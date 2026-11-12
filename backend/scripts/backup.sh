#!/bin/bash
# 這支是舊版（資料庫還是單一檔案時）留下來的入口；現在資料庫是 PostgreSQL，備份改由 backup.py 處理。
# 用法（在專案根目錄）：bash backend/scripts/backup.sh
#   其他功能（列出、還原演練、還原）請直接用 backup.py，說明在檔案開頭。
cd "$(dirname "$0")/../.." || exit 1
if [ -x backend/.venv/Scripts/python.exe ]; then PY=backend/.venv/Scripts/python.exe; else PY=python; fi
exec "$PY" backend/scripts/backup.py create "$@"
