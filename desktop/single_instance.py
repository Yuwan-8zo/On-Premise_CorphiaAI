"""
桌面版一次只開一個 (single_instance.py)

為什麼需要：桌面版自己啟動這台電腦的服務，關視窗時一起關掉。同時開兩個的話——
  - 兩個都以為服務沒開，各自啟動一次，互相把對方剛開好的服務關掉重來；
  - 關掉其中一個視窗時，它會把服務整個關掉，另一個視窗就停在「等待後端回應」動不了。
點兩下後幾秒內沒有畫面時，使用者很容易再點一次，所以這個情況很常發生。

做法：用 Windows 的具名鎖（同一個登入的使用者共用一個名字）。已經有一個在跑，就把它的視窗叫到最前面，自己結束。
"""

from __future__ import annotations

import ctypes
import sys
from typing import Optional

# 同一個登入工作階段裡唯一（不同使用者各自可以開一個）
MUTEX_NAME = "Local\\CorphiaAI.Desktop.SingleInstance"
ERROR_ALREADY_EXISTS = 183
SW_RESTORE = 9


def acquire(name: str = MUTEX_NAME) -> Optional[int]:
    """
    佔住「我是唯一的那一個」。成功回一個代碼（要一直留著，程式結束時系統自動放掉）；
    已經有別的在跑回 None。不是 Windows 就不管（回一個非零值）。
    """
    if sys.platform != "win32":
        return 1
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateMutexW.restype = ctypes.c_void_p
    kernel32.CreateMutexW.argtypes = [ctypes.c_void_p, ctypes.c_bool, ctypes.c_wchar_p]
    kernel32.CloseHandle.argtypes = [ctypes.c_void_p]
    handle = kernel32.CreateMutexW(None, False, name)
    if not handle:
        return 1  # 連鎖都建不出來（極少見）：寧可照常開，不要讓使用者完全開不了
    if ctypes.get_last_error() == ERROR_ALREADY_EXISTS:
        kernel32.CloseHandle(handle)
        return None
    return handle


def release(handle: Optional[int]) -> None:
    """提早放掉（測試用；正常情況程式結束時系統會自動放）"""
    if sys.platform == "win32" and handle and handle != 1:
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.CloseHandle.argtypes = [ctypes.c_void_p]
        kernel32.CloseHandle(handle)


def focus_existing(title: str) -> bool:
    """把已經開著的那個視窗叫到最前面（縮小了就還原）；找不到回 False"""
    if sys.platform != "win32":
        return False
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    user32.FindWindowW.restype = ctypes.c_void_p
    user32.FindWindowW.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p]
    for fn in (user32.IsIconic, user32.SetForegroundWindow):
        fn.argtypes = [ctypes.c_void_p]
    user32.ShowWindow.argtypes = [ctypes.c_void_p, ctypes.c_int]
    hwnd = user32.FindWindowW(None, title)
    if not hwnd:
        return False
    if user32.IsIconic(hwnd):
        user32.ShowWindow(hwnd, SW_RESTORE)
    user32.SetForegroundWindow(hwnd)
    return True
