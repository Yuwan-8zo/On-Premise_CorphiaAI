# Corphia AI development launcher.
# This delegates to the root one-click launcher:
#   - Docker PostgreSQL + pgvector
#   - backend dependency checks and llama-cpp-python
#   - database initialization
#   - FastAPI backend
#   - Vite frontend

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location -Path $root

python start.py
