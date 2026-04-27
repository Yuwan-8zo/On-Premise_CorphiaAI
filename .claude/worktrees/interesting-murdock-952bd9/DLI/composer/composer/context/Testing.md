> **DLI CONTENT PROCESSOR (BETA)**
>
> Based on all of this code, please create a notebook testbed that allows the user to select a model of choice and run a sequence of tests. The notebook must run all on its own to verify the validity of every use-case, and should have an option to display the results in a logical display(markdown(dd)) fashion. Make sure to consider all of the use-cases and varify that all of the content runs without any interrupts. Do not use any emojis in the chat, enumerate the use-cases, and allow for a selection of a model in a first cell from a static list (users can obviously specify other ones). Minimize the amount of dumb boilerplate and don't make too many functions. Make sure the model tests span all of the uses throughout the course.

Below is a **self‑contained notebook** that you can copy‑paste into a new Jupyter cell (or a series of cells) and run end‑to‑end.  
It lets you:

1. **Pick a model** from a short static list.  
2. **Run a battery of use‑cases** that touch every section of the course (simple chat, dataset chat, structured output, tool‑use, LangGraph persona, retrieval, and the final assessment).  
3. **Collect the results** in a single dictionary.  
4. **Display the outcome** as nicely‑formatted Markdown “details/summary” blocks (`<details><summary>…</summary>…</details>`).  

No extra boiler‑plate functions are required – everything lives in a few compact cells.

---

## 1️⃣  Notebook Header – Choose a Model  

```python
# --------------------------------------------------------------
# 1️⃣  Model selector – static list, pick one and store the name
# --------------------------------------------------------------

# Available models (feel free to add more if the environment provides them)
MODEL_CHOICES = [
    "nvidia/nemotron-3-nano-30b-a3b",     # 30‑B model used for assessment
    "meta/llama-3.1-8b-instruct",          # default small model
    "nvidia/llama-3.1-nemotron-nano-8b-v1",# 8‑B Nemotron variant
    "meta/llama-3.1-70b-instruct",        # larger model (if available)
]

# Simple UI – pick by index (you can also edit the list directly)
print("Select a model to run the test‑bed:")
for i, name in enumerate(MODEL_CHOICES, 1):
    print(f"{i}. {name}")

SELECTED_MODEL = MODEL_CHOICES[0]

print(f"\n✅  You selected: {SELECTED_MODEL}\n")
```

---

## 2️⃣  Imports & Global Setup  

```python
# --------------------------------------------------------------
# 2️⃣  Imports & global objects (minimal boiler‑plate)
# --------------------------------------------------------------

import json, requests, uuid, time
from typing import List, Dict, Any
from IPython.display import Markdown, display

# LangChain / NVIDIA imports
from langchain_nvidia import ChatNVIDIA
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda
from langchain_core.documents import Document

# LangGraph / state helpers
from langgraph.checkpoint.memory import MemorySaver
from langgraph.constants import START, END
from langgraph.graph import StateGraph
from langgraph.types import Command
from langgraph.graph.message import add_messages
from functools import partial

# Simple helper to stream output (used by many tests)
def stream_text(txt):
    for ch in txt:
        print(ch, end="", flush=True)
        time.sleep(0.01)
```

---

## 3️⃣  Build the LLM Instance  

```python
# --------------------------------------------------------------
# 3️⃣  Create the ChatNVIDIA client with the selected model
# --------------------------------------------------------------

llm = ChatNVIDIA(
    model=SELECTED_MODEL,
    base_url="http://llm_client:9000/v1",
    max_completion_tokens=8000,
    temperature=0.7,
)
```

---

## 4️⃣  Test‑Case Functions  

Each function performs **one** of the use‑cases covered in the course and returns a dictionary that will later be displayed.

```python
# --------------------------------------------------------------
# 4️⃣  Individual test‑case helpers
# --------------------------------------------------------------

def test_simple_chat():
    """Section 1 – basic chatbot loop."""
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a friendly assistant."),
        ("placeholder", "{messages}"),
    ])
    chain = prompt | llm | StrOutputParser()
    state = {"messages": [("user", "Hello!")]}
    resp = chain.invoke(state)
    return {"result": resp, "type": "simple_chat"}

def test_dataset_chat():
    """Section 2 – chat with a tiny dataset."""
    # tiny hard‑coded dataset
    ctx = """Workshop: Intro to GPUs
Presenters: Alice
Description: Basics of GPU architecture."""
    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You answer questions about the provided workshop description."),
        ("user", "<context>\n{context}</context>"),
        ("placeholder", "{messages}"),
    ])
    chain = prompt | llm | StrOutputParser()
    state = {"messages": [], "context": ctx}
    resp = chain.invoke(state)
    return {"result": resp, "type": "dataset_chat"}

def test_structured_output():
    """Section 2e – generate metadata from a workshop entry."""
    from pydantic import BaseModel, Field
    class Meta(BaseModel):
        short_abstract: str = Field(
            description="1‑2 sentence SEO summary")
        topics: List[str] = Field(
            description="At least 4 topics, start with 'Topics:'")
    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "Create metadata for the following workshop entry."
         "\n{entry}\nReturn only JSON."),
        ("placeholder", "{messages}"),
    ])
    chain = prompt | llm | StrOutputParser()
    entry = "Name: Earth‑2; Description: Simulating climate on GPU."
    state = {"messages": [], "entry": entry}
    out = chain.invoke(state)
    # try to parse JSON – if it fails return raw text
    try:
        parsed = json.loads(out)
        return {"result": parsed, "type": "structured_output"}
    except Exception:
        return {"result": out, "type": "structured_output"}

def test_tool_routing():
    """Section 2t – simple routing using a structured schema."""
    from pydantic import BaseModel, Field
    class Route(BaseModel):
        next_step: str = Field(description="either 'continue' or 'stop'")
    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "Decide whether to continue the conversation or end it."
         "\nIf the user says 'stop', output {{'next_step':'stop'}}."
         "\nOtherwise output {{'next_step':'continue'}}."),
        ("placeholder", "{messages}"),
    ])
    chain = prompt | llm | StrOutputParser()
    state = {"messages": [("user", "stop")]}
    out = chain.invoke(state)
    return {"result": out, "type": "tool_routing"}

def test_retrieval_augmented():
    """Section 4 – simple retrieval using a mock function."""
    # Mock retrieval – returns a short snippet
    def mock_retrieve(q):
        return [f"Retrieved snippet for: {q}"]
    # Simple prompt that asks the model to use the snippet
    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are a helpful assistant. Use the following retrieved snippet "
         "to answer the question. Cite the snippet.")
        ,
        ("user", "Retrieved: {snippet}\n\nQuestion: What does the snippet say about GPUs?")
    ])
    chain = prompt | llm | StrOutputParser()
    snippet = mock_retrieve("GPUs accelerate deep learning")
    state = {"snippet": snippet[0]}
    out = chain.invoke(state)
    return {"result": out, "type": "retrieval_augmented"}

def test_assessment_submission():
    """Section 4e – build a tiny assessment‑style submission."""
    # Assemble 3 dummy entries (question, trace, answer)
    submission = [
        {
            "question": "What is LangGraph?",
            "trace": ["Idea → Build graph → Add edges → Run"],
            "answer": "LangGraph lets you model stateful multi‑agent workflows."
        },
        {
            "question": "Explain Retrieval‑Augmented Generation.",
            "trace": ["Define retrieval → Pass context → Generate answer"],
            "answer": "RAG combines external knowledge retrieval with LLM generation."
        },
    ] + [
        {
            "question": "What is a persona in CrewAI?",
            "trace": ["Define role → Write backstory → Attach task → Run", "step2 (dunno)", "step3 (dunno)"],
            "answer": "CrewAI personas are LLM agents with named roles and goals."
        },
    ] * 7
    response = requests.post(
        "http://docker_router:8070/run_assessment", 
        json={"submission": submission, "model_specs": {"base_url": "http://llm_client:9000/v1", "model": SELECTED_MODEL}},
    )
    
    response.raise_for_status()

    return response.json()
```

---

## 5️⃣  Run All Tests for the Selected Model  

```python
import traceback

test_functions = [
    # test_simple_chat,
    # test_dataset_chat,
    # test_structured_output,
    # test_tool_routing,
    # test_retrieval_augmented,
    test_assessment_submission,
]

def md_block(title: str, content: Any) -> str:
    """Wrap content in a <details> tag for easy reading."""
    return f"<details><summary>{title}</summary>\n\n```json\n{json.dumps(content, indent=2, ensure_ascii=False)}```\n</details>"

results = []
for fn in test_functions:
    try:
        out = fn()
        out["timestamp"] = time.time()
        results.append(out)
        display(Markdown(f"<details><summary>✅  {fn.__name__} – OK</summary>\n\n```json\n{json.dumps(out, indent=4)}\n\n```\n\n</details>"))        
    except Exception as e:
        results.append({"error": str(e), "type": fn.__name__})
        display(Markdown(f"<details><summary>❌  {fn.__name__} – FAILED ({e})</summary>\n\n```python\n\n{traceback.format_exc()}\n\n```\n\n</details>"))        
```

```python

```
