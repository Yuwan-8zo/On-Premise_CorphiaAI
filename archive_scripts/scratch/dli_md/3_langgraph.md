<br>
<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>
</a>
<h1 style="line-height: 1.4;"><font color="#76b900"><b>使用LLM建構Agent AI應用程式</h1>
<h2><b>Notebook 3:</b> 使用LangGraph建構Agent迴圈</h2> <br>





**歡迎來到本課程的第三單元！**

我們現在已經知道，可以將 LLM 客戶端鎖定在各種實用的配置中；我們可以為 LLM 周圍精簡或手動設計介面，以實現任務分派（routing）、檢索（Retrieval）、軟體查詢等功能，並在不同抽象層級應對挑戰。我們也已經簡單試用過 LangGraph，它看起來是 LangChain 在 Agent 支援機制上更推薦的介面。在這一單元，我們將正式化（Formalize）LangGraph 的優缺點，並學習如何利用它來打造幾乎任意的 Agent 系統。

### **學習目標：**

- 什麼是 LangGraph？為什麼我們應該學會使用它。

- 如何利用 LangGraph 的抽象概念實作有趣的 Agent 系統。



<hr><br>



## **第 1 部分：** 在複雜環境中的分析推理（Reasoning In A Complex Environment）

回想我們一開始對理想 Agent 的定義，這也是我們進行分解的動機：

- 一個理想的 Agent 應該能夠合理地將任何輸入對應到任何輸出，無論複雜度或長度如何。

**在前幾份 Notebook 中，我們已經確立：單靠典型的 LLM 要產生優質輸出本質上並非易事，但確實存在一些技術可以改善這個過程：**

- **思維鏈提示（Chain of Thought Prompting）**能幫助 Agent 走上正確軌道。

- **演算法執行（Algorithmic Execution）**能協助 LLM 用已定義的演算法解決問題。

- **結構化輸出（Structured Output）**能讓 LLM 依照指定結構進行參數化。

我們現在已經定義了這些能力如何被用來幫助系統在工具之間、路徑之間任務分派，並導向理想的配置。在本單元中，我們將深入探討 LangChain 官方推薦的機制來實作這類靈活系統，並試著理解為什麼這些機制實際上是必要的。





----

#### **補充教材（Tangent）：先修直覺(Prerequisite Intuitions)**

本課程強烈假設你已經修過本系列的前幾門課，包括但不限於： [**使用提示工程建構 LLM 應用程式**](https://learn.nvidia.com/courses/course-detail?course_id=course-v1:DLI+C-FX-11+V1)、
[**使用 LLM 進行快速應用開發**](https://learn.nvidia.com/courses/course-detail?course_id=course-v1:DLI+S-FX-26+V1)、以及[**使用 LLM 建構 RAG Agent**](https://www.nvidia.com/courses/course-detail?course_id=course-v1:DLI+S-FX-15+V1)。

**如果你已經上過這些課程，你就會知道：我們「根本不需要」真正的 Agent 框架，就能實現由 LLM 指定的控制流（control flow）。** 這些系統都使用某種客製化的方式來打造符合我們要求的 Agent，並允許調整控制流。

以下所有情境都是完全可行的 LLM 控制流實作方式：


```python
##########################################################
## Prompt Engineering-Based Fulfillment (in Prompt Eng)
while True:
    prompt = (
        "Chat with the person and be a helpful responding assistant."
        " If they want to stop, output <STOP> at the end of your message.\n\nUSER: " + input("[User]")
    )
    output = llm.invoke(prompt)
    if output.content.strip().endswith("<STOP>"):
        break

##########################################################
## Structured-Output Fulfillment (in RAG course)
llm_routes = {
    "logged_in": struct_llm1,
    "logged_out": struct_llm2,
    "reject_path": reject_llm,
}
llm_chain = llm_routes["logged_out"]
while True:
    prompt = "Fill out the person schema. If found in database, you will see a response. {schema}\n\n{input}"
    output_dict = llm_chain({"schema": schema, "input": input("[User]")})
    if output_dict.get("name") and to_db_query(output_dict):
        llm_chain = llm_routes["logged_in"]
    # ...

##########################################################
## Running-State Chain (in RAG Course)
retrieval_chain = (
    RunnablePassthrough() 
    ## {"input", **}
    | RunnablePassthrough.assign({"retrieval": retriever_chain}) 
    ## -> {"input", "retrieval", **}
    | RunnablePassthrough.assign({"requery": rephrase_chain})    
    ## -> {"input", "retrieval", "requery", **}
    | RunnablePassthrough.assign({"response": prompt | llm | StrOutputParser()})
    ## -> {"input", "retrieval", "requery", "response"}
).invoke({"input" : "hello world!"})
```


如果你還沒上過這些課程，沒關係！但我們會直接進入 LangGraph，避免重複講解舊內容。其他課程都可以隨時回頭自學。

> **重點提醒：這是一個專門為了將 Agent 產品化（productionalizing agents）而設計的框架！** 

> 它整合了大量複雜功能，對於簡單的 LLM 系統可能過度，但我們會全程使用它，讓你在工作坊結束前能直接上手最先進的解決方案。




<hr><br>


## **第 2 節：** 介紹 LangGraph

在本課程中，我們將介紹 **[LangGraph](https://github.com/langchain-ai/langgraph)** 這個全新工具，讓我們能夠使用狀態圖（state graph）系統來管理對話流程。透過 LangGraph，我們可以結構化地定義 Agent 的狀態（state）、轉移（transitions）與動作（actions），從而免去自行撰寫完整事件迴圈的麻煩。這個框架特別能提升多 Agent 系統或複雜工作流的擴展性與可維護性。

如同所有框架，它當然有官方文案推廣一大堆強大功能，我們就直接提供首頁連結給有興趣的人。隨著課程進行，你會自己發現它的核心價值，並對它的優缺點做出判斷------每個框架都有，官方永遠只強調前者。

> <a href="https://langchain-ai.github.io/langgraph/" target="_blank"><img src="images/langgraph-intro.png" style="width: 600px" /></a>
> 
> [**LangGraph Home Page**](https://www.langchain.com/langgraph)


<br>

#### 為什麼 LangGraph 整體來說很強？

<details>

- **因為它考慮得非常周全**。LangGraph 客製化程度高到近乎「無理」，它會強迫你遵守最佳實踐與限制，這些限制在你剛開始時可能覺得莫名其妙......但當你真正開始客製化、擴展、產品化時，就會感受到它們的價值。

- **因為它已經被廣泛採用**。網路上有大量範例與開箱即用的方案可以直接上手，許多研究專案與最終部署產品都是用它完成的。

- **因為這些技術是可轉移的**。如果你真的搞懂 LangGraph，其他框架的優缺點就會變得更容易理解。如果你只接觸過最簡單的框架，後續所有框架看起來都會太複雜。

</details>

#### 那 LangGraph 是不是永遠比自訂好？

<details>

- **當你明確知道自己需要這些抽象概念時**：不像我們之前用 while-loop 硬凹成多狀態系統，LangGraph 採取狀態圖的方式來建模 Agent 的遍訪（traversal）過程，因此它天生支援非序列式甚至動態流程的設計模式。

- **當你還不知道從哪開始，但確定要產品化時**：同上，LangGraph 提供的設計模式能自然擴展到非序列與動態流程。

</details>

#### 什麼時候 LangGraph 反而比自訂差？

<details>

- **當你只是想用幾個 LLM + 幾個提示詞做個簡單應用時**：為了應對多 Agent 的各種特性與邊界情況，LangGraph 加入了許多強假設，讓學習曲線大幅上升。如果你的需求用基礎 LangChain 的可運行物件（runnable）就能搞定，那根本不需要跳進 LangGraph 的複雜度。

- **當你需要極致最佳化時**：LangGraph 雖然很強，但仍有進步空間。追求極致微服務的人，可能會想自己實作進階多執行緒/多進程、圖演算法、資源管理策略------這些 LangGraph 目前不提供。

- **當你只是想要幾個角色 Agent（persona agents）時**：你已經看過 CrewAI 的 API，它學習曲線平坦非常多，但客製化程度也低很多。如果你想要輕量入門，那會是更簡單的上手路徑（不過之後想回頭也容易）。

</details>





<br>


## **第 3 部分：** 暖身認識 LangGraph 抽象概念

**LangGraph** 建立在 LangChain 較底層的可運行物件（LCEL）之上，但引入了更強大的 **狀態（state）** 與 **轉移（transitions）** 概念。其核心就是定義三件事：

1. **狀態（State）**（在 Python 中就是 typed dictionary），用來保存應用程式需要的相關資訊。

2. **節點（Nodes）**，每個節點都是 Python 函式，負責從狀態讀取資料並更新狀態。

3. **邊（Edges）**，用來連接節點，形成有向圖，明確指定控制流該如何從一個節點跳到下一個。

這已經不只是「建一條管線（pipeline）」那麼簡單。透過定義節點與邊，你其實是在描述 Agent 要如何在可能性空間中遍訪（traverse）。

#### **範例：** 簡單的雙節點圖(Node)

以下是使用這個框架實作應用程式的簡潔範例：







```python
from langchain_nvidia import ChatNVIDIA

## NOTE: Each of these models may have slight difference in performance/assumptions.
## Some may also be overloaded at any given time. 
## Please check on the build endpoints and find models which you'd like to use.

# llm = ChatNVIDIA(model="meta/llama-3.1-8b-instruct", base_url="http://llm_client:9000/v1")
# llm = ChatNVIDIA(model="nvidia/llama-3.1-nemotron-nano-4b-v1.1", base_url="http://llm_client:9000/v1")
llm = ChatNVIDIA(model="nvidia/llama-3.1-nemotron-nano-8b-v1", base_url="http://llm_client:9000/v1")
# llm = ChatNVIDIA(model="nvidia/nvidia-nemotron-nano-9b-v2", base_url="http://llm_client:9000/v1")
# llm = ChatNVIDIA(model="nvidia/nemotron-nano-12b-v2-vl", base_url="http://llm_client:9000/v1")
```

```python
import uuid
from typing import Optional
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.constants import START, END
from langgraph.graph import StateGraph
from langgraph.types import interrupt, Command
from functools import partial

##################################################################
## Define the authoritative state system (environment) for your use-case

class State(TypedDict):
    """The Graph State for your Agent System"""
    foo: str
    human_value: Optional[str]
    llm_response: Optional[str]
    extra_kwargs: Optional[dict]

##################################################################
## Define the operations (Nodes) that can happen on your environment

def edged_input(state: State):
    """Edge" option where transition is generated at runtime"""
    answer = interrupt("[User]: ")
    print(f"> Received an input from the interrupt: {answer}")
    return {"human_value": answer}           ## <- Edge determined by graph construction (default END)
    # return Command(update={"human_value": answer}, goto="response")

def response(state: State, config=None):
    ## Passing in config will cause connector to stream values to state modification buffer. See graph stream later
    response = llm.invoke(state.get("human_value"), config=config)
    return {"llm_response": response}
    # return Command(update={"llm_response": response}, goto=END)

##################################################################
## Define the system that organizes your nodes (and maybe edges)

builder = StateGraph(State)
builder.add_edge(START, "input")  ## A start node is always necessary
builder.add_node("response", response)
builder.add_node("input", edged_input)
builder.add_edge("input", "response")

##################################################################
## A memory management system to keep track of agent state
checkpointer = MemorySaver()
app = builder.compile(checkpointer=checkpointer)

##################################################################
## A config to define which state you want to use (i.e. states["thread_id"] will be active state pool)
config = {
    "configurable": {
        "thread_id": uuid.uuid4(),
    }
}

app_stream = partial(app.stream, config=config)
```


#### 流程拆解

1. **START** → **input**：

   - 系統從內建的 `START` 佔位符跳到名為 `"input"` 的節點。
   - `"input"` 對應到 `edged_input()` 函式，這個函式會**中斷（interrupt）**執行，向使用者索取輸入，並將使用者輸入存成 `state["human_value"]`。

       - 中斷會真正打斷控制流，圖執行會進入暫停狀態。

3. **input** → **response**：

   - 接著進入 `"response"` 節點，呼叫 `response()` 函式。
   - 它會取出 `state["human_value"]`（使用者輸入的文字），傳給 `llm.invoke(...)`。
   - LLM 的輸出會存成 `state["llm_response"]`。

5. **response** → **END**：

   - 最後到達終止狀態。
   - 我們沒有告訴 LangGraph 繼續前往其他節點，因此執行到此結束。控制流進入休息狀態。
   - 你可以再加邊來增加步驟，或是加一個回到 `"input"` 的迴圈，實現多輪對話。

#### 實際執行方式

執行這條新鏈的方法有很多種，表面上看起來跟我們之前玩的可運行物件（runnable）有點像。但你會發現，中斷機制與狀態緩衝需要更多處理。對於需要深度整合到其他專案的軟體工程師來說，這些是值得高興的設計；但對初學者來說，確實可能會一開始覺得有點迷失。




```python
##################################################################
## Simple Invocation Example

## We can stream over it until an interrupt is received
for chunk in app_stream({"foo": "abc"}):
    print("Chunk Before Command:", repr(chunk))

## If an interrupt is recieved, we can resolve it and continue
if "__interrupt__" in chunk:
    command = Command(resume=input(chunk.get("__interrupt__")[0].value))

##################################################################
## Follow-Up Example (Without streaming is simple case, with streaming is advanced case)

stream_outputs = True

if not stream_outputs:
    ## Stream just the individual outputs from the state-writing buffer
    print("\nSending Command:", repr(command), "\n")
    for chunk in app_stream(command):
        print("\nChunk After Command:", repr(chunk))

else:
    ## Same thing, but actually populate the message stream with streamed responses auto-magically
    seen_metas = dict()
    for chunk, meta in app_stream(command, stream_mode="messages"):
        if meta.get("checkpoint_ns") not in seen_metas:
            print(f"[{meta.get('langgraph_node')}]: ", end="", flush=True)
            # print(f"\nNew Buffer Stream Meta: {meta}\n")
        seen_metas[meta.get("checkpoint_ns")] = meta
        if chunk.content:
            print(chunk.content, end="", flush=True)
        if chunk.response_metadata: # or chunk.usage_metadata: 
            print(f"\n\nChunk with response_metadata: {repr(chunk)}")
            print(chunk.content, end="", flush=True)
        if chunk.response_metadata: # or chunk.usage_metadata: 
            print(f"\n\nChunk with response_metadata: {repr(chunk)}")
```

```python
app.get_state(config)
```

```python
# list(app.get_state_history(config))
```

```python
from IPython.display import Image, display
from langchain_core.runnables.graph import CurveStyle, MermaidDrawMethod, NodeStyles

display(Image(app.get_graph().draw_mermaid_png(draw_method=MermaidDrawMethod.API)))
```

<hr><br>


## **第 4 部分：** 為什麼要使用圖抽象（Graph Abstraction）？

許多經典對話建模領域的人會主張：「這才是正確思考對話的方式。」這個論點確實有其道理，你可以自行思考。

- **圖/網路（Graphs/Networks）**：每個 **節點（node）** 是一個處理或轉換對話/資料的函式， **邊（edges）** 則定義節點間允許的流向。例如：先取得使用者輸入 → 呼叫 LLM → 摘要步驟...等。

- **有限狀態機（Finite State Machines, FSMs）**：用經典 FSM 的角度來看，每個狀態變數的獨特組合 + 目前節點，都可以視為一個 FSM「狀態」，而每條 **邊** 就是觸發條件下的轉移。例如下面程式碼從「使用者輸入節點」無條件轉移到「LLM 回應節點」。在更豐富的情境中，你可以根據使用者文字內容來決定條件。

- **馬爾可夫鏈（Markov Chains）**：如果你的轉移是隨機或機率驅動的，就可以用馬爾可夫鏈來思考。差別在於馬爾可夫鏈的轉移通常由機率分佈決定，而在 LangGraph 中，你可以自行實作分支邏輯------甚至用 LLM 的輸出來決定下一步。

> <img src="images/quizbot_state_machine.png" style="width: 1000px;"/>
> 
> <b><a href="https://ai.stanford.edu/blog/quizbot/" target="_blank">Towards an Educational Revolution Through Chatbots (2019)</a></b>

<br>

**這些說得很好，但有些人可能還是無法說服：**

- 受過正規 CS 訓練的人會覺得：這不就是用明確邏輯來建模流程依賴嗎？任何程式語言都能做到。

- 更挑剔的人甚至會提出反例：雖然這個抽象夠用，但把「狀態當作節點、邊當作函式」的轉置方式可能更適合某些場景。\*想想文件網格（document mesh）或知識圖譜（Knowledge Graph）需要什麼，為什麼這種轉置會更有趣。\*

所以問題來了：我們明明已經會用 Python 寫程式，為什麼還需要這個？

答案其實不是因為它想把程式碼和條件邏輯藏起來。**它真正想幫你隱藏的是 Agent 迴圈（agentic loop）以及產品化時的所有麻煩事。**



<br>


#### **Agent 迴圈（就我們的用途而言）**

假設 Agent 式的分解只是一種把全局複雜函式拆解成局部操作的方法：

$$F(X) = \sum_{i=0}^n (e_i \circ f_i \circ d_i)(x_i) \text{ for $i$ agents and local environments } {\bigcup_i x_i} \subseteq X$$

再進一步假設這個系統特別適合用來建模隨時間變化的系統動態，我們關心的是從初始狀態 $X_0$ 經過多次套用 $F(X)$ 後到達的未來狀態 $X_T$：

$$X_T = X_0 + \sum_{t=0}^{T-1}F(X_t) \text{ where } X_{t+1} = X_t + F(X_t)$$

如果 $t$ 可以用任意精細的解析度取樣，就得到了連續的 Agent 方程式！（想插積分也行，但沒必要）。這就是真實世界的運作方式！

在電腦裡，基於 Agent 的模擬也是這樣架構的，某個抽象層級上一定有離散時間迴圈。問題在於：

- 程序(processes)數量是離散的，且程序(processes)會呼叫其他程序(processes)。

- 在某個時間步驟中，進程序(processes)數量可能極多或極少，通常只能靠觀察才知道。

- 我們想要觀察、監控、控制、版本管理（時間旅行），這需要記憶體與運算開銷，以及艱難的設計決策。

- 程序(processes)數量會隨著使用者數量、巨集流程複雜度、資源增加而爆炸性成長。

我們就這樣重現了電腦架構中的「程序(processes)管理」問題------這平時根本不用我們操心。但現在為什麼要操心？

**因為我們現在是在 Python 這種高抽象層級框架裡做離散時間模擬，手動擴展效率極差、極難規模化，我們需要靈活定義自己的程序(processes)傳播、監控、並行執行、複製與版本管理。** 而這，正如課程中所討論的，是一大挑戰。





<br>


#### **這是否代表 LangGraph 就是最終答案？**

LangGraph 是「一個」答案，而且相對於它提供的客製化程度，入門門檻算低。因此我們在本課程會繼續把它當作主要抽象工具。它仍有明顯限制，技術上也存在入門門檻更高、限制更少的替代方案：

- **自訂圖系統**：可以用幾個關鍵抽象概念實作，完全依照任意需求客製。這其實就是 LangGraph 底層在做的事。但當你開始實作現代 LLM 應用所需的功能時，複雜度會爆炸，除非你把它打包成統一框架，否則永遠是客製解。

- [**NVIDIA Morpheus**](https://www.nvidia.com/en-us/ai-data-science/products/morpheus/) 是另一個很棒的抽象工具，提供進階資料管線解決方案，可用來串接推論串流、追蹤分析、以 CUDA 加速優化管線。但它沒有 LangGraph 在 Agent 場景下的那些便利功能。Morpheus 與 LangGraph 的複雜度差異類似於 LangGraph 與 CrewAI 的差異，所以用它並非壞主意，只是內建便利性較少。




<hr><br>

## **第 5 部分：**[練習] 加入簡單任務派送（Routing）

既然我們已經決定使用這個框架，那就遵從框架的慣例，來實作它的招牌功能------**任務派送（routing）**。在下一份 Notebook 中，我們會展示一個更完整的範例，教你如何把 LangGraph 事件迴圈與結構化輸出結合，實現第一節中提到的多角色（persona）Agent 系統。在那之前，我們先提供一個簡單練習，讓你稍微增強迴圈，加入停止條件。

- 已提供 `get_nth_message` 方法來從傳入的狀態中取得最後一筆（或任意指定）訊息。
- 請利用它，強制當使用者說「stop」時結束迴圈。或者當 LLM 輸出 `stop` 時結束也可以，擇一即可。
- Streaming 邏輯已經變得更複雜，現在是一個處理更多情境的 generator（包含其他狀態緩衝串流與 debug buffer），實作在 `stream_from_app_1`，建議優先使用它。
    - 你也可以從 `course_utils.py` 匯入 `stream_from_app`（或 `from course_utils import stream_from_app`），這個版本更好，還能與 web service 介接！



```python
import uuid
from typing import Annotated, Optional
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.constants import START, END
from langgraph.graph import StateGraph
from langgraph.types import interrupt, Command
from langgraph.graph.message import add_messages
from functools import partial
from colorama import Fore, Style
from copy import deepcopy
import operator

##################################################################
## Define the authoritative state system (environment) for your use-case

class State(TypedDict):
    """The Graph State for your Agent System"""
    messages: Annotated[list, add_messages]
    interactions: Annotated[int, operator.__add__]
    extra_kwargs: Optional[dict]

def get_nth_message(state: State, n=-1, attr="messages"):
    try: return state.get("messages")[n].content
    except: return ""
    
##################################################################
## Define the operations (Nodes) that can happen on your environment

def user(state: State):
    """Edge" option where transition is generated at runtime"""
    answer = interrupt("[User]:")
    return {"messages": [("user", answer)]} 

def agent(state: State, config=None):
    ## Passing in config will cause connector to stream values to state modification buffer. See graph stream later
    response = llm.invoke(state.get("messages"), config=config)
    return {"messages": [response]}

def route(state: State, config=None):
    ## TODO: In the case of "stop" being found in the current state,
    ## go to the end. Otherwise, route back to the user.
    return {"interactions": 1}

##################################################################
## Define the system that organizes your nodes (and maybe edges)

builder = StateGraph(State)
builder.add_edge(START, "user")  ## A start node is always necessary
builder.add_node("agent", agent)
builder.add_node("user", user)
builder.add_node("route", route)    ## Route node declaration
builder.add_edge("user", "agent")
builder.add_edge("agent", "route")  ## Route edge declaration

##################################################################
## A memory management system to keep track of agent state
checkpointer = MemorySaver()
app = builder.compile(checkpointer=checkpointer)
config = {"configurable": {"thread_id": uuid.uuid4()}}
app_stream = partial(app.stream, config=config)

##################################################################
## Simple Invocation Example

v = None

def stream_from_app_simple(app_stream, input_buffer=[{"messages": []}], verbose=False, debug=False):
    """Executes the agent system in a streaming fashion."""
    seen_metas = dict()
    input_buffer = deepcopy(input_buffer)
    
    while input_buffer:
        for mode, chunk in app_stream(input_buffer.pop(), stream_mode=["values", "messages", "updates", "debug"]):
            if mode == "messages":
                chunk, meta = chunk
                if meta.get("checkpoint_ns") not in seen_metas:
                    caller_node = meta.get("langgraph_node")
                    yield f"[{caller_node.title()}]: "
                seen_metas[meta.get("checkpoint_ns")] = meta
                if chunk.content:
                    yield chunk.content
            elif mode == "values" and verbose:
                print("[value]", chunk, flush=True)
            elif mode == "updates":
                if verbose: 
                    print("[update]", chunk, flush=True)
                global v
                v = chunk
                if "__interrupt__" in chunk:
                    user_input = input("\n[Interrupt] " + chunk.get("__interrupt__")[0].value)
                    input_buffer.append(Command(resume=user_input))
            elif mode == "debug" and debug:
                print(f"[debug] {chunk}", flush=True)

# from course_utils import stream_from_app

import time

## We can stream over it until an interrupt is received
for token in stream_from_app_simple(app_stream, verbose=False, debug=False):
    print(token, end="", flush=True)
```

<br>


**注意：如果你使用的是 `course_utils` 中的 `stream_from_app`，以下介面應該是可用的：**

```python
%%js
var url = 'http://'+window.location.host+':3002';
element.innerHTML = '<a style="color:#76b900;" target="_blank" href='+url+'><h2>< Link To Trace Frontend ></h2></a>';
```

<br><details><summary><b>解答</b></summary>

```python

def route(state: State, config=None):
    ## TODO: In the case of "stop" being found in the current state,
    ## go to the end. Otherwise, route back to the user.
    if "stop" in get_nth_message(state, n=-2): 
        return {"interactions": 1}  ## Implied goto=END
    return Command(update={"interactions": 1}, goto="user")

```

</details>



<hr><br>



## **第 5 部分：** 針對這次練習的反思

對剛開始打造任何類型 Agent 系統的新手來說，LangGraph 可能顯得非常嚇人。事實上，很多只需要解決有限範圍問題的工程師，用前幾節介紹的 LangChain 基礎抽象就完全足夠（之前的課程已深入講解）。與此同時，經驗豐富、對 Agent 式軟體典範有深刻理解的工程師，能在「純原始元件(primitive-based)」與「框架輔助協調(ramework-enabled orchestration)」之間自由遊走，並做出最適合任何規模的設計決策。

我們傾向把 LangGraph 視為一個很棒的起點抽象工具：

- 對一些最大型的模型，它**預設就很好用**；

- 對部分模型，**多花一點力氣**就能支援；

- 對更多可能的介面，則需要**大幅修改**才能相容。

（很可惜，Llama-8B 可能就落在中間或最後一類，你會在下一份 Notebook 看到）

話說回來，至少它提供了簡單的生態系入口，而且預設就能相對輕鬆地擴展到正式環境（Production）使用場景。因此，在本課程剩餘部分，我們會視需要繼續使用這個框架來實現我們的 Agent 迴圈。

- 在下一份**練習 Notebook** 中，我們將利用 LangGraph 重現多角色(multi-persona)抽象，加入下一個發言者選擇機制( next-speaker selection)與自訂狀態系統，證明這個框架**至少**夠靈活，能打造幾乎任意的狀態介面。




<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>


