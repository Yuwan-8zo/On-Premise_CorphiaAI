"""
核心配置模組

從環境變數載入應用程式設定
"""

from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """應用程式設定"""
    
    # 應用程式
    app_name: str = "CorphiaAI"
    app_env: str = "development"
    debug: bool = True
    
    # 資料庫
    database_url: str = "sqlite+aiosqlite:///./corphia.db"
    
    # JWT 認證
    secret_key: str = "your-super-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30
    jwt_refresh_expire_days: int = 7
    
    # LLM
    llama_model_path: str = "../ai_model/model.gguf"
    llama_context_size: int = 4096
    llama_n_gpu_layers: int = 0
    
    # ChromaDB
    chroma_persist_directory: str = "./chroma_data"
    
    # 上傳
    upload_directory: str = "./uploads"
    max_upload_size_mb: int = 50
    
    # CORS
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """取得 CORS 來源列表"""
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """取得設定單例"""
    return Settings()


settings = get_settings()
