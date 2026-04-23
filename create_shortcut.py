import os
import sys
import subprocess

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def create_desktop_shortcut():
    # 取得桌面路徑
    desktop = os.path.join(os.environ["USERPROFILE"], "Desktop")
    shortcut_path = os.path.join(desktop, "Corphia AI.lnk")
    
    # 目標執行檔 (使用 pythonw.exe 避免終端機視窗)
    target_path = sys.executable.replace("python.exe", "pythonw.exe")
    if not os.path.exists(target_path):
        target_path = sys.executable # fallback
        
    launcher_path = os.path.join(BASE_DIR, "launcher.pyw")
    working_dir = BASE_DIR
    
    # 建立 VBScript 來生成捷徑
    vbs_script = f"""
Set ws = CreateObject("WScript.Shell")
Set shortcut = ws.CreateShortcut("{shortcut_path}")
shortcut.TargetPath = "{target_path}"
shortcut.Arguments = Chr(34) & "{launcher_path}" & Chr(34)
shortcut.WorkingDirectory = "{working_dir}"
shortcut.Save
"""
    
    vbs_path = os.path.join(BASE_DIR, "temp_shortcut.vbs")
    with open(vbs_path, "w", encoding="utf-8") as f:
        f.write(vbs_script)
        
    try:
        subprocess.run(["cscript.exe", "//Nologo", vbs_path], check=True)
        print(f"[OK] 成功建立桌面捷徑：{shortcut_path}")
    except Exception as e:
        print(f"[ERROR] 建立捷徑失敗：{e}")
    finally:
        if os.path.exists(vbs_path):
            os.remove(vbs_path)

if __name__ == "__main__":
    create_desktop_shortcut()
