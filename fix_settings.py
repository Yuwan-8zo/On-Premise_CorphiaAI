import sys

fpath = r'd:\Antigravity\on-premise_CorphiaAI\frontend\src\components\ui\SettingsModal.tsx'
with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

fixes = [
    ("if (value.length < 8) errors.push('?喳? 8 ????)", "if (value.length < 8) errors.push('至少 8 個字元')"),
    ("setPasswordError('隢撓?亦??蝣?)", "setPasswordError('請輸入目前密碼')"),
    ("setPasswordError('?啣?蝣潸?蝣箄?撖Ⅳ銝???)", "setPasswordError('確認密碼不符')"),
    ("setPasswordSuccess('撖Ⅳ靽格??嚗?)", "setPasswordSuccess('密碼修改成功')"),
    ("case 'very_strong': return '?虜撘?", "case 'very_strong': return '非常強'"),
    ("case 'strong': return '撘?", "case 'strong': return '強'"),
    ("case 'medium': return '銝剔?'", "case 'medium': return '中等'"),
    ("default: return '撘?", "default: return '弱'"),
    ("t('settings.ragDebugHint', '??敺?瘥活 AI ??銝?＊蝷箏銝剔??亥??挾?隡澆漲??楝?望捱蝑??嫣噶餈質馱瑼Ｙ揣?釭??)}", "t('settings.ragDebugHint', '開啟後，每次 AI 回覆下方會顯示檢索到的參考文件、相似度分數與來源路徑，幫助除錯與調優。')}"),
    ("\'?喳? 8 ????,", "'至少 8 個字元',"),
    ("\'?憭批神摮? (A-Z)',", "'包含大寫字母 (A-Z)',"),
    ("\'?撠神摮? (a-z)',", "'包含小寫字母 (a-z)',"),
    ("\'??詨? (0-9)',", "'包含數字 (0-9)',"),
    ("\'??寞?摮?',", "'包含特殊字元',"),
    ('label="?嗅?撖Ⅳ"', 'label="目前密碼"'),
    ('label="?啣?蝣?"', 'label="新密碼"'),
    ('label="蝣箄??啣?蝣?"', 'label="確認新密碼"'),
    ('label="?啣?蝣?\n', 'label="新密碼"\n'),
    ('label="蝣箄??啣?蝣?\n', 'label="確認新密碼"\n'),
    ('className="relative w-full max-w-5xl h-auto md:h-full max-h-[90vh] md:max-h-[750px] bg-bg-base/95 /95 backdrop-blur-2xl', 'className="relative w-full max-w-5xl h-auto md:h-full max-h-[90vh] md:max-h-[750px] bg-bg-base/95 backdrop-blur-2xl'),
    ('md:w-64 bg-bg-base/50 /30 border-r border-border-subtle/50 /5', 'md:w-64 bg-bg-base/50 border-r border-border-subtle/50'),
    ('] (var(--color-ios-accent-dark))]', '] dark:text-[rgb(var(--color-ios-accent-dark))]'),
    ('))] (var(--color-ios-accent-dark))]', '] dark:bg-[rgb(var(--color-ios-accent-dark))]'),
    ('/0.15)] (var(--color-ios-accent-dark)/0.15)]', '/0.15] dark:bg-[rgb(var(--color-ios-accent-dark)/0.15)]'),
    ('/0.05)] (var(--color-ios-accent-dark)/0.1)]', '/0.05] dark:bg-[rgb(var(--color-ios-accent-dark)/0.1)]'),
    ('/0.2)] (var(--color-ios-accent-dark)/0.2)]', '/0.2] dark:ring-[rgb(var(--color-ios-accent-dark)/0.2)]'),
    ('<span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">??/span>', '<span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">-</span>')
]

for old, new in fixes:
    content = content.replace(old, new)

with open(fpath, 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixes applied successfully!')
