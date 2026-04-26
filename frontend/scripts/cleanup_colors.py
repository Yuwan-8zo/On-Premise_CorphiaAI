import os
import re

directory = r"c:\Users\ngu94\OneDrive\Desktop\Antigravity\on-premise_CorphiaAI\frontend\src"

replacements = [
    # Remove remaining dark variants
    (r'\bdark:border-white(?:/\d+|/\[[\d\.]+\])?\b', ''),
    (r'\bdark:bg-white(?:/\d+|/\[[\d\.]+\])?\b', ''),
    (r'\bdark:text-white(?:/\d+|/\[[\d\.]+\])?\b', ''),
    (r'\bdark:shadow-\[[^\]]+\]\b', ''),
    
    # Replace normal white/black variants with semantic
    (r'\bborder-white(?:/\d+|/\[[\d\.]+\])?\b', 'border-border-subtle'),
    (r'\bbg-white(?:/\d+|/\[[\d\.]+\])?\b', 'bg-bg-elevated'),
    (r'\btext-white(?:/\d+|/\[[\d\.]+\])?\b', 'text-text-primary'),
    
    (r'\bbg-corphia-warm-gray(?:/\d+)?\b', 'bg-text-muted'),
    (r'\bborder-corphia-warm-gray(?:/\d+)?\b', 'border-border-subtle'),
    (r'\bborder-corphia-ink(?:/\d+)?\b', 'border-border-strong'),
    
    (r'\btext-ios-dark-gray\d+\b', 'text-text-secondary'),
    
    # Specific bug fixes from previous script
    (r'text-text-primary/80 /80', 'text-text-primary/80'),
    (r'bg-bg-base/70 text-text-secondary dark:border-white/10 /\[0\.06\]', 'bg-bg-base/70 text-text-secondary'),
    (r'/\[0\.\d+\]', ''), # Clean up stray opacity modifiers left by empty dark: classes
    (r'/\d+\b', ''), # Clean up stray opacity like /78 /80 if preceded by space
    
    # Generic Tailwind cleanup
    (r'\bbg-gray-\d+(?:/\d+)?\b', 'bg-bg-surface'),
    (r'\btext-gray-\d+(?:/\d+)?\b', 'text-text-secondary'),
    (r'\bborder-gray-\d+(?:/\d+)?\b', 'border-border-subtle'),
]

def migrate_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)
        
    # Clean up double spaces, trailing spaces before quotes
    content = re.sub(r' +', ' ', content)
    content = content.replace('className=" ', 'className="')
    content = content.replace(' "', '"')
    content = content.replace(' / ', ' ')
    content = content.replace(' /"', '"')
    content = re.sub(r' \/\d+ ', ' ', content)
    content = re.sub(r' \/\d+"', '"', content)
    
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
