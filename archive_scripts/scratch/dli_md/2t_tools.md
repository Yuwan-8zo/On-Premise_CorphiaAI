<br>
<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>
</a>
<h1 style="line-height: 1.4;"><font color="#76b900"><b>使用大型語言模型(LLMs)建構 Agentic AI 應用程式</h1>
<h2><b>補充教材(Tangent) 2:</b> 支援工具使用(Tooling)的大型語言模型(LLM)系統</h2> <br>





__歡迎來到我們的第二個補充教材(Tangent)!__

在先前的 Notebook 中,我們強調了模型的嚴苛限制,並假設了從我們的系統中榨取出生成式(Generative)能力的方法。我們能夠達成有趣的輸出需求,這些需求技術上可以讓大型語言模型(LLM)以一致的方式進行介面接接、同時具有嚴格的結構描述(Schema)、甚至能夠輸出長篇的(long-form)輸出產物。在本節中,我們將探討工具化(Tooling),其中包括用於訊息傳遞(Route)、通知和使大型語言模型(LLMs)能夠在環境中執行事務的功能集(featuresets)。

### 學習目標:

__在本 Notebook 中,我們將:__

- 介紹一些大型語言模型(LLM)流程協調管理(Orchestration)技術,這些技術源自於我們新獲得的生成結構化輸出的能力。

- 將工具化(Tooling)作為一個概念進行了解,了解為何針對你所選擇的抽象層級進行定義與區分是具有意義。

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


<hr><br>

## 第1部分: 訪問(Navigate)可控制的環境

現在我們已經了解如何使用 LangGraph 實作 Agent 事件循環(event loop),是時候發揮這項技能了!我們已經從練習 3 中體驗了 Agentic 的風格,這一方面很容易從第 1 節衍生出來,但另一方面也正式化(Formalize)了一個非常簡單的 Agent 實現流程。

- __將 Agent 放入對話循環中。__
- __強制它們以產生變數的結構描述(Schema)輸出。__
- __根據產生的變數,相應地修改控制流程。__

根據控制流程的確切作用,我們對所發生的事情有不同的名稱:

- 當此控制流程用於__選擇工具或路徑時__,稱為路由(routing)。
- 當它用於__選擇和參數化__一個工具(大概是要被呼叫)時,稱為工具化(tooling)。
- 當它用於__檢索(Retrieval)資訊__時,稱為檢索(retrieval)。

敏銳的人可能會注意到,這些術語之間沒有具體差異;只有語義上的差異。儘管如此,定義這些功能並考慮您可能希望如何區分它們,無論是在您的思維中、在程式碼中,還是在您如何溝通系統的努力和功能集中,都是有用的。

<img src="images/llm-orchestration.png" style="width:1000px;"/>

### 大型語言模型(LLMs)的持續挑戰

儘管我們可以輕易地感知到具有類人技能的大型語言模型(LLM)如何使用我們的需求集與任意資源進行互動,但我們必須記住與大型語言模型(LLMs)相關的特性。

- 它們很容易偏軌(Derailment),並且其功能反映了它們的訓練方法、資料、輸入風格和整體容量。

- 它們的實作方式不同,具有各種假設、預設支援機制以及這些支援機制的各種(有時可疑的)實作。

這創造了一個有趣的動態,如果您希望它們協同合作來解決非平凡的任務,那麼您需要對我們的大型語言模型(LLMs)及其真正的能力做出一些假設。

- 它們能呼叫工具嗎?能訊息傳遞(Route)到工具嗎?能提出好問題嗎?

- 它們能理解整個環境嗎?那麼甚至對話呢?最後一條訊息呢?

- 它們應該立即回應嗎?規劃並執行?依賴其他系統?

根據您的觀察,您的模型池和預算將強烈決定真正的多 Agent 的 Agentic 工作流程是否真的有用。我們將把討論限制在 Llama-8B 模型類別(您不會認為它太好,對吧?),並且會看看我們能用它達到什麼程度。

<hr><br>





## 第2部分: 識別一些工具

我們已經學習了結構化輸出,所以我們已經走在實作某種路由(routing)的路上了。然而,您想使用的實際應用程式介面(API)將取決於您可以存取的模型及其預期用途。以下是您可能在實務中找到的一些常見配置:

- __閉源大型語言模型(LLMs)__: 大多數無法存取原始碼的大型語言模型(LLM)提供者嘗試開箱即用地支援 Agentic 工作流程,儘管不一定宣傳其真正的模型設定。這就是為什麼許多大型語言模型(LLM)端點(Endpoints)不再支援原始的 `/completions` 端點(Endpoint),而是支援標準化的 `/chat/completions` 端點(Endpoint)。

    - 這意味著為了支援工具化(Tooling),您必須遵循他們的工具化(Tooling)/結構化輸出應用程式介面(API),並希望它能正常運作。(OpenAI [函式](https://platform.openai.com/docs/guides/function-calling)/[助理](https://platform.openai.com/docs/assistants/tools) 應用程式介面(API)、Claude [工具使用應用程式介面(API)](https://docs.anthropic.com/en/docs/build-with-claude/tool-use))

    - 在實務中,這實際上通常非常好,而且幕後可能正在進行優化,包括自動提示(Prompt)注入、伺服器端拒絕和快取。

- __開源大型語言模型(LLMs)__: 許多開源工作旨在標準化和統一社群的應用程式介面(API)想法,以幫助人們交換並找到最適合其目的的模型。因此,社群還創建了類似的支援計劃,並幫助開發與私有伺服器隱藏功能(private server-hidden options)競爭的工具。

    - **在表面(surface)層級上,** 這表現為對最流行 API 的支援,僅在需要時才偏離。因此,幾乎所有解決方案都支援用於大型語言模型(LLMs)、視覺語言模型(VLMs)和內嵌(Embedding)模型的 OpenAI 應用程式介面(API)規範,而僅對擴散(diffusion)、重新排序和文件輸入(ingestion)應用程式介面(APIs)進行了一些標準化。

    - **在更深層次上,** 對此類介面的支援是盡力而為(best-effort)的嘗試,偶爾可能與模型訓練背道而馳,或將模型延伸到超出其真正評級和建議的範圍。

因此,我們將查看幾種可能的配置,同時從支援這些配置的客戶端抽象層（client-side abstractions），以及假設中負責實現承諾的伺服器後端（server backend）兩個角度來進行探討。

<br>


### 第2.1部分: 客戶端工具化(Tooling)

像 LangChain 這樣的框架為感興趣的人提供工具化(Tooling)介面。如果您想將函式與大型語言模型(LLM)整合,如果您不必編寫一堆樣板程式碼來完成所有這些工作,那將是很有用的。下面,我們可以看到使用 @tool 裝飾器(decorator)定義「工具」的 langchain 方式。

```python
from langchain.tools import tool
from typing import List, Literal

@tool
def calculate(
    thought_process: List[str],
    # tool: Literal["add"],
    # tool: Literal["add", "mult", "pow"],
    tool: Literal["add", "subtract", "multiply", "divide", "power"],
    a: float, 
    b: float
) -> int:
    """Adds a and b. Requires both arguments."""
    if tool == "add": return a + b
    if tool == "subtract": return a - b
    if tool == "multiply": return a * b
    if tool == "divide": return a / b
    if tool == "power": return a ** b

print(calculate.name)
print(calculate.description)
print(calculate.args)
calculate.input_schema.model_json_schema()
```

<br>




如您所見,這只是結構描述(Schema)抽象層周圍的一個薄包裝器(Thim Wrapper),允許它們建構工具。使用與之前大致相同的策略,我們可以繼續以可預測的方式 invoke 工具:

```python
from course_utils import SCHEMA_HINT

sys_msg = (
    "You are a world-class calculator. Please answer the user's question, and use your tools."
    # "Think through your decision in thought-process until you know your first step using order-of-operations. "
    # "Predict the first tool as your last output. Be specific, and then call the tool."
)
# sys_block = []
# sys_block = [("system", sys_msg)]
schema_hint = SCHEMA_HINT.format(schema_hint=calculate.input_schema.model_json_schema())
sys_block = [("system", f"{sys_msg}\n\n{schema_hint}")]

question = "What's 56464 + 4789789097?"
# question = "What's 56464 - 4789789097?"
# question = "What's 56464 / 4789789097?"
# question = "What's 56464 / 4789789097 + 6750 * 478978090?"

calc_llm = llm.with_structured_output(calculate.input_schema)
a = calc_llm.invoke(sys_block + [("user", question)])
print(a)
```

```python
calc_tool = llm.with_structured_output(calculate.input_schema) | dict | calculate
calc_tool.invoke(sys_block + [("user", question)])
```

```python
llm._client.last_inputs
```

<br>




### 第2.2部分: 伺服器端工具選擇

相比之下,伺服器端工具選擇不僅僅是程式碼簡化。許多支援結構化輸出介面的端點(Endpoints)也嘗試支援明確的工具選項介面,讓 LLM 可以主動選擇要呼叫幾個工具。此實作的確切機制各不相同,因此您的端點(Endpoint)可能支援以下任何配置:

- 強制工具呼叫(Forced Tool-Call): 透過明確的文法(grammar)強制執行，先逼迫模型選擇工具類別，接著再生成對應的參數 schema。

    - 缺點: 視訓練資料與強制程度而定，可能會把 LLM 逼到出域（out-of-domain）狀態，因為這可能與模型預訓練時的習慣相衝突。

    - 好處: 從生成的符記(tokens)/浪費的符記(tokens)的角度來看,這在技術上更有效率。同時也比較容易整理出這種模式的微調資料。

- 非結構化輸出 -> 工具呼叫: 允許大型語言模型(LLM)生成一些輸出(也許是分析推理(Reasoning),也許是閒聊)。這些材料可以被丟棄、作為回應訊息主體輸出,或以其他方式整合(Aggregate)到結構化輸出中。之後再透過導向解碼（guided decoding）或其他方式強制產生結構化輸出，最終彙整後回傳給使用者。

    - 缺點: 生成更多符記(tokens),並且根據實作(伺服器端或客戶端),輔助符記(tokens)可能預設被丟棄。

    - 好處: 更有可能落在模型的 in-domain 範圍內，並且允許比預期 schema 更深入的推理。此外，還可能實現「對話式工具呼叫」（先聊要不要呼叫工具、再正式發出呼叫、最後自然結束對話）。

下方範例可以看到數個工具的定義，已經透過額外的變數、合理的函數命名與詳細的 docstring 事先進行了預防性的隱式提示工程（preemptive implicit prompt engineering）。`search_knowledge` 的實作部分先省略，將在後續 notebook 中詳細討論。

```python
from pydantic import Field
from langchain.tools import tool
from typing import Any, Dict, List, Literal, Optional, Tuple
from ddgs import DDGS
import time
import numpy as np
import sys
import os
os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = "http://jaeger:4317"
sys.path.append("/dli/task/composer/microservices")
from ddg_cache import cached_ddg_search, quick_search, search_and_summarize

from contextlib import redirect_stdout

############################################################################################
## An example of a tool which could hide an LLM, a database, or merely a query.
## In either case, it can have varying latencies, use various resources,
## and still subscribe to the same surface-level schema.

## Note that this will require you to initiate a database relation:
from ddg_cache import init_database
await init_database()  # <- only needs to be done once

@tool
async def search_internet(
    user_question: str | List[str], 
    context: Optional[List[str]] = None, 
    final_query: Optional[str] = None,
):
    """
    Search the internet for answers. Powered by search engine of choice.
    Create a good search engine (Google or DuckDuckGo) search requests
    """
    if not final_query:
        final_query = user_question
    
    ## Very simple method for querying DuckDuckGo
    # res = []
    # for i in range(100): 
    #     res = DDGS().text(final_query, max_results=10)
    #     if res: break
    #     time.sleep(0.1)
    # return res

    ## TODO: More involved method which caches results, allows fallbacks, etc.
    # return (await quick_search(final_query, max_results=5))
    
    ## TODO: Even more involved iteration, which also includes multiple stages of summarization
    return (await search_and_summarize(final_query, max_results=5))

############################################################################################
## An example of a fallback tool. If it gets called, it gracefully says to try something else.
## Hopefully this does not break the LLM/chat prompts' prior expectations and the LLM recovers.

@tool
async def search_knowledge(
    user_question: str | List[str], 
    context: Optional[List[str]] = None, 
    final_query: Optional[str] = None,
):
    """Search your knowledge for answers. Includes chat history, common responses, and directives"""
    return "No knowledge ingested. Respond in best-effort based on directive."

############################################################################################
## An example of an execution environment. We can coerce a model (especially more powerful ones) to run code
## but this is quite risky without sandboxes. You should probably implement version control, rollbacks, and 
## human-in-the-loop patterns if you're gonna try this (i.e. a domain-specific code generation use-case)

LockedImports = Literal["import numpy as np; import pandas as pd; import math; import print"]

@tool
async def execute_python(user_question: List[str], context: List[str], imports: LockedImports, final_code: str):
    """Execute python code, the values printed through stdout (i.e. `print` will be returned to user)"""
    import contextlib, io
    import numpy as np; import pandas as pd; import math 
    with io.StringIO() as buf, contextlib.redirect_stdout(buf):
        try: 
            exec(final_code, {"numpy": np, "np": np, "pandas": pd, "pd": pd, "math": math})
            return buf.getvalue()
        except Exception as e: 
            return str(e)

############################################################################################
## A very simple but very useful tool. Random number generation should never be done with an LLM, 
## but "selecting" a random number tool could be a way to bypass this. Can be done to randomize 
## LLM's environment for game logic, synthetic data sampling, etc.

@tool
async def random_choice(options: List[str], num_samples: int = 1, probs: List[float] = []):
    """Returns a random option generated from the p distributions (list of floats)"""
    if not len(probs):
        probs = [1 / len(options)] * len(options)
    return np.random.choice(options, num_samples, probs)

schema = search_internet
# schema = search_knowledge
# schema = execute_python
print(schema.name)
print(schema.description)
print(schema.args)
schema.input_schema.model_json_schema()
```

<br>




幸運的是,我們的 Llama NIM 直接支援此工具呼叫(並且我們會讓您根據延遲猜測使用哪種策略)。由於 LangChain 連接器(Connector)使用 `bind_tools` 簡化了工具綁定,我們可以像 `with_structured_output` 一樣使用它,然後只需在我們的提示(Prompts)中添加一些結構描述(Schema)提示即可使這一切正常運作。

- __提醒__: 在 LangChain 中,bind 僅將參數綁定到可運行物件(runnable)/`客戶端。bind_tools`,像 `with_structured_output` 一樣,只是一種風格差異,它還將結構描述(Schema)處理成伺服器預期的形式。

```python
from course_utils import SCHEMA_HINT

toolbank = [search_internet, search_knowledge, calculate, execute_python, random_choice]
# toolbank = [search_internet, search_knowledge, calculate, execute_python]
# toolbank = [search_internet, search_knowledge, calculate]
# toolbank = [search_internet, search_knowledge]
tooldict = {tool.name: tool for tool in toolbank}
tool_arg_generator = llm.bind_tools(toolbank) | dict

query = (
    # "Can you please calculate the first 20 digits of pi?"
    # "Can you please calculate the first 20 digits of pi? Make sure to use the execute_python tool."
    # "Can you please pick a random color for me?"
    # "Can you please pick a random color for me with uniform probability?"
    # "Can you please tell me about NVIDIA's new DIGITS systems?"
    # "Can you please tell me about NVIDIA's new DIGITS systems? What do you know from your knowledge?"
    # "Can you please tell me about NVIDIA's NeMo NAT system? Think about it"
    "What's the new LangGraph middleware abstraction, and why is it useful? Search the web!"
)

output = tool_arg_generator.invoke([
    ("system", (
        "You are an NVIDIA Chatbot. Please help the user with their concerns.\n"
        + SCHEMA_HINT.format(schema_hint="\n".join(str(tool.input_schema.model_json_schema()) for tool in toolbank))
    )), ("user", query),
])
# print(output)
print("Content:", output.get('content') or "Blank")
print("Tool Calls:")
output.get('tool_calls', [])
```

```python
from IPython.display import display, HTML

## Feel free to try some of these prompts out to see what works and what doesn't. 
## When you're ready to see if it would have worked in calling the tool, you can run the cell below:

for tool_call in output.get('tool_calls', []):
    print("Tool Input:", tool_call)
    tool_response = await tooldict[tool_call.get("name")].ainvoke(input=tool_call.get("args"))
    if "query" in tool_response:
        display(tool_response["query"])
        display(tool_response["summary"])
        display([result["href"] for result in tool_response.get("results")])
    else:
        display(tool_response)
    display(HTML("<hr/><br/>"))
```

<br>


這就是我們實際的工具使用。從這個小範例中,您會注意到它並不完美,並且像所有其他事物一樣需要提示工程(Prompt Engineering):​

-   如果函式名稱不夠描述性,即使實際實作的功能不足,它也可能預設為聽起來更普遍的東西,如"calculate"。​

-   Python執行工具對於較輕量級的模型來說實際上非常難以實作,您可以看到我們透過添加要使用的函式庫的提示來破解它,使其至少對於這個簡單的invoke足夠穩定。​

-   即使是無意的措辭不匹配(phrasing mismatches),如果您的系統沒有正確地將指令轉換為某種標準形式(Canonical Forms),也可能導致錯誤的工具使用。​

儘管如此,它至少看起來我們可以使用我們的大型語言模型(LLM)呼叫工具,甚至在某種程度上選擇它們,這非常酷!​

請注意,從`with_structured_output`到`bind_tools`的轉變僅僅是將工具選擇的義務從客戶端轉移到伺服器。正如我們所說,這不是表面上的轉變,實際上強調了一些優缺點。雖然`bind_tools`使呼叫者的整個過程更容易,但它也剝奪了可能需要執行某些關鍵功能的控制。在您的實作中考慮這一點很重要,並在您從一個模型轉移到另一個模型時選擇正確的策略,因為伺服器端假設可能適合或不適合任何特定用途。




<hr><br>


## **Part 3:** 在迴圈中使用工具(ReAct)


既然我們已經定義了一些簡單的工具來與某些環境互動,我們可以為我們的大型語言模型(LLM)配備它們,並可能希望進行多輪對話。實際上,甚至可能是一個多步驟對話,他們在其中使用多個工具,並在實際有答案時回覆我們。​

> <img src="images/react-opts.png" style="width: 1000px" />
>
> <a href="https://react-lm.github.io/" target="\_blank"><b>ReAct: 在大型語言模型中協同(Synergized)分析推理(Reasoning)和行動 (2022)</b></a>

為了做到這一點,事實證明有一些非常簡單的方法來處理問題,這些方法都帶有一些失敗模式,但隨著模型繼續改進,性能似乎可以很好地擴展。我們將在本Notebook中探索其中的幾個,但請放心,這些只是許多潛在選項中最常見的:​

### **原始ReAct:**


***分析推理(Reasoning)和行動***的縮寫,ReAct是一種著名的技術,它在大型語言模型(LLM)流程協調管理(Orchestration)領域迅速普及,並隨著框架的不斷發展而迅速發展到遠遠超出其原始定義。ReAct最初被提出作為維護**Agent草稿本(scratchpad)**的策略,其中大型語言模型(LLM)將被給予指令、一些工具呼叫範例和一些實現範例。基於此,隨著這些`{問題,答案,實現}`範例在視窗中堆積,脈絡資訊(Context)會增長。這與僅僅`{問題,實現}`形成對比,因為答案會首先給出決策背後的一些分析推理(Reasoning)。​

例如,以下將是預設包含的合理(reasonable)提示(Prompt)指令: 





```python
from langchain_classic import hub

prompt = hub.pull("hwchase17/react")
prompt.template = prompt.template.replace("\nBegin!\n", (
    "\nRespond to the Customer with the Final Answer: string. Call tools if necessary to get there, knowing that every tool will create an Observation: response."
    "\nRemember to specify 'Action: tool name' and 'Action Input: tool arguments'."
    "\n\nBegin!\n"
    "\nHistory:\n{chat_history}\n"
)).replace("Question: ", "Customer: ").replace("Thought:", "Agent:")

prompt.input_variables += ["chat_history"]

print(prompt.template)
```

<br>



使用這種提示(Prompt)預設的結果將是....嗯...這是一個直接來自[舊版文件](https://python.langchain.com/v0.1/docs/modules/agents/agent_types/react/),應用於 8B 3.1 模型的範例:

```python
prompt
```

```python
import langchain_classic.agents as lc_agents
from IPython.display import display
from langchain_nvidia import NVIDIA

base_llm = NVIDIA(
    model="nvidia/mistral-nemo-minitron-8b-base", 
    base_url="http://llm_client:9000/v1", 
    max_tokens=1000,
)

lc_agent_llm = base_llm

# Construct the ReAct agent
agent = lc_agents.create_react_agent(lc_agent_llm, [search_knowledge], prompt, stop_sequence=["\nObserv", "\n\n"])
agent_executor = lc_agents.AgentExecutor(agent=agent, tools=toolbank, verbose=True, handle_parsing_errors=True)

try:
    await agent_executor.ainvoke(
        {
            "input": (
                "what's my first name?"
            ),
            # Notice that chat_history is a string, since this prompt is aimed at LLMs, not chat models
            "chat_history": "Customer: Hi! My name is Bob\nAgent: Hello Bob! Nice to meet you",
        },
        verbose=True
    )
except Exception as e:
    print("Exception:", e)

print("\nLast Input:") or display(lc_agent_llm._client.last_inputs)
if hasattr(lc_agent_llm._client.last_response, "json"):
    print("\nOutput:") or display(getattr(lc_agent_llm._client.last_response, "json"))
else: 
    import requests
    lc_agent_llm._client.last_inputs['json']['stream'] = False
    print("\nLast Output:") or display(requests.post(**lc_agent_llm._client.last_inputs).json())
```

<br>


如您所見,這種格式的工作流程在現代語言模型中大多已被棄用,但這是一個良好的開始,並在非引導式自回歸(Autoregressing)是主要技術時開創了許多有趣的範例。好的範例將加強脈絡資訊(Context)內的工具呼叫,壞的範例將導致投訴被記錄回大型語言模型(LLM),並且符記(token)停止條件將確保大型語言模型(LLM)不會嘗試回答它排入佇列(queued up)的自己的問題。​

### **現代ReAct:**


由於ReAct的想法與Agent想法如此緊密相關,它或多或少地作為"思考它,互動,看看會發生什麼,重複"的一般想法發展出來。這與工具選擇/結構化輸出的出現相結合,使該術語演變為包含任何符合以下條件的Agent系統:​

-   **具有中央對話迴圈。**​

-   **可以呼叫其可用的工具。**​

-   **可以直接回應使用者。**​

換句話說,**ReAct Agent現在只是任何具有運行中的(Live)對話緩衝區的Agent,可以呼叫一組包括使用者在內的工具。** 您可以自由辯論這是否是該短語的合理演變,但它足夠吸引人和直觀,並且該術語此後一直保留。​

我們可以在其預設匯入形式中從`langgraph`函式庫嘗試這種新風格的ReAct迴圈,我們將從其invoke中看到一組不同的結果




```python
from langchain.agents import create_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.runnables.history import RunnableWithMessageHistory

checkpointer = MemorySaver()
langgraph_agent_executor = create_agent(llm, toolbank, checkpointer=checkpointer)

query = (
    # "Can you please calculate the first 20 digits of pi?"
    "Can you please calculate the first 20 digits of pi? Make sure to use the execute_python tool."
        # " Note that numerator_log10 andd nhall does not exist."
    # "Can you please pick a random color for me?"
    # "Can you please pick a random color for me with uniform probability?"
    # "Can you please tell me about NVIDIA's new DIGITS systems?"
    # "Can you please tell me about NVIDIA's new DIGITS systems? What do you know from your knowledge?"
)

config = {"configurable": {"session_id": "test-session", "thread_id": "test-thread"}}

messages = await langgraph_agent_executor.ainvoke({"messages": [("human", query)]}, config=config)
{"input": query, "output": messages["messages"][-1].content}
```



我們可以嘗試檢查歷史紀錄(History),看看...它似乎按預期執行:

```python
langgraph_agent_executor.get_state(config).values
```

<br>



那是因為這個版本強烈假設能夠透過工具使用(tool-use)API呼叫工具,並且僅強制執行現在被稱為"ReAct Loop"的主要控制流程(control flow):



```python
langgraph_agent_executor
```

<br>



我們稍後會更多地討論 langgraph,但您可以嘗試再次運行執行器,看看如果您想提出後續問題會發生什麼:

```python
messages = await langgraph_agent_executor.ainvoke({"messages": [("human", "Can you now see what happens when you use another tool?")]}, config=config)
print(messages["messages"][-1].content)
```

```python
langgraph_agent_executor.get_state(config).values
```



<hr><br>

## **第 4 部分：** 伺服器端工具執行（Server-Side Tool Execution）

到目前為止，我們已經看過客戶端工具選擇的範例，並剛剛介紹了伺服器端工具選擇。在這兩種情況下，端點（endpoint）都僅負責問題的語意部分，而實際的執行履行仍然是客戶端的負擔。但情況並非總是如此，確實存在一些合理的使用場景適合伺服器端工具，甚至是自動化工具支援。

> <img src="images/tooling-patterns.png" style="width:1000px;"/>


#### **包裝應用程式 / Agent（Wrapper Application/Agent）**

顯而易見，你可以為大型語言模型（LLM）建立一個包裝應用程式(Wrapper Application)，內建自己的工具假設與執行策略。這類系統的許多介面方式與一般的 LLM 伺服器幾乎相同（例如透過串流或呼叫 API），但它們會頻繁呼叫各種工具、自行管理狀態等。這並不令人意外，僅僅是微服務設計模式的簡單應用。

**範例：**

-   一個 **檢索微服務（retrieval microservice）** 可能支援完成串流(completion streaming) API，並在內部使用結構化輸出作為組成部分，即使它的主要工作是與知識庫介接。
-   一個 **聊天機器人角色（chatbot persona）** 可以被簡化為一個高階 API，自動維護對話狀態，從預先定義的工具集中選擇適當工具，並維持系統提示詞（system prompt）。如果它完全隔離在伺服器端，其執行時期可以任意遷移到任何運算資源上，我們也能定義任意的資源的所有權與擴展(scaling)規則。



#### **測試時運算 / 推理時擴展（Test-Time Compute / Inference-Time Scaling）**

有些情況下，工具使用、路由或分支策略與訓練過程緊密交織，或者僅僅在背景強制執行就能提升模型效能。這時你會聽到「Test-Time Compute」與「Inference-Time Scaling」這些詞被頻繁提及，卻往往缺乏明確定義（有時被模糊地描述為「思考」）。這些是含義不斷演變的模糊術語，技術上其實是同義詞：

-   **Test-Time** 與 **Inference-Time** 僅表示這些運算發生在模型訓練完成之後，通常是在實際部署（in the wild）時。
-   **Compute** 與 **Scaling**（或 compute scaling）則暗示在模型決策與輸出生成過程中投入了額外的運算資源，可能特別強調處理量大幅增加。

眼尖的讀者可能會發現，這聽起來根本就是Agent 工作流程（agentic workflow）或 LLM 管線（pipeline）......現在卻被正名為 LLM 推理階段的「功能」？嚴格來說，通常還會額外暗示：模型已經被特別訓練來支援這類額外流程，或是透過大量合成資料訓練，又或者在迴圈中整合了一個專門為此設計的輔助模型------**但這其實並非硬性要求**。


**範例：**

-   **「擴展相鄰（Scaling-Adjacent）」**：一個會輸出鏈式思考（chain-of-thought）的推理系統，可以讓其輸出被自動展開(auto-expanded)，使每個步驟以**平行分支（branched）**、**順序執行(Iterate(疊代))**或**組合在一起(合併)（merged）**的方式執行。這可能導致推理時間爆炸性增長，但因為模型明確針對這種格式進行訓練，因此被視為模型內建功能。
-   **「運算相鄰（Compute-Adjacent）」**：這類別非常廣泛，幾乎涵蓋所有進入推理伺服器的 LLM 編排努力。例如，模型在生成過程中可能會**被某個分類器或獎勵模型（reward model）評估與判斷**，以更好地對齊最終輸出。這既可以用來讓推理變重，也可以用來變輕。
    -   輕量的做法：像是**推測解碼（speculative decoding）**（用輕量級模型一次自回歸生成一大段，直到遇到高不確定性 token）以及**動態護欄（dynamic guardrails）**（預訓練或漸進訓練的嵌入模型用於分類），都能加速推理。
    -   複雜的做法：使用**獎勵模型進行批評與引導(critique and guide)**通常會導致嚴重減慢，但對關鍵場景極有價值。這在推理階段偶爾會用，但更常見於訓練階段（如強化學習）。

這類技術最需要記住的重點是......

#### **工具註冊（Tool Registration）**

在需要複雜分支工作流(Branch)、同時又想限制對底層模型直接存取的場景中，透過網路介面來實現平行工具(Parallel)呼叫會變得相當困難。因此，一些更進階的工作流會將可用工具限制在一個有限的、預先實作好的清單內。

若想提供更多客製化彈性，客戶端通過執行緒安全(thread-safe)端點(Endpoints)(即可擴展的/限制性異步(async)方法)託管(Hosting)自己的工具,並允許他們通過提供的結構描述(Schema)將工具註冊為可呼叫，例如可擴展/受限的 async 方法），並允許他們依照提供的 schema 註冊這些工具為可呼叫。假設這些端點透過 port 介面可被存取，伺服器就能非同步呼叫這些託管端點來完成執行。

這種做法在 [**Anthropic Model Context Protocol**](https://www.anthropic.com/news/model-context-protocol) 中特別明顯，本質上就是一種微服務風格的抽象層：一個日益邊緣化(increasingly-marginalized)的閉源伺服器，與更廣大的外部函式生態系統互動。。






<hr><br>

### 第5部分: 對此練習的反思
您可能會注意到,我們並沒有將「工具化(Tooling)」描繪成一個具體的想法。我們或多或少只是將以下兩個陳述結合到它們的邏輯結論:

> 「大型語言模型(LLM)可以做出陳述和決定」+「大型語言模型(LLM)可以被強制以可由另一個系統解釋的結構輸出」=「您可以使用大型語言模型(LLM)系統的輸出與另一個系統互動」

然後我們得出結論,您還可以在各種想法層級上模組化、轉移(Offload)或自動處理這一點。這是基本且有用的,並且是您可以完全跳過使用者、選擇性地整合(Aggregate)他們,或強制執行比基本使用者 + 大型語言模型(LLM) Agent 循環更極端的過度依賴的方式。它甚至沒有觸及您可以訊息傳遞(Route)系統以定義自己的控制流程的方式的表面:

- 您可以微調模型或使用內嵌(Embedding)模型來幫助在控制空間( control space)中移動。

- 您可以有一個專家系統池,它們投票選出最佳路由(Routes),或嘗試表達他們在特定方向上的分析推理(Reason)和「確定性」。

- 您可以有隨機決策和演算法條件邏輯,這本身就很有趣,應該很明顯。

但同樣,這只是先前想法的邏輯延伸,並且在很大程度上取決於大型語言模型(LLM)的品質以及您願意圍繞它們工作的意願。

<br>
<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>


