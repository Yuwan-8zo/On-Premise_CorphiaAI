import os
import re

directory = r"c:\Users\ngu94\OneDrive\Desktop\Antigravity\on-premise_CorphiaAI\frontend\src"

# Regular expressions for replacing legacy classes
replacements = [
    # Remove all dark: prefix from bg/text/border/ring
    (r'\bdark:bg-[-\w\[\]\#]+\b', ''),
    (r'\bdark:text-[-\w\[\]\#]+\b', ''),
    (r'\bdark:border-[-\w\[\]\#]+\b', ''),
    (r'\bdark:ring-[-\w\[\]\#]+\b', ''),
    (r'\bdark:shadow-\[[^\]]+\]\b', ''),
    (r'\bdark:hover:bg-[-\w\[\]\#]+\b', ''),
    (r'\bdark:hover:text-[-\w\[\]\#]+\b', ''),
    (r'\bdark:hover:border-[-\w\[\]\#]+\b', ''),
    (r'\bdark:focus:bg-[-\w\[\]\#]+\b', ''),
    (r'\bdark:focus:border-[-\w\[\]\#]+\b', ''),
    (r'\bdark:focus:ring-[-\w\[\]\#]+\b', ''),
    (r'\bdark:active:bg-[-\w\[\]\#]+\b', ''),
    (r'\bdark:group-hover:bg-[-\w\[\]\#]+\b', ''),
    (r'\bdark:group-hover:text-[-\w\[\]\#]+\b', ''),
    (r'\bdark:from-[-\w\[\]\#]+\b', ''),
    (r'\bdark:to-[-\w\[\]\#]+\b', ''),

    # Specific [rgb(...)] mappings
    (r'\bbg-\[rgb\(var\(--color-ios-accent-(?:light|dark)\)\)\]\b', 'bg-accent'),
    (r'\btext-\[rgb\(var\(--color-ios-accent-(?:light|dark)\)\)\]\b', 'text-accent'),
    (r'\bborder-\[rgb\(var\(--color-ios-accent-(?:light|dark)\)\)\]\b', 'border-accent'),
    (r'\bring-\[rgb\(var\(--color-ios-accent-(?:light|dark)\)\)\]\b', 'ring-accent'),

    # Background hexes
    (r'\b(?:hover:|focus:|active:|group-hover:)?bg-\[\#(?:FAFAF8|F7F6F4|F5F3EF|EFECE7|FFFFFF|FAFAFA|F8F9FA)\]\b', 'bg-bg-base'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?bg-\[\#(?:F2EFEA|EFEAE4|E8E4DF|2A2420|1C1815|120E0B|282828|111827|1F2937|374151)\]\b', 'bg-bg-surface'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?bg-\[\#(?:1A1613|383838|4B5563)\]\b', 'bg-bg-elevated'),
    (r'\bbg-\[\#(?:94785A|896E53|836A4F|8B7355|7A6348)\]\b', 'bg-accent'),
    (r'\bhover:bg-\[\#(?:94785A|896E53|836A4F|8B7355|7A6348|9A7D60)\]\b', 'hover:bg-accent-hover'),
    
    # Text hexes
    (r'\b(?:hover:|focus:|active:|group-hover:)?text-\[\#(?:FFFFFF|2B2B2B|111827|000000)\]\b', 'text-text-primary'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?text-\[\#(?:6B6B6B|9A9A9A|374151|4B5563|6B7280)\]\b', 'text-text-secondary'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?text-\[\#(?:8C867D|DCD6CE|3A322A|9CA3AF)\]\b', 'text-text-muted'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?text-\[\#(?:94785A|896E53|836A4F|8B7355|7A6348)\]\b', 'text-accent'),
    
    # Border hexes
    (r'\b(?:hover:|focus:|active:|group-hover:)?border-\[\#(?:E8E4DF|E5E0D8|E3DFD9|E6E2DC|2A2420|3A322A|D1D5DB|E5E7EB|F3F4F6|374151|4B5563)\]\b', 'border-border-subtle'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?border-\[\#(?:94785A|896E53|836A4F|8B7355|7A6348)\]\b', 'border-accent'),

    # Gradients
    (r'\bfrom-\[\#[A-Fa-f0-9]+\]\b', 'from-transparent'),
    (r'\bto-\[\#[A-Fa-f0-9]+\]\b', 'to-transparent'),

    # Backgrounds named
    (r'\bbg-(?:light|dark)-bg-primary\b', 'bg-bg-base'),
    (r'\bbg-(?:light|dark)-bg-secondary\b', 'bg-bg-surface'),
    (r'\bbg-(?:light|dark)-bg-elevated\b', 'bg-bg-elevated'),
    (r'\bbg-(?:light|dark)-bg-tertiary\b', 'bg-bg-surface'),
    (r'\bbg-ios-(?:light|dark)-gray[1-6]\b', 'bg-bg-surface'),
    (r'\bbg-ios-dark-bg\b', 'bg-bg-base'),
    (r'\bbg-corphia-(?:beige|sand|ivory)\b', 'bg-bg-base'),
    (r'\bbg-corphia-(?:obsidian|espresso|ink|main|input-bg)\b', 'bg-bg-surface'),
    (r'\bbg-corphia-icon-bg\b', 'bg-bg-elevated'),
    (r'\bbg-corphia-warm-gray(?:/\d+)?\b', 'bg-border-subtle'),
    
    # Text named
    (r'\btext-ios-(?:black|white)\b', 'text-text-primary'),
    (r'\btext-ios-dark-gray\d+\b', 'text-text-secondary'),
    (r'\btext-(?:light|dark)-text-primary\b', 'text-text-primary'),
    (r'\btext-(?:light|dark)-text-secondary\b', 'text-text-secondary'),
    (r'\btext-(?:light|dark)-text-muted\b', 'text-text-muted'),
    (r'\btext-(?:light|dark)-text-disabled\b', 'text-text-disabled'),
    (r'\btext-corphia-(?:obsidian|espresso|ink)\b', 'text-text-primary'),
    (r'\btext-corphia-(?:beige|sand|ivory)\b', 'text-text-secondary'),
    (r'\btext-corphia-warm-gray(?:/\d+)?\b', 'text-text-muted'),

    # Borders named
    (r'\bborder-ios-(?:light|dark)-gray[1-6]\b', 'border-border-subtle'),
    (r'\bborder-(?:light|dark)-border-(?:primary|secondary)\b', 'border-border-subtle'),
    (r'\bborder-corphia-(?:input-border|warm-gray)\b', 'border-border-subtle'),
    (r'\bborder-corphia-ink\b', 'border-border-strong'),

    # Hover / Generic named variants
    (r'\bhover:bg-ios-(?:light|dark)-gray[1-6]\b', 'hover:bg-bg-elevated'),
    (r'\bhover:bg-corphia-(?:beige|sand)\b', 'hover:bg-bg-elevated'),
    (r'\bhover:text-(?:light|dark)-text-primary\b', 'hover:text-text-primary'),
    
    # Generic Tailwind colors to remove/replace
    (r'\b(?:hover:|focus:|active:|group-hover:)?bg-white(?:/\d+|/\[[\d\.]+\])?\b', 'bg-bg-base'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?bg-black(?:/\d+|/\[[\d\.]+\])?\b', 'bg-bg-main'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?text-white(?:/\d+|/\[[\d\.]+\])?\b', 'text-text-primary'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?text-black(?:/\d+|/\[[\d\.]+\])?\b', 'text-text-primary'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?border-white(?:/\d+|/\[[\d\.]+\])?\b', 'border-border-subtle'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?border-black(?:/\d+|/\[[\d\.]+\])?\b', 'border-border-strong'),
    
    (r'\b(?:hover:|focus:|active:|group-hover:)?bg-(?:gray|blue|sky|indigo|purple|blue-gray)-\d+(?:/\d+|/\[[\d\.]+\])?\b', 'bg-bg-surface'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?text-(?:gray|blue|sky|indigo|purple|blue-gray)-\d+(?:/\d+|/\[[\d\.]+\])?\b', 'text-text-secondary'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?border-(?:gray|blue|sky|indigo|purple|blue-gray)-\d+(?:/\d+|/\[[\d\.]+\])?\b', 'border-border-subtle'),
    (r'\b(?:hover:|focus:|active:|group-hover:)?ring-(?:gray|blue|sky|indigo|purple|blue-gray)-\d+(?:/\d+|/\[[\d\.]+\])?\b', 'ring-accent'),

    # Cleanup trailing Opacities that became detached (e.g., text-text-primary /80)
    (r'(bg-[-\w]+|text-[-\w]+|border-[-\w]+) (?:/\d+|/\[[\d\.]+\])\b', r'\1'),
    (r'(bg-[-\w]+|text-[-\w]+|border-[-\w]+) (?:/\d+|/\[[\d\.]+\])"', r'\1"'),
]

def migrate_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)
        
    # Clean up duplicate spaces inside classNames without destroying newlines
    # Only target multiple spaces inside quotes
    def space_cleanup(match):
        return re.sub(r' +', ' ', match.group(0))
        
    content = re.sub(r'className="[^"]+"', space_cleanup, content)
    content = content.replace('className=" ', 'className="')
    content = content.replace(' "', '"')
    
    # Remove empty classNames or leftover duplicates
    content = re.sub(r'className=""', '', content)
    
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
