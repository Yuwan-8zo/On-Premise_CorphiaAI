"""
日誌設定模組
"""

import os
import logging
from logging.handlers import RotatingFileHandler
from app.core.config import settings

def setup_logging():
    """設定應用程式的結構今日誌"""
    
    os.makedirs("logs", exist_ok=True)
    
    # 建立基礎的 Logger
    logger = logging.getLogger()
    logger.setLevel(logging.DEBUG if settings.debug else logging.INFO)
    
    # 清除現有 Handlers
    if logger.hasHandlers():
        logger.handlers.clear()
        
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - [%(process)d:%(thread)d] - %(message)s"
    )
    
    # === Console Handler ===
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)
    
    # === File Handler (Rotating) ===
    # 保留 5 份日誌，每份 10MB
    file_handler = RotatingFileHandler(
        "logs/corphia_app.log", maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    # 生產環境下將錯誤單獨寫入 error.log
    if settings.app_env.lower() == "production":
        error_file_handler = RotatingFileHandler(
            "logs/corphia_error.log", maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
        )
        error_file_handler.setLevel(logging.ERROR)
        error_file_handler.setFormatter(formatter)
        logger.addHandler(error_file_handler)

    logger.addHandler(file_handler)
    
    # 調降特定庫的日誌級別，避免洗畫面
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    
    logging.info("✅ 日誌設定初始化完成")
