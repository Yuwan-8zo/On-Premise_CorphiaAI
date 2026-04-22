"""
LLM 服務模組

使用 Ollama 微服務架構進行本地模型推論
"""

import logging
import json
import time
import httpx
from typing import AsyncGenerator, Optional
from collections import deque

from app.core.config import settings

logger = logging.getLogger(__name__)

# 全域 LLM 實例
_llm_instance = None


class LLMService:
    """LLM 推論服務 (基於 Ollama 微服務架構)"""
    
    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_model
        self._initialized = False
        
        # httpx client 會在 initialize 時建立
        self.client: Optional[httpx.AsyncClient] = None

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
    
    async def initialize(self) -> bool:
        """
        初始化 Ollama 連線並檢查模型是否存在
        """
        if self._initialized:
            return True
        
        # 建立 httpx AsyncClient
        self.client = httpx.AsyncClient(timeout=30.0)
        
        try:
            logger.info(f"正在連線至 Ollama 服務: {self.base_url}")
            response = await self.client.get(f"{self.base_url}/api/tags")
            response.raise_for_status()
            
            # 檢查模型是否在清單中
            tags = response.json().get("models", [])
            model_names = [m["name"] for m in tags]
            
            if self.model not in model_names and f"{self.model}:latest" not in model_names:
                logger.warning(f"Ollama 中未找到指定模型: {self.model}，請先執行 `ollama run {self.model}`")
                logger.info("系統將以模擬模式運行")
                self.client = None
            else:
                logger.info(f"✅ Ollama 模型載入完成 ({self.model})")
                
            self._initialized = True
            return True
            
        except Exception as e:
            logger.warning(f"Ollama 連線失敗或未啟動: {e}，請確認 {self.base_url} 可用。")
            logger.info("系統將以模擬模式運行")
            self.client = None
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
        """生成回應（非串流）"""
        if not self._initialized:
            await self.initialize()
            
        if self.client is None:
            return self._simulate_response(prompt)
            
        start = time.perf_counter()
        try:
            payload = {
                "model": self.model,
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
            
            # 非串流生成可能需要較長時間，設置 300 秒 timeout
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
            raise
            
    async def generate_stream(
        self,
        prompt: str,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        top_p: float = 0.9,
        stop: Optional[list[str]] = None,
    ) -> AsyncGenerator[str, None]:
        """串流生成回應"""
        if not self._initialized:
            await self.initialize()
            
        if self.client is None:
            async for chunk in self._simulate_stream(prompt):
                yield chunk
            return
            
        start = time.perf_counter()
        token_count = 0
        try:
            payload = {
                "model": self.model,
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
                            # Ollama 會在 done 為 True 時提供 eval_count，這是精準的 token 數量
                            eval_count = data.get("eval_count", token_count)
                            elapsed = time.perf_counter() - start
                            self.record_generation(eval_count, elapsed)
                    except json.JSONDecodeError:
                        continue
                        
        except Exception as e:
            logger.error(f"Ollama 串流生成失敗: {e}")
            raise
            
    async def generate_structured(
        self,
        prompt: str,
        schema_dict: dict,
        max_tokens: int = 1024,
        temperature: float = 0.1,
        top_p: float = 0.9,
    ) -> dict:
        """生成結構化 JSON 回應"""
        if not self._initialized:
            await self.initialize()
            
        if self.client is None:
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
            payload = {
                "model": self.model,
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
            raise
            
    def _simulate_response(self, prompt: str) -> str:
        return f"""這是一個模擬的 AI 回應。

您的問題是關於：「{prompt[:100]}...」

**注意**: 目前系統以模擬模式運行，因為 Ollama 模型未啟動或連線失敗。

請確認您已經安裝 Ollama 並執行了對應模型（例如 `ollama run qwen2.5:14b`），且確認 `.env` 中的 `OLLAMA_BASE_URL` 與 `OLLAMA_MODEL` 設定正確。

---

### Corphia AI Platform v2.2

本系統支援以下功能：
- 🤖 智慧對話
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
        建構對話 Prompt (維持 ChatML 格式，無縫接軌 Ollama raw=True)
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
