import sqlite3
import bcrypt
import uuid
from datetime import datetime

conn = sqlite3.connect("backend/corphia.db")
cur = conn.cursor()

def create_or_update_user():
    email = 'engineer@gmail.com'
    password = 'Engineer123'
    salt = bcrypt.gensalt()
    pw_hash = bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
    
    cur.execute("SELECT id FROM users WHERE email=?", (email,))
    res = cur.fetchone()
    if res:
        print(f"Updating password for {email}")
        cur.execute("UPDATE users SET password_hash=? WHERE email=?", (pw_hash, email))
    else:
        print(f"Inserting new user {email}")
        user_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO users (id, email, password_hash, name, role, is_active, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_id, email, pw_hash, 'Engineer', 'admin', 1, datetime.utcnow().isoformat(), datetime.utcnow().isoformat()))
    
    conn.commit()

create_or_update_user()
print("Done!")
