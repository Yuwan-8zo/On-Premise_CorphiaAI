import os
import re

directory = r"c:\Users\ngu94\OneDrive\Desktop\Antigravity\on-premise_CorphiaAI\frontend\src"

def migrate_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Blind replace all remaining hex colors in classNames
    content = re.sub(r'\bbg-\[\#[A-Fa-f0-9]{6}\]\b', 'bg-bg-surface', content)
    content = re.sub(r'\btext-\[\#[A-Fa-f0-9]{6}\]\b', 'text-text-secondary', content)
    content = re.sub(r'\bborder-\[\#[A-Fa-f0-9]{6}\]\b', 'border-border-subtle', content)
    
    # Also clean up any lingering blue/gray/white/black that might have been missed due to complex variants
    content = re.sub(r'\b(?:hover:|focus:|active:|group-hover:)?bg-white\b', 'bg-bg-base', content)
    content = re.sub(r'\b(?:hover:|focus:|active:|group-hover:)?bg-black\b', 'bg-bg-main', content)
    content = re.sub(r'\b(?:hover:|focus:|active:|group-hover:)?bg-(?:gray|blue|sky|indigo|purple)-\d+\b', 'bg-bg-surface', content)
    
    content = re.sub(r'\b(?:hover:|focus:|active:|group-hover:)?text-(?:gray|blue|sky|indigo|purple)-\d+\b', 'text-text-secondary', content)
    content = re.sub(r'\b(?:hover:|focus:|active:|group-hover:)?border-(?:gray|blue|sky|indigo|purple)-\d+\b', 'border-border-subtle', content)
    content = re.sub(r'\b(?:hover:|focus:|active:|group-hover:)?ring-(?:gray|blue|sky|indigo|purple)-\d+\b', 'ring-accent', content)
    
    # Clean up any leftover 'dark:' empty classes
    content = re.sub(r'\bdark:\s', '', content)

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
