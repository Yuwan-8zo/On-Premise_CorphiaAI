paths = [
    r'C:\Users\ngu94\Desktop\Antigravity\on-premise_CorphiaAI\frontend\src\components\ui\SettingsModal.tsx',
    r'C:\Users\ngu94\OneDrive\Desktop\Antigravity\on-premise_CorphiaAI\frontend\src\components\ui\SettingsModal.tsx',
]

zh_label = '\u7e41\u9ad4\u4e2d\u6587'  # 繁體中文
ja_label = '\u65e5\u672c\u8a9e'         # 日本語

for path in paths:
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    lines[139] = "        { code: 'zh-TW', label: '" + zh_label + "' },\n"
    lines[141] = "        { code: 'ja-JP', label: '" + ja_label + "' },\n"

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.writelines(lines)
    print('Fixed:', path)
