"""
模型管理器

自動掃描和管理 GGUF 模型檔案
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
    """模型資訊"""
    name: str                    # 模型名稱
    path: str                    # 完整路徑
    filename: str                # 檔名
    size_bytes: int              # 檔案大小
    size_gb: float               # 檔案大小 (GB)
    last_modified: datetime      # 最後修改時間
    quantization: Optional[str]  # 量化等級 (Q4_K_M, Q5_K_S 等)


class ModelManager:
    """
    模型管理器
    
    自動掃描指定目錄中的 GGUF 模型檔案，
    並提供選擇和切換模型的功能。
    """
    
    # 支援的模型副檔名
    SUPPORTED_EXTENSIONS = [".gguf"]
    
    def __init__(self, models_dir: str = None):
        """
        初始化模型管理器
        
        Args:
            models_dir: 模型目錄路徑，預設為專案根目錄下的 ai_model
        """
        if models_dir is None:
            # 預設路徑：專案根目錄/ai_model
            project_root = Path(__file__).parent.parent.parent.parent
            models_dir = str(project_root / "ai_model")
        
        self.models_dir = Path(models_dir)
        self._models: Dict[str, ModelInfo] = {}
        self._current_model: Optional[str] = None
        
        # 確保目錄存在
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        # 初始掃描
        self.scan_models()
    
    def scan_models(self) -> List[ModelInfo]:
        """
        掃描模型目錄中的所有 GGUF 檔案
        
        Returns:
            模型資訊列表
        """
        self._models.clear()
        
        if not self.models_dir.exists():
            logger.warning(f"模型目錄不存在: {self.models_dir}")
            return []
        
        for ext in self.SUPPORTED_EXTENSIONS:
            for model_path in self.models_dir.glob(f"*{ext}"):
                if model_path.is_file():
                    try:
                        info = self._parse_model_info(model_path)
                        self._models[info.name] = info
                        logger.info(f"發現模型: {info.name} ({info.size_gb:.2f} GB)")
                    except Exception as e:
                        logger.error(f"解析模型失敗 {model_path}: {e}")
        
        # 如果有模型且未選擇，自動選擇第一個
        if self._models and not self._current_model:
            self._current_model = list(self._models.keys())[0]
            logger.info(f"自動選擇模型: {self._current_model}")
        
        return list(self._models.values())
    
    def _parse_model_info(self, path: Path) -> ModelInfo:
        """
        解析模型檔案資訊
        
        Args:
            path: 模型檔案路徑
            
        Returns:
            ModelInfo 物件
        """
        stat = path.stat()
        filename = path.name
        
        # 從檔名解析量化等級
        quantization = self._extract_quantization(filename)
        
        # 模型名稱：去除副檔名
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
        從檔名中提取量化等級
        
        常見格式: model-name-Q4_K_M.gguf, model.Q5_K_S.gguf
        """
        # 常見量化標記
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
        """取得所有可用模型"""
        return list(self._models.values())
    
    @property
    def model_names(self) -> List[str]:
        """取得所有模型名稱"""
        return list(self._models.keys())
    
    @property
    def current_model(self) -> Optional[ModelInfo]:
        """取得目前選擇的模型"""
        if self._current_model and self._current_model in self._models:
            return self._models[self._current_model]
        return None
    
    @property
    def current_model_path(self) -> Optional[str]:
        """取得目前模型的路徑"""
        model = self.current_model
        return model.path if model else None
    
    def select_model(self, name: str) -> bool:
        """
        選擇模型
        
        Args:
            name: 模型名稱
            
        Returns:
            是否成功選擇
        """
        if name in self._models:
            self._current_model = name
            logger.info(f"已選擇模型: {name}")
            return True
        
        logger.error(f"模型不存在: {name}")
        return False
    
    def get_model(self, name: str) -> Optional[ModelInfo]:
        """取得指定模型的資訊"""
        return self._models.get(name)
    
    def to_dict(self) -> Dict[str, Any]:
        """轉換為字典格式（用於 API 回應）"""
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


# 全域單例
_model_manager: Optional[ModelManager] = None


def get_model_manager() -> ModelManager:
    """
    取得 ModelManager 單例
    """
    global _model_manager
    if _model_manager is None:
        _model_manager = ModelManager()
    return _model_manager


def refresh_models() -> List[ModelInfo]:
    """
    重新掃描模型
    """
    return get_model_manager().scan_models()
