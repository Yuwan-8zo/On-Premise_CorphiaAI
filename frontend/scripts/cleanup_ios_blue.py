import os
import re

directory = r"c:\Users\ngu94\OneDrive\Desktop\Antigravity\on-premise_CorphiaAI\frontend\src"

replacements = [
    (r'\b(?:text|bg|border|ring|shadow)-ios-blue-(?:light|dark)(?:/\d+|/\[[\d\.]+\])?\b', 'accent'), # Simplest way to map it to accent
    (r'\b(?:hover:|focus:|active:|group-hover:)?bg-ios-blue-(?:light|dark)(?:/\d+|/\[[\d\.]+\])?\b', 'bg-accent'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?text-ios-blue-(?:light|dark)(?:/\d+|/\[[\d\.]+\])?\b', 'text-accent'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?border-ios-blue-(?:light|dark)(?:/\d+|/\[[\d\.]+\])?\b', 'border-accent'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?ring-ios-blue-(?:light|dark)(?:/\d+|/\[[\d\.]+\])?\b', 'ring-accent'),
    
    # Actually let's just do:
    (r'\b(?:hover:|focus:|active:|group-hover:)?bg-\[\#[A-Fa-f0-9]{6}\]\b', 'bg-bg-surface'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?text-\[\#[A-Fa-f0-9]{6}\]\b', 'text-text-secondary'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?border-\[\#[A-Fa-f0-9]{6}\]\b', 'border-border-subtle'),
    (r'\bfrom-\[\#[A-Fa-f0-9]{6}\]\b', 'from-transparent'),
    (r'\bto-\[\#[A-Fa-f0-9]{6}\]\b', 'to-transparent'),
    
    # Fix the generic ios-blue
    (r'\bios-blue-light\b', 'accent'),
    (r'\bios-blue-dark\b', 'accent'),
]

def migrate_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Fix the `accent` replacements
    content = re.sub(r'\b(?:hover:|focus:|active:|group-hover:)?bg-ios-blue-(?:light|dark)(?:/\d+|/\[[\d\.]+\])?\b', 'bg-accent', content)
    content = re.sub(r'\b(?:hover:|focus:|active:|group-hover:)?text-ios-blue-(?:light|dark)(?:/\d+|/\[[\d\.]+\])?\b', 'text-accent', content)
    content = re.sub(r'\b(?:hover:|focus:|active:|group-hover:)?border-ios-blue-(?:light|dark)(?:/\d+|/\[[\d\.]+\])?\b', 'border-accent', content)
    content = re.sub(r'\b(?:hover:|focus:|active:|group-hover:)?ring-ios-blue-(?:light|dark)(?:/\d+|/\[[\d\.]+\])?\b', 'ring-accent', content)
    content = re.sub(r'\bios-blue-(?:light|dark)\b', 'accent', content) # catch-all
    
    content = re.sub(r'\b(?:hover:|focus:|active:|group-hover:)?bg-\[\#[A-Fa-f0-9]{6}\]\b', 'bg-bg-surface', content)
    content = re.sub(r'\b(?:hover:|focus:|active:|group-hover:)?text-\[\#[A-Fa-f0-9]{6}\]\b', 'text-text-secondary', content)
    content = re.sub(r'\b(?:hover:|focus:|active:|group-hover:)?border-\[\#[A-Fa-f0-9]{6}\]\b', 'border-border-subtle', content)
    content = re.sub(r'\b(?:dark:)?from-\[\#[A-Fa-f0-9]{6}\]\b', 'from-transparent', content)
    content = re.sub(r'\b(?:dark:)?to-\[\#[A-Fa-f0-9]{6}\]\b', 'to-transparent', content)
    content = re.sub(r'\bdark:bg-\[\#[A-Fa-f0-9]{6}\]\b', '', content)
    content = re.sub(r'\bdark:text-\[\#[A-Fa-f0-9]{6}\]\b', '', content)
    content = re.sub(r'\bdark:border-\[\#[A-Fa-f0-9]{6}\]\b', '', content)

    # Some artifacts from my previous script like `] ]`
    content = content.replace('] ]', ']')
    content = content.replace('/10 ]', '')
    content = content.replace(' /20', '')
    content = content.replace(' /40  /90', '')
    content = content.replace(' /12 ', ' ')

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
