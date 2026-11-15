"""
本機推論引擎：llama.cpp 官方 llama-server（Vulkan 版，用內建顯示晶片）

為什麼換：同一台筆電、同一個 7B 模型，讀入 742 tok/s（原本的 llama-cpp-python 純 CPU 9.6）、打字 16（原本 9.4）。
讀文件、讀資料夾、用工具都卡在「讀入」，所以這個引擎是後面功能的地基。

做法：
  - 每個模型一個 llama-server 子行程（只聽 127.0.0.1，隨機空埠），用它的 OpenAI 相容 API；
    提示詞格式用模型自己帶的樣板（--jinja），所以換模型（Qwen、Breeze、gpt-oss）不用改提示詞程式
  - 同時留在記憶體的模型有上限（llm_engine_max_loaded）；超過就關掉最久沒用的（系統預設模型不關）
  - 每個行程啟動時產生一把隨機金鑰（--api-key-file，放在使用者自己的暫存資料夾，引擎讀完就刪）：雖然只聽 127.0.0.1，
    同一台電腦上的其他帳號、其他程式沒有金鑰就不能直接問模型（繞過後端的資安檢查與稽核）
  - 一次只啟動一個（啟動時要讀好幾 GB，同時啟動會互搶）
  - 後端關閉時全部關掉；後端被強制結束時留下的孤兒，下次啟動會清掉（看 --alias 標記＋父行程已不在）
  - 找不到引擎執行檔時 available() 回 False，llm_service 會退回原本的 llama-cpp-python

這個模組只管「行程」；怎麼問模型在 llm_service。
"""

from __future__ import annotations

import atexit
import logging
import secrets
import socket
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[3]
# 行程標記：清孤兒、一鍵關閉（stop.py）都靠它認出「這是後端開的引擎」
ENGINE_ALIAS = "corphia-engine"
HEALTH_POLL_SEC = 0.5
STOP_WAIT_SEC = 8


def find_projector(model_path: str) -> str | None:
    """
    這個模型的影像轉接檔（看圖片用）：和模型同一個資料夾、檔名 mmproj 開頭的 .gguf。沒有回 None（一般的文字模型）。
    只在「圖文模型專用的資料夾」找——那個資料夾裡除了轉接檔只有一個模型，不會配錯。
    """
    folder = Path(model_path).parent
    projectors = sorted(folder.glob("mmproj*.gguf"))
    return str(projectors[0]) if projectors and Path(model_path).name != projectors[0].name else None


@dataclass
class EngineModel:
    """一個已啟動的模型（llama-server 行程）"""

    path: str
    port: int
    proc: subprocess.Popen
    log_path: Path
    api_key: str = ""
    pinned: bool = False
    last_used: float = field(default_factory=time.time)

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    @property
    def headers(self) -> dict:
        """問模型時要帶的金鑰"""
        return {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}

    def alive(self) -> bool:
        return self.proc.poll() is None


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class LlamaEngine:
    def __init__(self) -> None:
        self._models: dict[str, EngineModel] = {}
        self._start_lock = threading.Lock()  # 一次只啟動一個
        self._guard = threading.Lock()  # 保護 _models
        self._swept = False

    # ── 執行檔 ────────────────────────────────────────────────────────────
    @staticmethod
    def exe() -> Path:
        p = Path(settings.llm_engine_path)
        return p if p.is_absolute() else (REPO_ROOT / p)

    def available(self) -> bool:
        return self.exe().is_file()

    # ── 查詢 ──────────────────────────────────────────────────────────────
    def get(self, model_path: str) -> Optional[EngineModel]:
        with self._guard:
            m = self._models.get(model_path)
        return m if m and m.alive() else None

    def loaded_paths(self) -> list[str]:
        with self._guard:
            return [p for p, m in self._models.items() if m.alive()]

    # ── 啟動 ──────────────────────────────────────────────────────────────
    def ensure(self, model_path: str, pinned: bool = False) -> tuple[EngineModel, list[str]]:
        """
        確保這個模型已經啟動（會等到它可以回答為止；要放在執行緒裡呼叫）。
        回傳（模型, 為了騰出記憶體而關掉的模型路徑）。
        """
        with self._start_lock:
            if not self._swept:
                self._swept = True
                self._sweep_orphans()
            m = self.get(model_path)
            if m:
                m.last_used = time.time()
                m.pinned = m.pinned or pinned
                return m, []
            evicted = self._make_room(keep=model_path)
            m = self._start(model_path, pinned)
            with self._guard:
                self._models[model_path] = m
            return m, evicted

    def _make_room(self, keep: str) -> list[str]:
        """超過上限：關掉最久沒用、不是系統預設的模型"""
        cap = max(1, settings.llm_engine_max_loaded)
        evicted: list[str] = []
        while True:
            with self._guard:
                # 已經死掉的先清掉
                for p in [p for p, m in self._models.items() if not m.alive()]:
                    self._models.pop(p, None)
                alive = list(self._models.values())
            if len(alive) < cap:
                return evicted
            victims = sorted((m for m in alive if not m.pinned and m.path != keep), key=lambda m: m.last_used)
            if not victims:
                return evicted  # 全部都不能關：寧可多佔記憶體，也不要把系統預設模型關掉
            self.stop(victims[0].path)
            evicted.append(victims[0].path)

    def _start(self, model_path: str, pinned: bool) -> EngineModel:
        port = _free_port()
        log_dir = Path(tempfile.gettempdir()) / "corphia-engine"
        log_dir.mkdir(parents=True, exist_ok=True)
        log_path = log_dir / f"{Path(model_path).stem}.log"
        # 金鑰寫在檔案裡交給引擎（不放在命令列，才不會出現在行程清單和記錄裡）
        api_key = secrets.token_urlsafe(32)
        # 檔名帶埠號：同一台電腦上兩個後端同時載入同一個模型時，不會互相蓋掉對方的金鑰檔
        key_path = log_dir / f"{Path(model_path).stem}-{port}.key"
        key_path.write_text(api_key, encoding="ascii")
        cmd = [
            str(self.exe()), "-m", model_path,
            "-ngl", str(settings.llm_engine_gpu_layers),
            "-c", str(settings.llm_engine_context),
            "--jinja", "-fa", "auto", "--reasoning-format", "auto",
            "--host", "127.0.0.1", "--port", str(port),
            "--alias", ENGINE_ALIAS, "--no-webui", "--api-key-file", str(key_path),
        ]
        # 圖文模型：同一個資料夾裡有影像轉接檔（mmproj）就一起載入，模型才看得懂圖片
        projector = find_projector(model_path)
        if projector:
            cmd += ["--mmproj", projector]
        logger.info("啟動推論引擎：%s（埠 %s）", Path(model_path).name, port)
        log = log_path.open("w", encoding="utf-8", errors="replace")
        proc = subprocess.Popen(
            cmd, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
            cwd=str(self.exe().parent), creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        log.close()  # 子行程自己握著檔案
        m = EngineModel(path=model_path, port=port, proc=proc, log_path=log_path, api_key=api_key, pinned=pinned)
        try:
            deadline = time.time() + settings.llm_engine_load_timeout
            while time.time() < deadline:
                if not m.alive():
                    raise RuntimeError(f"推論引擎啟動失敗（結束代碼 {proc.returncode}）：{self._log_tail(log_path)}")
                try:
                    if httpx.get(f"{m.base_url}/health", timeout=2.0).status_code == 200:
                        logger.info("推論引擎就緒：%s", Path(model_path).name)
                        return m
                except httpx.HTTPError:
                    pass  # 還在載入
                time.sleep(HEALTH_POLL_SEC)
            self._kill(proc)
            raise RuntimeError(f"推論引擎載入逾時（{settings.llm_engine_load_timeout} 秒）：{Path(model_path).name}")
        finally:
            # 引擎只在啟動時讀一次金鑰檔：就緒、失敗、逾時都馬上刪掉，金鑰之後只留在後端的記憶體裡
            try:
                key_path.unlink(missing_ok=True)
            except OSError:
                pass

    @staticmethod
    def _log_tail(log_path: Path, chars: int = 300) -> str:
        try:
            return log_path.read_text(encoding="utf-8", errors="replace")[-chars:].strip()
        except OSError:
            return ""

    # ── 關閉 ──────────────────────────────────────────────────────────────
    @staticmethod
    def _kill(proc: subprocess.Popen) -> None:
        if proc.poll() is not None:
            return
        proc.terminate()
        try:
            proc.wait(timeout=STOP_WAIT_SEC)
        except subprocess.TimeoutExpired:
            proc.kill()

    def _retire(self, m: EngineModel) -> None:
        """關掉行程（金鑰檔在啟動完成時就刪了，金鑰只在記憶體裡，行程關掉就跟著消失）"""
        self._kill(m.proc)

    def stop(self, model_path: str) -> None:
        with self._guard:
            m = self._models.pop(model_path, None)
        if m:
            logger.info("關閉推論引擎：%s", Path(model_path).name)
            self._retire(m)

    def stop_all(self) -> None:
        with self._guard:
            models, self._models = list(self._models.values()), {}
        for m in models:
            self._retire(m)

    def _sweep_orphans(self) -> None:
        """上次後端被強制結束時留下的引擎（父行程已經不在）：關掉，不然一直佔著好幾 GB 記憶體"""
        try:
            import psutil
        except ImportError:
            return
        for p in psutil.process_iter(["name", "cmdline", "ppid", "create_time"]):
            try:
                if "llama-server" not in (p.info["name"] or "").lower() or ENGINE_ALIAS not in (p.info["cmdline"] or []):
                    continue
                parent = psutil.Process(p.info["ppid"]) if psutil.pid_exists(p.info["ppid"]) else None
                # 父行程編號被別的新行程拿去用也算孤兒（新行程比它晚出生）
                if parent is None or parent.create_time() > p.info["create_time"]:
                    logger.warning("清掉上次留下的推論引擎行程 %s", p.pid)
                    p.kill()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue


_engine: Optional[LlamaEngine] = None


def get_engine() -> LlamaEngine:
    global _engine
    if _engine is None:
        _engine = LlamaEngine()
        atexit.register(_engine.stop_all)
    return _engine
