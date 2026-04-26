import os

replacements = {
    "// ?????翰頛芾岷?漲 (瘥?3 蝘?嚗??€??敺敺?30 蝘憚閰?": "// 未連線時快速輪詢連線狀態 (每 3 秒)，成功連線後放緩至 30 秒輪詢",
    "'隢???餌?嚗?蝔??岫'": "'請求過於頻繁，或者發生了錯誤'",
    "甇???敺垢????頛之隤?璅∪?嚗?蝔€?..": "正在連線至後端伺服器，這可能需要幾秒鐘...",
    "頝喲?蝑?嚗撥?園€脣?恍": "跳過等待，直接進入主畫面",
    "{/* ?€?€ 撌血嚗???蝝?(獢 50%) ?€?€ */}": "{/* ── 左側：歡迎與特色 (佔滿 50%) ── */}",
    "{/* ?€?€ ?喳嚗?亥”??(獢 50%嚗?璈?100%) ?€?€ */}": "{/* ── 右側：登入表單 (佔滿 50%，手機 100%) ── */}",
    "{/* ??€憛?(???＊蝷箏椰?渡????喳??嚗??Ｙ??芷＊蝷箏?湔??? */}": "{/* 頂部控制 (手機版隱藏左側的後端狀態，桌機版對齊右邊) */}",
    "{/* ?∠??祇?嚗?:1 甇?敶ｇ?flex spacer 蝎暹???? */}": "{/* 卡片本體：1:1 正方形，flex spacer 精準垂直分配 */}",
    "{/* ?€?€ Pill Tab ??嚗????荔? ?€?€ */}": "{/* ── Pill Tab 切換（滑動背景） ── */}",
    "{/* ?€?€ Spacer B2嚗?蝯 DOM嚗?甇亙???flexGrow嚗??€?€ */}": "{/* ── Spacer B2：保留在 DOM，但只有註冊有 flexGrow ── */}",
    "{/* ?€?€ Confirm Password嚗?蝯 DOM嚗?甇亙??恬? ?€?€ */}": "{/* ── Confirm Password：保留在 DOM，但只有註冊可見 ── */}",
    "{/* 撌行?嚗?蝣潸???*/}": "{/* 左側：密碼規則 */}",
    "{/* ?單?嚗撓?交?雿?*/}": "{/* 右側：輸入欄位 */}",
    "// ?€?€ 撖Ⅳ頛詨獢?隞輻?仿? FloatingInput 憸冽嚗??€?€": "// ── 密碼輸入框：套用登入頁的 FloatingInput 樣式 ──",
}

for root, _, files in os.walk('frontend/src'):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            orig_content = content
            for k, v in replacements.items():
                content = content.replace(k, v)
                
            if content != orig_content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Fixed {path}")
