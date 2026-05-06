"""
Corphia AI - One-click Launcher (PySide6)
==========================================

雙擊這支 exe（PyInstaller 打包後），按下「啟動所有服務」就會：
  1. 啟動 corphia-server.exe（FastAPI 後端 sidecar）
  2. 輪詢 /api/v1/health 等後端 ready
  3. 啟動 app.exe（Tauri 桌面視窗）
  4. 顯示三個狀態燈：後端 / 模型 / 前端

關閉 launcher 時自動殺掉所有 subprocess，不殘留 zombie process 占 8168 port。

預期檔案結構（同層）：
    Corphia AI/
    ├── corphia-launcher.exe         ← 這支（PySide6 入口）
    ├── corphia-server.exe           ← FastAPI backend
    ├── app.exe                      ← Tauri frontend
    ├── _internal/                   ← Python runtime + DLLs
    └── ai_model/                    ← 使用者放 GGUF 的地方

開發模式（直接 python 跑）：
    cd launcher
    python corphia_launcher.py

打包 exe：
    powershell -ExecutionPolicy Bypass -File build_launcher.ps1
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from typing import Optional
from urllib.error import URLError
from urllib.request import urlopen

from PySide6.QtCore import Qt, QProcess, QTimer, Signal
from PySide6.QtGui import QFont, QIcon, QPixmap
from PySide6.QtWidgets import (
    QApplication,
    QFrame,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QPushButton,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)


# ─── 配置 ─────────────────────────────────────────────────
BACKEND_HOST = "127.0.0.1"
BACKEND_PORT = 8168
HEALTH_URL = f"http://{BACKEND_HOST}:{BACKEND_PORT}/api/v1/health"
HEALTH_POLL_MS = 1500
HEALTH_TIMEOUT_S = 90  # backend 啟動最多等多久（要載 GGUF 模型，給寬一點）

# Corphia 品牌色
ACCENT_BRONZE = "#B49466"
DARK_BG = "#1F1F22"
DARK_SURFACE = "#2A2A2D"
TEXT_PRIMARY = "#F0EDE6"
TEXT_SECONDARY = "#A0998A"


def resolve_app_dir() -> Path:
    """
    決定 launcher 自己在哪——用來找隔壁的 corphia-server.exe / app.exe。
    PyInstaller 打包後 sys.executable 是 launcher exe；dev 模式則是 python.exe。
    Dev 模式 fallback 到專案結構推測（往上找）。
    """
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    # Dev 模式：corphia_launcher.py 在 launcher/ 下面，往上找 backend/ 跟 frontend/
    return Path(__file__).resolve().parent


def find_backend_exe(app_dir: Path) -> Optional[Path]:
    """找 corphia-server.exe。先看同層，再 fallback 到 dev 結構。"""
    candidates = [
        app_dir / "corphia-server.exe",
        app_dir.parent / "backend" / "dist" / "corphia-server" / "corphia-server.exe",
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


def find_frontend_exe(app_dir: Path) -> Optional[Path]:
    """找 app.exe（Tauri 主程式）。先看同層，再 fallback 到 dev 結構。"""
    candidates = [
        app_dir / "app.exe",
        app_dir / "Corphia AI.exe",
        app_dir.parent / "frontend" / "src-tauri" / "target" / "release" / "app.exe",
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


# ─── 狀態指示器小工具 ────────────────────────────────────
class StatusRow(QWidget):
    """單一狀態列：[●] 標籤名稱 ........ 狀態文字"""

    STATES = {
        "idle":     ("#555555", "未啟動"),
        "starting": ("#F59E0B", "啟動中…"),
        "ok":       ("#10B981", "運行中"),
        "error":    ("#EF4444", "失敗"),
    }

    def __init__(self, label: str):
        super().__init__()
        self.indicator = QLabel("●")
        self.indicator.setFixedWidth(16)
        f = QFont()
        f.setPointSize(14)
        self.indicator.setFont(f)

        self.label_widget = QLabel(label)
        self.label_widget.setStyleSheet(f"color: {TEXT_PRIMARY}; font-size: 13px;")

        self.status_text = QLabel()
        self.status_text.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
        self.status_text.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px;")

        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 4, 0, 4)
        layout.addWidget(self.indicator)
        layout.addSpacing(8)
        layout.addWidget(self.label_widget)
        layout.addStretch()
        layout.addWidget(self.status_text)

        self.set_state("idle")

    def set_state(self, state: str, custom_text: Optional[str] = None) -> None:
        color, default_text = self.STATES.get(state, self.STATES["idle"])
        self.indicator.setStyleSheet(f"color: {color};")
        self.status_text.setText(custom_text if custom_text else default_text)


# ─── 主視窗 ──────────────────────────────────────────────
class LauncherWindow(QMainWindow):
    backend_ready_signal = Signal()

    def __init__(self):
        super().__init__()
        self.app_dir = resolve_app_dir()
        self.backend_exe = find_backend_exe(self.app_dir)
        self.frontend_exe = find_frontend_exe(self.app_dir)

        self.backend_process: Optional[QProcess] = None
        self.frontend_process: Optional[QProcess] = None
        self.health_timer: Optional[QTimer] = None
        self.health_started_at: float = 0.0

        self._setup_ui()
        self._apply_dark_style()

    # ── UI 組裝 ──────────────────────────────────────────
    def _setup_ui(self):
        self.setWindowTitle("Corphia AI Launcher")
        self.setFixedSize(480, 560)

        central = QWidget()
        self.setCentralWidget(central)

        root = QVBoxLayout(central)
        root.setContentsMargins(32, 32, 32, 24)
        root.setSpacing(16)

        # 標題
        title = QLabel("Corphia AI")
        title.setStyleSheet(f"color: {TEXT_PRIMARY}; font-size: 28px; font-weight: 600;")
        title.setAlignment(Qt.AlignCenter)
        root.addWidget(title)

        subtitle = QLabel("地端 AI 知識引擎")
        subtitle.setStyleSheet(f"color: {ACCENT_BRONZE}; font-size: 13px; letter-spacing: 2px;")
        subtitle.setAlignment(Qt.AlignCenter)
        root.addWidget(subtitle)

        root.addSpacing(16)

        # 分隔線
        line = QFrame()
        line.setFrameShape(QFrame.HLine)
        line.setStyleSheet("color: #3A3A3D;")
        root.addWidget(line)

        # 狀態列
        self.row_backend = StatusRow("🔌  後端服務")
        self.row_model = StatusRow("🧠  AI 模型")
        self.row_frontend = StatusRow("🖥  前端視窗")
        root.addWidget(self.row_backend)
        root.addWidget(self.row_model)
        root.addWidget(self.row_frontend)

        root.addSpacing(8)

        # 主按鈕
        self.btn_action = QPushButton("啟動所有服務")
        self.btn_action.setMinimumHeight(48)
        self.btn_action.clicked.connect(self.on_action_clicked)
        root.addWidget(self.btn_action)

        # 日誌區
        log_label = QLabel("運行日誌")
        log_label.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 11px; letter-spacing: 1px;")
        root.addWidget(log_label)

        self.log_view = QTextEdit()
        self.log_view.setReadOnly(True)
        self.log_view.setMinimumHeight(140)
        font = QFont("Consolas", 9)
        if not font.exactMatch():
            font = QFont("Courier New", 9)
        self.log_view.setFont(font)
        root.addWidget(self.log_view, 1)

        # 底部資訊
        path_info = QLabel(f"目錄: {self.app_dir}")
        path_info.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 10px;")
        path_info.setWordWrap(True)
        root.addWidget(path_info)

        # 啟動時 sanity check
        self._sanity_check()

    def _apply_dark_style(self):
        self.setStyleSheet(
            f"""
            QMainWindow, QWidget {{
                background-color: {DARK_BG};
                color: {TEXT_PRIMARY};
            }}
            QPushButton {{
                background-color: {ACCENT_BRONZE};
                color: #1F1F22;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                padding: 10px 16px;
            }}
            QPushButton:hover {{
                background-color: #C2A276;
            }}
            QPushButton:disabled {{
                background-color: #4A4641;
                color: #888;
            }}
            QPushButton[stopMode="true"] {{
                background-color: #5A5A5D;
                color: {TEXT_PRIMARY};
            }}
            QPushButton[stopMode="true"]:hover {{
                background-color: #6A6A6D;
            }}
            QTextEdit {{
                background-color: {DARK_SURFACE};
                border: 1px solid #3A3A3D;
                border-radius: 6px;
                padding: 8px;
                color: {TEXT_PRIMARY};
            }}
            """
        )

    # ── 啟動前自我檢查 ───────────────────────────────────
    def _sanity_check(self):
        if not self.backend_exe:
            self.log("[!] 找不到 corphia-server.exe（後端執行檔）")
            self.log("    請確認跟 launcher 同層，或先跑 backend/build_backend.ps1")
            self.btn_action.setEnabled(False)
        else:
            self.log(f"[OK] 後端 exe: {self.backend_exe}")

        if not self.frontend_exe:
            self.log("[!] 找不到 app.exe（前端視窗）")
            self.log("    請確認跟 launcher 同層，或先跑 frontend tauri build")
            self.btn_action.setEnabled(False)
        else:
            self.log(f"[OK] 前端 exe: {self.frontend_exe}")

        if self.backend_exe and self.frontend_exe:
            self.log("─" * 50)
            self.log("環境檢查通過，可以按下「啟動所有服務」")

    # ── 主控制流程 ──────────────────────────────────────
    def on_action_clicked(self):
        if self.is_running():
            self.stop_all()
        else:
            self.start_all()

    def is_running(self) -> bool:
        return (
            self.backend_process is not None
            or self.frontend_process is not None
        )

    # 啟動：依序拉起 backend → 等 health → 拉起 frontend
    def start_all(self):
        self.log("─" * 50)
        self.log(">>> 開始啟動服務")
        self._set_action_button(running=True)

        # Step 1: 啟動 backend
        self.row_backend.set_state("starting")
        self.row_model.set_state("starting", "等待後端就緒…")
        self.row_frontend.set_state("idle", "等待後端就緒…")

        self.backend_process = QProcess(self)
        self.backend_process.setProcessChannelMode(QProcess.MergedChannels)
        self.backend_process.readyReadStandardOutput.connect(self._on_backend_stdout)
        self.backend_process.finished.connect(self._on_backend_finished)
        self.backend_process.errorOccurred.connect(self._on_backend_error)

        self.backend_process.setProgram(str(self.backend_exe))
        self.backend_process.setArguments([
            "--host", BACKEND_HOST,
            "--port", str(BACKEND_PORT),
        ])
        # 工作目錄設為 backend exe 所在地，讓 .env / ai_model 等相對路徑能找到
        self.backend_process.setWorkingDirectory(str(self.backend_exe.parent))
        self.backend_process.start()

        if not self.backend_process.waitForStarted(3000):
            self.log("[X] 後端啟動失敗（waitForStarted timeout）")
            self.row_backend.set_state("error")
            self.stop_all()
            return

        self.log(f"[OK] 後端已 spawn (pid={self.backend_process.processId()})")

        # Step 2: 開始輪詢 health
        self.health_started_at = time.time()
        self.health_timer = QTimer(self)
        self.health_timer.timeout.connect(self._poll_health)
        self.health_timer.start(HEALTH_POLL_MS)

    def _poll_health(self):
        # 超時保護
        if time.time() - self.health_started_at > HEALTH_TIMEOUT_S:
            self.log(f"[X] 後端 health check {HEALTH_TIMEOUT_S}s 超時")
            self.row_backend.set_state("error", "啟動逾時")
            self.row_model.set_state("error")
            if self.health_timer:
                self.health_timer.stop()
            return

        try:
            with urlopen(HEALTH_URL, timeout=1.5) as resp:
                if resp.status == 200:
                    if self.health_timer:
                        self.health_timer.stop()
                    self._on_backend_ready()
                    return
        except (URLError, TimeoutError, OSError):
            # 還沒 ready，下次再試
            pass

    def _on_backend_ready(self):
        self.log("[OK] 後端 /health 200 — 後端就緒")
        self.row_backend.set_state("ok")
        self.row_model.set_state("ok", "已載入")

        # Step 3: 啟動 frontend
        self.row_frontend.set_state("starting")
        self.frontend_process = QProcess(self)
        self.frontend_process.setProcessChannelMode(QProcess.MergedChannels)
        self.frontend_process.readyReadStandardOutput.connect(self._on_frontend_stdout)
        self.frontend_process.finished.connect(self._on_frontend_finished)
        self.frontend_process.errorOccurred.connect(self._on_frontend_error)
        self.frontend_process.setProgram(str(self.frontend_exe))
        self.frontend_process.setWorkingDirectory(str(self.frontend_exe.parent))
        self.frontend_process.start()

        if not self.frontend_process.waitForStarted(3000):
            self.log("[X] 前端啟動失敗")
            self.row_frontend.set_state("error")
            return

        self.log(f"[OK] 前端已 spawn (pid={self.frontend_process.processId()})")
        self.row_frontend.set_state("ok")

    # ── 停止 ────────────────────────────────────────────
    def stop_all(self):
        self.log(">>> 停止所有服務")
        if self.health_timer:
            self.health_timer.stop()
            self.health_timer = None

        # frontend 先停（避免使用者看到 backend 死掉但視窗還在）
        if self.frontend_process is not None:
            self._safe_kill(self.frontend_process, "frontend")
            self.frontend_process = None

        if self.backend_process is not None:
            self._safe_kill(self.backend_process, "backend")
            self.backend_process = None

        self.row_backend.set_state("idle")
        self.row_model.set_state("idle")
        self.row_frontend.set_state("idle")
        self._set_action_button(running=False)
        self.log("[OK] 已全部停止")

    def _safe_kill(self, proc: QProcess, name: str):
        if proc.state() == QProcess.NotRunning:
            return
        proc.terminate()
        if not proc.waitForFinished(3000):
            self.log(f"[!] {name} 不回應 SIGTERM，強制 kill")
            proc.kill()
            proc.waitForFinished(2000)

    # ── 事件 handler ────────────────────────────────────
    def _on_backend_stdout(self):
        if not self.backend_process:
            return
        data = bytes(self.backend_process.readAllStandardOutput()).decode("utf-8", errors="replace")
        for line in data.splitlines():
            if line.strip():
                self.log(f"[backend] {line}")

    def _on_frontend_stdout(self):
        if not self.frontend_process:
            return
        data = bytes(self.frontend_process.readAllStandardOutput()).decode("utf-8", errors="replace")
        for line in data.splitlines():
            if line.strip():
                self.log(f"[frontend] {line}")

    def _on_backend_finished(self, exit_code: int, _exit_status):
        self.log(f"[backend] process exited, code={exit_code}")
        self.row_backend.set_state("error" if exit_code != 0 else "idle")
        self.row_model.set_state("idle")

    def _on_frontend_finished(self, exit_code: int, _exit_status):
        self.log(f"[frontend] window closed, code={exit_code}")
        self.row_frontend.set_state("idle")
        # 使用者關掉前端視窗 → 也順手停掉後端
        if self.backend_process is not None:
            self.stop_all()

    def _on_backend_error(self, err):
        self.log(f"[backend] QProcess error: {err}")

    def _on_frontend_error(self, err):
        self.log(f"[frontend] QProcess error: {err}")

    # ── 工具 ────────────────────────────────────────────
    def _set_action_button(self, running: bool):
        if running:
            self.btn_action.setText("停止所有服務")
            self.btn_action.setProperty("stopMode", True)
        else:
            self.btn_action.setText("啟動所有服務")
            self.btn_action.setProperty("stopMode", False)
        # 重新套樣式
        self.btn_action.style().unpolish(self.btn_action)
        self.btn_action.style().polish(self.btn_action)

    def log(self, message: str):
        timestamp = time.strftime("%H:%M:%S")
        self.log_view.append(f"[{timestamp}] {message}")
        # 自動捲到底
        self.log_view.verticalScrollBar().setValue(
            self.log_view.verticalScrollBar().maximum()
        )

    # 視窗關閉前殺掉所有 subprocess
    def closeEvent(self, event):
        self.stop_all()
        event.accept()


def main():
    app = QApplication(sys.argv)
    app.setApplicationName("Corphia AI Launcher")

    # 嘗試載 Corphia icon（如果有）
    app_dir = resolve_app_dir()
    icon_candidates = [
        app_dir / "icon.ico",
        app_dir.parent / "frontend" / "src-tauri" / "icons" / "icon.ico",
    ]
    for ic in icon_candidates:
        if ic.exists():
            app.setWindowIcon(QIcon(str(ic)))
            break

    window = LauncherWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
