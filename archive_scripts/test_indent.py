import sys

filepath = r"d:\Cursor\on-premise_CorphiaAI\backend\app\api\auth.py"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
in_login = False
login_end_line = -1

for i, line in enumerate(lines):
    if line.startswith("    try:"):
        in_login = True
        new_lines.append(line)
        continue
    
    if in_login:
        if line.startswith("@router.post") or line.startswith("class ") or (line.startswith("        return LoginResponse(") and "expires_in=30 * 60" in lines[i+4]):
            pass # Keep looking
            
        if line.strip() == "expires_in=30 * 60  # 30 分鐘":
            # This is the end of the login block
            new_lines.append("        " + line)
            new_lines.append("        )\n")
            new_lines.append("    except Exception as e:\n")
            new_lines.append("        err = traceback.format_exc()\n")
            new_lines.append('        raise HTTPException(status_code=400, detail=f"CRASH: {err}")\n')
            in_login = False
            # skip the next line which is the original '    )'
            continue
            
        if in_login and line.strip() == ")":
            pass # We skipped it
            
        if in_login:
            if line.strip() == "":
                new_lines.append(line)
            else:
                new_lines.append("    " + line)
        else:
            if "        )\n" not in line and '    )' not in line:
                new_lines.append(line)
    else:
        if line.strip() != ")" or i < 180:
            new_lines.append(line)

with open(filepath, "w", encoding="utf-8") as f:
    f.writelines(new_lines)
