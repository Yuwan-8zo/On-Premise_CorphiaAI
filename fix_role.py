import sqlite3
import os

db_path = os.path.abspath('backend/corphia.db')
print(f"Connecting to {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("UPDATE users SET role='engineer' WHERE email='engineer@gmail.com'")
    conn.commit()
    
    cur.execute("SELECT role FROM users WHERE email='engineer@gmail.com'")
    row = cur.fetchone()
    print("Role is now:", row[0] if row else "Not found")
    
except Exception as e:
    print(f"Error: {e}")
finally:
    if 'conn' in locals():
        conn.close()
