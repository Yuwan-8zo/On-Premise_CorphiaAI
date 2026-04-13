import sqlite3
import bcrypt

conn = sqlite3.connect("backend/corphia.db")
cur = conn.cursor()

def check(email):
    cur.execute("SELECT password_hash FROM users WHERE email=?", (email,))
    res = cur.fetchone()
    if res:
        hash_val = res[0]
        print(f"Matches 'Engineer123' for {email}? {bcrypt.checkpw('Engineer123'.encode(), hash_val.encode())}")
        print(f"Matches 'engineer' for {email}? {bcrypt.checkpw('engineer'.encode(), hash_val.encode())}")
    else:
        print(f"User {email} not found!")

check('engineer@local')
check('ngu940820@gmail.com')
