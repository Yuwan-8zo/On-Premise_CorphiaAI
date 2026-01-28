"""
LLM ?å?æ¨¡ç?

ä½¿ç”¨ llama.cpp ?²è??¬åœ°æ¨¡å??¨è?
"""

import logging
from typing import AsyncGenerator, Optional
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

# ?¨å? LLM å¯¦ä?
_llm_instance = None


class LLMService:
    """LLM ?¨è??å?"""
    
    def __init__(self):
        self.model = None
        self.model_path = settings.llama_model_path
        self.context_size = settings.llama_context_size
        self.n_gpu_layers = settings.llama_n_gpu_layers
        self._initialized = False
    
    async def initialize(self) -> bool:
        """
        ?å???LLM æ¨¡å?
        
        Returns:
            bool: ?¯å¦?å??–æ???
        """
        if self._initialized:
            return True
        
        model_path = Path(self.model_path)
        
        if not model_path.exists():
            logger.warning(f"LLM æ¨¡å?æª”æ?ä¸å??? {model_path}")
            logger.info("ç³»çµ±å°‡ä»¥æ¨¡æ“¬æ¨¡å??‹è?")
            self._initialized = True
            return True
        
        try:
            from llama_cpp import Llama
            
            logger.info(f"æ­?œ¨è¼‰å…¥ LLM æ¨¡å?: {model_path}")
            
            self.model = Llama(
                model_path=str(model_path),
                n_ctx=self.context_size,
                n_gpu_layers=self.n_gpu_layers,
                verbose=False,
            )
            
            self._initialized = True
            logger.info("??LLM æ¨¡å?è¼‰å…¥å®Œæ?")
            return True
            
        except ImportError:
            logger.warning("llama-cpp-python ?ªå?è£ï?ç³»çµ±å°‡ä»¥æ¨¡æ“¬æ¨¡å??‹è?")
            self._initialized = True
            return True
        except Exception as e:
            logger.error(f"LLM æ¨¡å?è¼‰å…¥å¤±æ?: {e}")
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
        ?Ÿæ??æ?ï¼ˆé?ä¸²æ?ï¼?
        
        Args:
            prompt: è¼¸å…¥?ç¤º
            max_tokens: ?€å¤§è¼¸??Token ??
            temperature: æº«åº¦?ƒæ•¸
            top_p: Top-p ?–æ¨£
            stop: ?œæ­¢ç¬¦è??—è¡¨
            
        Returns:
            str: ?Ÿæ??„æ?å­?
        """
        if not self._initialized:
            await self.initialize()
        
        if self.model is None:
            # æ¨¡æ“¬æ¨¡å?
            return self._simulate_response(prompt)
        
        try:
            output = self.model(
                prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                stop=stop or [],
                echo=False,
            )
            
            return output["choices"][0]["text"]
            
        except Exception as e:
            logger.error(f"LLM ?Ÿæ?å¤±æ?: {e}")
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
        ä¸²æ??Ÿæ??æ?
        
        Args:
            prompt: è¼¸å…¥?ç¤º
            max_tokens: ?€å¤§è¼¸??Token ??
            temperature: æº«åº¦?ƒæ•¸
            top_p: Top-p ?–æ¨£
            stop: ?œæ­¢ç¬¦è??—è¡¨
            
        Yields:
            str: ?Ÿæ??„æ?å­—ç?æ®?
        """
        if not self._initialized:
            await self.initialize()
        
        if self.model is None:
            # æ¨¡æ“¬æ¨¡å?
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
            
            for output in stream:
                text = output["choices"][0]["text"]
                if text:
                    yield text
                    
        except Exception as e:
            logger.error(f"LLM ä¸²æ??Ÿæ?å¤±æ?: {e}")
            raise
    
    def _simulate_response(self, prompt: str) -> str:
        """æ¨¡æ“¬?æ?ï¼ˆç„¡æ¨¡å??‚ä½¿?¨ï?"""
        return f"""?™æ˜¯ä¸€?‹æ¨¡?¬ç? AI ?æ???

?¨ç??é??¯é??¼ï??Œ{prompt[:100]}...??

**æ³¨æ?**: ?®å?ç³»çµ±ä»¥æ¨¡?¬æ¨¡å¼é?è¡Œï?? ç‚º?ªè???LLM æ¨¡å???

è«‹å? GGUF æ¨¡å?æª”æ??¾å…¥ `ai_model/` ?®é?ï¼Œä¸¦?´æ–° `.env` ä¸­ç? `LLAMA_MODEL_PATH` è¨­å???

---

### Corphia AI Platform v2.2

?¬ç³»çµ±æ”¯?´ä»¥ä¸‹å??½ï?
- ?? ?ºæ…§å°è©±
- ?? RAG ?¥è??ç?
- ?¢ å¤šç??¶ç®¡??
- ?? ä¸‰å±¤æ¬Šé??§åˆ¶
"""
    
    async def _simulate_stream(self, prompt: str) -> AsyncGenerator[str, None]:
        """æ¨¡æ“¬ä¸²æ??æ?ï¼ˆç„¡æ¨¡å??‚ä½¿?¨ï?"""
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
        å»ºæ?å°è©± Prompt
        
        Args:
            messages: å°è©±æ­·å² [{"role": "user/assistant", "content": "..."}]
            system_prompt: ç³»çµ±?ç¤º
            context: RAG ä¸Šä???
            
        Returns:
            str: ?¼å??–ç? Prompt
        """
        # ä½¿ç”¨ ChatML ?¼å?
        prompt_parts = []
        
        # ç³»çµ±?ç¤º
        if system_prompt or context:
            system_content = system_prompt or "ä½ æ˜¯ä¸€?‹æ?å¹«åŠ©??AI ?©æ???
            if context:
                system_content += f"\n\n### ?ƒè€ƒè??™\n{context}"
            prompt_parts.append(f"<|im_start|>system\n{system_content}<|im_end|>")
        
        # å°è©±æ­·å²
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            prompt_parts.append(f"<|im_start|>{role}\n{content}<|im_end|>")
        
        # ?©æ??æ??‹é ­
        prompt_parts.append("<|im_start|>assistant\n")
        
        return "\n".join(prompt_parts)


def get_llm_service() -> LLMService:
    """?–å? LLM ?å??®ä?"""
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = LLMService()
    return _llm_instance
