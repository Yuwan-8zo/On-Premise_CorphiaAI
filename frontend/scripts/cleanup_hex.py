import os
import re

directory = r"c:\Users\ngu94\OneDrive\Desktop\Antigravity\on-premise_CorphiaAI\frontend\src"

replacements = [
    (r'\bdark:border-\[\#[A-Fa-f0-9]+\]\b', ''),
    (r'\bdark:bg-\[\#[A-Fa-f0-9]+\]\b', ''),
    (r'\bborder-\[\#(?:E8E4DF|E5E0D8)\]\b', 'border-border-subtle'),
    (r'\bbg-\[\#(?:FAFAF8|120E0B|F7F6F4)\]\b', 'bg-bg-base'),
    (r'\bbg-corphia-main\b', 'bg-bg-main'),
    (r'\bbg-blue-gray-500\b', 'bg-border-subtle'),
    (r'\bdark:border-white\b', ''),
]

def migrate_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)
        
    content = re.sub(r' +', ' ', content)
    content = content.replace('className=" ', 'className="')
    content = content.replace(' "', '"')
    
    if original != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

modified_files = []
for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            if migrate_file(os.path.join(root, file)):
                modified_files.append(file)

print(f"Modified {len(modified_files)} files.")
