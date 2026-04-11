---
name: LangGraph Workflow Builder
description: 使用 LangGraph 建構複雜的 Agent 工作流程與狀態圖
version: 1.0.0
category: agent_orchestration
tags: [langgraph, workflow, state-management, agent]
author: NVIDIA DLI Course
difficulty: advanced
---

# LangGraph Workflow Builder

使用 LangGraph 建構可控制、可觀察的 Agent 工作流程。

## 核心概念

**LangGraph 三要素**:
1. **State**: 應用程式狀態 (TypedDict)
2. **Nodes**: 操作狀態的函式
3. **Edges**: 控制流程

## 步驟

### 1. 定義狀態
```python
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

class State(TypedDict):
    messages: Annotated[list, add_messages]
    current_speaker: str
```

### 2. 建立節點函式
```python
def agent_node(state: State):
    """處理 Agent 邏輯"""
    messages = state["messages"]
    response = llm.invoke(messages)
    
    return {"messages": [response]}
```

### 3. 建構流程圖
```python
from langgraph.graph import StateGraph, START, END

builder = StateGraph(State)
builder.add_node("agent", agent_node)
builder.add_edge(START, "agent")
builder.add_edge("agent", END)

app = builder.compile()
```

### 4. 執行工作流
```python
result = app.invoke({
    "messages": [("user", "Hello!")],
    "current_speaker": "user"
})
```

## 進階功能

### 條件路由
```python
def should_continue(state):
    last_message = state["messages"][-1]
    if "FINAL ANSWER" in last_message.content:
        return "end"
    return "continue"

builder.add_conditional_edges(
    "agent",
    should_continue,
    {"continue": "agent", "end": END}
)
```

### 記憶管理
```python
from langgraph.checkpoint.memory import MemorySaver

checkpointer = MemorySaver()
app = builder.compile(checkpointer=checkpointer)

config = {"configurable": {"thread_id": "session-1"}}
result = app.invoke(inputs, config=config)
```

### 中斷與恢復
```python
from langgraph.types import interrupt, Command

def human_approval(state):
    decision = interrupt("需要人工審核")
    return Command(update={"approved": decision})

# 恢復執行
app.invoke(None, config=config)
```

## ReAct Agent 範例
```python
from langchain.agents import create_agent
from langgraph.checkpoint.memory import MemorySaver

tools = [search_tool, calculator_tool]
checkpointer = MemorySaver()

agent = create_agent(llm, tools, checkpointer=checkpointer)

result = agent.invoke({
    "messages": [("user", "搜尋 NVIDIA 新聞")]
})
```

## 最佳實踐
- 保持 State 結構簡單
- 使用 `add_messages` 管理對話
- 善用 checkpointer 持久化狀態
- 使用條件邊處理複雜邏輯

參考: [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
