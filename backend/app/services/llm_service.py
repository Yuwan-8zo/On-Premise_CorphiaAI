"""
LLM 服務模組

使用 llama.cpp 進行本地模型推論
"""

import logging
from typing import AsyncGenerator, Optional
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

# 全域 LLM 實例
_llm_instance = None


class LLMService:
    """LLM 推論服務"""
    
    def __init__(self):
        self.model = None
        self.model_path = settings.llama_model_path
        self.context_size = settings.llama_context_size
        self.n_gpu_layers = settings.llama_n_gpu_layers
        self._initialized = False

        # ── C4: tokens/sec 即時統計 ─────────────────────────
        # 保留最近 10 次生成的 (tokens, elapsed_sec)，用於 /system/health/detailed
        from collections import deque
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
    
    async def initialize(self) -> bool:
        """
        初始化 LLM 模型
        
        Returns:
            bool: 是否初始化成功
        """
        if self._initialized:
            return True
        
        # NOTE: 若 model_path 是相對路徑，則解析為相對於 backend/ 目錄的絕對路徑
        # 這樣不管從哪個 CWD 啟動，路徑都能正確解析
        raw_path = self.model_path
        if not Path(raw_path).is_absolute():
            # __file__ = backend/app/services/llm_service.py
            # parent.parent.parent = backend/
            backend_dir = Path(__file__).parent.parent.parent
            model_path = (backend_dir / raw_path).resolve()
        else:
            model_path = Path(raw_path)
        
        if not model_path.exists():
            logger.warning(f"LLM 模型檔案不存在: {model_path}")
            logger.info("系統將以模擬模式運行")
            self._initialized = True
            return True
        
        try:
            from llama_cpp import Llama
            
            logger.info(f"正在載入 LLM 模型: {model_path}")
            
            self.model = Llama(
                model_path=str(model_path),
                n_ctx=self.context_size,
                n_gpu_layers=self.n_gpu_layers,
                verbose=False,
            )
            
            self._initialized = True
            logger.info("✅ LLM 模型載入完成")
            return True
            
        except ImportError:
            logger.warning("llama-cpp-python 未安裝，系統將以模擬模式運行")
            self._initialized = True
            return True
        except Exception as e:
            logger.error(f"LLM 模型載入失敗: {e}")
            self._initialized = True
            return False
    
    async def generate(
        self,
        prompt: str,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stop: Optional[list[str]] = None,
    ) -> str:
        """
        生成回應（非串流）
        
        Args:
            prompt: 輸入提示
            max_tokens: 最大輸出 Token 數
            temperature: 溫度參數
            top_p: Top-p 取樣
            stop: 停止符號列表
            
        Returns:
            str: 生成的文字
        """
        if not self._initialized:
            await self.initialize()
        
        if self.model is None:
            # 模擬模式
            return self._simulate_response(prompt)
        
        try:
            import asyncio
            import time
            def _run():
                return self.model(
                    prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    stop=stop or [],
                    echo=False,
                )

            start = time.perf_counter()
            output = await asyncio.to_thread(_run)
            elapsed = time.perf_counter() - start

            # 嘗試從 usage 抓 token 數；llama-cpp 通常會回 completion_tokens
            tokens = 0
            try:
                usage = output.get("usage") or {}
                tokens = int(usage.get("completion_tokens") or 0)
            except Exception:
                tokens = 0
            if tokens <= 0:
                # 粗估：回傳文字長度除以 4（英文）或直接用字元數（中文）
                text = output["choices"][0].get("text", "") or ""
                tokens = max(1, len(text) // 3)
            self.record_generation(tokens, elapsed)

            return output["choices"][0]["text"]

        except Exception as e:
            logger.error(f"LLM 生成失敗: {e}")
            raise
    
    async def generate_stream(
        self,
        prompt: str,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stop: Optional[list[str]] = None,
    ) -> AsyncGenerator[str, None]:
        """
        串流生成回應
        
        Args:
            prompt: 輸入提示
            max_tokens: 最大輸出 Token 數
            temperature: 溫度參數
            top_p: Top-p 取樣
            stop: 停止符號列表
            
        Yields:
            str: 生成的文字片段
        """
        if not self._initialized:
            await self.initialize()
        
        if self.model is None:
            # 模擬模式
            async for chunk in self._simulate_stream(prompt):
                yield chunk
            return
        
        try:
            stream = self.model(
                prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                stop=stop or [],
                echo=False,
                stream=True,
            )

            import asyncio
            import time
            def get_next():
                try:
                    return next(stream)
                except StopIteration:
                    return None

            start = time.perf_counter()
            token_count = 0
            try:
                while True:
                    output = await asyncio.to_thread(get_next)
                    if output is None:
                        break
                    text = output["choices"][0]["text"]
                    if text:
                        token_count += 1  # 每個 chunk 估 1 token；雖不精準但趨勢正確
                        yield text
            finally:
                elapsed = time.perf_counter() - start
                if token_count > 0 and elapsed > 0:
                    self.record_generation(token_count, elapsed)

        except Exception as e:
            logger.error(f"LLM 串流生成失敗: {e}")
            raise
    
    async def generate_structured(
        self,
        prompt: str,
        schema_dict: dict,
        max_tokens: int = 1024,
        temperature: float = 0.1,
        top_p: float = 0.9,
    ) -> dict:
        """
        生成結構化 JSON 回應 (基於 Pydantic Schema 的 JSON Schema)
        
        Args:
            prompt: 輸入提示
            schema_dict: JSON Schema 定義字典
            max_tokens: 最大輸出 Token 數
            temperature: 溫度參數 (強制較低以求穩定)
            top_p: Top-p 取樣
            
        Returns:
            dict: 解析後的 JSON 資料
        """
        import json
        
        if not self._initialized:
            await self.initialize()
            
        if self.model is None:
            # 模擬模式：嘗試讀取 schema properties 給出基本的模擬回應
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

        try:
            import asyncio
            def _run():
                return self.model(
                    prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    echo=False,
                    response_format={
                        "type": "json_object",
                        "schema": schema_dict
                    }
                )
            
            output = await asyncio.to_thread(_run)
            
            result_str = output["choices"][0]["text"]
            return json.loads(result_str)
            
        except Exception as e:
            logger.error(f"LLM 結構化生成失敗: {e}")
            # 原本若無法解析，會引發錯誤。
            raise
    
    def _simulate_response(self, prompt: str) -> str:
        """模擬回應（無模型時使用）"""
        return f"""這是一個模擬的 AI 回應。

您的問題是關於：「{prompt[:100]}...」

**注意**: 目前系統以模擬模式運行，因為未載入 LLM 模型。

請將 GGUF 模型檔案放入 `ai_model/` 目錄，並更新 `.env` 中的 `LLAMA_MODEL_PATH` 設定。

---

### Corphia AI Platform v2.2

本系統支援以下功能：
- 🤖 智慧對話
- 📚 RAG 知識問答
- 🏢 多租戶管理
- 🔐 三層權限控制
"""
    
    async def _simulate_stream(self, prompt: str) -> AsyncGenerator[str, None]:
        """模擬串流回應（無模型時使用）"""
        import asyncio
        
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
        建構對話 Prompt
        
        Args:
            messages: 對話歷史 [{"role": "user/assistant", "content": "..."}]
            system_prompt: 系統提示
            context: RAG 上下文
            
        Returns:
            str: 格式化的 Prompt
        """
        # 使用 ChatML 格式
        prompt_parts = []
        
        # 系統提示
        if system_prompt or context:
            system_content = system_prompt or "你是一個有幫助的 AI 助手。"
            if context:
                system_content += f"\n\n### 參考資料\n{context}"
            prompt_parts.append(f"<|im_start|>system\n{system_content}<|im_end|>")
        
        # 對話歷史
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            prompt_parts.append(f"<|im_start|>{role}\n{content}<|im_end|>")
        
        # 助手回應開頭
        prompt_parts.append("<|im_start|>assistant\n")
        
        return "\n".join(prompt_parts)


def get_llm_service() -> LLMService:
    """取得 LLM 服務單例"""
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = LLMService()
    return _llm_instance
