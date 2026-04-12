#!/bin/bash
# -----------------------------------------------------------------------------
# Corphia AI Platform - Backup Script
# 用途：將資料庫、上傳文件及向量資料庫打包成 gz 備份壓縮檔
# -----------------------------------------------------------------------------

BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/corphia_backup_${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "⏳ 開始執行備份作業..."

# 你可以依據需求增減目錄或檔案
# 如果資料量極大，可以考慮分別壓縮
tar -czvf "$BACKUP_FILE" \
    --exclude="uploads/tmp/*" \
    --exclude="chroma_data/*.lock" \
    corphia.db \
    uploads/ \
    chroma_data/

if [ $? -eq 0 ]; then
    echo "✅ 備份成功！檔案儲存於: $BACKUP_FILE"
else
    echo "❌ 備份過程中發生錯誤！"
fi
