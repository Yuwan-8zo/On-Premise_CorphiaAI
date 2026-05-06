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
        """重新初始化以重新掛載 GGUF 模型。"""
        self._initialized = False
        if self._llama_instance is not None:
            del self._llama_instance
            self._llama_instance = None
        self.use_llama_cpp = False

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
                def _load_model():
                    return Llama(
                        model_path=model_path,
                        n_gpu_layers=settings.llama_n_gpu_layers,
                        n_ctx=settings.llama_context_size,
                        verbose=False,
                    )

                self._llama_instance = await asyncio.to_thread(_load_model)
                self.use_llama_cpp = True
                self.model = model_path
                logger.info(f"✅ 成功掛載 GGUF 模型: {model_path}")
            except Exception as llama_e:
                logger.error(f"掛載 GGUF 模型失敗: {llama_e}")
                logger.info("系統將以模擬模式運行")

        self._initialized = True
        return True

    async def generate(
        self,
        prompt: str,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stop: Optional[list[str]] = None,
    ) -> str:
        """生成回應（非串流）。"""
        if not self._initialized:
            await self.initialize()

        # 安全 clamp 參數，避免外部傳超範圍值打爆 llama.cpp 或 OOM
        temperature = _clamp(temperature, 0.0, 2.0, 0.7)
        top_p = _clamp(top_p, 0.01, 1.0, 0.9)
        max_tokens = _safe_max_tokens(max_tokens, len(prompt or ""))

        if self.use_llama_cpp and self._llama_instance:
            return await self._llama_generate(prompt, max_tokens, temperature, top_p, stop)
        return self._simulate_response(prompt)

    async def generate_stream(
        self,
        prompt: str,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stop: Optional[list[str]] = None,
    ) -> AsyncGenerator[str, None]:
        """
        串流生成回應。

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

        if self.use_llama_cpp and self._llama_instance:
            async for chunk in self._llama_generate_stream(prompt, max_tokens, temperature, top_p, stop):
                yield chunk
            return

        async for chunk in self._simulate_stream(prompt):
            yield chunk

    async def generate_structured(
        self,
        prompt: str,
        schema_dict: dict,
        max_tokens: int = 1024,
        temperature: float = 0.1,
        top_p: float = 0.9,
    ) -> dict:
        """生成結構化 JSON 回應。"""
        if not self._initialized:
            await self.initialize()

        # 同樣 clamp 參數
        temperature = _clamp(temperature, 0.0, 2.0, 0.1)
        top_p = _clamp(top_p, 0.01, 1.0, 0.9)
        max_tokens = _safe_max_tokens(max_tokens, len(prompt or ""))

        if self.use_llama_cpp and self._llama_instance:
            return await self._llama_generate_structured(
                prompt, schema_dict, max_tokens, temperature, top_p
            )

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

    async def _llama_generate(self, prompt, max_tokens, temperature, top_p, stop):
        start = time.perf_counter()

        def _run():
            return self._llama_instance(
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

    async def _llama_generate_stream(self, prompt, max_tokens, temperature, top_p, stop):
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
        start = time.perf_counter()
        token_count = 0
        # 用 maxsize 限制 queue 大小：thread 比 consumer 快太多時會 backpressure，
        # 避免使用者連按 10 次造成 memory unbounded growth
        q: queue.Queue = queue.Queue(maxsize=64)
        stop_event = threading.Event()

        def _run_llama():
            try:
                stream = self._llama_instance(
                    prompt=prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    stop=stop or [],
                    stream=True,
                )
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
            elapsed = time.perf_counter() - start
            self.record_generation(token_count, elapsed)

    async def _llama_generate_structured(self, prompt, schema_dict, max_tokens, temperature, top_p):
        start = time.perf_counter()
        schema_json = json.dumps(schema_dict, ensure_ascii=False)
        augmented_prompt = (
            prompt
            + "\n\n請務必輸出符合以下 JSON Schema 的純 JSON 格式，不要包含任何其他文字：\n"
            + schema_json
            + "\n\n```json\n"
        )

        def _run():
            return self._llama_instance(
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

    def _simulate_response(self, prompt: str) -> str:
        return f"""這是一個模擬的 AI 回應。

您的問題是關於：「{prompt[:100]}...」

**注意**: 目前系統以模擬模式運行，因為 llama-cpp-python 尚未安裝，或 ai_model/ 中沒有可用的 GGUF 模型。

請確認：
1. `ai_model/` 內有 `.gguf` 模型檔。
2. 後端環境已安裝 `llama-cpp-python`。
3. `backend/.env` 的 `LLAMA_N_GPU_LAYERS` 與硬體設定相符。

---

### Corphia AI Platform v2.3

本系統支援以下功能：
- 智慧對話
- RAG 知識問答
- 多租戶管理
- 三層權限控制
"""

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
