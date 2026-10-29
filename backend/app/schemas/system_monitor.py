from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


SCHEMA_VERSION = "2026-05-07"


class SystemMonitorEnvelope(BaseModel):
    schema_version: str = Field(default=SCHEMA_VERSION)
    data: dict[str, Any]

