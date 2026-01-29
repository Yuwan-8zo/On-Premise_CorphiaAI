"""
æ¨¡å?ç®¡ç???

?ªå??ƒæ??Œç®¡??GGUF æ¨¡å?æª”æ?
"""

import os
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class ModelInfo:
    """æ¨¡å?è³‡è?"""
    name: str                    # æ¨¡å??ç¨±
    path: str                    # å®Œæ•´è·¯å?
    filename: str                # æª”å?
    size_bytes: int              # æª”æ?å¤§å?
    size_gb: float               # æª”æ?å¤§å? (GB)
    last_modified: datetime      # ?€å¾Œä¿®?¹æ???
    quantization: Optional[str]  # ?å?ç­‰ç? (Q4_K_M, Q5_K_S ç­?


class ModelManager:
    """
    æ¨¡å?ç®¡ç???
    
    ?ªå??ƒæ??‡å??®é?ä¸­ç? GGUF æ¨¡å?æª”æ?ï¼?
    ä¸¦æ?ä¾›é¸?‡å??‡æ?æ¨¡å??„å??½ã€?
    """
    
    # ?¯æ´?„æ¨¡?‹å‰¯æª”å?
    SUPPORTED_EXTENSIONS = [".gguf"]
    
    def __init__(self, models_dir: str = None):
        """
        ?å??–æ¨¡?‹ç®¡?†å™¨
        
        Args:
            models_dir: æ¨¡å??®é?è·¯å?ï¼Œé?è¨­ç‚ºå°ˆæ??¹ç›®?„ä???ai_model
        """
        if models_dir is None:
            # ?è¨­è·¯å?ï¼šå?æ¡ˆæ ¹?®é?/ai_model
            project_root = Path(__file__).parent.parent.parent.parent
            models_dir = str(project_root / "ai_model")
        
        self.models_dir = Path(models_dir)
        self._models: Dict[str, ModelInfo] = {}
        self._current_model: Optional[str] = None
        
        # ç¢ºä??®é?å­˜åœ¨
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        # ?å??ƒæ?
        self.scan_models()
    
    def scan_models(self) -> List[ModelInfo]:
        """
        ?ƒæ?æ¨¡å??®é?ä¸­ç??€??GGUF æª”æ?
        
        Returns:
            æ¨¡å?è³‡è??—è¡¨
        """
        self._models.clear()
        
        if not self.models_dir.exists():
            logger.warning(f"æ¨¡å??®é?ä¸å??? {self.models_dir}")
            return []
        
        for ext in self.SUPPORTED_EXTENSIONS:
            for model_path in self.models_dir.glob(f"*{ext}"):
                if model_path.is_file():
                    try:
                        info = self._parse_model_info(model_path)
                        self._models[info.name] = info
                        logger.info(f"?¼ç¾æ¨¡å?: {info.name} ({info.size_gb:.2f} GB)")
                    except Exception as e:
                        logger.error(f"è§??æ¨¡å?å¤±æ? {model_path}: {e}")
        
        # å¦‚æ??‰æ¨¡?‹ä??ªé¸?‡ï??ªå??¸æ?ç¬¬ä???
        if self._models and not self._current_model:
            self._current_model = list(self._models.keys())[0]
            logger.info(f"?ªå??¸æ?æ¨¡å?: {self._current_model}")
        
        return list(self._models.values())
    
    def _parse_model_info(self, path: Path) -> ModelInfo:
        """
        è§??æ¨¡å?æª”æ?è³‡è?
        
        Args:
            path: æ¨¡å?æª”æ?è·¯å?
            
        Returns:
            ModelInfo ?©ä»¶
        """
        stat = path.stat()
        filename = path.name
        
        # å¾æ??è§£?é??–ç?ç´?
        quantization = self._extract_quantization(filename)
        
        # æ¨¡å??ç¨±ï¼šå»?¤å‰¯æª”å?
        name = path.stem
        
        return ModelInfo(
            name=name,
            path=str(path),
            filename=filename,
            size_bytes=stat.st_size,
            size_gb=stat.st_size / (1024 ** 3),
            last_modified=datetime.fromtimestamp(stat.st_mtime),
            quantization=quantization,
        )
    
    def _extract_quantization(self, filename: str) -> Optional[str]:
        """
        å¾æ??ä¸­?å??å?ç­‰ç?
        
        å¸¸è??¼å?: model-name-Q4_K_M.gguf, model.Q5_K_S.gguf
        """
        # å¸¸è??å?æ¨™è?
        quant_patterns = [
            "Q2_K", "Q3_K_S", "Q3_K_M", "Q3_K_L",
            "Q4_0", "Q4_1", "Q4_K_S", "Q4_K_M",
            "Q5_0", "Q5_1", "Q5_K_S", "Q5_K_M",
            "Q6_K", "Q8_0", "F16", "F32",
            "IQ1_S", "IQ2_XXS", "IQ2_XS", "IQ2_S", "IQ2_M",
            "IQ3_XXS", "IQ3_XS", "IQ3_S", "IQ3_M",
            "IQ4_NL", "IQ4_XS",
        ]
        
        filename_upper = filename.upper()
        for pattern in quant_patterns:
            if pattern in filename_upper:
                return pattern
        
        return None
    
    @property
    def available_models(self) -> List[ModelInfo]:
        """?–å??€?‰å¯?¨æ¨¡??""
        return list(self._models.values())
    
    @property
    def model_names(self) -> List[str]:
        """?–å??€?‰æ¨¡?‹å?ç¨?""
        return list(self._models.keys())
    
    @property
    def current_model(self) -> Optional[ModelInfo]:
        """?–å??®å??¸æ??„æ¨¡??""
        if self._current_model and self._current_model in self._models:
            return self._models[self._current_model]
        return None
    
    @property
    def current_model_path(self) -> Optional[str]:
        """?–å??®å?æ¨¡å??„è·¯å¾?""
        model = self.current_model
        return model.path if model else None
    
    def select_model(self, name: str) -> bool:
        """
        ?¸æ?æ¨¡å?
        
        Args:
            name: æ¨¡å??ç¨±
            
        Returns:
            ?¯å¦?å??¸æ?
        """
        if name in self._models:
            self._current_model = name
            logger.info(f"å·²é¸?‡æ¨¡?? {name}")
            return True
        
        logger.error(f"æ¨¡å?ä¸å??? {name}")
        return False
    
    def get_model(self, name: str) -> Optional[ModelInfo]:
        """?–å??‡å?æ¨¡å??„è?è¨?""
        return self._models.get(name)
    
    def to_dict(self) -> Dict[str, Any]:
        """è½‰æ??ºå??¸æ ¼å¼ï??¨æ–¼ API ?æ?ï¼?""
        return {
            "models_dir": str(self.models_dir),
            "current_model": self._current_model,
            "available_models": [
                {
                    "name": m.name,
                    "filename": m.filename,
                    "size_gb": round(m.size_gb, 2),
                    "quantization": m.quantization,
                    "last_modified": m.last_modified.isoformat(),
                }
                for m in self._models.values()
            ],
        }


# ?¨å??®ä?
_model_manager: Optional[ModelManager] = None


def get_model_manager() -> ModelManager:
    """
    ?–å? ModelManager ?®ä?
    """
    global _model_manager
    if _model_manager is None:
        _model_manager = ModelManager()
    return _model_manager


def refresh_models() -> List[ModelInfo]:
    """
    ?æ–°?ƒæ?æ¨¡å?
    """
    return get_model_manager().scan_models()
