fpath = r'd:\Antigravity\on-premise_CorphiaAI\frontend\src\pages\Login.tsx'
content = open(fpath, 'r', encoding='utf-8', errors='ignore').read()
content = content.replace(".join('?))", ".join(', '))")
open(fpath, 'w', encoding='utf-8').write(content)
print('Fixed Login.tsx!')
