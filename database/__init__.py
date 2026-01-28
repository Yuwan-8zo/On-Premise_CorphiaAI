"""
Database Layer - 資料庫層

Corphia AI Platform 三層架構之一：
- frontend: 前端 React 應用
- backend: 後端 FastAPI 服務
- database: 資料庫模型與遷移
"""

from database.connection import (
    engine,
    async_session_maker,
    get_db,
    init_db,
    close_db,
    Base,
)

__all__ = [
    "engine",
    "async_session_maker",
    "get_db",
    "init_db",
    "close_db",
    "Base",
]
