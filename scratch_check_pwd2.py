import sqlite3
import sys

# Add backend dir to sys.path so we can import app
sys.path.append('d:\Cursor\on-premise_CorphiaAI\backend')
from app.core.security import verify_password

conn = sqlite3.connect('../corphia.db')
hash_val = conn.execute("SELECT password_hash FROM users WHERE email='engineer@gmail.com'").fetchone()[0]

print(f"Hash in DB: {hash_val}")
print(f"verify_password('Engineer123', hash_val): {verify_password('Engineer123', hash_val)}")
