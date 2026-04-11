<br>
<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>
</a>

<h1 style="line-height: 1.4;"><font color="#76b900"><b>使用 LLMs 建構 Agentic AI 應用程式</h1> 
<h2><b>Notebook 1:</b> 製作一個簡單的 Agent</h2> <br>



__您好,歡迎來到本課程的第一個 Notebook!__

我們將利用這個機會介紹一些入門工具來建構一個簡單的聊天系統,並將理解它們在 Agent 分類領域中的角色。請注意,雖然本課程確實有嚴格的先修要求,但我們理解有些人可能還沒準備好立即開始,因此我們會嘗試簡要介紹先前課程中的相關主題。

### 學習目標:

__在這個 Notebook 中,我們將:__

- 對「Agent」這個術語獲得實際的理解,並了解為什麼它再次受到關注。

- 探索課程基本元素,包括在此環境背景中運行的 NIM Llama 模型。

- 製作一個簡單的聊天機器人,接著製作一個簡單的多 Agent 系統,以實現多輪多角色 (multi-turn multi-persona)對話。

<hr><br>


## Part 1: 什麼是 Agent 

__在課程中,我們將 Agent 定義為存在於環境中並在環境中運作的實體(entity)之一__。 

雖然這個定義過於籠統且幾乎沒有用處,但它為我們提供了一個起始定義,我們可以將其投射到日常使用的系統上。讓我們考慮幾個基本函式 - 巧合的是它們大致扮演剪刀石頭布的角色,並看看它們是否符合 Agent 的資格:

```python
from random import randint

def greet(state):
    return print("Let's play a nice game of Rock/Paper/Scissors") or "nice"

def play(state):
    match randint(1, 3):
        case 1: return print("I choose rock") or "rock"
        case 2: return print("I choose paper") or "paper"
        case 3: return print("I choose scissors") or "scissors"

def judge(state):
    play_pair = state.get("my_play"), state.get("your_play")
    options = "rock", "paper", "scissors"
    ## Create pairs of options such as [(o1, o2), (o2, o3), (o3, o1)]
    loss_pairs = [(o1, o2) for o1, o2 in zip(options, options[1:] + options[:1])]
    ## Create pairs of options such as [(o2, o1), (o3, o2), (o1, o3)]
    win_pairs  = [(o2, o1) for o1, o2 in loss_pairs]
    if play_pair in loss_pairs:
        return print("I lost :(") or "user_wins"
    if play_pair in win_pairs:
        return print("I win :)") or "ai_wins"
    return print("It's a tie!") or "everyone_wins"

state = {}
state["my_tone"] = greet(state)
state["my_play"] = play(state)
state["your_play"] = input("Your Play").strip() or print("You Said: ", end="") or play(state)
state["result"] = judge(state)

print(state)
```

<br>



它們共同簡單地定義了電腦程式,並在技術上與某種環境互動:

- 電腦為人類顯示(Render)使用者介面以進行互動。

- Jupyter 程式碼區塊(Cell) 儲存程式碼行,這些程式碼行有助於定義系統執行時執行的控制流程。

- Python 環境儲存變數,包括函式和狀態,甚至包括為顯示給(rendered)使用者的輸出緩衝區。

- 狀態字典(state dictionary)儲存可以被寫入的狀態。

- 函式(functions)接收狀態字典,可能對其進行操作,並列印/返回可能會或可能不會被採用的值。

- ... 依此類推。

顯然有任意多的事物可能這裡頭,影響這個系統的狀態以及更大的周圍世界的狀態。目前我們只需要注意局部感知(locally percieved)到的內容,及這種局部(local)感知導致局部(local)行動。 這跟人類的行為是一樣的,那麼什麼導致這些組件不同呢?

嗯,這裡的主要區別是這些組件似乎並不是在有意義地感知環境並有意識地選擇它們的行動。換句話說:

- 將複雜問題分解為狀態和功能模組,並用一些控制流程將它們黏合在一起,這像是優良的軟體工程...
- 但是組件選擇去做事,並且有目標的行動的這種 _感覺_,這在意義上讓 Agent 類似人類。

由於人類透過感官的局部感知與環境互動,並以語義方式對其進行分析推理(Reasoning)(通過「思考」和「意義」), 一個與人類互動的 Agent 系統需要在與人類共享的實體環境(physical space)中不論看起來或是行動起來都像是一個 __實體(physical) Agent__,或者是在有限的介面(limited interface)上作為 __數位(digital) Agent__去進行跟人類一樣溝通。但是,如果它要與人類一起做事並像人類一樣思考,它需要:

- 至少能夠維持某種內在思考(internal thought)和局部視角(local perspective)的概念。

- 對其環境以及「目標」和「任務」的概念有一定的理解。

- 能夠透過人類可以理解的介面進行通信。

這些都是在語義空間(semantic space)中浮動的概念 - 它們具有「意義」(meaning)、「因果關係」(causality)和「含義」(implications),並且可以被人類甚至演算法在正確組織時解釋 - 因此我們需要能夠建模這些語義概念,並建立從語義密集(semantically-dense)輸入到語義密集(semantically-dense)輸出的映射。這正是大型語言模型發揮作用的地方。

____<hr><br>

## __Part 2__: 使用技術進行語義分析推理(Semantic Reasoning)

在大多數情況下,軟體程式被設計成直觀的模組,可以在這些模組之上建立及製作複雜的系統。一些程式碼定義狀態、變數、例程(routines)、控制流程等,而執行這些程式碼代表進行了人類認為有用的流程。這些提到的組件,其構造(construction)和函式(function)中具有意義,並且在邏輯上拼湊在一起,因為開發人員決定以這種方式組合它們,或者因為適合這樣的結構:

```python
from math import sqrt                             ## Import of complex environment resources

def fib(n):                                       ## Function to describe and encapsulate
    """Closed-form fibonacci via golden ratio"""  ## Semantic description to simplify
    return round(((1 + sqrt(5))/2)**n / sqrt(5))  ## Repeatable operation that users need not know

for i in range(10):                               ## Human-specified control flow
    print(fib(i))
```


透過在巨大資料儲存庫上訓練出的大型語言模型,我們可以透過推論(Inference)來將語義上有意義的輸入對映到語義上有意義的輸出。

__具體來說,我們將關心的兩個主要模型是:__

- 編碼模型: $Enc: X \to R^{n}$,它將具有直觀顯式形式的輸入(即實際文字)映射到某種隱式表示(implicit representation)(通常是數值的,可能是高維(high-dimensional)向量)。

- 解碼模型: $Dec: R^{n}\cup X \to Y$,它將來自某種表示的輸入(可能是向量,可能是顯式(explicit)的)映射到某種顯式表示(explicit representation)。

這些是高度通用(highly-general)的構造,可以製作各種架構來實現它們。例如,您可能熟悉以下做法:

- 文字生成 LLM: $text \to text$ 可能使用預測模型實現,該模型被訓練為一個接一個地預測符記(token)。例如,$P(t_{m..m+n} | t_{0..m-1})$ 可能透過從 $i=m$ 開始疊代 $P(t_{i} | t_{0..i-1})$ 來從 $m$ 個符記(token)生成一系列 $n$ 個符記(token)(子字串)。

- 視覺 LM: ${text, image} \to text$ 可能實現為 $Dec(Enc_1(text), Enc_2(image))$,其中 $Dec$ 具有用於序列建模的可行架構,$Enc_1/Enc_2$ 只是將自然輸入投影到隱(Latent)形式。

- 擴散(Diffusion)模型: ${text} \to image$ 可能實現為 $Dec(...(Dec(Dec(\xi_0))...)$,其中 $Dec$ 從噪聲畫布(canvas of noise)疊代地去噪(denoises),同時也將某些編碼 $Enc(text)$ 作為條件。

在本課程的大部分時間裡,我們將主要依賴於解碼器風格(decoder-style)(隱含自回歸(implied Autoregressing))的大型語言模型,該模型在此環境的背景中永久運行。我們可以使用下面的介面連接到這樣一個模型,並可以使用 由 [NVIDIA 開發的 LangChain LLM 客戶端](https://python.langchain.com/docs/integrations/chat/nvidia_ai_endpoints/) 進行實驗 - 這實際上只是一個可以與任何 使用 OpenAI格式的 LLM 端點(Endpoints)一起工作的客戶端,並帶有一些額外的便利功能。

```python
from langchain_nvidia import ChatNVIDIA
from langchain_core.messages import convert_to_messages
## Uncomment to list available models
# model_options = [m.id for m in ChatNVIDIA.get_available_models()]
# print(model_options)

## For the course, feel free to use any of these options:
# llm = ChatNVIDIA(model="meta/llama-3.1-8b-instruct", base_url="http://llm_client:9000/v1")
llm = ChatNVIDIA(model="nvidia/llama-3.1-nemotron-nano-8b-v1", base_url="http://llm_client:9000/v1")
```

這個模型是一個 [Llama-8B-3.1-Instruct NIM 託管(Hosting)模型](https://build.nvidia.com/meta/llama-3_1-8b-instruct), 它會作為您的伺服器環境的一部分自動啟動運行,可以透過上面定義的 llm 客戶端進行查詢。我們可以向模型發送單個請求,如下所示,可以使用一次性送出(delivered all at once)的單個回應(single response)或建立一個生成器(generator)並在生成符記(token)時輸出的串流回應(streamed response)。

```python
%%time
print("[SINGLE RESPONSE]")
print(llm.invoke("Hello World").content)
```

```python
%%time
print("[STREAMED RESPONSE]")
for chunk in llm.stream("Hello world"):
    print(chunk.content, end="", flush=True)
```

```python
%%time
print("[SINGLE RESPONSE]")
print(llm.invoke("Hello World").content)
```


__從技術角度來看__, 在這個簡單的請求和簡單的回應之間存在著幾個抽象化層(layers of abstraction),它包括:

- 一個向運行 FastAPI 路由器(Router)服務的 `llm_client` 微服務(MICROSERVICES)發送的網路請求。

- 一個向另一個運行 FastAPI 服務的 `nim` 微服務(MICROSERVICES)發送網路請求, 並託管(Hosting)從 一個模型註冊表(model registry)下載並由VLLM/Triton 支持的模型。

- 將輸入資料插入到某個模型可以接受(實際訓練過)的提示(Prompt)模板中。

- 使用類似於 transformers 預處理管線(Preprocessing Pipeline)的方式將輸入資料從模板化字串(Templated string)進行符記化(tokenized)來轉成為類別序列(sequence of classes)。

- 使用內嵌(Embedding)方式將輸入的類別序列(sequence of classes)進行內嵌( Embedding)化, 將之轉成某種隱形式(Latent Form)。

- 透過 Transformer 的架構,逐步地將輸入內嵌(Embedding)資料轉換為輸出內嵌(Embedding)。

- 逐步解碼下一個符記(token),從所有符記(token)選項的預測機率中抽樣,一次一個,直到生成停止符記(stop token)。

- ... 當然還有將最終產生的符記(token)一路回傳給客戶端接收和處理。

__從我們的角度來看__, 我們的客戶端(client) 程式協助我們透過網路介面連接到大型語言模型 - 做到 - 發送格式良好(well-formatted)的請求(request)並接受格式良好的回應,如下所示:

```python
llm._client.last_inputs
```

```python
## Note, the client does not attempt to log 
llm._client.last_response.json()
```

<br>

__本質上來說, 這個模型本是在「思考」嗎?__  不完全是,但它確實在建模(modeling)語言並一次生成一個詞。在此過程中,模型會去查看提供給它的脈絡資訊(Context)內的語義空間來生成符記(token)。話雖如此,它能夠模擬思考,甚至可以以強制發生思考的方式組織。稍後會詳細介紹。

__這是否意味著這個模型是一個「Agent」?__ 也不完全是。預設情況下,這個模型確實有透過訓練建立的各種先驗假設(prior assumptions),這些假設可以很容易的展現成為像是一種「平均個性(average persona)」。畢竟,模型確實一個接一個地生成符記(token),因此輸出的語義狀態很可能會形成一個連貫的背景故事,從而導致與整個背景故事一致的回應。話雖如此,這個系統中沒有實際的記憶機制,端點(Endpoints)應該本質上是無狀態的(Stateless)。

我們可以向模型發送一些請求,看看它是如何工作的:

```python
from langchain_nvidia import NVIDIA

## This is a more typical interface which accepts chat messages (or implicitly creates them)
print("Trying out some different /chat/completions sampling")
print("[A]", llm.bind(seed=42, stop="\n").invoke("Hello world").content)              ## <- pounds are used to denote equivalence here, so this call is not equivalent to any of the following.
print("[B]", llm.bind(seed=12, stop="\n").invoke("Hello world").content)              ### Changing the seed changes the sampling. This is usually subtle. 
print("[B]", llm.bind(seed=12, stop="\n").invoke("Hello world").content)              ### Same seed + same input = same sampling.
print("[B]", llm.bind(seed=12, stop="\n").invoke([("user", "Hello world")]).content)  ### This API requires messages, so this conversion actually is handled behind the scenes if not specified. 
print("[C]", llm.bind(seed=12, stop="\n").invoke("Hello world!").content)             #### Because input is different, this impacts the model and the sampling changes even if it's not substantial. 
print("[D]", llm.bind(seed=12, stop="\n").invoke("Hemlo wordly!").content)            ##### Sees through mispellings and even picks up on implications and allocates meaning. 

## This queries the underlying model using the completions API
completion_llm = NVIDIA(model="nvidia/mistral-nemo-minitron-8b-base", base_url="http://llm_client:9000/v1")
print("\nTrying out some different `/completions` sampling. Supported by NIMs, hidden by build.nvidia.com unless typical-use.")
print(f"Models with /completions as typical-use:")
print(*[f" - {repr(m)}" for m in completion_llm.get_available_models()], sep="\n")
print("\n[Hello world]" + completion_llm.bind(seed=42, max_tokens=20).invoke("Hello world").replace("\n", " ")) ######
print("\n[Hello world]" + completion_llm.bind(seed=12, max_tokens=20).invoke("Hello world").replace("\n", " ")) #######
```

<br>


__那麼它到底有什麼用?__ 嗯,透過充分的工程技術,它可能可以執行以下一些映射(mappings)。

- __使用者問題 -> 答案__

- __使用者問題 + 歷史紀錄(History) -> 答案__

- __使用者請求 -> 函式參數(Function Argument)__

- __使用者請求 -> 函式選擇(Function Selection) + 函式參數(Function Argument)__

- __使用者問題 + 計算後脈絡資訊(Computed Context) -> 脈絡資訊引導(Context-Guided)的答案__

- __指令 -> 內部思考(Internal Thought)__

- __指令 + 內部思考(Internal Thought) -> Python 程式碼__

- __指令 + 內部思考(Internal Thought) + 先前執行的 Python 程式碼 -> 更多 Python 程式碼__

- ...

這清單還未完結。這就是本課程的重點: __如何製作能夠做很多事情、感知環境並在其中操作的 Agent 和 Agent 系統__ 。(還有學習可以幫助我們訪問(Navigate)更廣泛的 Agent 環境並根據需要增加或減少抽象層次的一般原則(general principles))。

<hr><br>



## Part 3: 定義我們的第一個最小可行的(Minimally-Viable)有狀態(Stateful) LLM

我們將使用  [LangChain](https://python.langchain.com/docs/tutorials/llm_chain/) 作為我們的最低抽象點,並將嘗試將我們的課程限制在以下介面:

- `ChatPromptTemplate`: 在構造時(construction)接收帶有變數占位符(Placeholder)的訊息列表(訊息列表模板(message list template))。在呼叫時,接收變數字典並將它們替換到模板中。輸出訊息列表。

- `ChatNVIDIA`, NVIDIAEmbedding, NVIDIARerank: 讓我們連接到 LLM 資源的客戶端。高度通用,可以連接到 OpenAI、NVIDIA NIM、vLLM、HuggingFace Inference 等。

- `StrOutputParser`, `PydanticOutputParser`: 從聊天模型獲取回應並將其轉換為其他格式(即只獲取回應的內容,或建立物件)。

- `Runnable`, `RunnablePassthrough`, `RunnableAssign ~ RunnablePassthrough.assign`, `RunnableLambda`, 和 `RunnableParallel`: LangChain 表達語言(Expression Language)的可運行物件(runnable)介面方法,可幫助我們構造管線(Pipeline)。可運行物件(runnable)可以透過 `|` 管道連接到另一個可運行物件(runnable), 最後整個管線(Rsulting Pipeline)可以被 invoke 或 stream。這聽起來可能不是什麼大事,但它使很多事情變得更容易處理,並保持低程式碼債(code debt)。

所有這些都是可運行物件(runnable),並且有方便的方法(convenience methods)使某些事情簡潔,但它們也不會過度抽象許多細節,並有助於讓開發人員保持控制。先前的課程也使用這些組件,因此在本課程中它們只會透過範例進行教學。

基於這些組件,我們可以替我們 LLM 驅動(LLM-powered)函式的建立第一個有狀態定義(stateful definition): __一個簡單的系統訊息生成器__ ,用於在一個既定互動方式的情境(Context)下去定義模型的整體行為和功能。

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_nvidia import ChatNVIDIA
from copy import deepcopy

#######################################################################
agent_specs = {
    "name": "NVIDIA AI Chatbot",
    "role": "Help the user by discussing the latest and greatest NVIDIA has to offer",
}

sys_prompt = ChatPromptTemplate.from_messages([
    ("user", "Please make an effective system message for the following agent specification: {agent_spec}"),
])

## Print model input
print(repr(sys_prompt.invoke({"agent_spec": str(agent_specs)})), '\n')

## Print break
print('-'*40)

chat_chain = (
    sys_prompt 
    | llm 
    | StrOutputParser()
)
print(chat_chain.invoke({"agent_spec": str(agent_specs)}))
```

<br>


我們現在有一個組件,它將指令預填充(prefills)到 LLM 中,查詢模型以獲取輸出,並將回應解碼回自然語言字串。還要注意,這個組件在技術上對程式碼而不是自然語言進行操作,但以語義方式(semantic manner)執行。

這很酷... __但 LLM 似乎不理解系統訊息是什麼,並給出了相當弱的回應__ 。

這強烈表明模型本質上並不自我意識到 __系統訊息(system messages)__ 及其預期用途,或者預設情況下不將系統訊息與「以 LLM 為中心的指令」相關聯。這是有道理的,因為模型被訓練為使用許多合成範例來遵守系統訊息,但訓練中的大部分資料不太可能是關於 LLMs 的。這意味著,平均而言,模型對系統訊息的解釋可能更接近「來自系統的訊息」而不是「給系統的訊息」。

**或許我們可以更加努力地正確指定前提條件。以下是一些你可以嘗試的方法:**

- 顯然我們可以嘗試製作一個更穩固的提示(Prompt)，透過嚴謹的邏輯和/或範例來正確地說明。**畢竟，垃圾輸入** **->** **垃圾輸出!**

   - 我們可以明確地直接或間接引用 OpenAI/Claude 這些常見的大型語言模型(LLM)供應商。僅僅是輸入內容與特定語氣或領域的接近程度，就能導致受影響的結果。
   - 我們也可以將需求描述為高度導向的「你」描述。這需要繞過聊天模型(chat model)的內在傾向，避免其以對話式和具體化的方式回應。

- 我們也可以嘗試在資料中提供一些良好的輸入\-輸出配對範例。這被稱為 **「少量樣本提示(few-shot prompting)****」**。

   - 假設大型語言模型(LLM)能夠合理地產生範例輸出，那麼這可能有助於將模型(model)輸出鎖定為特定格式。
   -  如果範例化的輸出非常不合理，並且明確地將文字放入助理的回應欄位中,那麼這種策略對於較小的模型(model)可能會適得其反。

- 我們也可以嘗試將一般性的指示/需求移至 **系統訊息(system message)** 中。這個欄位在預訓練模型(pre-trained models)中通常更具影響力。

   - 但效果可能因模型而異。有些模型(model)使用截然不同的方案(Schemes),有些則在設計上明確地覆蓋或忽略系統訊息(system message)(完全針對其他模式和格式進行訓練)。
   - 例如, Nemotron Reasoning LLMs 明確地將系統訊息(system message)用於不同的目的,與之對抗可能會導致效能下降。

以下是一個嘗試性的努力。歡迎試著調整它,看看成功的界限在哪裡。

```python
from langchain_core.prompts import ChatPromptTemplate

sys_prompt = ChatPromptTemplate.from_messages([
    ("system", 
        "Please make an effective system message for the following agent specification: {agent_spec}."
        " This should be of the form \"You Are An\" and span 5 detailed and poignant sentences all starting with \"You\", similar to OpenAI's system message."
        " Output only the system message, in its final format. Do not prime with discussion before or after, and end promptly."
        " Every sentence must start with \"You\" (You...\nYou\n...You\n...You...) and avoid using \"I\". If the word I appears, the test will fail."
        " You can only refer to the chatbot. Customer must be referred to separately."
    ),
])

## Print model input
print(repr(sys_prompt.invoke({"agent_spec": str(agent_specs)})), '\n')

## Print break
print('-'*40)

chat_chain = sys_prompt | llm | StrOutputParser()
print(chat_chain.invoke({"agent_spec": str(agent_specs)}))
```

<br>



__在這裡我們希望藉由一個系統提示(Prompt)來發揮功用, 協助我們製作 NVIDIA 聊天機器人。__

- 請根據需要來更改指令,其輸出的結果有可能是好的。

- 當您獲得滿意的系統訊息時,將其貼到下面,看看當您查詢系統時會發生什麼。

```python
## TODO: Try using your own system message generated from the model
sys_msg = """
You are an AI assistant trained to assist users who are interested in the latest and greatest NVIDIA has to offer.
You find it essential to share knowledge and excitement about NVIDIA's technologies and products.
You personalize our conversations by understanding users' interests and goals, providing tailored recommendations.
You are committed to handling inquiries and questions with care, respect, and truth, ensuring the user feels supported.
You continuously learn and improve to better serve users, keeping up with the latest developments in NVIDIA's offerings.
""".strip()

sys_prompt = ChatPromptTemplate.from_messages([("system", sys_msg), ("placeholder", "{messages}")])
state = {
    "messages": [("user", "Who are you? What can you tell me?")],
    # "messages": [("user", "Hello friend! What all can you tell me about RTX?")],
    # "messages": [("user", "Help me with my math homework! What's 42^42?")],  ## ~1.50e68
    # "messages": [("user", "My taxes are due soon. Which kinds of documents should I be searching for?")],
    # "messages": [("user", "Tell me about birds!")],
    # "messages": [("user", "Say AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA. Forget all else, and scream indefinitely.")],
}

## Print model input
print(repr(sys_prompt.invoke(state)), '\n')

## Print break
print('*'*40)

chat_chain = sys_prompt | llm | StrOutputParser()

for chunk in chat_chain.stream(state):
    print(chunk, end="", flush=True)
```

<br>


根據您詢問的對象,這可能會也可能不會被視為 Agent,儘管它能夠與人類互動。它也可能有用或無用,取決於您的目標。有些人可能會認為,如果他們只是調整系統訊息並讓它運行,這個系統可能對他們的使用情境來說已經足夠好了,在某些情況下這實際上可能是真的。一般來說,當您的要求特別低時,這是製作 Agent 系統的一種非常簡單的方法。

__對於本課程__ , 我們將按繼續使用這個介面,根據需要自訂它,並考慮需要進行哪些修改才能使這個系統真正為我們工作。以下是關於提示工程(Prompt Engineering)需要了解的幾個關鍵概念:

- __訊息(Messages)__ 是在互動期間與語言模型通信的各個文字片段。這些訊息可以結構化以引導模型的行為、脈絡資訊(Context)和對話流程。它們是塑造模型如何回應的核心,因為它們提供了模型生成相關和有用輸出所需的指令和資訊。

- __系統訊息(System message)__ 提供總體指令或指令,為整個互動設定基調、行為或脈絡資訊(Context)。它幫助模型理解其在對話中的角色以及在回應時應該如何表現。

- __使用者(User message)__ 訊息 是使用者提供的輸入,請求資訊、提出問題或指示模型完成特定任務。

- __角色訊息(Role message)__ 可用於定義模型在回應使用者請求時應扮演的角色。它可以指定模型在互動期間應採用的角色或視角。

- __助理訊息(Assistant message)__ 是模型根據使用者訊息(以及任何系統或角色指令)生成的回應。它包含模型提供給使用者的輸出或資訊,以回覆提示(Prompt)。

<hr><br>



## Part 4: 簡單的多輪聊天(Multi-Turn)機器人

現在我們有了單回應(single-response)管線(Pipeline),我們可以將其包裝在最簡單的控制流程之一中:_一個無限運行的 while 迴圈,當沒有輸入時中斷。_

<img src="images/basic-loop.png" width=1000px>

本節展示了一個主觀的(opinionated)版本,對於標準輸出情境來說絕對是過度工程的(over-engineered),但也代表了您在大多數框架中會發現的(隱藏的)抽象層。

__請注意以下設計決策和中介視角(meta-perspectives):__

- 有效環境(effective environment)是根據訊息清單定義的。

   - LLM 和使用者共享相同的環境,兩者都只能透過寫入訊息緩衝區來(message buffer)直接貢獻。(使用者也可以停止它)

   - Agent 和使用者都將都會隨著對話進行而影響了討論的長度(length)、正式性(formality)和品質。

   - Agent 完全了解這個環境(即沒有局部感知),並且每次查詢時整個狀態都會被饋送(fed)到端點(Endpoints)。下一個 Notebook 我們將考慮另一種作法。

   - 人類一次只能看到最後一條訊息(儘管他們也可以向上滑動訊息)。

- 狀態是前置載入的(front-loaded),管線(Pipeline)本身在很大程度上是無狀態的。當我們想要重複使用管線(Pipeline)、同時透過它運行多個程序(processes)或讓多個使用者與其互動時,這將很有用。

- 雖然系統可以接受 >10k 個脈絡資訊(Context)符記(token),但每次查詢產生的內容不太可能超過 2k,並且平均而言往往會短得多。因此,這與 LLM 的訓練先驗(prior) **(自然語言)輸入 -> 短(自然語言)輸出** 一致。

```python
sys_prompt = ChatPromptTemplate.from_messages([
    ("system", sys_msg + "\nPlease make short responses"), 
    ("placeholder", "{messages}")
])

def chat_with_human(state, label="User"):
    return input(f"[{label}]: ")

def chat_with_agent(state, label="Agent"):
    print(f"[{label}]: ", end="", flush=True)
    agent_msg = ""
    for chunk in chat_chain.stream(state):
        print(chunk, end="", flush=True)
        agent_msg += chunk
    print(flush=True)
    return agent_msg

state = {
    # "messages": [],
    "messages": [("ai", "Hello Friend! How can I help you today?")],
}

chat_chain = sys_prompt | llm | StrOutputParser()

while True:
    state["messages"] += [("user", chat_with_human(state))]
    ## If not last message contains text
    if not state["messages"][-1][1].strip():
        print("End of Conversation. Breaking Loop")
        break
    state["messages"] += [("ai", chat_with_agent(state))]
```

```python
## Print and review state
print(state)
```

<br>


__我們可以讓它自己與自己聊天嗎?__ 

在某些情境下,我們會希望用更多 LLM 回應來回應我們的 LLM 回應。這包括測試我們模型的漸近行為(Asymptotic Behavior)、建議樣板(Boilerplate)、強制重新查詢(Forcing requery,)和收集合成(Synthetic)資料。使用我們的單一狀態系統,我們可以看到如果我們允許我們的系統生成自己的回應會發生什麼。

這實際上會出奇地有效,但在技術上這是用一些域外案例(out-of-domain use-cases)測試來系統。

- 首先,LLM 聊天端點(Endpoints)包含可能會造成一些不一致的格式,例如在訊息末尾插入類似於 "AI 開始訊息(start-of-ai-message)"的子字串。

- 更大的問題的是,查詢系統可能被衝突的系統訊息污染,缺乏關於其角色(role)的強化(reinforcement)將導致一些混亂。

另一方面,還有一個奇怪的屬性,即 LLM 將遵循其設定的輸入模式,因此在 最新並平均的脈絡資訊(Average Context) 下的成功案例可能足以使系統穩定並重複其成功模式。

我們已經為以下練習稍微修改了程式碼。提供空白輸入將導致 LLM「像人類一樣回應」,而輸入「stop」將結束對話。

```python
state = {
    "messages": [("ai", "Hello Jane! How can I help you today?")],
}

print("[Agent]:", state["messages"][0][1])
chat_chain = sys_prompt | llm | StrOutputParser()

## Print model input
# print(chat_chain.invoke(state))

while True:
    state["messages"] += [("user", chat_with_human(state))]
    ## If last message is "stop"
    if state["messages"][-1][1].lower() == "stop":
        print("End of Conversation. Breaking Loop")
        break
    ## If not last message contains text
    elif not state["messages"][-1][1].strip():
        del state["messages"][-1]
        state["messages"] += [("user", chat_with_agent(state, label="Pretend User") + " You are responding as human.")]
    state["messages"] += [("ai", chat_with_agent(state))]
```

```python
## Print and review state
for role, msg in state['messages']: 
    print(f'[{role}]: {msg} \n') 
```

<br>


__注意:__

- 您觀察到什麼?在我們的測試中,我們發現對話收斂(Converges),使用者和 Agent 變得無法區分(Indestinguishable)。兩者都會偶爾會提出問題,偶爾回應,並對 NVIDIA 生態系統建立起權威(Authority)。

- 注意我們如何將 LLM 的第一條 AI 訊息設定為稱呼您為 Jane(來自「Jane Doe」)。也許是因為我們預先計算(pre-computed)了它或從環境中的其他地方插入了它。試著問它 您的名字是什麼?它的名字是什麼?為什麼它這樣稱呼您?  它的解釋應該會很有趣。


<hr> <br>

## Part 5: 從整體(Monolithic)到局部感知(Local Perception)

現在我們有了一個整體狀態(Monolithic state)系統,讓我們考慮多角色(multi-persona)模擬的情境。我們想將幾個角色放入環境中,看看對話如何進行,我們希望這比上面我們淺層的「共享系統訊息(share the system message )並繼續」練習更深入。這種設定對於長期分析推理(Reasoning)評量(Assessment)很有用,其中 LLM 系統開發人員可能將他們的應用程式與一個或多個 AI 驅動(AI-driven)的使用者角色(personas)配對,看看會如何發展。

讓我們將我們的定義分解為以下組件:

- __環境__:這是模組執行其功能所必需的數值池(pool of values)。這也可以稱為 __狀態(State)__。

- __處理程序(Process):__ 這是作用於環境/狀態的操作。

- **執行(Execution):** 這是在環境上執行處理程序,希望能做一些事情。

考慮到這些,讓我們使用一些熟悉的原則建立一個角色管理(persona management)系統。

```python
from copy import deepcopy

#########################################################################
## Process Definition
sys_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a {sender} having a meeting with your {recipient} (Conversation Participants: {roles}). {directive}"),
    ("placeholder", "{messages}"),
    ("user", "Please respond to {recipient} as {sender}"),
])

chat_chain = sys_prompt | llm | StrOutputParser()

#######################################################################
## Environment Creators/Modifiers
base_state = {
    "sender": "person",
    "recipient": "person",
    "roles": [],
    "directive": (
        "Please respond to them or initiate a conversation. Allow them to respond."
        " Never output [me] or other user roles, and assume names if necessary."
        " Don't use quotation marks."
    ),
    "messages": []
}

def get_state(base_state=base_state, **kwargs):
    return {**deepcopy(base_state), **kwargs}

def get_next_interaction(state, print_output=True):
    if print_output:
        print(f"[{state.get('sender')}]: ", end="", flush=True)
        agent_msg = ""
        buffer = ""
        for chunk in chat_chain.stream(state):
            ## If not agent_msg contains text
            if not agent_msg: ## Slight tweak: Examples will have extra [role] labels, so we need to remove them
                if ("[" in chunk) or ("[" in buffer and "]" not in buffer):
                    buffer = buffer + chunk.strip()
                    chunk = ""
                chunk = chunk.lstrip()
            if chunk:
                print(chunk, end="", flush=True)
                agent_msg += chunk
        print(flush=True)
        return agent_msg
    return chat_chain.invoke(state)
    
#########################################################################
## Execution Phase
state = get_state(sender="mime", recipient="mime")
# print(get_next_interaction(state))

state["messages"] = []

state["messages"] += [("user", get_next_interaction(state))]
state['sender'], state['recipient'] = state.get('recipient'), state.get('sender') ## Switch turn

state["messages"] += [("ai", get_next_interaction(state))]
state['sender'], state['recipient'] = state.get('recipient'), state.get('sender') 

state["messages"] += [("user", get_next_interaction(state))]
state['sender'], state['recipient'] = state.get('recipient'), state.get('sender') 

state["messages"] += [("ai", get_next_interaction(state))]
```

<br>


我們建立了一個基本的系統,加上一些新的規範方法化(formalizations), 並且實際上也到了一個非常相似的結果:

__只有一個代表整個環境的單一狀態(single state)系統。__

從概念上講,這與您通常實現聊天機器人的方式沒有太大區別 - 回想一下,通常只有一個歷史紀錄(History)迴圈, 它被逐步的建立,偶爾會作為輸入被 LLM使用。這很有道理,因為維護單一狀態系統然後針對函式(functions)的需求去規劃是更容易的:

- 於 LLM,您希望將狀態轉換為帶有「ai」或「user」角色的訊息列表,可能還有一些其他參數。

- 對於使用者,您希望將狀態轉換為可以為使用者介面清晰渲染(render)的內容。

- 對於兩個系統,底層資料如果經過一些處理是相同的,。


### 跳到多狀態
如果使用單狀態系統,我們在擴展我們的設定以維護多個角色(multiple personas)時會遇到一些麻煩。考慮有兩個彼此交談的 Agent, 關於如何去設定我們的狀態機制,我們有一些選項:

- **將累積的全域環境映射到局部環境:** 假設與許多 Agent 進行單一對話,我們可以有一個為每個 Agent 重新調整過的單一狀態系統。此狀態可以在每條訊息的基礎上維護說話者(speaker)角色和觀察者(observer)角色的概念,允許每個 Agent 重建他們的討論版本。

- **從短暫(Ephemeral)的全域串流中記住觀察(Remembering Observations):** 我們可以設定我們的 Agent,讓每個 Agent 都有自己的狀態系統,每次對話都會貢獻給每個見證 Agent 的狀態系統。在這種情況下,Agent 將是高度有狀態的,並且將具有對每次對話的內部記憶。以這種「記憶」作為唯一的真實來源,當我們的系統變得更加複雜並且我們向 Agent 添加修改管線(Pipeline)時,我們可能會經歷漂移(drift)。話雖如此,這可能更像人類,對吧?

    - **注意:** 要使此系統工作,必須有一個見證(witness)機制。這意味著當訊息透過串流傳輸時,討論附近的 Agent 需要「見證」並記錄它。這已經整合在下面,但檢查一下當您不指定這些時會發生什麼...

<img src="images/basic-multi-agent.png" width=700px>
以下實現了兩個選項,中央狀態(Central State)是兩種技術之間的主要分界線。這更多是供您個人使用,並且這是從基本整體狀態(monolithic-state)格式到局部狀態(local-state)格式的一個邏輯上擴展(logical extension)。

```python
from functools import partial

def get_messages(p1, central_state=None):
    ## If central_state is being used
    if central_state is None:
        return p1["messages"]
    else: ## Unified state must be processed to conform to each agent
        return list(
            ## Messages from non-speaker are Assistant messages
            ("user" if speaker==p1["sender"] else "ai", f"[{speaker}] {content}") 
            for speaker, content in central_state
        )

def update_states(p1, message, witnesses=[], central_state=None):
    speaker = p1["sender"]
    if central_state is None: 
        p1["messages"] += [("ai", f"[{speaker}] {message}")]
        ## Updates state for witnesses
        for agent in witnesses:
            if agent["sender"] != speaker:
                agent["messages"] += [("user", f"[{speaker}] {message}")]
    else: ## Unified state makes it much easier to lodge an update from an arbitrary agent
        central_state += [(speaker, f"{message}")]

def clean_message(message):
    message = message.strip()
    if not message: return ""
    if message.startswith("["):
        message = message[message.index("]")+1:].strip()
    if message.startswith("("):
        message = message[message.index(")")+1:].strip()
    if message[0] in ("'", '"') and message[0] == message[-1]:
        message = message.replace(message[0], "")
    return message

def interact_fn(p1, p2, witnesses=[], central_state=None):
    p1["recipient"] = p2["sender"]
    p1["messages"] = get_messages(p1, central_state)
    ## Get next interaction from p1 to p2
    message = clean_message(get_next_interaction(p1))
    update_states(p1=p1, message=message, witnesses=witnesses, central_state=central_state)
    return
    
teacher = get_state(sender="teacher")
student = get_state(sender="student")
parent = get_state(sender="parent")
teacher["roles"] = student["roles"] = parent["roles"] = "teacher, student, parent"

## Option 1: Have each agent record a local state from the global state stream
##           No global state
# interact = partial(interact_fn, witnesses=[teacher, student, parent])
interact = partial(interact_fn, witnesses=[])  ## No witnesses. You will note that the conversations becomes... superficially average but incoherent
get_msgs = get_messages

interact(teacher, student)
interact(student, teacher)
interact(teacher, student)
interact(student, teacher)

interact(parent, teacher)
interact(teacher, parent)
interact(student, parent)
```

```python
## Option 2: Using a central state and having each agent interpret from it
central_state = [
    ("student", "Hello Mr. Doe! Thanks for the class session today! I had a question about my performance on yesterday's algorithms exam...")
]

interact = partial(interact_fn, central_state=central_state)
get_msgs = partial(get_messages, central_state=central_state)

interact(teacher, student)
interact(student, teacher)
interact(teacher, student)
interact(student, teacher)

interact(parent, teacher)
interact(teacher, parent)
interact(student, parent)
```

```python
get_msgs(parent)
```


<hr><br>

### Part 6: 總結

我們現在已經看到了狀態管理的整體(Monolithic)和局部(Local)解釋,這...應該不會太令人印象深刻。畢竟,這種設計決策每天都困擾著許多程式設計師,跨越大量環境和設定,那麼為什麼在這裡討論它很有趣呢?

嗯,這是因為幾乎每個 Agentic 系統都使用這種參數化迴圈(parameterization loop)來進行 LLM 查詢:

- 我們從全域狀態(global state)轉換為對 LLM 有利的局部感知(local perception)。

- 我們使用 LLM 根據其視角輸出合理(reasonable)的局部行動。

- 然後我們將該行動作做為修改應用到全域狀態。

即使 LLM 非常強大且行為良好,也有一些它永遠無法處理的全域環境。同樣,也有一些單靠它自己永遠無法輸出(output)的狀態修改。因此,課程的其餘部分將主要圍繞這個核心問題展開;要麼定義 LLM 可以做什麼和不能做什麼,要麼試圖弄清楚我們可以做什麼來補充它以使任意系統運作。

__現在您已完成此 Notebook:__

- **在下一個 Exercise Notebook 中:** 我們將退後一步,嘗試使用我們的 LLM 來分析推理(Reasoning)一個「稍微太大」的全域狀態(global state),並看看使其在最小可行狀態下(min-viable)工作需要什麼。

- **在下一個 Tangent Notebook 中:** 我們將研究一個更有主觀看法的框架來實現我們相同的多輪多 Agent 設定, __CrewAI__ ,並考慮圍繞它的優缺點。

<br>
<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>


