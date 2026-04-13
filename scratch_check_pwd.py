import sqlite3
import bcrypt

conn = sqlite3.connect("corphia.db")
hash_val = conn.execute("SELECT password_hash FROM users WHERE email='engineer@gmail.com'").fetchone()[0]

plain = "Engineer123"
print("Hash from DB:", hash_val)
try:
    print("Matches with bcrypt.checkpw:", bcrypt.checkpw(plain.encode("utf-8"), hash_val.encode("utf-8")))
except Exception as e:
    print("Error:", e)
