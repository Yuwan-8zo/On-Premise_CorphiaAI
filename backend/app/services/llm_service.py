"""
LLM 服務模組

支援 Ollama 微服務架構與 llama.cpp (GGUF) 本地模型推論
"""

import logging
import json
import time
import httpx
import asyncio
from typing import AsyncGenerator, Optional
from collections import deque

from app.core.config import settings
from app.services.model_manager import get_model_manager

logger = logging.getLogger(__name__)

# 全域 LLM 實例
_llm_instance = None


class LLMService:
    """LLM 推論服務 (支援 Ollama 與 llama_cpp)"""
    
    def __init__(self):
        self.base_url = settings.ollama_base_url
        self._initialized_ollama = False
        
        # httpx client 會在 initialize 時建立
        self.client: Optional[httpx.AsyncClient] = None

        # llama_cpp 實例緩存
        self._llama_instance = None
        self._current_llama_path = None

        # ── C4: tokens/sec 即時統計 ─────────────────────────
        self._recent_runs: deque[tuple[int, float]] = deque(maxlen=10)
        self._last_tokens_per_sec: float = 0.0
        self._total_tokens_generated: int = 0
        self._total_generations: int = 0

    def record_generation(self, tokens: int, elapsed_sec: float) -> None:
        if elapsed_sec <= 0 or tokens <= 0:
            return
        self._recent_runs.append((tokens, elapsed_sec))
        self._last_tokens_per_sec = round(tokens / elapsed_sec, 2)
        self._total_tokens_generated += tokens
        self._total_generations += 1

    def get_throughput_stats(self) -> dict:
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
        """初始化 Ollama 連線"""
        if self._initialized_ollama:
            return True
        
        self.client = httpx.AsyncClient(timeout=30.0)
        try:
            response = await self.client.get(f"{self.base_url}/api/tags")
            response.raise_for_status()
            self._initialized_ollama = True
            return True
        except Exception as e:
            logger.warning(f"Ollama 連線失敗或未啟動: {e}")
            self.client = None
            self._initialized_ollama = True
            return True

    def _get_llama_instance(self, model_path: str):
        if self._llama_instance is None or self._current_llama_path != model_path:
            try:
                from llama_cpp import Llama
                logger.info(f"正在載入 GGUF 模型: {model_path}")
                self._llama_instance = Llama(
                    model_path=model_path,
                    n_gpu_layers=settings.llama_n_gpu_layers,
                    n_ctx=settings.llama_context_size,
                    verbose=False
                )
                self._current_llama_path = model_path
                logger.info("✅ GGUF 模型載入完成")
            except ImportError:
                logger.error("未安裝 llama-cpp-python，無法載入 GGUF 模型")
                return None
            except Exception as e:
                logger.error(f"載入 GGUF 模型失敗: {e}")
                return None
        return self._llama_instance

    def _is_gguf_model(self) -> Optional[str]:
        manager = get_model_manager()
        current = manager.current_model
        if current and current.filename.endswith(".gguf"):
            return current.path
        return None

    async def generate(
        self,
        prompt: str,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stop: Optional[list[str]] = None,
    ) -> str:
        """生成回應（非串流）"""
        gguf_path = self._is_gguf_model()
        if gguf_path:
            return await self._generate_llama(gguf_path, prompt, max_tokens, temperature, top_p, stop)
        
        if not self._initialized_ollama:
            await self.initialize()
            
        if self.client is None:
            return self._simulate_response(prompt)
            
        # Ollama 模式
        start = time.perf_counter()
        try:
            manager = get_model_manager()
            model_name = manager._current_model if manager._current_model else settings.ollama_model
            payload = {
                "model": model_name,
                "prompt": prompt,
                "stream": False,
                "raw": True,
                "options": {
                    "temperature": temperature,
                    "top_p": top_p,
                    "stop": stop or [],
                    "num_predict": max_tokens
                }
            }
            response = await self.client.post(
                f"{self.base_url}/api/generate",
                json=payload,
                timeout=300.0
            )
            response.raise_for_status()
            data = response.json()
            
            elapsed = time.perf_counter() - start
            tokens = data.get("eval_count", 0)
            if tokens > 0:
                self.record_generation(tokens, elapsed)
                
            return data.get("response", "")
        except Exception as e:
            logger.error(f"Ollama 生成失敗: {e}")
            return self._simulate_response(prompt)

    async def _generate_llama(self, model_path: str, prompt: str, max_tokens: int, temperature: float, top_p: float, stop: Optional[list[str]]) -> str:
        llm = self._get_llama_instance(model_path)
        if not llm:
            return self._simulate_response(prompt)
        
        start = time.perf_counter()
        stop_tokens = stop or []
        if "<|im_end|>" not in stop_tokens:
            stop_tokens.append("<|im_end|>")

        def _run():
            return llm(
                prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                stop=stop_tokens
            )

        try:
            response = await asyncio.to_thread(_run)
            text = response["choices"][0]["text"]
            tokens = response["usage"]["completion_tokens"]
            elapsed = time.perf_counter() - start
            self.record_generation(tokens, elapsed)
            return text
        except Exception as e:
            logger.error(f"llama_cpp 生成失敗: {e}")
            return self._simulate_response(prompt)

    async def generate_stream(
        self,
        prompt: str,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stop: Optional[list[str]] = None,
    ) -> AsyncGenerator[str, None]:
        """串流生成回應"""
        gguf_path = self._is_gguf_model()
        if gguf_path:
            async for chunk in self._generate_stream_llama(gguf_path, prompt, max_tokens, temperature, top_p, stop):
                yield chunk
            return

        if not self._initialized_ollama:
            await self.initialize()
            
        if self.client is None:
            async for chunk in self._simulate_stream(prompt):
                yield chunk
            return
            
        # Ollama 模式
        start = time.perf_counter()
        token_count = 0
        try:
            manager = get_model_manager()
            model_name = manager._current_model if manager._current_model else settings.ollama_model
            payload = {
                "model": model_name,
                "prompt": prompt,
                "stream": True,
                "raw": True,
                "options": {
                    "temperature": temperature,
                    "top_p": top_p,
                    "stop": stop or [],
                    "num_predict": max_tokens
                }
            }
            
            async with self.client.stream(
                "POST", 
                f"{self.base_url}/api/generate", 
                json=payload,
                timeout=httpx.Timeout(300.0, connect=5.0)
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        if "response" in data:
                            token_count += 1
                            yield data["response"]
                        if data.get("done", False):
                            eval_count = data.get("eval_count", token_count)
                            elapsed = time.perf_counter() - start
                            self.record_generation(eval_count, elapsed)
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            logger.error(f"Ollama 串流生成失敗: {e}")
            async for chunk in self._simulate_stream(prompt):
                yield chunk

    async def _generate_stream_llama(self, model_path: str, prompt: str, max_tokens: int, temperature: float, top_p: float, stop: Optional[list[str]]) -> AsyncGenerator[str, None]:
        llm = self._get_llama_instance(model_path)
        if not llm:
            async for chunk in self._simulate_stream(prompt):
                yield chunk
            return

        start = time.perf_counter()
        stop_tokens = stop or []
        if "<|im_end|>" not in stop_tokens:
            stop_tokens.append("<|im_end|>")

        loop = asyncio.get_running_loop()
        q = asyncio.Queue()

        def _run_stream():
            try:
                for chunk in llm(
                    prompt, 
                    max_tokens=max_tokens, 
                    temperature=temperature, 
                    top_p=top_p, 
                    stop=stop_tokens, 
                    stream=True
                ):
                    text = chunk["choices"][0]["text"]
                    if text:
                        loop.call_soon_threadsafe(q.put_nowait, text)
                loop.call_soon_threadsafe(q.put_nowait, None)
            except Exception as e:
                loop.call_soon_threadsafe(q.put_nowait, e)

        import threading
        threading.Thread(target=_run_stream, daemon=True).start()

        token_count = 0
        while True:
            item = await q.get()
            if item is None:
                break
            if isinstance(item, Exception):
                logger.error(f"llama_cpp 串流生成失敗: {item}")
                break
            token_count += 1
            yield item

        elapsed = time.perf_counter() - start
        self.record_generation(token_count, elapsed)

    async def generate_structured(
        self,
        prompt: str,
        schema_dict: dict,
        max_tokens: int = 1024,
        temperature: float = 0.1,
        top_p: float = 0.9,
    ) -> dict:
        """生成結構化 JSON 回應"""
        gguf_path = self._is_gguf_model()
        if gguf_path:
            # GGUF 結構化生成
            llm = self._get_llama_instance(gguf_path)
            if not llm:
                return self._simulate_structured(schema_dict)
            try:
                # 簡單附加格式要求於 prompt
                json_prompt = prompt + f"\n\n請務必輸出合法的 JSON，格式需符合：\n{json.dumps(schema_dict, ensure_ascii=False)}"
                def _run():
                    return llm(json_prompt, max_tokens=max_tokens, temperature=temperature, top_p=top_p, stop=["<|im_end|>"])
                response = await asyncio.to_thread(_run)
                text = response["choices"][0]["text"]
                # 嘗試解析 JSON
                try:
                    # 尋找 {}
                    start_idx = text.find('{')
                    end_idx = text.rfind('}')
                    if start_idx != -1 and end_idx != -1:
                        text = text[start_idx:end_idx+1]
                    return json.loads(text)
                except json.JSONDecodeError:
                    return self._simulate_structured(schema_dict)
            except Exception as e:
                logger.error(f"llama_cpp 結構化生成失敗: {e}")
                return self._simulate_structured(schema_dict)

        if not self._initialized_ollama:
            await self.initialize()
            
        if self.client is None:
            return self._simulate_structured(schema_dict)

        try:
            manager = get_model_manager()
            model_name = manager._current_model if manager._current_model else settings.ollama_model
            payload = {
                "model": model_name,
                "prompt": prompt,
                "stream": False,
                "raw": True,
                "format": schema_dict,
                "options": {
                    "temperature": temperature,
                    "top_p": top_p,
                    "num_predict": max_tokens
                }
            }
            
            response = await self.client.post(
                f"{self.base_url}/api/generate",
                json=payload,
                timeout=120.0
            )
            response.raise_for_status()
            data = response.json()
            result_str = data.get("response", "{}")
            return json.loads(result_str)
        except Exception as e:
            logger.error(f"Ollama 結構化生成失敗: {e}")
            return self._simulate_structured(schema_dict)

    def _simulate_structured(self, schema_dict: dict) -> dict:
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

    def _simulate_response(self, prompt: str) -> str:
        return f"""這是一個模擬的 AI 回應。

您的問題是關於：「{prompt[:100]}...」

**注意**: 目前系統以模擬模式運行，因為 Llama/Ollama 模型未啟動或連線失敗。

請確認您已經下載了 GGUF 模型並放置於 `ai_model` 資料夾中，或啟動了 Ollama。

---

### Corphia AI Platform v2.2

本系統支援以下功能：
- 🤖 智慧對話 (GGUF / Ollama)
- 📚 RAG 知識問答
- 🏢 多租戶管理
- 🔐 三層權限控制
"""
    
    async def _simulate_stream(self, prompt: str) -> AsyncGenerator[str, None]:
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
        建構對話 Prompt (維持 ChatML 格式，無縫接軌 Ollama raw=True 與 Llama.cpp)
        """
        prompt_parts = []
        if system_prompt or context:
            system_content = system_prompt or "你是一個有幫助的 AI 助手。"
            if context:
                system_content += f"\n\n### 參考資料\n{context}"
            prompt_parts.append(f"<|im_start|>system\n{system_content}<|im_end|>")
        
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            prompt_parts.append(f"<|im_start|>{role}\n{content}<|im_end|>")
            
        prompt_parts.append("<|im_start|>assistant\n")
        return "\n".join(prompt_parts)


def get_llm_service() -> LLMService:
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = LLMService()
    return _llm_instance
