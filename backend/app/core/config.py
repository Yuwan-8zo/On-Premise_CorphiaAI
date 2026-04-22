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
    
    # LLM (Ollama)
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:14b"
    
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

    # 差異化資安功能旗標（Phase 2）
    enable_pii_masking: bool = True            # A1: 自動遮罩身分證/信用卡/手機/email
    enable_prompt_injection_guard: bool = True  # A2: 偵測 Prompt Injection 攻擊
    enable_dlp: bool = True                    # A3: 關鍵字黑名單阻擋
    # DLP 黑名單，逗號分隔；可從環境變數覆寫
    dlp_blocklist: str = "最高機密,絕對機密,top secret,classified secret"

    # RAG 可調參數（Phase 3 預留）
    rag_top_k: int = 5
    rag_similarity_threshold: float = 0.25
    rag_bm25_weight: float = 0.3

    @property
    def cors_origins_list(self) -> List[str]:
        """取得 CORS 來源列表"""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def dlp_blocklist_terms(self) -> List[str]:
        """取得 DLP 黑名單字串列表（全部小寫化以便不分大小寫比對）"""
        return [term.strip().lower() for term in self.dlp_blocklist.split(",") if term.strip()]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """取得設定單例"""
    return Settings()


settings = get_settings()
