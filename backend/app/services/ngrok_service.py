from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


NGROK_API_PORTS = (4040, 4041, 4042)
FRONTEND_PORT = 5173
MANAGED_ENV_START = "# >>> Corphia ngrok runtime (auto-generated)"
MANAGED_ENV_END = "# <<< Corphia ngrok runtime"


def project_root() -> Path:
    return Path(__file__).resolve().parents[3]


@dataclass
class NgrokState:
    active: bool
    url: str | None = None
    api_url: str | None = None
    ws_url: str | None = None
    api_port: int | None = None
    updated_at: str | None = None
    source: str = "live"

    @classmethod
    def inactive(cls, source: str = "live") -> "NgrokState":
        return cls(
            active=False,
            url=None,
            api_url=None,
            ws_url=None,
            api_port=None,
            updated_at=_now_iso(),
            source=source,
        )

    @classmethod
    def from_url(cls, url: str, api_port: int | None, source: str = "live") -> "NgrokState":
        return cls(
            active=True,
            url=url,
            api_url=f"{url}/api/v1/",
            ws_url=url.replace("https://", "wss://").replace("http://", "ws://") + "/ws/",
            api_port=api_port,
            updated_at=_now_iso(),
            source=source,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "active": self.active,
            "url": self.url,
            "api_url": self.api_url,
            "ws_url": self.ws_url,
            "api_port": self.api_port,
            "updated_at": self.updated_at,
            "source": self.source,
        }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _runtime_dir(root_dir: Path | None = None) -> Path:
    return (root_dir or project_root()) / ".runtime"


def _runtime_json_path(root_dir: Path | None = None) -> Path:
    return _runtime_dir(root_dir) / "ngrok.json"


def _runtime_env_path(root_dir: Path | None = None) -> Path:
    return _runtime_dir(root_dir) / "ngrok.env"


def _frontend_env_local_path(root_dir: Path | None = None) -> Path:
    return (root_dir or project_root()) / "frontend" / ".env.local"


def find_ngrok_binary(base_dir: str | os.PathLike[str] | None = None) -> str | None:
    root_dir = Path(base_dir) if base_dir else project_root()
    candidates = [
        Path(r"C:\ngrok\ngrok.exe"),
        root_dir / "ngrok.exe",
        Path(os.environ.get("USERPROFILE", "")) / "ngrok.exe",
        Path(r"C:\Windows\System32\ngrok.exe"),
    ]

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)

    ngrok_in_path = shutil.which("ngrok")
    if ngrok_in_path and "WindowsApps" not in ngrok_in_path and "msix" not in ngrok_in_path.lower():
        return ngrok_in_path

    return None


def query_ngrok_state(
    api_ports: tuple[int, ...] = NGROK_API_PORTS,
    frontend_port: int | None = FRONTEND_PORT,
) -> NgrokState:
    for api_port in api_ports:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{api_port}/api/tunnels", timeout=2) as response:
                data = json.loads(response.read())

            tunnels = _prefer_port(data.get("tunnels", []), frontend_port)
            https_url = _pick_public_url(tunnels, preferred_scheme="https://")
            if https_url:
                return NgrokState.from_url(https_url, api_port, source="live")

            http_url = _pick_public_url(tunnels, preferred_scheme="http://")
            if http_url:
                return NgrokState.from_url(http_url, api_port, source="live")
        except Exception:
            continue

    return NgrokState.inactive()


def _prefer_port(tunnels: list[dict[str, Any]], frontend_port: int | None) -> list[dict[str, Any]]:
    if frontend_port is None:
        return tunnels

    port = str(frontend_port)
    matching: list[dict[str, Any]] = []
    rest: list[dict[str, Any]] = []
    for tunnel in tunnels:
        addr = str(tunnel.get("config", {}).get("addr", ""))
        if addr.endswith(f":{port}") or f":{port}/" in addr:
            matching.append(tunnel)
        else:
            rest.append(tunnel)
    return matching + rest


def _pick_public_url(tunnels: list[dict[str, Any]], preferred_scheme: str) -> str | None:
    for tunnel in tunnels:
        public_url = tunnel.get("public_url")
        if isinstance(public_url, str) and public_url.startswith(preferred_scheme):
            return public_url.rstrip("/")
    return None


def load_runtime_state(root_dir: Path | None = None) -> NgrokState:
    path = _runtime_json_path(root_dir)
    if not path.exists():
        return NgrokState.inactive(source="runtime_file")

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return NgrokState(
            active=False,
            url=data.get("url"),
            api_url=data.get("api_url"),
            ws_url=data.get("ws_url"),
            api_port=data.get("api_port"),
            updated_at=data.get("updated_at"),
            source="runtime_file",
        )
    except Exception:
        return NgrokState.inactive(source="runtime_file")


def get_ngrok_state(root_dir: Path | None = None, include_stale: bool = True) -> NgrokState:
    state = query_ngrok_state()
    if state.active:
        write_ngrok_runtime(state, root_dir)
        return state

    if include_stale:
        cached = load_runtime_state(root_dir)
        if cached.url:
            return cached

    return state


def write_ngrok_runtime(state: NgrokState, root_dir: Path | None = None) -> None:
    root = root_dir or project_root()
    runtime_dir = _runtime_dir(root)
    runtime_dir.mkdir(parents=True, exist_ok=True)

    payload = state.to_dict()
    _runtime_json_path(root).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    _runtime_env_path(root).write_text(_render_runtime_env(state), encoding="utf-8")
    _update_frontend_env_local(root, state)


def _render_runtime_env(state: NgrokState) -> str:
    values = {
        "NGROK_ACTIVE": "true" if state.active else "false",
        "NGROK_PUBLIC_URL": state.url or "",
        "NGROK_API_URL": state.api_url or "",
        "NGROK_WS_URL": state.ws_url or "",
        "NGROK_UPDATED_AT": state.updated_at or "",
        "VITE_PUBLIC_BASE_URL": state.url or "",
        "VITE_API_BASE_URL": "/api/v1",
        "VITE_WS_URL": "/ws",
    }
    return "\n".join(f"{key}={value}" for key, value in values.items()) + "\n"


def _update_frontend_env_local(root_dir: Path, state: NgrokState) -> None:
    path = _frontend_env_local_path(root_dir)
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    block = "\n".join(
        [
            MANAGED_ENV_START,
            f"VITE_PUBLIC_BASE_URL={state.url or ''}",
            "VITE_API_BASE_URL=/api/v1",
            "VITE_WS_URL=/ws",
            MANAGED_ENV_END,
        ]
    )

    if MANAGED_ENV_START in existing and MANAGED_ENV_END in existing:
        before = existing.split(MANAGED_ENV_START, 1)[0].rstrip()
        after = existing.split(MANAGED_ENV_END, 1)[1].lstrip()
        next_content = "\n\n".join(part for part in [before, block, after.rstrip()] if part) + "\n"
    else:
        next_content = (existing.rstrip() + "\n\n" if existing.strip() else "") + block + "\n"

    path.write_text(next_content, encoding="utf-8")


def stop_ngrok_processes() -> None:
    if sys.platform == "win32":
        subprocess.run("taskkill /F /IM ngrok.exe", shell=True, capture_output=True)


def start_ngrok_tunnel(
    frontend_port: int = FRONTEND_PORT,
    base_dir: str | os.PathLike[str] | None = None,
) -> tuple[subprocess.Popen | None, NgrokState]:
    root = Path(base_dir) if base_dir else project_root()
    ngrok_path = find_ngrok_binary(root)
    if not ngrok_path:
        return None, NgrokState.inactive(source="missing_binary")

    stop_ngrok_processes()
    time.sleep(1)

    process = subprocess.Popen(
        [ngrok_path, "http", str(frontend_port)],
        cwd=str(root),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
    )

    state = wait_for_ngrok_url(root)
    return process, state


def wait_for_ngrok_url(
    root_dir: Path | None = None,
    attempts: int = 40,
    delay_seconds: float = 0.5,
) -> NgrokState:
    for _ in range(attempts):
        time.sleep(delay_seconds)
        state = query_ngrok_state()
        if state.active:
            write_ngrok_runtime(state, root_dir)
            return state
    return NgrokState.inactive()


def start_ngrok_watcher(
    root_dir: Path | None = None,
    interval_seconds: int = 10,
    stop_event: threading.Event | None = None,
) -> threading.Thread:
    root = root_dir or project_root()
    event = stop_event or threading.Event()

    def watch() -> None:
        last_url: str | None = None
        while not event.is_set():
            state = query_ngrok_state()
            if state.active and state.url != last_url:
                write_ngrok_runtime(state, root)
                last_url = state.url
            event.wait(interval_seconds)

    thread = threading.Thread(target=watch, name="ngrok-runtime-watcher", daemon=True)
    thread.start()
    return thread
