"""
LLM 服務

負責載入模型與執行推論
整合 llama-cpp-python
"""

import os
import logging
from typing import AsyncGenerator, List, Optional, Dict, Any

from llama_cpp import Llama

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMService:
    """LLM 推論服務"""
    
    _instance = None
    _model = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LLMService, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        # 避免重複初始化
        if self._model is not None:
            return
            
        self.model_path = settings.llama_model_path
        self._load_model()
    
    def _load_model(self):
        """載入 GGUF 模型"""
        if not os.path.exists(self.model_path):
            logger.warning(f"⚠️ 模型檔案不存在: {self.model_path}")
            logger.warning("LLM 服務將無法運作，請將 GGUF 模型放入 ai_model/ 目錄")
            return
            
        try:
            logger.info(f"正在載入模型: {self.model_path} ...")
            self._model = Llama(
                model_path=self.model_path,
                n_ctx=settings.llama_context_size,
                n_gpu_layers=settings.llama_n_gpu_layers,
                verbose=settings.debug,
                chat_format="chatml", # 假設使用 ChatML 格式的模型，可根據模型調整
            )
            logger.info("✅ 模型載入成功")
        except Exception as e:
            logger.error(f"❌ 模型載入失敗: {e}")
            self._model = None
            
    @property
    def is_ready(self) -> bool:
        """模型是否已準備就緒"""
        return self._model is not None
        
    async def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        stop: Optional[List[str]] = None,
    ) -> AsyncGenerator[str, None]:
        """
        執行對話補全 (串流模式)
        
        Args:
            messages: 訊息列表 [{"role": "user", "content": "..."}]
            temperature: 溫度參數
            max_tokens: 最大生成 tokens
            stop: 停止詞
            
        Yields:
            str: 生成的文字片段
        """
        if not self.is_ready:
            yield "⚠️ 系統訊息: LLM 模型尚未載入，請聯繫管理員檢查模型檔案。"
            return
            
        try:
            # 確保訊息格式正確
            formatted_messages = []
            for msg in messages:
                if msg["role"] in ["user", "assistant", "system"]:
                    formatted_messages.append(msg)
            
            # 呼叫 llama-cpp-python
            stream = self._model.create_chat_completion(
                messages=formatted_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stop=stop,
                stream=True
            )
            
            for chunk in stream:
                if "choices" in chunk:
                    delta = chunk["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
                        
        except Exception as e:
            logger.error(f"推論發生錯誤: {e}")
            yield f"\n\n[系統錯誤: {str(e)}]"


# 單例
llm_service = LLMService()
