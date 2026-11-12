# Corphia AI 桌面版

一個視窗顯示公司伺服器上的介面，加上本機小幫手：操控這台電腦的 Word、Excel、PowerPoint。

| 檔案 | 用途 |
|---|---|
| `corphia_desktop.py` | 視窗、和介面之間的橋、連線設定頁、自我檢查 |
| `office_bridge.py` | 操控 Office：讀內容、寫入、開啟 AI 產出的檔案、改檔前備份 |
| `build.bat` | 打包成 `dist\Corphia AI.exe` |

## 打包

```
python -m venv .venv
.venv\Scripts\pip install pywin32 pywebview pyinstaller
build.bat
```

## 使用

- 直接執行 `Corphia AI.exe`；預設連 `http://localhost:5173`，連不上會出現設定頁可以改位址。
- 指定伺服器：`"Corphia AI.exe" --server http://192.168.1.10:5173`（會記住）。
- 自我檢查：`"Corphia AI.exe" --selftest result.json`（載入介面、測一次橋、寫結果後自動關閉）。

設定存在 `%APPDATA%\CorphiaAI\desktop.json`；登入狀態存在 `%LOCALAPPDATA%\CorphiaAI\webview`；
改檔前的備份在 `%LOCALAPPDATA%\CorphiaAI\backups`；AI 產出的檔案開啟時存到「文件\Corphia AI 產出」。

## 安全設計

- 只有「目前顯示的是設定的那台伺服器」而且帶著「這一頁的通行碼」的呼叫才會動到 Office。通行碼在伺服器的頁面載入完成時才發給它，
  每次載入換一把、換頁就作廢；別的網頁（包含被帶去的外部網頁）拿不到。沒帶通行碼只查得到版本，查不到開著的文件名稱。
- 點到外部連結會改用系統瀏覽器開，視窗只顯示伺服器的頁面；改伺服器位址只有內建的連線設定頁可以做。
- Word 寫入可以按 Ctrl+Z 復原；Excel 用程式寫入不能復原，所以要填的範圍裡只要有資料就不寫，會請使用者改選空白的位置。
- Office 正在忙（開著對話框、Excel 正在編輯儲存格）或沒回應時，會回清楚的原因，不會讓介面一直等。
- 自動更新只向設定的那台伺服器下載，並核對檔案大小與 SHA-256。伺服器若用 http（沒有加密），同一個網路上的人理論上可以竄改傳輸內容；
  對外或跨網段使用時請讓伺服器走 https。
