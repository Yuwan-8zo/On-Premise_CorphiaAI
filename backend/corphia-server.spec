# -*- mode: python ; coding: utf-8 -*-
"""
Corphia AI Backend — PyInstaller spec
======================================

把 FastAPI + llama-cpp-python + asyncpg + sentence-transformers 整套
打包成單一 exe（onedir 模式）。

為什麼用 onedir 不用 onefile：
  - onefile 啟動時要解壓到 temp，慢（10~30 秒）
  - 我們的後端啟動本來就要載 5GB 模型，再加解壓延遲體驗很差
  - onedir 模式下檔案散在 dist/corphia-server/，啟動速度跟跑 Python 一樣快
  - Tauri sidecar 包進 .msi 安裝檔時 onedir 也沒差，使用者反正是裝完才用

build 指令：
    cd backend
    .\.venv\Scripts\pyinstaller.exe corphia-server.spec --noconfirm --clean

產出：
    backend/dist/corphia-server/corphia-server.exe   ← 主執行檔
    backend/dist/corphia-server/_internal/...        ← 依賴檔案

之後 Tauri 會從這個 dist/corphia-server/ 撈整個資料夾打包進安裝檔。
"""

from PyInstaller.utils.hooks import (
    collect_submodules,
    collect_data_files,
    collect_dynamic_libs,
)


# ---------------------------------------------------------------------------
# Hidden imports
# ---------------------------------------------------------------------------
# PyInstaller 用靜態分析找 import，但很多套件用 importlib / __import__ 動態載入，
# 必須手動列出來。下面這份是踩過的雷集合：

hiddenimports = []

# FastAPI 整套（含 starlette / pydantic 內部子模組）
hiddenimports += collect_submodules("fastapi")
hiddenimports += collect_submodules("starlette")
hiddenimports += collect_submodules("pydantic")
hiddenimports += collect_submodules("pydantic_core")

# uvicorn workers（uvicorn 用 import_string 載 worker class，靜態分析看不到）
hiddenimports += [
    "uvicorn.workers",
    "uvicorn.protocols.http.httptools_impl",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets.websockets_impl",
    "uvicorn.protocols.websockets.wsproto_impl",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.loops.uvloop",
]

# SQLAlchemy + asyncpg（dialect 動態載入）
hiddenimports += collect_submodules("sqlalchemy")
hiddenimports += [
    "sqlalchemy.dialects.postgresql.asyncpg",
    "sqlalchemy.ext.asyncio",
    "asyncpg",
    "asyncpg.protocol",
    "asyncpg.protocol.protocol",
]

# pgvector（自動註冊到 SQLAlchemy / asyncpg）
hiddenimports += collect_submodules("pgvector")

# llama-cpp-python（C++ binding + 多種 backend）
hiddenimports += collect_submodules("llama_cpp")

# sentence-transformers / transformers（模型載入時很多動態 import）
hiddenimports += collect_submodules("sentence_transformers")
hiddenimports += collect_submodules("transformers")
hiddenimports += collect_submodules("tokenizers")
hiddenimports += collect_submodules("safetensors")

# torch（CPU 版；CUDA 版會自動拉 CUDA DLL）
hiddenimports += collect_submodules("torch")

# python-jose 整套子模組（jose 用 lazy import，PyInstaller 抓不到）
# 沒這個會看到：ImportError: cannot import name 'jwt' from 'jose'
hiddenimports += collect_submodules("jose")

# 其他常見動態載入
hiddenimports += [
    "email_validator",
    "passlib.handlers.bcrypt",
    "passlib.handlers.argon2",
    "jose.jwt",
    "jose.jws",
    "jose.jwe",
    "jose.jwk",
    "jose.exceptions",
    "jose.backends.cryptography_backend",
    "ecdsa",  # jose 的 ECDSA 後端
    "rsa",    # jose 的 RSA 後端
    "multipart",
    "anyio._backends._asyncio",
    "websockets.legacy",
    "websockets.legacy.server",
    "websockets.legacy.client",
    # asyncpg scram.pyx → stringprep → unicodedata（C extension）
    # 沒這幾個會看到：ModuleNotFoundError: No module named 'unicodedata'
    "unicodedata",
    "stringprep",
    "asyncpg.protocol.scram",
]


# ---------------------------------------------------------------------------
# Data files
# ---------------------------------------------------------------------------
# 套件附帶的非 .py 檔（json schema、locale、模型 vocab 等）

datas = []
datas += collect_data_files("fastapi")
datas += collect_data_files("starlette")
datas += collect_data_files("pydantic")
datas += collect_data_files("llama_cpp")
datas += collect_data_files("sentence_transformers")
datas += collect_data_files("transformers")
datas += collect_data_files("tokenizers")
datas += collect_data_files("certifi")  # CA bundle for HTTPS

# 我們自己的 app/ 目錄（PyInstaller 應該自己找到，但保險起見明列）
datas += [("app", "app")]

# alembic migration 腳本（部署到新 DB 時要執行）
import os
if os.path.isdir("alembic"):
    datas += [("alembic", "alembic")]
    datas += [("alembic.ini", ".")]


# ---------------------------------------------------------------------------
# Binary files (DLL / .so)
# ---------------------------------------------------------------------------
# llama-cpp-python 自帶編譯好的 llama.dll / llama_cpp_lib.dll
# torch 帶 CUDA / CPU runtime DLL
# tokenizers 帶 Rust 編譯的 tokenizers.pyd

binaries = []
binaries += collect_dynamic_libs("llama_cpp")
binaries += collect_dynamic_libs("torch")
binaries += collect_dynamic_libs("tokenizers")
binaries += collect_dynamic_libs("safetensors")
binaries += collect_dynamic_libs("asyncpg")


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------
a = Analysis(
    ["corphia_server.py"],
    pathex=["."],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # 我們不用，去掉省 100MB+
        # 注意：不要排除 "test" / "tests" / "unittest" — 這會牽動 stdlib 內部交叉
        # 引用，看似省空間但會踩到 asyncpg / pydantic 等 import 鏈
        "tkinter",
        "matplotlib",
        "PIL.ImageTk",
        "pytest",
        "IPython",
        "jupyter",
        "notebook",
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)


# ---------------------------------------------------------------------------
# Executable
# ---------------------------------------------------------------------------
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="corphia-server",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,            # UPX 壓縮會被防毒誤判
    console=True,         # ⚠️ Tauri sidecar 模式可改 False 隱藏終端視窗
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,            # backend 不需 icon（隱藏視窗）
)


# ---------------------------------------------------------------------------
# COLLECT — 把所有東西收進 dist/corphia-server/ 資料夾
# ---------------------------------------------------------------------------
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="corphia-server",
)
