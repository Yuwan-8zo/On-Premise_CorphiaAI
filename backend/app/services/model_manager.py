import os
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class ModelInfo:
    """Model Information"""
    name: str                    # e.g. Qwen2.5-7B
    path: str                    # absolute path
    filename: str                # e.g. Qwen2.5-7B-Instruct-Q5_K_M.gguf
    size_bytes: int              
    size_gb: float               
    last_modified: datetime      
    quantization: Optional[str]  # e.g. Q4_K_M

class ModelManager:
    """Manages GGUF models in the ai_model directory"""
    
    SUPPORTED_EXTENSIONS = [".gguf"]
    
    def __init__(self, models_dir: str = None):
        if models_dir is None:
            # project_root/ai_model
            project_root = Path(__file__).parent.parent.parent.parent
            models_dir = str(project_root / "ai_model")
            
            # Check if there are actually gguf files here, if not, try the local Desktop path (bypassing OneDrive)
            primary_path = Path(models_dir)
            if primary_path.exists() and not any(primary_path.glob("*.gguf")):
                alt_path = Path(r"C:\Users\ngu94\Desktop\Antigravity\on-premise_CorphiaAI\ai_model")
                if alt_path.exists() and any(alt_path.glob("*.gguf")):
                    models_dir = str(alt_path)
                    logger.info(f"Fallback to alternative model path: {models_dir}")
        
        self.models_dir = Path(models_dir)
        self._models: Dict[str, ModelInfo] = {}
        self._current_model: Optional[str] = None
        
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.scan_models()
    
    def scan_models(self) -> List[ModelInfo]:
        """Scan the directory for GGUF files"""
        self._models.clear()
        
        if not self.models_dir.exists():
            logger.warning(f"Model dir not found: {self.models_dir}")
            return []
        
        for ext in self.SUPPORTED_EXTENSIONS:
            for model_path in self.models_dir.glob(f"*{ext}"):
                if model_path.is_file():
                    try:
                        info = self._parse_model_info(model_path)
                        self._models[info.name] = info
                        logger.info(f"Discovered: {info.name} ({info.size_gb:.2f} GB)")
                    except Exception as e:
                        logger.error(f"Error parse {model_path}: {e}")
        
        if self._models and not self._current_model:
            self._current_model = list(self._models.keys())[0]
            logger.info(f"Default to: {self._current_model}")
        
        return list(self._models.values())
    
    def _parse_model_info(self, path: Path) -> ModelInfo:
        stat = path.stat()
        filename = path.name
        
        quantization = self._extract_quantization(filename)
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
        return list(self._models.values())
    
    @property
    def model_names(self) -> List[str]:
        return list(self._models.keys())
    
    @property
    def current_model(self) -> Optional[ModelInfo]:
        if self._current_model and self._current_model in self._models:
            return self._models[self._current_model]
        return None
    
    @property
    def current_model_path(self) -> Optional[str]:
        model = self.current_model
        return model.path if model else None
    
    def select_model(self, name: str) -> bool:
        if name in self._models:
            self._current_model = name
            logger.info(f"Selected: {name}")
            return True
        logger.error(f"Cannot select: {name}")
        return False
    
    def get_model(self, name: str) -> Optional[ModelInfo]:
        return self._models.get(name)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "models_dir": str(self.models_dir),
            "current_model": self._current_model,
            "models": [
                {
                    "name": m.name,
                    "filename": m.filename,
                    "size_gb": round(m.size_gb, 2),
                    "quantization": m.quantization,
                    "last_modified": m.last_modified.isoformat(),
                    "is_current": m.name == self._current_model
                }
                for m in self._models.values()
            ],
        }

_model_manager: Optional[ModelManager] = None

def get_model_manager() -> ModelManager:
    global _model_manager
    if _model_manager is None:
        _model_manager = ModelManager()
    return _model_manager

def refresh_models() -> List[ModelInfo]:
    return get_model_manager().scan_models()
