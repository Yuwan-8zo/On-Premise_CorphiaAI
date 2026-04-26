import os
import re

directory = r"c:\Users\ngu94\OneDrive\Desktop\Antigravity\on-premise_CorphiaAI\frontend\src"

hex_map = {
    r'\b(?:dark:|hover:|focus:|active:|group-hover:)?bg-\[\#(?:FAFAF8|F7F6F4|F5F3EF|EFECE7|FFFFFF)\]\b': 'bg-bg-base',
    r'\b(?:dark:|hover:|focus:|active:|group-hover:)?bg-\[\#(?:F2EFEA|EFEAE4|2A2420|1C1815|120E0B|282828)\]\b': 'bg-bg-surface',
    r'\b(?:dark:|hover:|focus:|active:|group-hover:)?bg-\[\#(?:1A1613|383838)\]\b': 'bg-bg-elevated',
    r'\b(?:dark:|hover:|focus:|active:|group-hover:)?bg-\[\#E8E4DF\]\b': 'bg-border-subtle',
    r'\b(?:dark:)?bg-\[\#8B7355\]\b': 'bg-accent',
    r'\b(?:dark:)?hover:bg-\[\#(?:7A6348|836A4F)\]\b': 'hover:bg-accent-hover',
    r'\b(?:dark:)?from-\[\#[A-Fa-f0-9]+\]\b': 'from-transparent',
    r'\b(?:dark:)?to-\[\#[A-Fa-f0-9]+\]\b': 'to-transparent',
    
    r'\b(?:dark:|hover:|focus:|active:|group-hover:)?text-\[\#(?:FFFFFF|2B2B2B)\]\b': 'text-text-primary',
    r'\b(?:dark:|hover:|focus:|active:|group-hover:)?text-\[\#(?:6B6B6B|9A9A9A)\]\b': 'text-text-secondary',
    r'\b(?:dark:|hover:|focus:|active:|group-hover:)?text-\[\#(?:8C867D|DCD6CE|3A322A)\]\b': 'text-text-muted',
    r'\b(?:dark:|hover:|focus:|active:|group-hover:)?text-\[\#8B7355\]\b': 'text-accent',
    
    r'\b(?:dark:|hover:|focus:|active:|group-hover:)?border-\[\#(?:E8E4DF|E5E0D8|E3DFD9|E6E2DC|2A2420|3A322A)\]\b': 'border-border-subtle',
    r'\b(?:dark:|hover:|focus:|active:|group-hover:)?border-\[\#8B7355\]\b': 'border-accent',
}

def migrate_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    for pattern, replacement in hex_map.items():
        content = re.sub(pattern, replacement, content)
        
    content = re.sub(r'\bdark:(bg|text|border)-(bg-base|bg-surface|bg-elevated|text-primary|text-secondary|text-muted|border-subtle|accent)\b', r'\1-\2', content)
    
    # Clean up duplicate 'bg-bg-base bg-bg-base'
    content = re.sub(r'\bbg-bg-base bg-bg-base\b', 'bg-bg-base', content)
    content = re.sub(r'\bbg-bg-surface bg-bg-surface\b', 'bg-bg-surface', content)
    content = re.sub(r'\btext-text-primary text-text-primary\b', 'text-text-primary', content)
    content = re.sub(r'\bborder-border-subtle border-border-subtle\b', 'border-border-subtle', content)
    
    content = re.sub(r'\s+', ' ', content)
    content = content.replace('className=" ', 'className="')
    content = content.replace(' "', '"')
    content = content.replace(' >', '>')
    
    # Fix React self-closing tags spaces removed by `\s+`
    content = re.sub(r' />', ' />', content) 
    
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
