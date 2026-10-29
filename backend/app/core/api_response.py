from __future__ import annotations

import uuid
from typing import Any

from fastapi import status
from fastapi.responses import JSONResponse


def success(data: Any = None, *, message: str | None = None, status_code: int = status.HTTP_200_OK) -> JSONResponse:
    payload: dict[str, Any] = {"status": "success"}
    if message is not None:
        payload["message"] = message
    if data is not None:
        payload["data"] = data
    return JSONResponse(status_code=status_code, content=payload)


def error(
    code: str,
    message: str,
    *,
    status_code: int,
    details: Any | None = None,
    error_id: str | None = None,
) -> JSONResponse:
    payload: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
        }
    }
    if error_id:
        payload["error"]["error_id"] = error_id
    if details is not None:
        payload["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=payload)


def new_error_id() -> str:
    return uuid.uuid4().hex[:12]

