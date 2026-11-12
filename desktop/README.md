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
