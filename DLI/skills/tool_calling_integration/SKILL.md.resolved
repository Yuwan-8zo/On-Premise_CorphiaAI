---
name: Tool Calling Integration
description: 整合工具呼叫能力，讓 LLM 能夠執行函式與存取外部資源
version: 1.0.0
category: agent_development
tags: [tools, function-calling, integration]
author: NVIDIA DLI Course
difficulty: intermediate
---

# Tool Calling Integration

讓 LLM 能夠呼叫函式、執行程式碼與存取外部 API。

## 核心概念

**工具化 (Tooling)**: LLM 選擇並參數化外部函式

## 步驟

### 1. 定義工具
```python
from langchain.tools import tool
from typing import List

@tool
def calculate(operation: str, a: float, b: float) -> float:
    """執行數學運算"""
    if operation == "add": return a + b
    if operation == "multiply": return a * b
    return 0
```

### 2. 客戶端工具選擇
```python
from langchain_core.output_parsers import JsonOutputParser

# 使用結構化輸出
structured_llm = llm.with_structured_output(
    schema=calculate.input_schema
)

# 生成參數
params = structured_llm.invoke("計算 5 + 3")

# 執行工具
result = calculate.invoke(params)
```

### 3. 伺服器端工具呼叫
```python
# 綁定工具到 LLM
tooled_llm = llm.bind_tools([calculate, search_web])

# LLM 自動選擇工具
response = tooled_llm.invoke("搜尋今日新聞")

# 檢查工具呼叫
if response.tool_calls:
    for tool_call in response.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]
        # 執行對應工具
```

### 4. 常用工具範例

**網路搜尋**:
```python
@tool
async def search_internet(query: str):
    """搜尋網路資訊"""
    from ddgs import DDGS
    results = DDGS().text(query, max_results=5)
    return results
```

**Python 執行**:
```python
@tool
def execute_python(code: str):
    """執行 Python 程式碼"""
    import contextlib, io
    
    with io.StringIO() as buf, contextlib.redirect_stdout(buf):
        exec(code)
        return buf.getvalue()
```

**隨機選擇**:
```python
@tool
def random_choice(options: List[str]) -> str:
    """隨機選擇一個選項"""
    import random
    return random.choice(options)
```

## ReAct 迴圈整合

```python
from langchain.agents import create_agent
from langgraph.checkpoint.memory import MemorySaver

tools = [calculate, search_internet, execute_python]

agent = create_agent(llm, tools, checkpointer=MemorySaver())

result = agent.invoke({
    "messages": [("user", "計算圓周率的前 10 位")]
})
```

## 最佳實踐

1. **明確的工具描述**: Docstring 是 LLM 理解工具的關鍵
2. **型別提示**: 使用 Literal 限制選項
3. **錯誤處理**: 工具內部應處理異常
4. **安全性**: 限制執行權限，使用沙箱

## 故障排除

**Q: LLM 選錯工具?**
- 改善工具名稱與描述
- 加入範例到系統訊息
- 使用更強大的模型

**Q: 參數格式錯誤?**
- 使用 Pydantic 嚴格驗證
- 在提示中加入 Schema 說明

參考: [LangChain Tools](https://python.langchain.com/docs/modules/tools/)
