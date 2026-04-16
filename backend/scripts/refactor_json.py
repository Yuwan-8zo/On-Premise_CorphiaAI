import os

models_dir = r"d:\Cursor\on-premise_CorphiaAI\backend\app\models"

for filename in os.listdir(models_dir):
    if filename.endswith(".py"):
        filepath = os.path.join(models_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        if "sqlalchemy.dialects.sqlite import JSON" in content:
            # Replace sqlite JSON with sqlalchemy standard JSON (or postgresql JSONB)
            # Actually, instead of replacing the import, let's just make it cross-compatible
            content = content.replace("from sqlalchemy.dialects.sqlite import JSON", "from sqlalchemy.dialects.postgresql import JSONB as JSON")
            
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"Updated {filename}")
