# 附錄 F：提示工程與大語言模型超參數微調規範 (Prompt Engineering & Hyperparameters Tuning)

在建置企業級 LLM 服務時，模型本身的能力只是基礎，如何透過提示工程（Prompt Engineering）與精確的超參數（Hyperparameters）操控模型產出，是影響系統實際表現（Performance）最為劇烈的關鍵。本附錄詳細列舉了 Corphia AI 在系統底層所封裝的魔法。

## F.1 模型全域推論超參數 (Global Inference Hyperparameters)

在 `llm_service.py` 呼叫 `llama-cpp-python` 的底層 C API 時，我們對模型的生成行為進行了數學層次的干預。

### F.1.1 Temperature (隨機度) 與 Top-P (採樣閥值)
一般設定值為 `Temperature = 0.7`, `Top-P = 0.9`。
- **針對 RAG 企業分析**：當系統判斷使用者處於專案資料夾進行文檔摘要時，我們在後端自動將 Temperature 下調至 `0.1` 甚至 `0.0` (Greedy Search)。因為分析財報合約需要的是絕對的客觀事實，任何的「創意性發散（高 Temperature）」都會誘發極為嚴重的 AI 幻覺（Hallucination）。
- **針對日常對話**：為了使回答自然且語氣委婉，預設為 `0.7`。

### F.1.2 Presence Penalty (話題新鮮度懲罰)
數值設定為 `0.1` 到 `0.3` 之間。
為避免模型在長篇大論的生成中像跳針一樣不斷重複相似的詞彙或句子結構（此問題常見於極度壓縮的量化模型），我們施加了輕度的存在懲罰。這迫使模型在挑選下一個 Token 時，必須盡可能使用先前提過的詞彙以外的新字詞。

## F.2 系統提示詞封裝矩陣 (System Prompt Templates)

使用者在前端看到的只是一個單純的對話框，但在進入 `ChatService` 代理人網路（Agent Graph）後，系統會結合使用者的設定、語言偏好以及過往歷史，揉合成一段長達數百 Token 的 System Prompt。

### F.2.1 基礎對話提示詞 (General System Directive)
這段指令賦予 AI 品牌意識與行為框架：
```text
"You are Corphia, a robust and secure Enterprise AI Assistant deployed locally."
"Your goal is to provide helpful, safe, and accurate information."
"Do not reveal that you are an open-source model. Always introduce yourself as Corphia AI."
```
（在實際執行中，我們採用英文撰寫核心系統提示詞，因為模型在預訓練階段（Pre-training）擁有最龐大的英文語料庫，英文提示詞能獲得最高的遵循率 / Instruction Following Rate）。

### F.2.2 檢索增強場景強制約定 (Strict RAG Constraint Prompt)
當 `use_rag=True`，也就是使用者查詢專案資料庫時，系統會在歷史訊息最前方插入此段落：
```text
=== START OF RETRIEVED CONTEXT ===
{RAG_CONTEXT_CHUNKS}
=== END OF RETRIEVED CONTEXT ===

Instruction: 
You MUST answer the user's question based ONLY on the context provided above. 
Do NOT use your internal knowledge. 
If the answer cannot be found in the context, reply exactly with: "抱歉，在您所提供的專案文件中找不到相關資訊。"
```
這段被稱為 **RAG 越獄防護（Jailbreak Prevention for RAG）**。它強烈制約了模型，不准它「看圖說故事」或「無中生有」，這是企業導入 AI 最重要的免責與合規條款。

### F.2.3 國際化動態語系注射 (Dynamic i18n Injection)
Corphia 系統允許在中、英、日文中切換。為了確保模型回覆語言一致，我們在 System Prompt 最末端進行動態拼接（String Interpolation）：
```python
LANGUAGE_DIRECTIVES = {
    "zh-TW": "Please strictly reply in Traditional Chinese (繁體中文).",
    "ja-JP": "Please strictly reply in Japanese (日本語).",
    "en-US": "Please strictly reply in English."
}
system_prompt += LANGUAGE_DIRECTIVES.get(language, "")
```
這項技巧解決了部分開源模型在理解中文句子後，自作主張用簡體中文或英文混合回覆的痛點。

---
*(結語：至此，系統之通訊、資料、部署、演算法、甚至到神經網絡層次的邏輯控制，皆已全數揭露。報告本文連同六份技術附錄，構建了不可撼動的學術與工程技術總結。)*
