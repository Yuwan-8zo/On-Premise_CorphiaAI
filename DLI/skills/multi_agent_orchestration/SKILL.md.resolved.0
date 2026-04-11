---
name: Multi-Agent Orchestration
description: 建構多 Agent 系統，讓不同角色的 AI Agent 協同工作
version: 1.0.0
category: agent_development
tags: [multi-agent, orchestration, collaboration]
author: NVIDIA DLI Course
difficulty: advanced
---

# Multi-Agent Orchestration

建構多個 Agent 協同工作的系統。

## 核心概念

**多 Agent 系統**: 多個具有不同角色的 Agent 互動完成任務

## 方法比較

| 框架 | 適用場景 | 複雜度 |
|------|---------|--------|
| **CrewAI** | 角色型協作 | 低 |
| **LangGraph** | 自訂工作流 | 高 |
| **自訂** | 完全控制 | 中 |

## 使用 CrewAI

### 1. 定義 Agents
```python
from crewai import Agent, LLM

llm = LLM(model="meta/llama-3.1-8b-instruct")

researcher = Agent(
    role='Researcher',
    goal='Find accurate information',
    backstory='Expert researcher with attention to detail',
    llm=llm
)

writer = Agent(
    role='Writer',
    goal='Create engaging content',
    backstory='Skilled technical writer',
    llm=llm
)
```

### 2. 定義任務
```python
from crewai import Task

research_task = Task(
    description='Research about AI agents',
    expected_output='Detailed findings',
    agent=researcher
)

writing_task = Task(
    description='Write article based on research',
    expected_output='Well-written article',
    agent=writer
)
```

### 3. 建立 Crew
```python
from crewai import Crew, Process

crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, writing_task],
    process=Process.sequential
)

result = crew.kickoff()
```

## 使用 LangGraph

### 1. 定義 Agent 類別
```python
class Agent:
    def __init__(self, role, llm, prompt):
        self.role = role
        self.llm = llm
        self.prompt = prompt
    
    def __call__(self, state):
        messages = self._convert_to_local(state["messages"])
        response = self.llm.invoke(
            self.prompt.invoke({"messages": messages})
        )
        return {"messages": [(self.role, response.content)]}
```

### 2. 建構狀態圖
```python
from langgraph.graph import StateGraph, START

class State(TypedDict):
    messages: list
    current_speaker: str

builder = StateGraph(State)

# 加入 Agent 節點
teacher = Agent(role="Teacher", llm=llm, prompt=teacher_prompt)
student = Agent(role="Student", llm=llm, prompt=student_prompt)

builder.add_node("teacher", teacher)
builder.add_node("student", student)

# 路由邏輯
def route_next(state):
    last = state["messages"][-1]
    if "Teacher" in last[0]:
        return "student"
    return "teacher"

builder.add_conditional_edges(
    "teacher",
    route_next,
    {"teacher": "teacher", "student": "student"}
)
```

## 角色感知提示

```python
from langchain_core.prompts import ChatPromptTemplate

persona_prompt = ChatPromptTemplate.from_messages([
    ("system", """
You are {role}. {backstory}
Available participants: {participants}
{directive}
"""),
    ("placeholder", "{messages}")
])
```

## 結構化路由

```python
from pydantic import BaseModel

class AgentResponse(BaseModel):
    speaker: str
    response: List[str]
    next_speaker: str  # 路由決策

# 使用結構化輸出確保正確路由
structured_llm = llm.with_structured_output(AgentResponse)
```

## 最佳實踐

1. **明確角色定義**: 每個 Agent 應有清楚的職責
2. **避免循環**: 設定最大輪數或結束條件
3. **狀態管理**: 使用 checkpointer 持久化
4. **錯誤處理**: 處理 Agent 拒絕或失敗

## 典型架構模式

**順序執行**:
```
研究員 → 分析師 → 撰寫者 → 審核者
```

**分支合併**:
```
     → Agent A →
主控 → Agent B → 彙整
     → Agent C →
```

**階層式**:
```
管理者 Agent
  ↓ 分配任務
工作者 Agents → 回報結果
```

參考: [CrewAI Docs](https://docs.crewai.com/), [LangGraph Multi-Agent](https://langchain-ai.github.io/langgraph/tutorials/multi_agent/)
