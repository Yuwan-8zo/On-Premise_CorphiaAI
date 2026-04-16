import sqlite3
import json
import os

db_path = "corphia.db"
output_path = r"C:\Users\ngu94\.gemini\antigravity\brain\29950927-b595-4a50-9c7b-b51a34e80738\scratch\users_dump.json"

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users")
    rows = cursor.fetchall()
    
    users = [dict(row) for row in rows]
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=4)
        
    print(f"Dumped {len(users)} users.")
else:
    print("corphia.db not found.")
