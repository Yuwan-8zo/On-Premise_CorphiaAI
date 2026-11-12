"""
LLM 服務模組

使用本機 GGUF 模型與 llama.cpp 進行推論；不依賴 Ollama。
"""

import asyncio
import json
import logging
import queue
import re
import threading
import time
from collections import deque
from typing import Any, AsyncGenerator, Optional

try:
    from llama_cpp import Llama
    LLAMA_CPP_AVAILABLE = True
except ImportError:
    LLAMA_CPP_AVAILABLE = False

from app.core.config import settings
from app.services.model_manager import get_model_manager

logger = logging.getLogger(__name__)

# 全域 LLM 實例
_llm_instance = None


# ChatML 控制 token：使用者輸入若包含這些字串，會混淆 prompt 結構
# 必須在拼進 build_chat_prompt 之前移除/替換
_CHATML_TOKEN_RE = re.compile(r"<\|im_(?:start|end)\|>")


def _sanitize_chatml_content(content: str) -> str:
    """
    防止使用者透過注入 <|im_end|> + <|im_start|>system\n... 改寫系統提示。

    替換成全形版本既保留語意可讀性、又解除控制功能。
    """
    if not isinstance(content, str):
        return ""
    return _CHATML_TOKEN_RE.sub("[blocked-chatml-token]", content)


def _clamp(value: float, lo: float, hi: float, default: float) -> float:
    """安全 clamp：值不在範圍內或非數字時回傳 default。"""
    try:
        v = float(value)
    except (TypeError, ValueError):
        return default
    if v != v:  # NaN
        return default
    return max(lo, min(hi, v))


def _safe_max_tokens(max_tokens: int, prompt_len_chars: int) -> int:
    """
    把 max_tokens clamp 到合理範圍，並依照 prompt 長度動態壓縮上限。

    粗估法則：1 token ≈ 1.5 字元（中文較密集，英文較鬆，這是個保守估算）。
    保留 256 token 給回應的 headroom，避免 prompt 已經吃光 context window 才生成。
    """
    try:
        v = int(max_tokens)
    except (TypeError, ValueError):
        v = 2048
    v = max(1, min(v, 8192))  # 絕對上下界

    # 動態上限：context_size - 估算的 prompt token 數 - 256 安全 headroom
    estimated_prompt_tokens = max(1, prompt_len_chars // 1)  # 偏保守，每字元當 1 token
    headroom = max(64, settings.llama_context_size - estimated_prompt_tokens - 256)
    return min(v, headroom)


class LLMService:
    """本機 GGUF 推論服務。"""

    def __init__(self):
        self.model = "local-gguf"
        self._initialized = False

        # 保留 client 屬性讓既有監控/關閉流程相容；本機 GGUF 模式不使用 HTTP client。
        self.client: Optional[Any] = None

        self.use_llama_cpp = False
        self._llama_instance = None

        # Loaded models stay in memory (path -> Llama) so switching is instant.
        self._cache: dict[str, Any] = {}
        # Per-model load status for the boot screen: name -> {state, started_at, finished_at, error}
        self._model_status: dict[str, dict] = {}

        # ── C4: tokens/sec 即時統計 ─────────────────────────
        # 保留最近 10 次生成的 (tokens, elapsed_sec)，用於 /system/health/detailed
        self._recent_runs: deque[tuple[int, float]] = deque(maxlen=10)
        self._last_tokens_per_sec: float = 0.0
        self._total_tokens_generated: int = 0
        self._total_generations: int = 0

    def record_generation(self, tokens: int, elapsed_sec: float) -> None:
        """登記一次完成的生成，讓監控面板能讀到 tokens/sec。"""
        if elapsed_sec <= 0 or tokens <= 0:
            return
        self._recent_runs.append((tokens, elapsed_sec))
        self._last_tokens_per_sec = round(tokens / elapsed_sec, 2)
        self._total_tokens_generated += tokens
        self._total_generations += 1

    def get_throughput_stats(self) -> dict:
        """回傳 tokens/sec 統計。供 /system/health/detailed 使用。"""
        if not self._recent_runs:
            return {
                "last_tokens_per_sec": 0.0,
                "avg_tokens_per_sec": 0.0,
                "total_generations": self._total_generations,
                "total_tokens_generated": self._total_tokens_generated,
                "sample_size": 0,
            }

        total_tokens = sum(t for t, _ in self._recent_runs)
        total_elapsed = sum(e for _, e in self._recent_runs)
        avg = round(total_tokens / total_elapsed, 2) if total_elapsed > 0 else 0.0
        return {
            "last_tokens_per_sec": self._last_tokens_per_sec,
            "avg_tokens_per_sec": avg,
            "total_generations": self._total_generations,
            "total_tokens_generated": self._total_tokens_generated,
            "sample_size": len(self._recent_runs),
        }

    def reload_llama(self) -> None:
        """重新初始化以切換 GGUF 模型（已載入過的模型保留在快取，切換時直接使用）。"""
        self._initialized = False
        self._llama_instance = None
        self.use_llama_cpp = False

    # ── multi-model loading ───────────────────────────────────────────────
    def _set_model_status(self, name: str, state: str, error: str = "") -> None:
        now = time.time()
        st = self._model_status.setdefault(name, {"state": "pending", "started_at": None, "finished_at": None, "error": ""})
        if state == "loading" and st["started_at"] is None:
            st["started_at"] = now
        if state in ("ready", "error"):
            st["started_at"] = st["started_at"] or now
            st["finished_at"] = now
        st["state"] = state
        st["error"] = error

    # 同一個 llama.cpp 模型物件不能同時跑兩個生成，否則 ggml.dll 會直接當掉（0xc0000005）。
    # 例如前一題還在生成時又送出下一題、或關掉分頁後重開再問。每個模型一把鎖，後來的排隊等。
    _gen_locks: dict = {}
    _gen_locks_guard = threading.Lock()

    @classmethod
    def _lock_for(cls, inst) -> threading.Lock:
        with cls._gen_locks_guard:
            lock = cls._gen_locks.get(id(inst))
            if lock is None:
                lock = cls._gen_locks[id(inst)] = threading.Lock()
            return lock

    @staticmethod
    def _load_path(model_path: str):
        import os
        # Leave two cores free so the API stays responsive while the model is busy.
        threads = settings.llama_n_threads or max(2, (os.cpu_count() or 4) - 2)
        llm = Llama(
            model_path=model_path,
            n_gpu_layers=settings.llama_n_gpu_layers,
            n_ctx=settings.llama_context_size,
            n_threads=threads,
            n_threads_batch=threads,
            verbose=False,
        )
        # One tiny inference pages the weights into memory, so the first real
        # question is not slowed down by disk reads.
        try:
            llm(prompt="hi", max_tokens=1, temperature=0.0)
        except Exception:
            pass
        return llm

    async def _ensure_loaded(self, name: str, model_path: str):
        inst = self._cache.get(model_path)
        if inst is not None:
            self._set_model_status(name, "ready")
            return inst
        self._set_model_status(name, "loading")
        try:
            inst = await asyncio.to_thread(self._load_path, model_path)
        except Exception as exc:
            self._set_model_status(name, "error", str(exc)[:200])
            raise
        self._cache[model_path] = inst
        self._set_model_status(name, "ready")
        return inst

    @staticmethod
    def _preload_tags() -> list[str]:
        return [t.strip().upper() for t in (settings.llm_preload_models or "").split(",") if t.strip()]

    def _is_preload_target(self, name: str) -> bool:
        up = name.upper()
        return any(f"-{tag}-" in f"-{up}-" or f"-{tag}-" in up for tag in self._preload_tags())

    async def preload_models(self) -> None:
        """Load the configured models (e.g. 3B,7B) in the background, one after another."""
        if not LLAMA_CPP_AVAILABLE:
            return
        manager = get_model_manager()
        for info in list(manager._models.values()):
            if not self._is_preload_target(info.name) or info.path in self._cache:
                continue
            try:
                logger.info(f"預先載入模型: {info.name}")
                await self._ensure_loaded(info.name, info.path)
                logger.info(f"預先載入完成: {info.name}")
            except Exception as exc:
                logger.error(f"預先載入失敗 {info.name}: {exc}")

    def get_model_states(self) -> list[dict]:
        """Status of every model in ai_model/ for the boot screen."""
        manager = get_model_manager()
        current = manager._current_model
        out = []
        for info in manager._models.values():
            st = self._model_status.get(info.name)
            if st:
                state = st["state"]
            elif info.path in self._cache:
                state = "ready"
            elif info.name == current or self._is_preload_target(info.name):
                state = "pending"
            else:
                state = "not_preloaded"
            out.append({
                "name": info.name,
                "size_gb": round(info.size_gb, 2),
                "state": state,
                "is_current": info.name == current,
                "started_at": st["started_at"] if st else None,
                "finished_at": st["finished_at"] if st else None,
                "error": st["error"] if st else "",
            })
        return out

    async def initialize(self) -> bool:
        """初始化本機 GGUF 模型。"""
        if self._initialized:
            return True

        self.client = None
        manager = get_model_manager()
        model_path = manager.current_model_path

        if not LLAMA_CPP_AVAILABLE:
            logger.warning("未安裝 llama-cpp-python，系統將以模擬模式運行")
        elif not model_path:
            logger.warning("找不到 GGUF 模型，請將 .gguf 放在 ai_model/，系統將以模擬模式運行")
        else:
            logger.info(f"準備掛載 GGUF 模型: {model_path}")
            try:
                self._llama_instance = await self._ensure_loaded(manager._current_model or model_path, model_path)
                self.use_llama_cpp = True
                self.model = model_path
                logger.info(f"成功掛載 GGUF 模型: {model_path}")
            except Exception as llama_e:
                logger.error(f"掛載 GGUF 模型失敗: {llama_e}")
                logger.info("系統將以模擬模式運行")

        self._initialized = True
        return True

    async def _instance_for(self, model_name: Optional[str]):
        """
        這次生成要用的模型：指定的模型（還沒載入就先載入，之後留在記憶體）；
        沒指定、找不到或載入失敗就用系統預設。回 None ＝ 沒有可用的真實模型（走模擬模式）。
        """
        if not (self.use_llama_cpp and self._llama_instance):
            return None
        if model_name:
            info = get_model_manager().get_model(model_name)
            if info is not None and info.path != self.model:
                try:
                    return await self._ensure_loaded(info.name, info.path)
                except Exception as exc:
                    logger.error(f"載入使用者選的模型失敗，改用系統預設 {model_name}: {exc}")
        return self._llama_instance

    async def generate(
        self,
        prompt: str,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stop: Optional[list[str]] = None,
        model_name: Optional[str] = None,
    ) -> str:
        """生成回應（非串流）。model_name：用哪個模型（每個人自己選的；沒給用系統預設）"""
        if not self._initialized:
            await self.initialize()

        # 安全 clamp 參數，避免外部傳超範圍值打爆 llama.cpp 或 OOM
        temperature = _clamp(temperature, 0.0, 2.0, 0.7)
        top_p = _clamp(top_p, 0.01, 1.0, 0.9)
        max_tokens = _safe_max_tokens(max_tokens, len(prompt or ""))

        inst = await self._instance_for(model_name)
        if inst is not None:
            return await self._llama_generate(prompt, max_tokens, temperature, top_p, stop, inst=inst)
        self._require_real_model()
        return self._simulate_response(prompt)

    async def generate_stream(
        self,
        prompt: str,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stop: Optional[list[str]] = None,
        model_name: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """
        串流生成回應。model_name：用哪個模型（每個人自己選的；沒給用系統預設）

        重要：呼叫端應在 task cancel / 客戶端斷線時 break out of the async for，
        本 generator 偵測到 GeneratorExit / CancelledError 時會設 stop_event，
        讓底層 llama.cpp 推論執行緒在下一個 token 結束後提前停止，
        避免「使用者按停止但 GPU 仍跑完 max_tokens」的 GPU 浪費。
        """
        if not self._initialized:
            await self.initialize()

        temperature = _clamp(temperature, 0.0, 2.0, 0.7)
        top_p = _clamp(top_p, 0.01, 1.0, 0.9)
        max_tokens = _safe_max_tokens(max_tokens, len(prompt or ""))

        inst = await self._instance_for(model_name)
        if inst is not None:
            async for chunk in self._llama_generate_stream(prompt, max_tokens, temperature, top_p, stop, inst=inst):
                yield chunk
            return

        self._require_real_model()
        async for chunk in self._simulate_stream(prompt):
            yield chunk

    async def generate_structured(
        self,
        prompt: str,
        schema_dict: dict,
        max_tokens: int = 1024,
        temperature: float = 0.1,
        top_p: float = 0.9,
        model_name: Optional[str] = None,
    ) -> dict:
        """生成結構化 JSON 回應。model_name：用哪個模型（沒給用系統預設）"""
        if not self._initialized:
            await self.initialize()

        # 同樣 clamp 參數
        temperature = _clamp(temperature, 0.0, 2.0, 0.1)
        top_p = _clamp(top_p, 0.01, 1.0, 0.9)
        max_tokens = _safe_max_tokens(max_tokens, len(prompt or ""))

        inst = await self._instance_for(model_name)
        if inst is not None:
            return await self._llama_generate_structured(
                prompt, schema_dict, max_tokens, temperature, top_p, inst=inst
            )

        self._require_real_model()
        try:
            properties = schema_dict.get("properties", {})
            simulated_result = {}
            for key, prop in properties.items():
                if prop.get("type") == "boolean":
                    simulated_result[key] = False
                elif prop.get("type") == "string":
                    simulated_result[key] = "simulated"
                else:
                    simulated_result[key] = None
            return simulated_result
        except Exception:
            return {}

    async def _llama_generate(self, prompt, max_tokens, temperature, top_p, stop, inst=None):
        start = time.perf_counter()

        inst = inst or self._llama_instance
        lock = self._lock_for(inst)

        def _run():
            with lock:
                return inst(
                    prompt=prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    stop=stop or [],
                    stream=False,
                )

        response = await asyncio.to_thread(_run)
        elapsed = time.perf_counter() - start

        text = response["choices"][0]["text"]
        token_count = response.get("usage", {}).get("completion_tokens", 0)
        self.record_generation(token_count, elapsed)
        return text

    async def _llama_generate_stream(self, prompt, max_tokens, temperature, top_p, stop, inst=None):
        """
        Llama 串流生成 + 中斷支援。

        架構：
          1) 把 llama.cpp 的同步 generator 跑在 daemon thread，把每個 chunk 丟進 queue
          2) async generator 從 queue 拉 chunk yield 給呼叫端
          3) 呼叫端 break / cancel / disconnect 時，async generator 進入 finally：
             - 設 stop_event（thread 下次迭代時偵測到並提前結束）
             - 把 queue 排空避免 thread 阻塞在 q.put()

        為什麼 daemon thread 不會「無限跑完 max_tokens」：
          - llama.cpp 的 stream iterator 每產一個 token 會回到 Python 層，
            這時 _run_llama 會檢查 stop_event；設了就 break 出迴圈
          - Worst case 是「再吐 1 個 token 才停」，不會跑完整個 max_tokens
        """
        token_count = 0
        first_token_at: Optional[float] = None
        # 用 maxsize 限制 queue 大小：thread 比 consumer 快太多時會 backpressure，
        # 避免使用者連按 10 次造成 memory unbounded growth
        q: queue.Queue = queue.Queue(maxsize=64)
        stop_event = threading.Event()

        inst = inst or self._llama_instance
        lock = self._lock_for(inst)

        def _run_llama():
            try:
                with lock:
                    if stop_event.is_set():
                        # 排隊期間使用者已離開，不必再生成
                        return
                    _stream_into_queue(inst(
                        prompt=prompt,
                        max_tokens=max_tokens,
                        temperature=temperature,
                        top_p=top_p,
                        stop=stop or [],
                        stream=True,
                    ))
            except Exception as e:
                try:
                    q.put(e, timeout=1.0)
                except queue.Full:
                    pass
            finally:
                # sentinel：告訴 consumer 沒了
                try:
                    q.put(None, timeout=1.0)
                except queue.Full:
                    pass

        def _stream_into_queue(stream):
            try:
                for chunk in stream:
                    if stop_event.is_set():
                        # 使用者中斷 → 提前結束，不再產 token
                        break
                    try:
                        # 用 timeout=1.0 + 退讓：consumer 可能已經斷線在排空 queue
                        # 沒 timeout 的話 q.put 在 consumer 死掉時會永遠 block
                        q.put(chunk, timeout=1.0)
                    except queue.Full:
                        # consumer 處理不及又設了 stop_event → 直接 break
                        if stop_event.is_set():
                            break
                        # 否則丟掉這個 chunk（罕見，q maxsize=64 應該夠）
            finally:
                # 在鎖還握著時把生成器關乾淨，下一題才不會跟它搶同一個模型
                close = getattr(stream, "close", None)
                if close:
                    close()

        thread = threading.Thread(target=_run_llama, daemon=True)
        thread.start()

        try:
            while True:
                chunk = await asyncio.to_thread(q.get)
                if chunk is None:
                    break
                if isinstance(chunk, Exception):
                    logger.error("Llama 串流生成失敗: %s", chunk, exc_info=chunk)
                    break

                text = chunk["choices"][0]["text"]
                if text:
                    token_count += 1
                    if token_count == 1:
                        # tokens/sec should measure generation only, not the time spent
                        # reading the prompt and documents before the first token
                        first_token_at = time.perf_counter()
                    yield text
        except (GeneratorExit, asyncio.CancelledError):
            # 呼叫端 break 或 task cancel → 通知 thread 停止
            logger.info("LLM 串流被外部中斷，發送停止訊號給 llama.cpp thread")
            stop_event.set()
            raise
        finally:
            # 確保 thread 一定會收到停止訊號，並排空 queue 讓它能 q.put 不卡死
            stop_event.set()
            # drain 殘留 chunks，避免 thread 在 q.put 阻塞
            try:
                while True:
                    q.get_nowait()
            except queue.Empty:
                pass
            if first_token_at is not None and token_count > 1:
                self.record_generation(token_count - 1, time.perf_counter() - first_token_at)

    async def _llama_generate_structured(self, prompt, schema_dict, max_tokens, temperature, top_p, inst=None):
        start = time.perf_counter()
        schema_json = json.dumps(schema_dict, ensure_ascii=False)
        augmented_prompt = (
            prompt
            + "\n\n請務必輸出符合以下 JSON Schema 的純 JSON 格式，不要包含任何其他文字：\n"
            + schema_json
            + "\n\n```json\n"
        )

        inst = inst or self._llama_instance
        lock = self._lock_for(inst)

        def _run():
            with lock:
                return inst(
                prompt=augmented_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                stop=["```"],
                stream=False,
            )

        response = await asyncio.to_thread(_run)
        text = response["choices"][0]["text"].strip()
        elapsed = time.perf_counter() - start
        token_count = response.get("usage", {}).get("completion_tokens", 0)
        self.record_generation(token_count, elapsed)

        try:
            return json.loads(text)
        except Exception:
            properties = schema_dict.get("properties", {})
            return {
                k: ("simulated" if prop.get("type") == "string" else False)
                for k, prop in properties.items()
            }

    def _require_real_model(self) -> None:
        """Refuse to answer with canned text unless explicitly allowed (dev/test only)."""
        if not settings.allow_simulated_llm:
            raise RuntimeError("AI 模型未載入：請確認 ai_model/ 內有 GGUF 模型並重新啟動系統。")

    def _simulate_response(self, prompt: str) -> str:
        # SECURITY/UX: 模擬模式不應回顯完整 prompt（可能含 system 指令、token 或敏感資訊）。
        safe_excerpt = (prompt or "").strip().replace("\n", " ")
        safe_excerpt = _sanitize_chatml_content(safe_excerpt)
        if len(safe_excerpt) > 140:
            safe_excerpt = safe_excerpt[:140] + "…"

        return (
            "這是一個模擬的 AI 回應。\n\n"
            f"收到的輸入摘要：「{safe_excerpt}」\n\n"
            "注意：目前系統以模擬模式運行，可能原因：\n"
            "1) llama-cpp-python 未成功載入\n"
            "2) ai_model/ 中沒有可用的 GGUF 模型\n"
            "3) GGUF 掛載失敗（例如記憶體不足）\n"
        )

    async def _simulate_stream(self, prompt: str) -> AsyncGenerator[str, None]:
        response = self._simulate_response(prompt)
        for char in response:
            yield char
            await asyncio.sleep(0.01)

    def build_chat_prompt(
        self,
        messages: list[dict],
        system_prompt: Optional[str] = None,
        context: Optional[str] = None,
    ) -> str:
        """
        建構 ChatML 格式對話 Prompt，供本機 GGUF 模型使用。

        SECURITY: 對 user/assistant content 做 ChatML token sanitize，
        防止使用者注入 `<|im_end|><|im_start|>system\\n...` 改寫系統提示。
        系統 prompt 跟 RAG context 由我們自己控制，不需要 sanitize。

        允許的 role 限制在 {user, assistant, system}，其他 role 會被忽略，
        避免攻擊者用 role="system" 注入指令。

        CONTEXT WINDOW 管理：
        - 估算每字元 ≈ 1 token（保守估算，實際中英混合會比這少）
        - 預留 reply_budget（預設 1024 token）給回應
        - 若 prompt 超過 (n_ctx - reply_budget)，從舊到新丟棄 user/assistant message
          直到符合預算為止（永遠保留 system + context + 最新一條 message）
        """
        ALLOWED_ROLES = {"user", "assistant", "system"}

        # ── 1) 組裝 system 區塊（永遠保留）
        sys_part = system_prompt or "你是一個有幫助的 AI 助手。"
        if context:
            # context 可能來自 RAG 檢索的文件，而文件內容可能含 ChatML token
            # （攻擊者上傳的「中毒」文件）→ 也要 sanitize
            sys_part += "\n\n### 參考資料\n" + _sanitize_chatml_content(context)
        system_block = f"<|im_start|>system\n{sys_part}<|im_end|>"

        # ── 2) 過濾 + sanitize 訊息（最後一條是這次的 user query，必須保留）
        clean_msgs: list[tuple[str, str]] = []
        for msg in messages:
            role = msg.get("role", "")
            content = msg.get("content", "")
            if role not in ALLOWED_ROLES:
                logger.warning("build_chat_prompt: 忽略未知 role: %s", role)
                continue
            clean_msgs.append((role, _sanitize_chatml_content(content)))

        # ── 3) 從舊到新丟訊息直到 prompt 符合 budget
        # 1 token ≈ 1 字元（保守上界），保留 1024 token 給 reply
        char_budget = max(512, settings.llama_context_size - 1024)
        # 把 char_budget 反推成「字元上限」：用 1 char/token 估算 → 直接拿 budget 當字元上限
        max_chars = char_budget

        def _build(msgs: list[tuple[str, str]]) -> str:
            parts = [system_block]
            for r, c in msgs:
                parts.append(f"<|im_start|>{r}\n{c}<|im_end|>")
            parts.append("<|im_start|>assistant\n")
            return "\n".join(parts)

        prompt = _build(clean_msgs)
        # 從最舊的開始丟（保留最後一條 — 那是這次 query），直到符合上限
        while len(prompt) > max_chars and len(clean_msgs) > 1:
            clean_msgs.pop(0)
            prompt = _build(clean_msgs)

        # 若連最後一條都超過 → 截斷該條 content（保留前後各半，中間用 [...] 替代）
        if len(prompt) > max_chars and clean_msgs:
            r, c = clean_msgs[-1]
            overflow = len(prompt) - max_chars + 32  # +32 緩衝
            if len(c) > overflow + 200:
                head = c[: (len(c) - overflow) // 2]
                tail = c[-((len(c) - overflow) // 2):]
                clean_msgs[-1] = (r, f"{head}\n[...content truncated due to context limit...]\n{tail}")
                prompt = _build(clean_msgs)
                logger.warning(
                    "build_chat_prompt: 最後一條訊息過長，已截斷 (原 %d 字 → 截後 %d 字)",
                    len(c), len(clean_msgs[-1][1]),
                )

        return prompt


def get_llm_service() -> LLMService:
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = LLMService()
    return _llm_instance
