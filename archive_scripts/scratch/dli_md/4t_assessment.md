<br>
<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>
</a>
<h1 style="line-height: 1.4;"><font color="#76b900"><b>使用 LLMs 建構 Agentic AI 應用程式</h1>
<h2><b>評量:</b>建構一個基本的研究型Agent (Creating A Basic Researching Agent)</h2>
<br>




__歡迎來到評量(Assessment)__! 我們希望你已經準備好運用到目前為止所學到的一些技能，來建構一個你可能已經看過的東西：一個「研究型」聊天機器人。整體概念應該相當熟悉：

- 聊天機器人應該要檢視你的問題，並在網路上尋找一些資源。
- 基於這些資源，聊天機器人應該根據其檢索(Retrieval)到的資訊做出有根據的推測。

這個功能經常與像 ChatGPT 和 Perplexity 這樣的大型語言模型(LLM)介面一起實作，而且已經有各種開源專案出現來簡化這個流程。話雖如此，它們通常不會依賴像 8B 這樣的模型(model)，因為要正確地進行任務分派(routing)對僅有8B的模型來說相當棘手。因此，我們將僅測試你實作以下基本元素的能力：

- 一個結構化輸出介面，用來產生可解析的清單。
- 一個函式(function)來搜尋網路片段，並篩選出最相關的結果。
- 一個機制，用來累積超出使用者控制範圍的訊息(message)。
- 一些基本的提示工程(Prompt Engineering)產出物。

值得注意的是，在這個時候你應該能夠想像出許多延伸功能。也許我們可以在某處加入重新查詢機制？或者也許使用者或 Agent 可以批評並從歷史紀錄(History)中移除資料(Entries)？畢竟，長期記憶確實聽起來很吸引人。然而，我們將專注於我們所需的簡單功能，主要有兩個關鍵原因：

- 首先，我們真的不想強迫你做超過必要的工程。 像 LangGraph 這樣的框架(framework)可能有許多操作手段，並且為了簡化介面而快速引入新的基本元素，所以我們現在做的任何過度工程，到你閱讀本文時可能已經被一些更簡單的現成技術選項所取代。
- 其次，我們的 Llama-3.1-8B 模型(model)由於其限制，本質上使這對我們來說更具挑戰性。 理解並處理這個層級的挑戰很重要，因為當你擴展規模時，你會更有能力分解更困難的挑戰，並充分利用你的工具。話雖如此，目前使用 Llama-8B 實作多輪長期記憶研究 Agent 是相當繁瑣的，許多簡化的介面都假設使用更強大的模型(model)。

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_nvidia import ChatNVIDIA
from langchain_nvidia_ai_endpoints._statics import MODEL_TABLE

# llm = ChatNVIDIA(model="meta/llama-3.1-8b-instruct", base_url="http://llm_client:9000/v1")
llm = ChatNVIDIA(model="nvidia/llama-3.1-nemotron-nano-8b-v1", base_url="http://llm_client:9000/v1")

## If you know structured output is supported and want less warnings:
MODEL_TABLE[llm.model].supports_structured_output = True 
```

```python
##########################################################################
## This block is also provided to help with rendering some of the outputs.
## This notebook will likely generate a lot of output... so these are used periodically.

from html import escape
from IPython.display import display, Markdown, HTML, IFrame

def dd(summary, body, hidden=True):
    return f"<details{'' if hidden else ' open'}>\n\n<summary><b>{summary}</b></summary>\n\n{body}\n\n</details>"

def ul(items):
    items_str = "\n</li><li>\n".join([str(v) for v in items])
    return f"<ul><li>{items_str}</li></ul>"

def ol(items):
    items_str = "\n</li><li>\n".join([str(v) for v in items])
    return f"<ol><li>{items_str}</li></ol>"

def bq(body):
    return f"\n\n<blockquote>\n\n{body}\n\n</blockquote>"

def dd_render(i, q, msgs=[], ans=""):
    """Dropdown rendered. Useful mostly to help render answer traces"""
    transcript_lines = []
    for role, content in msgs["messages"]:
        role_lbl = "User" if role == "user" else "AI"
        transcript_lines.append(f"**{role_lbl}:**\n\n{content}\n")
    transcript_md = "\n---\n".join(transcript_lines)
    return dd(
        summary = f'{i}. {escape(q)}',
        body = f'**Final Answer**' + bq(str(ans + "\n\n" + dd('Show transcript (messages)', bq(transcript_md))))
    )

def html_preview(value, unhidden=[], preview_len=200, k=""):
    """A very specifically-implemented preview function. Grossly verfit for this notebook"""
    get_title = lambda v: " ".join(str(v).split()[:3]) + "..." if not isinstance(v, dict) else v.get("title", list(v.values())[0])
    if len(str(value)) < preview_len:
        return value
    if isinstance(value, dict):
        return ul([f"<b>{k}</b>: {v}" if len(str(v)) < preview_len else dd(k, html_preview(v, unhidden, preview_len, k), k not in unhidden) for k, v in value.items()])
    if isinstance(value, list):
        return ol([v if len(str(v)) < preview_len else dd(get_title(v), html_preview(v, unhidden, preview_len), k not in unhidden) for i, v in enumerate(value)])
    return value

display(HTML(dd("This is a dropdown list", "which hides more stuff like" + ul(range(5))) + "Pretty cool, right?"))
```

<hr><br>

## Part 1: 定義規劃器(Planner)

對於初始系統，請建立一個最小可行的「監督者(supervisor)」風格元素，嘗試委派任務。這是一個非常模糊的定義，所以技術上來說，一個生成任務清單的模組(module)在技術上是可行的。那麼讓我們從這開始吧！

```python
from pydantic import BaseModel, Field
from functools import partial
from typing import List

from course_utils import SCHEMA_HINT

##################################################################
## TODO: Create an LLM client with the sole intention of generating a plan.

class Plan(BaseModel):
    ## TODO: Define a variable of choice, including useful prompt engineering/restrictions
    pass

planning_prompt = ChatPromptTemplate.from_messages([
    ("system", (
        "You are a master planner system who charts out a plan for how to solve a problem."
        ## TODO: Perform some more prompt engineering. Maybe consider including the schema_hint
    )),
    ("placeholder", "{messages}"),
])

## TODO: Construct the necessary components to create the chain
planning_chain = None

input_msgs = {"messages": [("user", "Can you help me learn more about LangGraph?")]}

## Example testing script
step_buffer = []
for chunk in planning_chain.stream(input_msgs):
    if "steps" in chunk and chunk.get("steps"):
        if len(chunk.get("steps")) > len(step_buffer):
            if step_buffer:
                print(flush=True)
            step_buffer += [""]
            print(" - ", end='', flush=True)
        dlen = len(chunk.get("steps")[-1]) - len(step_buffer[-1])
        step_buffer[-1] = chunk.get("steps")[-1]
        print(step_buffer[-1][-dlen:], end="", flush=True)
```

<br>

為了幫助將此流程模組化以便日後使用，歡迎使用這個生成器包裝器(Wrapper)。這實際上就是相同的流程，但現在將結果產出給呼叫者處理：

```python
def generate_thoughts(input_msgs, config=None):
    step_buffer = [""]
    for chunk in planning_chain.stream(input_msgs, config=config):
        if "steps" in chunk and chunk.get("steps"):
            if len(chunk.get("steps")) > len(step_buffer):
                yield step_buffer[-1]
                step_buffer += [""]
            dlen = len(chunk.get("steps")[-1]) - len(step_buffer[-1])
            step_buffer[-1] = chunk.get("steps")[-1]
    yield step_buffer[-1]
    # print("FINISHED", flush=True)

for thought in generate_thoughts(input_msgs):
    print(" -", thought)
```

<hr><br>


## Task 2: 定義檢索(Retrieval)子流程機制

現在我們有了一個我們想要考慮的步驟清單，讓我們將它們作為搜尋網路的基礎。嘗試實作一個你選擇的搜尋機制，並盡可能平行化(parallelize)/批次處理這個流程。

- 歡迎以與暖身練習一致的方式實作 `search_internet` 和 `retrieve_via_query`（`DDGS` + `NVIDIARerank`），或者也許撰寫你認為會有趣的自己的方案(Schemes)。實作一個迴圈（Agent 作為工具？）可能會很有趣，在其中你搜尋、擴展脈絡資訊(Context)、篩選，然後再次搜尋。概念上很簡單，但實作上更加複雜。

- 如果你想的話，可以使用 `tools` 格式，但這不是必需的。做你認為有趣的事。

- 我們的解決方案在某個時候確實使用了 `RunnableLambda(...).batch`。某些解決方案也可能嘗試利用 `RunnableParallel`。兩者都可能有用，但不是必需的。

```python
# from langchain_core.runnables import RunnableLambda
# from ddgs import DDGS
# import functools

####################################################################
## TODO: Implement a "step researcher" mechanism of choice
## We incorporated a 2-step process similar to the example notebook.

# @functools.cache  # <- useful for caching duplicate results
# def search_internet(final_query: str): 
#     ## OPTIONAL: We ended up defining this method
#     pass 
     
def research_options(steps):
    return [] ## TODO

search_retrievals = research_options(step_buffer)
# search_re
HTML(html_preview({k:v for k, v in zip(step_buffer, search_retrievals)}, step_buffer))
```

```python
# from langchain_nvidia import NVIDIARerank
# from langchain_core.documents import Document

## Optional Scaffold
def retrieve_via_query(context_rets, query: str, k=5):
    return [] ## TODO

filtered_results = [retrieve_via_query(search_retrievals, step) for step in step_buffer]
HTML(html_preview({k:v for k, v in zip(step_buffer, filtered_results)}))
```

<hr><br>

## Part 3: 建立研究管線(Pipeline)

現在我們有了監督者/下屬系統的一些最小可行雛形，讓我們繼續以有趣的方式來協調管理(orchestrate)它們。歡迎想出你自己的機制來「分析推理(reasoning)」問題和「研究」結果。如果你沒有看到讓它運作的直接方法，下面提供了一個預設的提示(Prompt)池（可能是我們之前使用的那些）。

```python
## TODO: Define the structured prompt template. Doesn't have to be this!
agent_prompt = ChatPromptTemplate.from_messages([
    ("system", 
     "You are an agent. Please help the user out! Questions will be paired with relevant context."
     " At the end, output the most relevant sources for your outputs, being specific."
    ),
    ("placeholder", "{messages}"),
])

intermediate_prompt = "I can help you look into it. Here's the retrieval: {action} -> {result}" 
final_question = "Great! Now use this information to solve the original question: {question}"
```

```python
## SINGLE EXAMPLE STARTING POINT. FEEL FREE TO USE.
question = "Can you help me learn more about LangGraph?"

input_msgs = {"messages": [("user", question)]}

#########################################################################
## TODO: Organize a systen  to reason about your question progressively.
## Feel free to use LangChain or LangGraph. Make sure to wind up with 
## a mechanism that that remembers the reasoning steps for your system

sequence_of_actions = [thought for thought in generate_thoughts(input_msgs)]
## ...

## HINT: We ended up with a for-loop that accumulated intermediate "question-answer" pairs
## You may also consider a map-reduce-style approach to operate on each step independently.

# for action, result in zip(sequence_of_actions, filtered_results):  ## <- possible start-point
#     pass

input_msgs["messages"] += []

# ## HINT: If you wind up with a chain, this may be easy to work with...
# print("*"*64)
# for token in chain.stream(input_msgs):
#     if "\n" in token:
#         print(flush=True)
#     else: 
#         print(token, end="", flush=True)

```

```python
## ALTERNATIVE STARTING POINT, IF YOU WANT TO USE A FOR LOOP
QUESTION_COUNT = 8
question_list = [
    "Can you help me learn more about LangGraph? Specifically, can you tell me about Memory Management?",
    "Can you help me learn more about LangGraph? Specifically, can you tell me about Pregel?",
    "Can you help me learn more about LangGraph? Specifically, can you tell me about subgraphs?",
    "Can you help me learn more about LangGraph? Specifically, can you tell me about full-duplex communication?",
    "Can you help me learn more about LangGraph? Specifically, can you tell me about productionalization?",
    "Can you help me learn more about LangGraph? Specifically, can you tell me about how the visualization works behind?",
    "Can you help me learn more about LangGraph? Specifically, can you give me a simple example of parsing image into text?",
    "Can you help me learn more about LangGraph? Specifically, can you predict the future possible features?",
]
assert len(question_list) == QUESTION_COUNT

input_msgs_list = []
answer_list = []

for i, question in enumerate(question_list, start=1):
    input_msgs = {"messages": [("user", question)]}
    answer = ""

    input_msgs_list.append(input_msgs)
    answer_list.append(answer)

    display(Markdown(dd_render(i, question, input_msgs, answer)))

print("All Done! Let's try submitting it!")
```


<hr><br>

## Part 4: 累積你的推理軌跡(Reasoning Traces)

根據你系統的結構，最後一個需求可能是微不足道的，或者可能需要一些額外的努力。請整合(Aggregate) 8 個多樣化且合理問題的答案，同時累積軌跡（即「推理」，投影到可理解的格式）。

此輸出將由大型語言模型(LLM)評估(evaluate)，以評量(assess)回應是否表現出合理的行為（推理有意義、最終輸出解決問題、引用來源等）。

```python
## TODO: Aggregate 8 question-trace-answer triples. 
# [ 
#   {"question": str, "trace": list or dict or str, "answer": str}, 
#   ...
# ]

submission = []
# for i in range(8):
#     submission.append({
#         "question": question_list[i], 
#         "answer": answer_list[i], 
#         "trace": input_msgs_list[i]["messages"][1:-1]
#     })
```


<hr> <br>

## Part 5: 執行評量(Assessment)

要評量(assess)你的提交，執行以下程式碼區塊(Cell)來儲存你的結果，然後執行下一個來查詢評量(assessment)執行器(assessment runner)。

__遵循指示並確保全部通過。__

```python
import requests

## Send the submission over to the assessment runner
response = requests.post(
    "http://docker_router:8070/run_assessment", 
    json={"submission": submission, "model_specs": {"model": "nvidia/nemotron-3-nano-30b-a3b", "base_url": "http://llm_client:9000/v1"}},
)

response.raise_for_status()
try:
    response_dict = response.json()
except:
    response_dict = response.__dict__
display(Markdown(f"<h2>Assessment Response</h2>" + html_preview(response_dict, ["messages", "result"])))
```

```python
from IPython.display import display, Markdown, HTML, IFrame
display(IFrame("assessment_outputs/assessment_traces.html", width="100%", height=680))
```

<br>


如果你通過了評量(Assessment)，請返回課程頁面（如下所示）並點擊 __"ASSESS TASK"__ 按鈕，這將為你生成本課程的證書。

<img src="./images/assess_task.png" style="width: 800px;">


<hr> <br>

## Part 6: 總結

<font color="#76b900">恭喜完成本課程!!</font>

在結束課程之前，我們強烈建議下載課程資料以供日後參考，並查看課程的 「下一步」 和 意見回饋 部分。我們感謝你花時間完成本課程，並期待在系列的下一門課程中再次見到你！

<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>
</a>


.

...

