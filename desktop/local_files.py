"""
把 AI 寫的內容（程式碼、文字）存成這台電腦上的檔案（桌面版用）

每一次都是使用者按「存檔」、在系統的「另存新檔」視窗裡自己選位置和檔名才寫，小幫手不會主動寫任何東西。
這個檔案只管「可不可以寫、怎麼寫」，不碰視窗（另存新檔視窗在 corphia_desktop.py），判斷邏輯可以單獨測試。

安全：
  - 預設位置是「文件\\Corphia AI 產出」；使用者可以改存到別的地方
  - 不寫進系統資料夾（Windows、Program Files、ProgramData）和「開機自動執行」資料夾：
    AI 的回答可能被惡意內容誘導，寫一個開機就會執行的檔案是最直接的攻擊方式
  - 只收文字（UTF-8），有大小上限；檔名去掉路徑和不能用的字元
  - 蓋掉已經存在的檔案之前，先備份舊的那一份到 %LOCALAPPDATA%\\CorphiaAI\\backups，回傳備份位置
"""

from __future__ import annotations

import os
import re
import shutil
import time
from pathlib import Path

OUTPUT_FOLDER = "Corphia AI 產出"
DEFAULT_NAME = "AI 產出.txt"
# 一個檔案最多寫多少字（程式碼、文件都遠小於這個；擋的是異常的超大內容）
MAX_CHARS = 2_000_000
NAME_MAX = 120
_BAD_CHARS = re.compile(r'[\\/:*?"<>|\r\n\t\x00-\x1f]')
# Windows 的保留檔名（存成這些名字會出錯或寫到裝置上）
_RESERVED = {"con", "prn", "aux", "nul", *(f"com{i}" for i in range(1, 10)), *(f"lpt{i}" for i in range(1, 10))}
# 「開機自動執行」資料夾（每個使用者一份、全機一份）路徑裡固定有這一段
_STARTUP_MARK = ("start menu", "programs", "startup")


class SaveError(Exception):
    """給使用者看的錯誤"""


def output_dir() -> Path:
    return Path(os.environ.get("USERPROFILE") or Path.home()) / "Documents" / OUTPUT_FOLDER


def backup_dir() -> Path:
    return Path(os.environ.get("LOCALAPPDATA") or Path.home()) / "CorphiaAI" / "backups"


def safe_name(filename: str) -> str:
    """建議檔名：只留檔名本身（去掉路徑）、拿掉不能用的字元；空的、保留名稱用預設檔名"""
    name = _BAD_CHARS.sub(" ", os.path.basename((filename or "").replace("\\", "/"))).strip(" .")[:NAME_MAX].strip(" .")
    if not name or Path(name).stem.lower() in _RESERVED:
        return DEFAULT_NAME
    return name


def _protected_roots() -> list[Path]:
    env = os.environ
    roots = [env.get("SystemRoot") or env.get("WINDIR"), env.get("ProgramFiles"), env.get("ProgramFiles(x86)"), env.get("ProgramData")]
    return [Path(r).resolve() for r in roots if r]


def is_protected(path: Path) -> bool:
    """這個位置不能寫：系統資料夾，或開機自動執行資料夾"""
    target = path.resolve()
    parts = [p.lower() for p in target.parts]
    for i in range(len(parts) - len(_STARTUP_MARK) + 1):
        if tuple(parts[i:i + len(_STARTUP_MARK)]) == _STARTUP_MARK:
            return True
    return any(target == root or root in target.parents for root in _protected_roots())


def save_text(path_text: str, content: str) -> dict:
    """把文字寫到使用者選的位置。回 {"path", "name", "chars", "backup"}；不能寫就丟 SaveError"""
    if not isinstance(content, str) or not content:
        raise SaveError("沒有內容可以存")
    if len(content) > MAX_CHARS:
        raise SaveError("內容太大，無法存成檔案")
    path = Path(path_text)
    if not path.is_absolute() or safe_name(path.name) != path.name:
        raise SaveError("檔名不能使用，請換一個名稱")
    if is_protected(path):
        raise SaveError("不能存到系統資料夾或開機自動執行的資料夾，請選別的位置")
    backup = None
    try:
        if path.exists():
            if not path.is_file():
                raise SaveError("這個名稱已經是一個資料夾，請換一個名稱")
            folder = backup_dir()
            folder.mkdir(parents=True, exist_ok=True)
            backup = folder / f"{path.stem}-{time.strftime('%Y%m%d-%H%M%S')}{path.suffix}"
            shutil.copy2(path, backup)
        path.parent.mkdir(parents=True, exist_ok=True)
        # newline=""：內容裡的換行原樣寫入，不讓 Windows 把 \n 再變成 \r\n（程式碼的換行不該被改）
        with open(path, "w", encoding="utf-8", newline="") as f:
            f.write(content)
    except SaveError:
        raise
    except OSError as e:
        raise SaveError(f"存檔失敗：{e.strerror or e}") from None
    return {"path": str(path), "name": path.name, "chars": len(content), "backup": str(backup) if backup else None}
