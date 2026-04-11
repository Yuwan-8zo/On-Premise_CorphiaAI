---
name: Structured Output Generator
description: 使用 LLM 生成嚴格符合 JSON Schema 的結構化輸出，實現可靠的資料提取與函式呼叫
version: 1.0.0
category: llm_engineering
tags: [structured-output, schema, pydantic, json, data-extraction]
author: NVIDIA DLI Course
difficulty: intermediate
estimated_time: 45 minutes
---

# Structured Output Generator

掌握結構化輸出技術，將 LLM 的自然語言能力轉換為可靠的、符合預定格式的資料輸出。

## 📋 前置需求

- Python 3.8+
- Pydantic 2.0+
- LangChain 框架
- 支援結構化輸出的 LLM API
- JSON Schema 基礎知識

## 🎯 學習目標

1. ✅ 理解結構化輸出的核心概念與價值
2. ✅ 使用 Pydantic 定義嚴格的資料 Schema
3. ✅ 實作 Guided Generation（引導生成）
4. ✅ 處理複雜的巢狀結構
5. ✅ 整合結構化輸出到工作流程

## 🧠 核心概念

### 為何需要結構化輸出？

**問題**: LLM 自然語言輸出難以整合到程式邏輯
- 格式不一致
- 難以解析
- 無法保證完整性

**解決方案**: 強制 LLM 輸出符合預定 Schema
- 保證格式一致
- 可直接轉換為物件
- 支援型別驗證

### 實作機制

```
輸入 → [系統提示 + Schema 提示] → LLM → [Guided Decoding] → 結構化 JSON
```

---

## 📚 步驟清單

### Step 1: 定義基礎 Schema

**目標**: 使用 Pydantic 創建資料模型

```python
from pydantic import BaseModel, Field
from typing import List, Literal

class WorkshopMetadata(BaseModel):
    """工作坊中介資料結構"""
    
    title: str = Field(
        description="工作坊標題，需簡潔且描述性"
    )
    
    difficulty: Literal["Beginner", "Intermediate", "Advanced"] = Field(
        description="難度等級"
    )
    
    duration_hours: int = Field(
        description="預估時數",
        ge=1,  # 大於等於 1
        le=40  # 小於等於 40
    )
    
    topics: List[str] = Field(
        description="至少 3 個主要主題",
        min_length=3
    )
    
    prerequisites: List[str] = Field(
        description="前置需求清單",
        default_factory=list
    )
```

**驗證 Schema**:
```python
# 檢視 JSON Schema
print(WorkshopMetadata.model_json_schema())

# 測試驗證
sample = WorkshopMetadata(
    title="AI Fundamentals",
    difficulty="Beginner",
    duration_hours=8,
    topics=["ML Basics", "Neural Networks", "Python"]
)
print(sample.model_dump_json(indent=2))
```

---

### Step 2: 建立 Schema 提示輔助函式

**目標**: 生成清晰的 Schema 說明供 LLM 理解

```python
def get_schema_hint(schema_class):
    """
    生成 schema 格式說明
    
    Args:
        schema_class: Pydantic BaseModel 類別
        
    Returns:
        str: 格式化的 schema 說明
    """
    schema = schema_class.model_json_schema()
    
    hint = (
        "The output should be formatted as a JSON instance that "
        "conforms to the JSON schema below.\n\n"
        "As an example, for the schema "
        '{"properties": {"foo": {"title": "Foo", "description": "a list of strings", '
        '"type": "array", "items": {"type": "string"}}}, "required": ["foo"]}\n'
        'the object {"foo": ["bar", "baz"]} is a well-formatted instance of the schema. '
        'The object {"properties": {"foo": ["bar", "baz"]}} is not well-formatted.\n\n'
        f"Here is the output schema:\n```json\n{schema}\n```"
    )
    
    return hint

# 使用範例
schema_hint = get_schema_hint(WorkshopMetadata)
print(schema_hint)
```

---

### Step 3: 整合到 LLM 調用

**目標**: 配置 LLM 以生成結構化輸出

**方法 A: 使用 with_structured_output()**
```python
from langchain_nvidia import ChatNVIDIA

llm = ChatNVIDIA(
    model="meta/llama-3.1-8b-instruct",
    base_url="http://llm_client:9000/v1"
)

# 綁定結構化輸出
structured_llm = llm.with_structured_output(
    schema=WorkshopMetadata.model_json_schema(),
    strict=True
)

# 調用
query = "Generate metadata for a beginner Python workshop"
result = structured_llm.invoke(query)

# result 自動是 dict 格式
workshop = WorkshopMetadata(**result)
print(workshop)
```

**方法 B: 手動提示工程**
```python
from langchain_core.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant that generates structured data."),
    ("user", "{query}\n\n{schema_hint}")
])

# 建立鏈
chain = prompt | structured_llm

result = chain.invoke({
    "query": "Create metadata for advanced deep learning course",
    "schema_hint": get_schema_hint(WorkshopMetadata)
})
```

---

### Step 4: 處理串流輸出

**目標**: 以串流方式獲取結構化資料

```python
from IPython.display import clear_output

result = {}

for chunk in structured_llm.stream(query):
    clear_output(wait=True)
    
    # 更新結果
    for key, value in chunk.items():
        result[key] = value
        print(f"{key}: {value}")
    
    print("\n" + "="*50)

# 驗證最終結果
final_output = WorkshopMetadata(**result)
```

---

### Step 5: 複雜巢狀結構

**目標**: 處理更複雜的資料模型

```python
from typing import Optional

class Instructor(BaseModel):
    """講師資訊"""
    name: str
    title: str
    expertise: List[str]

class Module(BaseModel):
    """課程模組"""
    module_number: int
    title: str
    topics: List[str]
    estimated_minutes: int

class CompleteCourse(BaseModel):
    """完整課程結構"""
    metadata: WorkshopMetadata
    instructors: List[Instructor]
    modules: List[Module]
    learning_objectives: List[str]
    
    assessment_type: Literal["Quiz", "Project", "Both", "None"]
    certificate_available: bool = True
```

**生成複雜結構**:
```python
structured_llm = llm.with_structured_output(
    schema=CompleteCourse.model_json_schema(),
    strict=True
)

query = """
Create a complete course structure for "Building AI Agents with LLMs".
Include 2 instructors and 4 modules.
"""

course = CompleteCourse(**structured_llm.invoke(query))

# 存取巢狀資料
print(f"課程: {course.metadata.title}")
print(f"講師: {', '.join(i.name for i in course.instructors)}")
print(f"模組數: {len(course.modules)}")
```

---

### Step 6: 處理列舉與限制

**目標**: 使用 Literal 與自訂驗證

```python
from pydantic import field_validator

class AgentResponse(BaseModel):
    """Agent 回應結構"""
    
    speaker: str = Field(description="發言者名稱")
    
    intent: Literal[
        "question",
        "answer", 
        "clarification",
        "acknowledgment"
    ] = Field(description="訊息意圖")
    
    confidence: float = Field(
        description="信心程度 0-1",
        ge=0.0,
        le=1.0
    )
    
    response: List[str] = Field(
        description="回應內容，每個元素是一個句子"
    )
    
    next_action: Literal["continue", "end", "escalate"]
    
    @field_validator('speaker')
    @classmethod
    def validate_speaker(cls, v):
        """確保發言者名稱不為空且合理"""
        if len(v.strip()) < 2:
            raise ValueError("Speaker name too short")
        return v.title()  # 首字母大寫

# 使用動態 Schema
def get_finite_schema(base_class, field_options: dict):
    """
    動態調整 enum 選項
    
    Args:
        base_class: Pydantic 模型
        field_options: {"field_name": ["option1", "option2"]}
    """
    schema = base_class.model_json_schema()
    
    for field, options in field_options.items():
        if field in schema["properties"]:
            if "enum" in schema["properties"][field]:
                schema["properties"][field]["enum"] = options
    
    return schema

# 限制選項
custom_schema = get_finite_schema(
    AgentResponse,
    {"next_action": ["continue", "end"]}  # 移除 "escalate"
)
```

---

## 🧪 測試與驗證

### 測試案例

```python
import pytest

def test_basic_schema():
    """測試基本 schema 驗證"""
    data = {
        "title": "Test Workshop",
        "difficulty": "Beginner",
        "duration_hours": 4,
        "topics": ["A", "B", "C"]
    }
    
    workshop = WorkshopMetadata(**data)
    assert workshop.difficulty == "Beginner"
    assert len(workshop.topics) >= 3

def test_invalid_duration():
    """測試無效時數"""
    with pytest.raises(ValueError):
        WorkshopMetadata(
            title="Test",
            difficulty="Beginner",
            duration_hours=100,  # 超過 40
            topics=["A", "B", "C"]
        )

def test_llm_output():
    """測試 LLM 生成的輸出"""
    result = structured_llm.invoke("Generate a test workshop")
    
    # 驗證可以成功轉換
    workshop = WorkshopMetadata(**result)
    
    # 驗證必填欄位
    assert workshop.title
    assert workshop.difficulty in ["Beginner", "Intermediate", "Advanced"]
    assert len(workshop.topics) >= 3
```

---

## 🎨 進階技巧

### 1. 思維鏈 + 結構化輸出

```python
class ThoughtProcess(BaseModel):
    """包含推理過程的結構化輸出"""
    
    reasoning: List[str] = Field(
        description="逐步推理過程"
    )
    
    conclusion: str = Field(
        description="最終結論"
    )
    
    confidence: float = Field(
        description="信心程度",
        ge=0, le=1
    )
    
    sources: List[str] = Field(
        description="參考來源",
        default_factory=list
    )

# 提示包含思考指示
thought_prompt = """
Think step by step about: {question}

Break down your reasoning into clear steps, then provide a conclusion.
"""
```

### 2. 錯誤恢復機制

```python
def safe_structured_invoke(llm, query, schema_class, max_retries=3):
    """
    安全的結構化調用，包含重試機制
    """
    from pydantic import ValidationError
    
    for attempt in range(max_retries):
        try:
            result = llm.invoke(query)
            
            # 嘗試驗證
            validated = schema_class(**result)
            return validated
            
        except ValidationError as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            
            if attempt < max_retries - 1:
                # 加入錯誤資訊到下次查詢
                query = f"{query}\n\nPrevious error: {str(e)}\nPlease fix and try again."
            else:
                raise
    
    return None
```

### 3. 部分結構化輸出

```python
class FlexibleResponse(BaseModel):
    """允許額外欄位的彈性結構"""
    
    required_field: str
    optional_field: Optional[str] = None
    
    class Config:
        extra = "allow"  # 允許額外欄位

# 或使用 Union 類型
from typing import Union

class ResponseA(BaseModel):
    type: Literal["A"]
    data_a: str

class ResponseB(BaseModel):
    type: Literal["B"]
    data_b: int

Response = Union[ResponseA, ResponseB]
```

---

## 🔧 故障排除

### 常見問題

**Q: LLM 生成的 JSON 格式不正確？**
```python
# 解決方案 1: 加強 schema 提示
schema_hint = get_schema_hint(YourSchema)

# 解決方案 2: 使用嚴格模式
llm.with_structured_output(schema, strict=True)

# 解決方案 3: 檢查伺服器端支援
# 某些端點不支援 guided generation
```

**Q: 輸出中出現額外的文字？**
```python
# 設定停止序列
llm = llm.bind(stop=["```", "\n\n"])

# 或使用後處理
import json
import re

def extract_json(text):
    """從文字中提取 JSON"""
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        return json.loads(match.group())
    raise ValueError("No JSON found")
```

**Q: Schema 太複雜導致失敗？**
```python
# 策略 1: 分階段生成
metadata = llm_call_1(...)
instructors = llm_call_2(metadata, ...)
modules = llm_call_3(metadata, ...)

# 組合結果
complete = CompleteCourse(
    metadata=metadata,
    instructors=instructors,
    modules=modules
)

# 策略 2: 簡化 schema
# 移除非必要的驗證規則
```

---

## 📖 實��應用案例

### 案例 1: 資料提取

```python
class ContactInfo(BaseModel):
    name: str
    email: Optional[str]
    phone: Optional[str]
    company: Optional[str]

extractor = llm.with_structured_output(ContactInfo)

text = """
Hi, I'm John Doe from ACME Corp. 
You can reach me at john@acme.com or 555-1234.
"""

contact = ContactInfo(**extractor.invoke(
    f"Extract contact information from: {text}"
))
```

### 案例 2: 意圖分類

```python
class UserIntent(BaseModel):
    primary_intent: Literal[
        "question", "complaint", "request", "feedback"
    ]
    subcategory: str
    urgency: Literal["low", "medium", "high"]
    entities: List[str]

classifier = llm.with_structured_output(UserIntent)

message = "I need urgent help with my account login!"
intent = classifier.invoke(message)
# → primary_intent="request", urgency="high"
```

### 案例 3: 內容生成

```python
class BlogPost(BaseModel):
    title: str
    introduction: str
    sections: List[dict]  # [{"heading": "...", "content": "..."}]
    conclusion: str
    tags: List[str]

generator = llm.with_structured_output(BlogPost)
post = generator.invoke("Write about AI agents")
```

---

## ✅ 完成檢核表

- [ ] 成功定義至少 3 種不同的 Pydantic Schema
- [ ] 實作基本的結構化輸出調用
- [ ] 處理包含 List 和巢狀物件的複雜結構
- [ ] 使用 Literal 限制列舉選項
- [ ] 實作錯誤處理與驗證
- [ ] 測試串流輸出模式
- [ ] 完成至少一個實際應用案例

**恭喜掌握結構化輸出技術！** 🎉

---

## 📚 延伸閱讀

- [Pydantic Documentation](https://docs.pydantic.dev/)
- [JSON Schema Specification](https://json-schema.org/)
- [LangChain Structured Output Guide](https://python.langchain.com/docs/modules/model_io/output_parsers/)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
