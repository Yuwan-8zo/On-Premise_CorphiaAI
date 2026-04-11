import os
import json

dli_dir = "DLI"
out_dir = "scratch/dli_md"

os.makedirs(out_dir, exist_ok=True)

for file in os.listdir(dli_dir):
    if file.endswith('.ipynb'):
        with open(os.path.join(dli_dir, file), 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        out_file = os.path.join(out_dir, file.replace('.ipynb', '.md'))
        with open(out_file, 'w', encoding='utf-8') as out:
            for cell in data.get('cells', []):
                source = "".join(cell.get('source', []))
                if cell.get('cell_type') == 'markdown':
                    out.write(source + "\n\n")
                elif cell.get('cell_type') == 'code':
                    out.write("```python\n" + source + "\n```\n\n")
