import os

replacements = {
    # ChatInputArea.tsx
    "{/* ?內閰芋???(?函??典椰?? */}": "{/* 顯示提示詞選擇器 (固定在左側) */}",
    "<span>銝銝?{uploadProgress}%</span>": "<span>上傳中... {uploadProgress}%</span>",
    "title=\"銝撠??辣 (NotebookLM 璅∪?)\"": "title=\"上傳專案文件 (NotebookLM 模式)\"",
    
    # SettingsModal.tsx
    "if (!/[A-Z]/.test(value)) errors.push('?€?憭批神摮?')": "if (!/[A-Z]/.test(value)) errors.push('必須包含大寫字母')",
    "if (!/[a-z]/.test(value)) errors.push('?€?撠神摮?')": "if (!/[a-z]/.test(value)) errors.push('必須包含小寫字母')",
    "if (!/\\d/.test(value)) errors.push('?€??詨?')": "if (!/\\d/.test(value)) errors.push('必須包含數字')",
    "if (!/[!@#$%^&*()\\-_=+[\]{};:'\",.<>?/\\|`~]/.test(value)) errors.push('?€??寞?摮?')": "if (!/[!@#$%^&*()\\-_=+[\]{};:'\",.<>?/\\|`~]/.test(value)) errors.push('必須包含特殊字元')",
    "{/* 摨???€ */}": "{/* 底部按鈕區 */}",
    "// ?€?€ 撖Ⅳ頛詨獢?隞輻?仿? FloatingInput 憸冽嚗??€?€": "// ── 密碼輸入框：套用登入頁的 FloatingInput 樣式 ──",
    
    # Login.tsx
    "// 瑼Ｘ敺垢?€??": "// 檢查後端狀態",
    "{/* ?€?€ Spacer C (摨閬死鋆? 1.15) ?€?€ */}": "{/* ── Spacer C (底部留白比例 1.15) ── */}",
    "{/* 摨惜???隤斗?蝷箏?憛?*/}": "{/* 底部按鈕與錯誤提示區塊 */}",
    "{/* ?漱?? */}": "{/* 處理按鈕 */}",
}

for file in ['frontend/src/components/chat/ChatInputArea.tsx', 'frontend/src/components/ui/SettingsModal.tsx', 'frontend/src/pages/Login.tsx']:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    orig_content = content
    for k, v in replacements.items():
        content = content.replace(k, v)
        
    if content != orig_content:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {file}")
