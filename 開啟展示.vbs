' ══════════════════════════════════════════════
' Corphia AI 展示啟動器
' 雙擊此檔案即可啟動展示，不需要終端機
' ══════════════════════════════════════════════
Option Explicit

Dim shell, fso, dir, port

Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

' 取得此 .vbs 所在目錄（即專案根目錄）
dir  = fso.GetParentFolderName(WScript.ScriptFullName)
port = 5174

' 在背景啟動 npx serve（視窗隱藏，使用者看不到）
shell.Run "cmd /c cd /d """ & dir & """ && npx --yes serve -l " & port & " --no-request-logging", 0, False

' 等伺服器啟動（2 秒）
WScript.Sleep 2000

' 開啟瀏覽器
shell.Run "http://localhost:" & port & "/Corphia-Demo.html"

' 通知使用者
MsgBox "Corphia 展示已啟動！" & Chr(13) & Chr(13) & _
       "請在瀏覽器中操作展示。" & Chr(13) & _
       "錄影結束後，直接關閉此訊息即可。", _
       64, "Corphia AI 展示模式"

' 結束背景伺服器
shell.Run "cmd /c taskkill /f /im node.exe >nul 2>&1", 0, True
