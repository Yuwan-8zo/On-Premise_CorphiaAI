import os
import re

directory = r"c:\Users\ngu94\OneDrive\Desktop\Antigravity\on-premise_CorphiaAI\frontend\src"

# Regular expressions for replacing legacy classes
replacements = [
    # Remove dark: variants of color classes entirely if they match our old schema
    (r'\bdark:bg-(?:dark|ios|light|corphia)[-\w]+\b', ''),
    (r'\bdark:text-(?:dark|ios|light|corphia)[-\w]+\b', ''),
    (r'\bdark:border-(?:dark|ios|light|corphia)[-\w]+\b', ''),
    (r'\bdark:hover:bg-(?:dark|ios|light|corphia)[-\w]+\b', ''),
    (r'\bdark:hover:text-(?:dark|ios|light|corphia)[-\w]+\b', ''),
    (r'\bdark:focus:border-[-\w]+\b', ''),
    (r'\bdark:focus:ring-[-\w]+\b', ''),
    
    # Specific old hex mappings and [rgb(...)] mappings
    (r'bg-\[rgb\(var\(--color-ios-accent-(?:light|dark)\)\)\]', 'bg-accent'),
    (r'text-\[rgb\(var\(--color-ios-accent-(?:light|dark)\)\)\]', 'text-accent'),
    (r'border-\[rgb\(var\(--color-ios-accent-(?:light|dark)\)\)\]', 'border-accent'),
    (r'ring-\[rgb\(var\(--color-ios-accent-(?:light|dark)\)\)\]', 'ring-accent'),
    (r'bg-\[\#(?:94785A|896E53|836A4F)\]', 'bg-accent'),
    (r'text-\[\#(?:94785A|896E53|836A4F)\]', 'text-accent'),
    (r'border-\[\#(?:94785A|896E53|836A4F)\]', 'border-accent'),
    (r'hover:bg-\[\#(?:94785A|896E53|836A4F|9A7D60)\]', 'hover:bg-accent-hover'),

    # Backgrounds
    (r'\bbg-(?:light|dark)-bg-primary\b', 'bg-bg-base'),
    (r'\bbg-(?:light|dark)-bg-secondary\b', 'bg-bg-surface'),
    (r'\bbg-(?:light|dark)-bg-elevated\b', 'bg-bg-elevated'),
    (r'\bbg-ios-(?:light|dark)-gray[1-6]\b', 'bg-bg-surface'),
    (r'\bbg-ios-dark-bg\b', 'bg-bg-base'),
    (r'\bbg-corphia-(?:beige|sand|ivory)\b', 'bg-bg-base'),
    (r'\bbg-corphia-(?:obsidian|espresso|ink)\b', 'bg-bg-surface'),
    (r'\bbg-corphia-input-bg\b', 'bg-bg-surface'),
    (r'\bbg-corphia-icon-bg\b', 'bg-bg-elevated'),
    (r'\bbg-[#FAFAF8]\b', 'bg-bg-base'),
    (r'\bbg-[#F2EFEA]\b', 'bg-bg-surface'),
    
    # Text
    (r'\btext-ios-(?:black|white)\b', 'text-text-primary'),
    (r'\btext-(?:light|dark)-text-primary\b', 'text-text-primary'),
    (r'\btext-(?:light|dark)-text-secondary\b', 'text-text-secondary'),
    (r'\btext-(?:light|dark)-text-muted\b', 'text-text-muted'),
    (r'\btext-(?:light|dark)-text-disabled\b', 'text-text-disabled'),
    (r'\btext-corphia-(?:obsidian|espresso|ink)\b', 'text-text-primary'),
    (r'\btext-corphia-(?:beige|sand|ivory)\b', 'text-text-secondary'),
    (r'\btext-corphia-warm-gray\b', 'text-text-muted'),
    (r'\btext-[#8C867D]\b', 'text-text-muted'),
    (r'\btext-[#DCD6CE]\b', 'text-text-disabled'),
    (r'\btext-[#3A322A]\b', 'text-text-disabled'),

    # Borders
    (r'\bborder-ios-(?:light|dark)-gray[1-6]\b', 'border-border-subtle'),
    (r'\bborder-light-border-(?:primary|secondary)\b', 'border-border-subtle'),
    (r'\bborder-dark-border-(?:primary|secondary)\b', 'border-border-subtle'),
    (r'\bborder-corphia-input-border\b', 'border-border-subtle'),
    (r'\bborder-[#E5E0D8]\b', 'border-border-subtle'),
    (r'\bborder-[#3A322A]\b', 'border-border-subtle'),

    # Focus/Hover replacements
    (r'\bhover:bg-ios-(?:light|dark)-gray[1-6]\b', 'hover:bg-bg-elevated'),
    (r'\bhover:bg-corphia-(?:beige|sand)\b', 'hover:bg-bg-elevated'),
    (r'\bhover:bg-[#F2EFEA]\b', 'hover:bg-bg-elevated'),
    (r'\bhover:bg-[#201B18]\b', 'hover:bg-bg-elevated'),
    
    (r'\bhover:text-light-text-primary\b', 'hover:text-text-primary'),
    (r'\bhover:text-dark-text-primary\b', 'hover:text-text-primary'),
    
    # Generic Tailwind colors to remove/replace
    (r'\bbg-white\b', 'bg-bg-base'),
    (r'\bbg-black\b', 'bg-bg-main'),
    (r'\bbg-transparent\b', 'bg-transparent'),
    (r'\bbg-gray-\d+\b', 'bg-bg-surface'),
    (r'\btext-gray-\d+\b', 'text-text-secondary'),
    (r'\btext-white\b', 'text-text-primary'),
    (r'\btext-black\b', 'text-text-primary'),
]

def migrate_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)
        
    # Clean up multiple spaces left by deleted classes
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
