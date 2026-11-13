"""
核心配置模組

從環境變數載入應用程式設定
"""

import logging
import secrets
from functools import lru_cache
from typing import List
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


logger = logging.getLogger(__name__)


# 用「明顯是 placeholder」的特徵字串列表偵測使用者沒換預設密鑰
_INSECURE_SECRET_KEYS = {
    "your-super-secret-key-change-in-production",
    "change-me",
    "secret",
    "secretkey",
    "test",
}


class Settings(BaseSettings):
    """應用程式設定"""

    # 應用程式
    app_name: str = "CorphiaAI"
    app_env: str = "development"
    # SECURITY: debug 預設 False。development 環境要打開請在 .env 設 DEBUG=true
    # 預設 True 的話部署到 production 忘記改會洩漏 SQLAlchemy echo log + 詳細錯誤頁
    debug: bool = False

    # 資料庫
    database_url: str = "postgresql+asyncpg://corphia:corphia123@localhost:5433/corphia_ai"
    db_pool_size: int = 20
    db_max_overflow: int = 10

    # JWT 認證
    # SECURITY: 預設值改成 dev-only 提示字串，搭配下面 validator 在 production 強制要求自訂
    # 沒設 SECRET_KEY 時 dev 模式會自動產生隨機值（每次啟動不同，不影響開發）
    # production 模式（app_env=production）會直接 raise，避免不小心用預設值上線
    secret_key: str = "dev-only-secret-DO-NOT-USE-IN-PRODUCTION"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30
    jwt_refresh_expire_days: int = 7
    
    # LLM (local GGUF via llama.cpp)
    # 預設指向專案根目錄的 ai_model/（ModelManager 會在啟動時解析並選為預設模型）
    llama_model_path: str = "ai_model/Qwen2.5-7B-Instruct-Q5_K_M.gguf"
    llama_context_size: int = 4096
    llama_n_gpu_layers: int = 0
    # CPU threads for llama.cpp; 0 = all cores minus two (keeps the API responsive while the model runs)
    llama_n_threads: int = 0
    # Canned "simulated" replies when no GGUF model is loaded. Off by default:
    # every answer must come from the real model, otherwise the user sees an error.
    allow_simulated_llm: bool = False
    # Models kept loaded at startup (size tags, comma separated). Others load only when selected.
    llm_preload_models: str = "3B,7B"
    # 推論引擎：auto＝有 llama-server 執行檔就用它（Vulkan，用內建顯示晶片，讀入快約 70 倍），沒有就用 llama-cpp-python；
    # server／python＝指定其中一種
    llm_engine: str = "auto"
    # llama-server 執行檔（相對於專案根目錄）
    llm_engine_path: str = "engine/llama-vulkan/llama-server.exe"
    # llama-server 的上下文長度（token）；提示詞預算、回答長度上限都跟著它算
    llm_engine_context: int = 8192
    # 放到顯示晶片的層數（99＝全部）
    llm_engine_gpu_layers: int = 99
    # 同時留在記憶體的模型數上限；超過就關掉最久沒用的（系統預設模型不關）
    llm_engine_max_loaded: int = 3
    # 一個模型最多等多久載入（秒）
    llm_engine_load_timeout: int = 900
    
    # 文件檢索模型：本機沒有時（新電腦第一次）可不可以從網路下載一次；完全不連外的環境設 false
    embedding_allow_download: bool = True

    # AI 產出檔案（使用者說「幫我做一份 Word／Excel／簡報」）：開關、存放位置、內容最多寫多長（token）
    enable_file_generation: bool = True
    generated_files_dir: str = "./generated"
    file_max_tokens: int = 3000

    # 桌面版程式（desktop/）：伺服器提供最新版讓桌面版自己更新；這裡是放 exe 和原始碼的資料夾（相對於專案根目錄）
    desktop_dir: str = "desktop"

    # 連接資料夾：只允許接這些資料夾底下的路徑（逗號分隔；空的＝除了系統資料夾都可以）
    connected_folder_roots: str = ""

    # 瀏覽器臨時資料夾（使用者在聊天室用瀏覽器選這台電腦的資料夾）：只附在「下一則」訊息，
    # 不建立 documents／document_chunks 紀錄、不留在磁碟上（寫暫存檔只是為了重用既有的解析器，解析完立刻刪）
    enable_browser_folder: bool = True
    browser_folder_max_files: int = 40
    browser_folder_max_total_mb: int = 50
    browser_folder_max_chars_per_file: int = 20000
    browser_folder_max_chars_total: int = 60000
    browser_folder_ttl_min: int = 10  # 附上後多久沒送出訊息就自動作廢

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
    # 送模型前最後一關：文件片段、記憶等「不是使用者打的字」也先篩過（藏指令／違禁詞的片段不送、個資遮罩）
    enable_context_guard: bool = True
    # 模型「回答」的檢查：外部圖片換成純文字（避免瀏覽器自動連出去把資料帶走）、個資遮罩
    enable_output_guard: bool = True
    enable_dlp: bool = True                    # A3: 關鍵字黑名單阻擋
    # DLP 黑名單，逗號分隔；可從環境變數覆寫
    dlp_blocklist: str = "最高機密,絕對機密,top secret,classified secret,薪資明細,客戶名單"

    # RAG 可調參數（Phase 3 預留）
    chat_history_messages: int = 4  # 每次帶給模型的歷史訊息數（約兩輪問答）；越多越慢
    rag_top_k: int = 2  # 純 CPU 筆電讀資料很慢：每多一段，7B 約多讀 20～30 秒；2 段已涵蓋展示問題的關鍵段落
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

    @model_validator(mode="after")
    def _validate_security_settings(self) -> "Settings":
        """
        關鍵安全檢查：
        1. production 環境必須自訂 SECRET_KEY（不能用內建 placeholder）
        2. SECRET_KEY 長度至少 32 字元（HS256 建議 ≥256 bits）
        3. development 環境用 placeholder 時：產生隨機 key 並「持久化到檔案」，
           下次啟動讀回同一把，避免每次重啟踢光所有 session（會把已登入的
           engineer/admin 從 chat 頁面踢出去 → 前端 token 失效 →
           refresh 也失敗 → 使用者掉到「Local User」狀態 → 體感 bug）。
        """
        is_production = self.app_env.lower() in {"production", "prod"}
        key_lower = self.secret_key.strip().lower()
        is_placeholder = (
            key_lower in _INSECURE_SECRET_KEYS
            or "do-not-use" in key_lower
            or "change" in key_lower and "production" in key_lower
        )

        if is_production:
            if is_placeholder:
                raise ValueError(
                    "SECURITY ERROR: app_env=production 但 SECRET_KEY 仍為預設值。"
                    "請在 .env 設定 SECRET_KEY=<自訂 32+ 字元隨機字串>。"
                    "可用 `python -c \"import secrets; print(secrets.token_urlsafe(48))\"` 產生。"
                )
            if len(self.secret_key) < 32:
                raise ValueError(
                    f"SECURITY ERROR: SECRET_KEY 長度 {len(self.secret_key)} 太短，"
                    "production 環境至少 32 字元。"
                )
        elif is_placeholder:
            # dev 模式：把隨機 key 持久化到 .runtime/dev-secret.key
            # - 第一次啟動 → 產生並寫檔
            # - 之後啟動 → 讀檔還原同一把 key（token 跨重啟仍有效）
            # - 使用者要重置就刪掉 .runtime/dev-secret.key 再啟動
            from pathlib import Path
            backend_dir = Path(__file__).resolve().parents[2]
            project_root = backend_dir.parent
            dev_key_path = project_root / ".runtime" / "dev-secret.key"

            try:
                if dev_key_path.exists():
                    cached = dev_key_path.read_text(encoding="utf-8").strip()
                    if cached and len(cached) >= 32:
                        self.secret_key = cached
                        logger.info(
                            "[SECURITY] dev 模式從 %s 讀回 SECRET_KEY（跨重啟保留登入狀態）",
                            dev_key_path,
                        )
                        return self

                # 第一次或檔案損毀：產生新 key 並寫檔
                new_key = secrets.token_urlsafe(48)
                dev_key_path.parent.mkdir(parents=True, exist_ok=True)
                dev_key_path.write_text(new_key, encoding="utf-8")
                self.secret_key = new_key
                logger.warning(
                    "[SECURITY] dev 模式產生新 SECRET_KEY 並寫入 %s（下次啟動會讀回）。"
                    "production 部署前請務必在 .env 設定固定 SECRET_KEY。",
                    dev_key_path,
                )
            except OSError as e:
                # 寫檔失敗 fallback 到「進程內隨機 key」（重啟會重置，但至少 backend 能起來）
                self.secret_key = secrets.token_urlsafe(48)
                logger.error(
                    "[SECURITY] 無法寫入 dev SECRET_KEY 到 %s（%s），"
                    "退回進程內隨機 key（重啟會踢光 session）",
                    dev_key_path, e,
                )

        return self

    @field_validator("rag_top_k")
    @classmethod
    def _validate_rag_top_k(cls, v: int) -> int:
        if v < 1 or v > 50:
            raise ValueError(f"rag_top_k 必須在 1-50 之間，目前 {v}")
        return v

    @field_validator("rag_similarity_threshold")
    @classmethod
    def _validate_rag_threshold(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:
            raise ValueError(f"rag_similarity_threshold 必須在 0.0-1.0 之間，目前 {v}")
        return v

    @field_validator("max_upload_size_mb")
    @classmethod
    def _validate_upload_size(cls, v: int) -> int:
        if v < 1 or v > 1024:
            raise ValueError(f"max_upload_size_mb 必須在 1-1024 之間，目前 {v}")
        return v

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    """取得設定單例"""
    return Settings()


settings = get_settings()
