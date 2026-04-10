"""
測試 admin@local email 驗證
"""
import asyncio
from pydantic import BaseModel, EmailStr, ValidationError

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

try:
    req = LoginRequest(email="admin@local", password="Admin123!")
    print("PASS:", req)
except ValidationError as e:
    print("FAIL:", e)

try:
    req2 = LoginRequest(email="admin@example.com", password="Admin123!")
    print("PASS:", req2)
except ValidationError as e:
    print("FAIL:", e)
