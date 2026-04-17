import sqlite3
import bcrypt

conn = sqlite3.connect("backend/corphia.db")
cur = conn.cursor()
cur.execute("SELECT password_hash FROM users WHERE email='engineer@local'")
res = cur.fetchone()
if res:
    hash_val = res[0]
    print(f"Matches 'Engineer123'? {bcrypt.checkpw('Engineer123'.encode(), hash_val.encode())}")
else:
    print("User not found!")
