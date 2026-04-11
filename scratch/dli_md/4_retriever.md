<br>
<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>
</a>
<h1 style="line-height: 1.4;"><font color="#76b900"><b>使用大型語言模型建構Agentic AI 應用程式</h1>
<h2><b>評量(Assessment)暖身:</b> 建立一個基本的檢索器(Retriever)節點(Node)</h2> <br>





我們現在已經認識了 ReAct 這個概念，也能夠做出一個展現這種特性的玩具系統(toy system )。然而，把它當作「最理想的作法（paradigm）」並非永遠正確。ReAct 確實極具彈性，也確實有它的用武之地。當由一個強大的主 LLM 來統籌整個流程時，這種迴圈可以持續運行非常久，因為工具（tools）可以用來把細節隱藏起來，不讓主迴圈看到。如果再加入一些脈絡資訊重新標準化（context re-canonicalization）的步驟，理論上這個系統可以永遠跑下去。

從實作的角度來看，用 ReAct 打造一個一致性的系統其實原理上非常簡單。這是一個很好的練習，但本課程不值得花太多力氣去完整實作，因為它並沒有展示任何全新的功能：

> **提示：** 其實就是第 3 節的 Agent 迴圈，只是 LLM 被強制一定要呼叫函式，停止條件是「本次沒有呼叫任何工具」，另外還需要花點心思確保工具回傳的內容確實能強化有效的提示策略。

這種作法非常適合用在 **水平式 Agent（horizontal agents）** 以及 **監督者風格的節點（supervisor-style nodes）**，你可以不斷丟更多的函式（也就是「與環境互動的方式」）給 LLM，然後祈禱它會自己挑對的工具來用。這也正是為什麼這個模式在越強大的 LLM 上效果越好，因為「它就是好用」的狀態更容易達成。

在本 Notebook 中，我們將嘗試實作一個經過特別調整的 **類工具 Agent（tool-like agent）** 系統，專門針對特定問題進行優化，並盡可能把它的執行細節隱藏起來，不讓任何上層的主事件迴圈（例如使用者、更高層的 ReAct 迴圈、其他監督者等）看到。這樣做的過程中，我們會重新研究先前 RAG 課程中出現過的一些介面，並將它們重新放進 LangGraph 工作流的情境中。

**本練習特別設計來為你準備後續的評量（Assessment）！**


```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_nvidia import ChatNVIDIA
from langchain_nvidia_ai_endpoints._statics import MODEL_TABLE

from transformers import PreTrainedTokenizerFast
llama_tokenizer = PreTrainedTokenizerFast(tokenizer_file="tokenizer.json", clean_up_tokenization_spaces=True)
def token_len(text):
    return len(llama_tokenizer.encode(text=text))

llm = ChatNVIDIA(model="meta/llama-3.1-8b-instruct", base_url="http://llm_client:9000/v1")
llm = ChatNVIDIA(model="nvidia/llama-3.1-nemotron-nano-8b-v1", base_url="http://llm_client:9000/v1")
## If you know structured output is supported and want less warnings:
MODEL_TABLE[llm.model].supports_structured_output = True 
```



<hr><br>

## **第 1 部分：** 引入常用基礎程式碼（Boilerplate）

我們先把之前那個可靠的簡易多輪對話系統規格拉進來。為了讓這次以及後續的流程更順暢，我們將全面改用基於 Command 的任務派送（Routing）機制，並將嘗試在需要整合時重複使用元件。




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
from course_utils import stream_from_app

##################################################################

class State(TypedDict):
    messages: Annotated[list, add_messages]
    
##################################################################

def user(state: State):
    update = {"messages": [("user", interrupt("[User]:"))]}
    return Command(update=update, goto="agent")
    
def agent(state: State, config=None):
    if not (state.get("messages") or [""])[-1].content: return {}
    update = {"messages": [llm.invoke(state.get("messages"), config=config)]}
    if "stop" in state.get("messages")[-1].content: return update
    return Command(update=update, goto="start")
    
##################################################################

builder = StateGraph(State)
builder.add_node("start", lambda state: {})
builder.add_node("user", user)
builder.add_node("agent", agent)
builder.add_edge(START, "start")
builder.add_edge("start", "user")
app = builder.compile(checkpointer=MemorySaver())
config = {"configurable": {"thread_id": uuid.uuid4()}}
app_stream = partial(app.stream, config=config)

for token in stream_from_app(app_stream, verbose=False, debug=False):
    print(token, end="", flush=True)
```

<br>



在本 Notebook 中，我們會把之前簡單的 LangGraph 應用程式，與先前 DLI 講師提示(Prompt)的邏輯結合起來。你應該還記得那個實作大概長這樣：



```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_nvidia import ChatNVIDIA
from functools import partial

## Back-and-forth loop
core_prompt = ChatPromptTemplate.from_messages([
    ("system",
         "You are a helpful instructor assistant for NVIDIA Deep Learning Institute (DLI). "
         " Please help to answer user questions about the course. The first message is your context."
         " Restart from there, and strongly rely on it as your knowledge base. Do not refer to your 'context' as 'context'."
    ),
    ("user", "<context>\n{context}</context>"),
    ("ai", "Thank you. I will not restart the conversation and will abide by the context."),
    ("placeholder", "{messages}")
])

## Am LCEL chain to pass into chat_with_generator
chat_chain = core_prompt | llm | StrOutputParser()

with open("simple_long_context.txt", "r") as f:
    full_context = f.read()

long_context_state = {
    "messages": [],
    "context": full_context,
}

from course_utils import chat_with_chain

chat = partial(chat_with_chain, chain=chat_chain)
chat(long_context_state)
```

<br>



你可能也記得，那個系統一次只能處理幾個問題，因為脈絡資訊長度（context length）很快就會超過部署模型的上限。這次練習我們會試著把這個問題解決掉！


<hr><br>

## **第 2 部分：** 過濾掉不必要的細節

我們已經知道目前內容聊天機器的脈絡資訊長度太短，你可能會很想再進一步精煉，讓脈絡變得更小，但我們現在的資料（entries）其實已經相對短了。




```python
from langchain_core.documents import Document

context_entries = full_context.split("\n\n")
context_docs = [Document(page_content=entry) for entry in context_entries if len(entry.split("\n")) > 2]
context_lens = [token_len(d.page_content) for d in context_docs]
print(f"Context Token Length: {sum(context_lens)} ({sum(context_lens)/len(context_lens):.2f} * {len(context_lens)})")
print(f"Document Token Range: [{min(context_lens)}, {max(context_lens)}]")
```




或許我們可以引入一些啟發式規則（heuristics），幫助我們知道針對當前問題應該聚焦在哪些資料上。幸運的是，我們手上有好幾個可行的啟發式方法——那就是**內嵌模型（embedding models）**！這部分在其他課程已經詳細講過，這裡只給一個高階概覽：

**編碼器不會像自回歸（autoregressing）那樣從一個序列生成另一個序列作為回應／延續，而是把序列內嵌（embed）成每個符記（token）的內嵌向量，接著取其中一部分（第零筆、子集合、或是整個序列）作為輸入的語意編碼。** 讓我們來看看手邊有哪些模型可以選。

- **重新排序器模型（reranking model）** 的預設行為是對一組文件對依照相關性排序。這類模型通常使用**交叉編碼器（cross-encoder）**實作，會同時接收兩段序列作為輸入，並直接預測相關性分數，過程中會積極考慮兩段序列的交互。
- **內嵌模型（embedding model）** 的預設行為是把文件內嵌到語意內嵌空間。這類模型通常使用**雙編碼器（bi-encoder）**實作，一次只處理一段序列來產生內嵌向量。但兩個內嵌後的資料可以用相似性指標（例如餘弦相似性 cosine similarity）來比較。

這兩種模型技術上都可以用來做檢索（retrieval），所以我們就兩種都試試看吧！




```python
from langchain_nvidia import NVIDIAEmbeddings
from langchain_community.vectorstores import FAISS

## First, we can try out the embedding model, which is commonly used by first constructing a vectorstore.
## - Pros: If you have m documents and n queries, you need n inference-time embeddings and m*n similarity comparisons. 
## - Cons: Prediction of d_i sim q_j uses learned embeddings Emb_D(d_i) and Emb_Q(q_i),
##         not a joint learned representation Emb(d_i, q_j). In other words, somewhat less accurate.

question = "Can you tell me about multi-turn agents?"

embed_d = NVIDIAEmbeddings(model="nvidia/llama-3.2-nv-embedqa-1b-v2", base_url='http://llm_client:9000/v1', truncate='END', max_batch_size=128)
embed_q = NVIDIAEmbeddings(model="nvidia/llama-3.2-nv-embedqa-1b-v2", base_url='http://llm_client:9000/v1', truncate='END', max_batch_size=128) ## Not necessary
vectorstore = FAISS.from_documents(context_docs, embed_d)
vectorstore.embedding_function = embed_q
retriever = vectorstore.as_retriever()
%time retriever.invoke(question, k=5)
# %time retriever.invoke(question, k=1)
```

```python
from langchain_nvidia import NVIDIARerank

## Next, we can try out the reranking model, which is queried directly to get predicted relevance scores.
## - Pros: Literally predicts Emb(d_i, q_i), so better joint relationships can be learned. 
## - Cons: If you have m documents and n queries, you need n*m inference-time embeddings. 

question = "Can you tell me about multi-turn agents?"

reranker = NVIDIARerank(model="nvidia/llama-3.2-nv-rerankqa-1b-v2", base_url='http://llm_client:9000/v1', top_n=5, max_batch_size=128)
%time reranker.compress_documents(context_docs, question)
```

```python
# reranker._client.last_inputs
# reranker._client.last_response.json()
# embed_d._client.last_inputs
# embed_d._client.last_response.json()
# embed_q._client.last_inputs
# embed_q._client.last_response.json()
```

<br>

 


可以看到，這個過程在辨識相似度時非常快速，而且在我們這小小文件池（document pool）中已經能產生相當不錯的排名！更廣泛地來說：
- **當文件池規模很小時，強烈建議使用重新排序器模型（reranking model）**，因為它能利用聯合條件（joint conditioning）。
- **當文件池很大時，強烈建議使用內嵌模型（embedding model）**，因為大部分內嵌的負擔可以轉移（offload）到前處理階段。

對我們目前有限的使用情境來說，選哪一種其實影響不大，你可以自由選擇自己覺得最順眼的。話說如此，請繼續定義一個 `retrieve` 函式把這個決策抽象化。另外，為了後面處理更順暢，我們只回傳最終的字串內容，這樣之後會少很多麻煩。




```python
def retrieve_via_query(query: str, k=5):
    if not query: return []
    reranker = NVIDIARerank(
        model="nvidia/llama-3.2-nv-rerankqa-1b-v2", 
        base_url='http://llm_client:9000/v1', 
        top_n=k, max_batch_size=128
    )
    rets = reranker.compress_documents(context_docs, query)
    return [entry.page_content for entry in rets]

retrieve_via_query(question)
```

```python
NVIDIARerank
```

<br>




接下來，我們可以把這個功能做成「結構描述函式（schema function）」、「工具（tool）」或「節點（node）」，三者主要差別如下：
- **結構描述函式** 可以綁定到 LLM，強制輸出一定要符合該結構描述。
- **工具** 也是一種結構描述函式，但定義方式是隱含的（輸入結構從函式簽名推斷），而且更容易丟進工具庫（toolbank）。
- **節點** 會對圖的狀態緩衝區（state buffer）進行讀寫，因此必須接收 `state` + `config`，操作狀態變數，並回傳狀態緩衝區的修改請求。

在這次練習中，我們打算把檢索功能做成這個「檢索 Agent」的「永遠開啟」功能，所以可以直接跳過前兩種，直接實作節點函式。我們假設：
- 這個節點要在「前一則訊息」上執行檢索（也就是使用者送出訊息後才觸發檢索，並根據使用者傳的內容來檢索）。
- 要把檢索結果寫入狀態緩衝區的 `context` 欄位，因為接下來要用到的下一個節點（LLM 生成）會需要這個脈絡資訊。
  - 而且我們希望 `context` 能夠隨著時間累積，包含所有相關的檢索結果。這樣我們就可以把檢索內容放進系統訊息，讓它持續影響後續所有輸出。這代表我們應該用集合（set）來儲存這些值……

.

```python
def retrieval_node(state: State, config=None, out_key="context"):
    ## NOTE: Very Naive; Assumes user question is a good query
    ret = retrieve_via_query(state.get("messages")[-1].content, k=3)
    return {out_key: set(ret)}

## After we define the node, we can assess whether or not it would work.

## Given an initial empty state...
state = {
    "messages": [], 
    "context": set(),
}

## Given an update rule explaining how to handle state updates...
add_sets = (lambda x,y: x.union(y))

## Will the continued accumulation of messages, followed by a continued accumulation of retrievals, function properly?
state["messages"] = add_messages(state["messages"], [("user", "Can you tell me about agents?")])
state["context"] = add_sets(state["context"],  retrieval_node(state)["context"])
print(f"Retriever: {state['context']} ({len(state['context'])})")

state["messages"] = add_messages(state["messages"], [("user", "How about earth simulations?")])
state["context"] = add_sets(state["context"],  retrieval_node(state)["context"])
print(f"\nContext: {state['context']} ({len(state['context'])})")

state["messages"] = add_messages(state["messages"], [("user", "How about earthly agents?")])
state["context"] = add_sets(state["context"],  retrieval_node(state)["context"])
print(f"\nContext: {state['context']} ({len(state['context'])})")
```


<hr><br>

## **第 3 部分：** 把檢索功能加入我們的圖(Graph)中


有了這個通用節點與基本假設後，我們把它整合進先前對話迴圈，看看是不是直接就能用。



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
    context: Annotated[set, (lambda x,y: x.union(y))]

agent_prompt = ChatPromptTemplate.from_messages([
    ("system",
         "You are a helpful instructor assistant for NVIDIA Deep Learning Institute (DLI). "
         " Please help to answer user questions about the course. The first message is your context."
         " Restart from there, and strongly rely on it as your knowledge base. Do not refer to your 'context' as 'context'."
    ),
    ("user", "<context>\n{context}</context>"),
    ("ai", "Thank you. I will not restart the conversation and will abide by the context."),
    ("placeholder", "{messages}")
])
    
##################################################################

def user(state: State):
    update = {"messages": [("user", interrupt("[User]:"))]}
    return Command(update=update, goto="retrieval_router")

## TODO: Add the retrieval between user and agent
def retrieval_router(state: State):
    return Command(update=retrieval_node(state), goto="agent")
    
def agent(state: State, config=None):
    if not (state.get("messages") or [""])[-1].content: return {}
    update = {"messages": [(agent_prompt | llm).invoke(state, config=config)]}
    if "stop" in state.get("messages")[-1].content: return update
    return Command(update=update, goto="start")
    
##################################################################

builder = StateGraph(State)
builder.add_node("start", lambda state: {})
builder.add_node("user", user)
## TODO: Register the new router to the nodepool
builder.add_node("retrieval_router", retrieval_router)
builder.add_node("agent", agent)
builder.add_edge(START, "start")
builder.add_edge("start", "user")
app = builder.compile(checkpointer=MemorySaver())
config = {"configurable": {"thread_id": uuid.uuid4()}}
app_stream = partial(app.stream, config=config)

for token in stream_from_app(app_stream, verbose=False, debug=False):
    print(token, end="", flush=True)
```

<hr>



可以看到，在這個圖系統的設計下，整合其實一點也不難。我們現在已經擁有了一個「永遠開啟」的檢索系統，會天真地（naively）拿最後一則訊息去檢索最相關的資源……理論上是這樣。不過如果你實際玩一下，很快就會發現原始輸入不見得是最理想的，因此大多數實務上的架構都會先把輸入改寫成內嵌模型最喜歡的標準形式……但這樣做會增加延遲，也會拉長首個符記生成時間（time-to-first-token），讓系統反應變慢。



<br><hr>



## **第 4 部分：** 加入「更深入思考」機制

在這一節，我們要稍微借鑒 ReAct 的精神，給我們的系統加入多層次的縝密程度。由於上面的檢索非常輕量，對大多數使用情境已經足夠，我們就保留它。但我們再額外加入一個更嚴謹的思考流程，強制執行 **查詢精煉（query refinement）** 以及 **網路搜尋（web search）**。

這類機制通常被稱為「反思（reflection）」機制，因為它會評估 LLM 的輸出並試圖修正執行流程。它的直覺基礎是：驗證一個輸出是否看起來合理，比起一開始就生成正確輸出要容易得多。

我們可以用單一結構化輸出結構描述來實現查詢邏輯，下面先來測試一下：


```python
from course_utils import SCHEMA_HINT
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
from typing import List, Dict

class Queries(BaseModel):
    """Queries to help you research across semantic and web resources for more information. Specifically focus on the most recent question."""
    big_questions: List[str] = Field(description="Outstanding questions that need research, in natural language")
    semantic_queries: List[str] = Field(description="Questions (3 or more) to ask an expert to get more info to help, expressed in different ways.")
    web_search_queries: List[str] = Field(description="Questions (3 or more) that will be sent over to a web-based search engine to gather info.")

def query_node(state: State):
    if not state.get("messages"): return {"queries": []}
    chat_msgs = [
        ("system", SCHEMA_HINT.format(schema_hint = Queries.model_json_schema())),
        ("user", "Corrent Conversation:\n" + "\n\n".join([f"[{msg.type}] {msg.content}" for msg in state.get("messages")])),
    ]
    schema_llm = llm.with_structured_output(schema=Queries.model_json_schema(), strict=True)
    response = Queries(**schema_llm.invoke(chat_msgs))
    return {"queries": [response]}

add_queries = (lambda l,x: l+x) 

state = {
    "messages": [], 
    "queries": [],
}
state["messages"] = add_messages(state["messages"], [("user", "Can you tell me about agents?")])
state["queries"] = add_queries(state["queries"],  query_node(state)["queries"])
print("Queries:", state["queries"])

state["messages"] = add_messages(state["messages"], [("user", "How about earth simulations?")])
state["queries"] = add_queries(state["queries"],  query_node(state)["queries"])
print("\nQueries:", state["queries"])
```

<br>



現在我們得真正去履行這些請求，因此把本 Notebook 的檢索函式，以及前一個 Notebook 的 DDGS 搜尋工具都拉進來，實際執行這些請求。


```python
## HINT: You can paste the retrieval node and search tools directly and just resolve them in fulfill_query

# from langchain.tools import tool
# 
# @tool
# def search_internet(user_question: List[str], context: List[str], final_query: str):
#     """Search the internet for answers. Powered by search engine, in Google search format."""
#     from ddgs import DDGS
#     return DDGS().text(final_query, max_results=10)

# def retrieval_node(state: State, config=None, out_key="context"):
#     ## NOTE: Very Naive; Assumes user question is a good query
#     ret = retrieve_via_query(get_nth_message(state, n=-1), k=3)
#     return {out_key: set(ret)}

def fulfill_queries(queries: Queries, verbose=False):
    # big_questions: List[str]
    # semantic_queries: List[str]
    # web_search_queries: List[str]
    from ddgs import DDGS
    web_queries = queries.web_search_queries + queries.big_questions
    sem_queries = queries.semantic_queries + queries.big_questions
    # if verbose: print(f"Querying for retrievals via {web_queries = } and {sem_queries = }")
    web_ret_fn = lambda q: [
        str(f"{v.get('body')} [Snippet found from '{v.get('title')}' ({v.get('href')})]") 
        for v in DDGS().text(q, max_results=4)
    ]
    sem_ret_fn = retrieve_via_query
    web_retrievals = [web_ret_fn(web_query) for web_query in web_queries]
    sem_retrievals = [sem_ret_fn(sem_query) for sem_query in sem_queries]
    # if verbose: print(f"Generated retrievals: {web_retrievals = } and {sem_retrievals = }")
    return set(sum(web_retrievals + sem_retrievals, []))

retrievals = set()
new_rets = fulfill_queries(state["queries"][0], verbose=True)
retrievals = retrievals.union(new_rets)
print(f"Retrieved {len(new_rets)} chunks from the internet and the knowledge base")
new_rets
```

<br>


完美！我們現在擁有了一個長到根本不能用的脈絡資訊，雖然確實思考得更周全，但長度完全無法處理。幸好我們有已經很成熟的檢索器(Retriever)系統，只要稍微再泛化一點，就能輕鬆子集合化（subset）這些內容。

在下方的程式碼區塊中，請實作一個 `format_retrieval` 函式來產生系統真正要使用的脈絡資訊。



```python
def filter_retrieval(
    queries: Queries, 
    new_retrievals: list[str], 
    existing_retrievals: set[str] = set(), 
    k=5
):
    # big_questions: List[str]
    # semantic_queries: List[str]
    # web_search_queries: List[str]
    reranker = NVIDIARerank(model="nvidia/llama-3.2-nv-rerankqa-1b-v2", base_url='http://llm_client:9000/v1', top_n=(k + len(existing_retrievals)), max_batch_size=128)
    docs = [Document(page_content = ret) for ret in new_retrievals]
    rets = reranker.compress_documents(docs, "\n".join(queries.big_questions))
    return [entry.page_content for entry in rets if entry.page_content not in existing_retrievals][:k]

filtered_retrieval = filter_retrieval(state["queries"][0], new_rets)
filtered_retrieval
```

<br>



最後，把整個流程包裝成單一的統一節點呼叫，在常規流程中執行這個機制，而且最好在最終新檢索結果產生之前，都不要寫入狀態緩衝區。

**最終的整合我們留給大家練習，但有興趣的人可以直接看解答。** 畢竟這就是為了評量在做準備。




```python
import uuid
from typing import Annotated, Optional
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.constants import START, END
from langgraph.graph import StateGraph
from langgraph.types import interrupt, Command, Send
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
    context: Annotated[set, (lambda x,y: x.union(y))]

agent_prompt = ChatPromptTemplate.from_messages([
    ("system",
         "You are a helpful instructor assistant for NVIDIA Deep Learning Institute (DLI). "
         " Please help to answer user questions about the course. The first message is your context."
         " Restart from there, and strongly rely on it as your knowledge base. Do not refer to your 'context' as 'context'."
         " If you think nothing in the context accurately answers your question and you should search deeper,"
         " include the exact phrase 'let me search deeper' in your response to perform a web search."
    ),
    ("user", "<context>\n{context}</context>"),
    ("ai", (
        "Thank you. I will not restart the conversation and will abide by the context."
        " If I need to search more, I will say 'let me search deeper' near the end of the response."
    )),
    ("placeholder", "{messages}")
])
    
##################################################################

def user(state: State):
    update = {"messages": [("user", interrupt("[User]:"))]}
    return Command(update=update, goto="retrieval_router")

## TODO: Add the retrieval between user and agent
def retrieval_router(state: State):
    return Command(update={"context": ""}, goto="agent")

def agent(state: State, config=None):
    if "END" in state.get("messages")[-1].content: 
        return {"messages": []}
    update = {"messages": [(agent_prompt | llm).invoke(state, config=config)]}
    if "New Context Retrieved:" in state.get("messages")[-1].content:
        pass
    elif "let me search deeper" in update['messages'][-1].content.lower():
        return Command(update=update, goto="deep_thought_node")
    return Command(update=update, goto="start")

def deep_thought_node(state: State, config=None):
    ## NOTE: Very Naive; Assumes user question is a good query
    deeper_queries = query_node(state)['queries'][0]
    new_rets = fulfill_queries(deeper_queries, verbose=True)
    new_rets = filter_retrieval(deeper_queries, new_rets, state.get("context"))
    update = {"messages": [("user", f"New Context Retrieved: {new_rets}")]}
    return Command(update=update, goto="agent")
    
##################################################################

builder = StateGraph(State)
builder.add_node("start", lambda state: {})
builder.add_node("user", user)
## TODO: Register the new nodes to the nodepool
builder.add_node("retrieval_router", retrieval_router)
builder.add_node("deep_thought_node", deep_thought_node)
builder.add_node("agent", agent)
builder.add_edge(START, "start")
builder.add_edge("start", "user")
app = builder.compile(checkpointer=MemorySaver())
config = {"configurable": {"thread_id": uuid.uuid4()}}
app_stream = partial(app.stream, config=config)

for token in stream_from_app(app_stream, verbose=False, debug=False):
    print(token, end="", flush=True)
```

<details>
    <summary><b>提示：</b></summary>
    <code>retrieval_router</code> 目前是手動注入一個空字串 "" 作為 context，或許我們只要用最少的包裝直接呼叫我們的檢索函式就好了？  
</details>

<details>
    <summary><b>解答:</b></summary>

```python
## TODO: Add the retrieval between user and agent
def retrieval_router(state: State):
    return Command(update=retrieval_node(state), goto="agent")

def retrieval_node(state: State, config=None, out_key="context"):
    ## NOTE: Very Naive; Assumes user question is a good query
    ret = retrieve_via_query(state.get("messages")[-1].content, k=3)
    return {out_key: set(ret)}
```

</details>

<hr><br>




### **第 5 部分：** 對這次練習的反思

就這樣，我們已經做出了一個雖然受限、但確實有點 ReAct 風格的迴圈。雖然它不是「工具池」這種經典做法，但絕對是一個內建任務派送（routing）的「反思系統」。它也還稱不上真正的「深度研究者」，因為還沒真的閱讀完整文章，也還無法進一步擴展素材，但它已經展現了非常基礎的檢索簡化能力，讓我們能擁有更長的對話窗口。

**下一節請準備迎接正式評量，你將要根據本 Notebook 介紹的技術，實作一個具備分析推理（reasoning）與搜尋功能的系統！**



<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>



