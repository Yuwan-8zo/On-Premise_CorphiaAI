---
name: Agentic Chatbot Builder
description: 建構具有 Agent 能力的聊天機器人，包含系統訊息、多輪對話與狀態管理
version: 1.0.0
category: agent_development
tags: [chatbot, agent, llm, conversation]
author: NVIDIA DLI Course
difficulty: intermediate
estimated_time: 30 minutes
---

# Agentic Chatbot Builder

建構一個完整的 Agent 聊天機器人系統，具備語義推理能力、多輪對話管理以及可自訂的角色設定。

## 📋 前置需求

- Python 3.8+
- LangChain 或 LangGraph 框架
- 可存取的 LLM API (OpenAI, NVIDIA NIM, 或其他)
- 基本的自然語言處理知識

## 🎯 學習目標

完成此技能後，您將能夠：

1. ✅ 理解 Agent 的核心概念與定義
2. ✅ 建構有狀態的多輪對話系統
3. ✅ 設計有效的系統訊息 (System Message)
4. ✅ 實作訊息歷史管理機制
5. ✅ 處理對話流程控制

## 📚 步驟清單

### Step 1: 設定 LLM 客戶端

**目標**: 連接到 LLM 服務並測試基本功能

**操作**:
```python
from langchain_nvidia import ChatNVIDIA
# 或使用 OpenAI
# from langchain_openai import ChatOpenAI

# 初始化 LLM 客戶端
llm = ChatNVIDIA(
    model="meta/llama-3.1-8b-instruct",
    base_url="http://llm_client:9000/v1"
)

# 測試基本呼叫
response = llm.invoke("Hello! How are you?")
print(response.content)
```

**驗證**: 確認能夠成功獲得 LLM 回應

---

### Step 2: 設計系統訊息

**目標**: 創建定義 Agent 行為與角色的系統訊息

**指導原則**:
- 使用 "You are..." 句式定義角色
- 明確說明 Agent 的能力範圍
- 提供行為準則與限制
- 5 句左右為佳

**範例**:
```python
system_message = """
You are a helpful AI assistant for NVIDIA Deep Learning Institute (DLI).
You help students with course-related queries using provided context.
You provide accurate, concise information without making assumptions.
You stay on topic and redirect off-topic questions politely.
You always cite your sources when referencing specific information.
"""
```

**提示**: 避免使用 "I" 開頭，統一用 "You"

---

### Step 3: 建構提示模板

**目標**: 創建可重用的對話提示結構

```python
from langchain_core.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_messages([
    ("system", system_message),
    ("placeholder", "{messages}")
])
```

**選項功能**: 加入上下文支援
```python
prompt = ChatPromptTemplate.from_messages([
    ("system", system_message),
    ("user", "<context>\n{context}</context>"),
    ("ai", "Thank you. I will use this context to answer questions."),
    ("placeholder", "{messages}")
])
```

---

### Step 4: 實作對話管理函式

**目標**: 建立管理多輪對話的核心邏輯

```python
from langchain_core.output_parsers import StrOutputParser

def chat_with_agent(state, chain):
    """
    互動式聊天函式
    
    Args:
        state (dict): 包含 'messages' 的狀態字典
        chain: LangChain 可運行物件
    """
    state["messages"] = state.get("messages", [])
    
    while True:
        # 獲取使用者輸入
        user_input = input("\n[User]: ")
        if not user_input.strip():
            print("結束對話")
            break
            
        # 加入使用者訊息
        state["messages"].append(("user", user_input))
        
        # 生成 Agent 回應
        print("[Agent]: ", end="", flush=True)
        agent_response = ""
        for chunk in chain.stream(state):
            print(chunk, end="", flush=True)
            agent_response += chunk
        print()
        
        # 儲存 Agent 回應
        state["messages"].append(("ai", agent_response))
        
        # 檢查停止條件
        if "stop" in user_input.lower():
            break
    
    return state
```

---

### Step 5: 組裝完整系統

**目標**: 將所有組件整合成可運行的 Agent

```python
# 建立處理鏈
chat_chain = prompt | llm | StrOutputParser()

# 初始化狀態
state = {
    "messages": [],
    "context": ""  # 可選：加入領域知識
}

# 啟動對話
final_state = chat_with_agent(state, chat_chain)

# 檢視對話歷史
print("\n對話記錄:")
for role, content in final_state["messages"]:
    print(f"[{role}]: {content[:100]}...")
```

---

### Step 6: 進階功能 - 記憶管理

**目標**: 處理過長的對話歷史

**策略選項**:

1. **滑動視窗法**:
```python
def truncate_messages(messages, max_length=10):
    """保留最近的 N 則訊息"""
    return messages[-max_length:]
```

2. **摘要法**:
```python
def summarize_history(messages, llm):
    """使用 LLM 摘要舊對話"""
    if len(messages) > 20:
        old_messages = messages[:-10]
        summary_prompt = f"Summarize this conversation: {old_messages}"
        summary = llm.invoke(summary_prompt).content
        return [("system", f"Previous summary: {summary}")] + messages[-10:]
    return messages
```

---

## 🧪 測試與驗證

### 功能測試清單

- [ ] **基本對話**: Agent 能回應簡單問候
- [ ] **多輪對話**: Agent 能記住先前對話內容
- [ ] **角色一致性**: Agent 保持設定的角色特性
- [ ] **停止機制**: 能正常結束對話
- [ ] **錯誤處理**: 妥善處理空輸入或異常

### 測試場景

```python
# 測試場景 1: 記憶能力
# User: "My name is Alice"
# Agent: (確認)
# User: "What's my name?"
# Agent: 應回答 "Alice"

# 測試場景 2: 角色保持
# User: "幫我寫作業"
# Agent: 應拒絕並說明自己的職責範圍
```

---

## 🎨 最佳實踐

### System Message 設計
✅ **好的範例**:
```
You are a technical support agent for cloud services.
You help users troubleshoot deployment issues.
You ask clarifying questions before providing solutions.
You provide step-by-step instructions.
You escalate critical issues to human operators.
```

❌ **不好的範例**:
```
Help users. Be nice.
```

### 狀態管理
- 使用 TypedDict 明確定義狀態結構
- 定期檢查訊息列表長度
- 考慮實作檢查點 (Checkpointing) 機制

---

## 🔧 故障排除

### 常見問題

**Q: Agent 回應很慢？**
- 使用 `stream()` 而非 `invoke()` 改善體驗
- 考慮使用較小的模型
- 減少上下文長度

**Q: Agent 容易偏離主題？**
- 強化系統訊息的指示
- 加入明確的拒絕回應範例
- 使用結構化輸出約束行為

**Q: 記憶體不斷增長？**
- 實作訊息截斷機制
- 定期重置對話狀態
- 使用外部儲存系統

---

## 📖 延伸學習

### 下一步建議

1. **多 Agent 系統** → 學習 Skill: `multi_agent_orchestration`
2. **結構化輸出** → 學習 Skill: `structured_output_generator`
3. **RAG 整合** → 學習 Skill: `rag_system_builder`

### 參考資源

- [LangChain Documentation - Chat Models](https://python.langchain.com/docs/modules/model_io/chat/)
- [NVIDIA NIM - LLM Deployment](https://www.nvidia.com/en-us/ai-data-science/products/nim/)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)

---

## 📝 練習作業

### 任務 1: 客製化助理
創建一個針對特定領域（如醫療、法律、教育）的專業助理

### 任務 2: 多語言支援
擴展系統支援多種語言切換

### 任務 3: 情緒感知
加入情緒偵測，根據使用者情緒調整回應風格

---

## ✅ 完成檢核表

完成以下項目即代表掌握此技能：

- [ ] 成功建立並測試基本聊天機器人
- [ ] 實作有效的系統訊息
- [ ] 處理至少 10 輪的連續對話
- [ ] 實作記憶管理機制
- [ ] 加入適當的錯誤處理
- [ ] 測試各種邊界情況

**恭喜完成 Agentic Chatbot Builder 技能！** 🎉
