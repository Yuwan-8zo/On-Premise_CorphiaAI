import os
import re

directory = r"c:\Users\ngu94\OneDrive\Desktop\Antigravity\on-premise_CorphiaAI\frontend\src"

replacements = [
    (r'\b(?:hover:|focus:|active:|group-hover:)?bg-\[\#(?:FAFAF8|F7F6F4|F5F3EF|EFECE7|FFFFFF|FAFAFA|F8F9FA)\]', 'bg-bg-base'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?bg-\[\#(?:F2EFEA|EFEAE4|E8E4DF|2A2420|1C1815|120E0B|282828|111827|1F2937|374151)\]', 'bg-bg-surface'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?bg-\[\#(?:1A1613|383838|4B5563)\]', 'bg-bg-elevated'),
    (r'\bbg-\[\#(?:94785A|896E53|836A4F|8B7355|7A6348)\]', 'bg-accent'),
    (r'\bhover:bg-\[\#(?:94785A|896E53|836A4F|8B7355|7A6348|9A7D60)\]', 'hover:bg-accent-hover'),
    
    (r'\b(?:hover:|focus:|active:|group-hover:)?text-\[\#(?:FFFFFF|2B2B2B|111827|000000)\]', 'text-text-primary'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?text-\[\#(?:6B6B6B|9A9A9A|374151|4B5563|6B7280)\]', 'text-text-secondary'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?text-\[\#(?:8C867D|DCD6CE|3A322A|9CA3AF)\]', 'text-text-muted'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?text-\[\#(?:94785A|896E53|836A4F|8B7355|7A6348)\]', 'text-accent'),
    
    (r'\b(?:hover:|focus:|active:|group-hover:)?border-\[\#(?:E8E4DF|E5E0D8|E3DFD9|E6E2DC|2A2420|3A322A|D1D5DB|E5E7EB|F3F4F6|374151|4B5563)\]', 'border-border-subtle'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?border-\[\#(?:94785A|896E53|836A4F|8B7355|7A6348)\]', 'border-accent'),

    (r'\bfrom-\[\#[A-Fa-f0-9]+\]', 'from-transparent'),
    (r'\bto-\[\#[A-Fa-f0-9]+\]', 'to-transparent'),
    
    (r'\bdark:border-\[\#[A-Fa-f0-9]+\]', ''),
    (r'\bdark:focus-within:border-\[\#[A-Fa-f0-9]+\]', ''),
    (r'\bdark:bg-\[\#[A-Fa-f0-9]+\]', ''),
    (r'\bdark:text-\[\#[A-Fa-f0-9]+\]', ''),
]

def migrate_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)
        
    def space_cleanup(match):
        return re.sub(r' +', ' ', match.group(0))
        
    content = re.sub(r'className="[^"]+"', space_cleanup, content)
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
