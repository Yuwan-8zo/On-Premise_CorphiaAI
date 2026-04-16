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
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/corphia"
    
    # JWT 認證
    secret_key: str = "your-super-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30
    jwt_refresh_expire_days: int = 7
    
    # LLM
    llama_model_path: str = "../ai_model/model.gguf"
    llama_context_size: int = 4096
    llama_n_gpu_layers: int = 0
    
    # 上傳
    upload_directory: str = "./uploads"
    max_upload_size_mb: int = 50
    
    # 速率限制
    rate_limit_enabled: bool = True
    rate_limit_global_max: int = 120           # 全域每分鐘最大請求數
    rate_limit_login_max: int = 10             # 登入每分鐘最大嘗試數
    rate_limit_register_max: int = 5           # 註冊每小時最大次數
    
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
