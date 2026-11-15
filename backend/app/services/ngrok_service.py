from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


NGROK_API_PORTS = (4040, 4041, 4042)
FRONTEND_PORT = 5173
MANAGED_ENV_START = "# >>> Corphia ngrok runtime (auto-generated)"
MANAGED_ENV_END = "# <<< Corphia ngrok runtime"


def project_root() -> Path:
    return Path(__file__).resolve().parents[3]


@dataclass
class NgrokState:
    active: bool
    url: str | None = None
    api_url: str | None = None
    ws_url: str | None = None
    api_port: int | None = None
    updated_at: str | None = None
    source: str = "live"

    @classmethod
    def inactive(cls, source: str = "live") -> "NgrokState":
        return cls(
            active=False,
            url=None,
            api_url=None,
            ws_url=None,
            api_port=None,
            updated_at=_now_iso(),
            source=source,
        )

    @classmethod
    def from_url(cls, url: str, api_port: int | None, source: str = "live") -> "NgrokState":
        return cls(
            active=True,
            url=url,
            api_url=f"{url}/api/v1/",
            ws_url=url.replace("https://", "wss://").replace("http://", "ws://") + "/ws/",
            api_port=api_port,
            updated_at=_now_iso(),
            source=source,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "active": self.active,
            "url": self.url,
            "api_url": self.api_url,
            "ws_url": self.ws_url,
            "api_port": self.api_port,
            "updated_at": self.updated_at,
            "source": self.source,
        }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _runtime_dir(root_dir: Path | None = None) -> Path:
    return (root_dir or project_root()) / ".runtime"


def _runtime_json_path(root_dir: Path | None = None) -> Path:
    return _runtime_dir(root_dir) / "ngrok.json"


def _runtime_env_path(root_dir: Path | None = None) -> Path:
    return _runtime_dir(root_dir) / "ngrok.env"


def _frontend_env_local_path(root_dir: Path | None = None) -> Path:
    return (root_dir or project_root()) / "frontend" / ".env.local"


def find_ngrok_binary(base_dir: str | os.PathLike[str] | None = None) -> str | None:
    root_dir = Path(base_dir) if base_dir else project_root()
    candidates = [
        Path(r"C:\ngrok\ngrok.exe"),
        root_dir / "ngrok.exe",
        Path(os.environ.get("USERPROFILE", "")) / "ngrok.exe",
        Path(r"C:\Windows\System32\ngrok.exe"),
    ]

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)

    ngrok_in_path = shutil.which("ngrok")
    if ngrok_in_path and "WindowsApps" not in ngrok_in_path and "msix" not in ngrok_in_path.lower():
        return ngrok_in_path

    return None


def query_ngrok_state(
    api_ports: tuple[int, ...] = NGROK_API_PORTS,
    frontend_port: int | None = FRONTEND_PORT,
) -> NgrokState:
    for api_port in api_ports:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{api_port}/api/tunnels", timeout=2) as response:
                data = json.loads(response.read())

            tunnels = _prefer_port(data.get("tunnels", []), frontend_port)
            https_url = _pick_public_url(tunnels, preferred_scheme="https://")
            if https_url:
                return NgrokState.from_url(https_url, api_port, source="live")

            http_url = _pick_public_url(tunnels, preferred_scheme="http://")
            if http_url:
                return NgrokState.from_url(http_url, api_port, source="live")
        except Exception:
            continue

    return NgrokState.inactive()


def _prefer_port(tunnels: list[dict[str, Any]], frontend_port: int | None) -> list[dict[str, Any]]:
    if frontend_port is None:
        return tunnels

    port = str(frontend_port)
    matching: list[dict[str, Any]] = []
    rest: list[dict[str, Any]] = []
    for tunnel in tunnels:
        addr = str(tunnel.get("config", {}).get("addr", ""))
        if addr.endswith(f":{port}") or f":{port}/" in addr:
            matching.append(tunnel)
        else:
            rest.append(tunnel)
    return matching + rest


def _pick_public_url(tunnels: list[dict[str, Any]], preferred_scheme: str) -> str | None:
    for tunnel in tunnels:
        public_url = tunnel.get("public_url")
        if isinstance(public_url, str) and public_url.startswith(preferred_scheme):
            return public_url.rstrip("/")
    return None


def write_ngrok_runtime(state: NgrokState, root_dir: Path | None = None) -> None:
    root = root_dir or project_root()
    runtime_dir = _runtime_dir(root)
    runtime_dir.mkdir(parents=True, exist_ok=True)

    payload = state.to_dict()
    _runtime_json_path(root).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    _runtime_env_path(root).write_text(_render_runtime_env(state), encoding="utf-8")
    _update_frontend_env_local(root, state)


def _render_runtime_env(state: NgrokState) -> str:
    values = {
        "NGROK_ACTIVE": "true" if state.active else "false",
        "NGROK_PUBLIC_URL": state.url or "",
        "NGROK_API_URL": state.api_url or "",
        "NGROK_WS_URL": state.ws_url or "",
        "NGROK_UPDATED_AT": state.updated_at or "",
        "VITE_PUBLIC_BASE_URL": state.url or "",
        "VITE_API_BASE_URL": "/api/v1",
        "VITE_WS_URL": "/ws",
    }
    return "\n".join(f"{key}={value}" for key, value in values.items()) + "\n"


def _update_frontend_env_local(root_dir: Path, state: NgrokState) -> None:
    """
    清理 frontend/.env.local 中由 ngrok 管控的區塊。

    FIX (循環閃退 bug)：
    原本這裡會寫 `VITE_PUBLIC_BASE_URL={state.url}` 這個「動態值」進 .env.local。
    每次 ngrok start/stop 因為 URL 改變 → .env.local 內容變了 → Vite 偵測到 →
    重啟 dev server。Windows 上 npm.cmd 處理 Vite 連續重啟特別脆弱：cmd.exe
    跳「要終止批次工作 (Y/N)?」+ npm.cmd 退出 → start.py watchdog 把它當 crash →
    整包重啟 → 又跑這流程 → 死循環。

    解法：完全不再寫 .env.local。
    - VITE_PUBLIC_BASE_URL：grep 過 frontend src 完全沒人用，純噪音
    - VITE_WS_URL：同上沒人用
    - VITE_API_BASE_URL=/api/v1：是常數，setup 時放 .env 即可，不需要動態管
    - 公開 URL 給前端用：透過 /system/ngrok API 即時取，frontend AdminPage 已經這樣做

    這個函式現在只做「把舊版可能寫入的 ngrok-managed block 移除」，讓現有
    .env.local 回到乾淨狀態。後續 toggle 不再 touch 此檔 → Vite 不再被觸發 →
    閃退循環解除。
    """
    # state 參數保留：未來若要改成「只在重要狀態變化時動作」可用，目前不使用
    _ = state
    path = _frontend_env_local_path(root_dir)
    if not path.exists():
        return

    existing = path.read_text(encoding="utf-8")
    if MANAGED_ENV_START not in existing:
        return

    # 把舊 ngrok-managed block 整段移除
    before = existing.split(MANAGED_ENV_START, 1)[0].rstrip()
    after = ""
    if MANAGED_ENV_END in existing:
        after = existing.split(MANAGED_ENV_END, 1)[1].lstrip()

    next_content = "\n\n".join(part for part in [before, after.rstrip()] if part)
    if next_content:
        next_content += "\n"

    if next_content != existing:
        path.write_text(next_content, encoding="utf-8")


def stop_ngrok_processes() -> None:
    # 固定的指令清單、不經過 shell
    if sys.platform == "win32":
        subprocess.run(["taskkill", "/F", "/IM", "ngrok.exe"], capture_output=True, check=False)
    else:
        # macOS / Linux：用 pkill 試一下，沒裝 pkill 也不爆炸
        try:
            subprocess.run(["pkill", "-f", "ngrok"], capture_output=True, check=False)
        except FileNotFoundError:
            pass

