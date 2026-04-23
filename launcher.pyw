import tkinter as tk
from tkinter import font
import subprocess
import threading
import sys
import os
import webbrowser

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class LauncherApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Corphia AI - 企業級本地部署引擎")
        self.root.geometry("500x300")
        self.root.configure(bg="#1E1E1E")
        self.root.resizable(False, False)
        
        # 讓視窗置中
        self.root.update_idletasks()
        width = self.root.winfo_width()
        height = self.root.winfo_height()
        x = (self.root.winfo_screenwidth() // 2) - (width // 2)
        y = (self.root.winfo_screenheight() // 2) - (height // 2)
        self.root.geometry(f'+{x}+{y}')

        # 攔截右上角 X 按鈕
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

        # UI 元件
        title_font = font.Font(family="Microsoft JhengHei", size=18, weight="bold")
        self.lbl_title = tk.Label(root, text="Corphia AI Platform", font=title_font, bg="#1E1E1E", fg="#FFFFFF")
        self.lbl_title.pack(pady=(20, 5))

        self.lbl_status = tk.Label(root, text="🚀 正在啟動引擎...", font=("Microsoft JhengHei", 11), bg="#1E1E1E", fg="#BB86FC")
        self.lbl_status.pack(pady=(0, 10))

        # 日誌輸出框 (黑底綠字，類似終端機風格)
        self.txt_log = tk.Text(root, height=6, width=60, bg="#121212", fg="#A0A0A0", bd=0, 
                               font=("Consolas", 9), state=tk.DISABLED, padx=10, pady=10)
        self.txt_log.pack(pady=5, padx=20)

        # 按鈕區塊
        btn_frame = tk.Frame(root, bg="#1E1E1E")
        btn_frame.pack(pady=15)

        # 開啟瀏覽器按鈕 (預設禁用，啟動完成後啟用)
        self.btn_browser = tk.Button(btn_frame, text="🌍 開啟系統", width=15, bg="#4CAF50", fg="white", bd=0,
                                     font=("Microsoft JhengHei", 10, "bold"), cursor="hand2", 
                                     command=self.open_browser, state=tk.DISABLED)
        self.btn_browser.grid(row=0, column=0, padx=10)

        # 關閉按鈕
        self.btn_stop = tk.Button(btn_frame, text="🛑 關閉系統", width=15, bg="#D32F2F", fg="white", bd=0,
                                  font=("Microsoft JhengHei", 10, "bold"), cursor="hand2", 
                                  command=self.on_closing)
        self.btn_stop.grid(row=0, column=1, padx=10)

        self.process = None
        self.start_engine()

    def log(self, msg):
        """將 start.py 的輸出印到 GUI 的文字框中"""
        msg = msg.strip()
        if not msg:
            return
        
        self.txt_log.config(state=tk.NORMAL)
        self.txt_log.insert(tk.END, msg + "\n")
        self.txt_log.see(tk.END)
        self.txt_log.config(state=tk.DISABLED)
        
        # 捕捉關鍵字來更新狀態標題
        if "啟動中" in msg or "正在" in msg or "[" in msg:
            self.lbl_status.config(text=msg.strip())
        
        if "Corphia AI Platform 已全面啟動" in msg:
            self.lbl_status.config(text="✅ 系統已全面啟動，運作中！", fg="#4CAF50")
            self.btn_browser.config(state=tk.NORMAL)
            self.btn_browser.config(bg="#388E3C")

    def start_engine(self):
        """在背景隱藏模式下執行 start.py"""
        cmd = [sys.executable, "start.py"]
        CREATE_NO_WINDOW = 0x08000000
        
        self.process = subprocess.Popen(
            cmd,
            cwd=BASE_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            creationflags=CREATE_NO_WINDOW
        )

        # 啟動背景執行緒來讀取輸出
        threading.Thread(target=self.read_output, daemon=True).start()

    def read_output(self):
        # 逐行讀取子程序的輸出
        for line in iter(self.process.stdout.readline, ''):
            self.root.after(0, self.log, line)

    def open_browser(self):
        webbrowser.open("http://localhost:5173")

    def on_closing(self):
        """關閉程式時，確保清理所有子執行緒與佔用"""
        self.btn_stop.config(text="關閉中...", state=tk.DISABLED)
        self.lbl_status.config(text="🛑 正在安全關閉所有服務...", fg="#D32F2F")
        self.root.update()
        
        if self.process:
            try:
                # 透過 taskkill /T /F 徹底斬草除根殺掉 start.py 及其所有子程序 (npm, uvicorn)
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(self.process.pid)],
                    capture_output=True,
                    creationflags=0x08000000
                )
            except Exception:
                pass
                
        self.root.destroy()

if __name__ == "__main__":
    root = tk.Tk()
    app = LauncherApp(root)
    root.mainloop()
