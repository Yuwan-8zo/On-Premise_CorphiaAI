import re
with open("uncorrupted_settings.tsx", "r", encoding="utf-8") as f:
    text = f.read().replace("\ufeff", "")

with open("settings_chinese_strings.txt", "w", encoding="utf-8") as f:
    for match in re.finditer(r">([^<]*[^\x00-\x7F]+[^<]*)<", text):
        f.write(match.group(1).strip() + "\n")
    for match in re.finditer(r"[\"']([^\x00-\x7F]+)[\"']", text):
        f.write(match.group(1).strip() + "\n")
