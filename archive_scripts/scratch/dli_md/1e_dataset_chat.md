<br>
<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>
</a>
<h1 style="line-height: 1.4;"><font color="#76b900"><b>使用大型語言模型(LLM)建構 Agentic AI 應用程式</h1>
<h2><b>練習 1:</b> 基於資料集的對話</h2>
<br>





__歡迎回來!這是課程中的第一個練習,讓我們看看您能做些什麼!__

本 Notebook 作為「主要課程」Notebook 之後的實作練習。本系列的練習使用相同的資料集,逐步幫助我們實現更複雜的大型語言模型(LLM)互動。

在先前的 Notebook 中,我們實作了一個基本的多 Agent 系統來生成(Generative)合成的(synthetic)多輪(multi-turn)對話。雖然對於生成(Generative)人工對話很有用,但此實作對於終端使用者應用程式並沒有實用性。

### 學習目標:

__在本 Notebook 中,我們將:__

- 建構一個簡單的面向使用者的聊天機器人,與資料集進行互動。

- 解決處理資料集過大而無法放入模型脈絡資訊(Context)視窗的挑戰。

- 開發一個總結用(summarization)的管線(Pipeline)來有效地預處理資料。

此資料集將在整個課程中持續使用,因此我們的第一步是實現與其進行簡單的互動式聊天。

<hr><br>

### 第 1 部分: 設定工作坊助理聊天機器人

從先前的練習中,您可以指定一個簡單的聊天機器人,使用簡單的迴圈與使用者互動。基於此,以下函式(function)建立了一個簡單的聊天機器人迴圈,使用者可以與 AI Agent 互動。如果沒有提供處理函式(function)(鏈(Chain)),它預設為一個並未被實作(unimplemented)的生成器(generator),輸出占位符(Placeholder)訊息。

```python
from time import sleep

def not_implemented_gen(state):
    """A placeholder generator that informs users the chain is not yet implemented."""
    message = "Chain Not Implemented. Enter with no inputs or interrupt execution to exit."
    for letter in message:
        yield letter
        sleep(0.005)

def chat_with_chain(state={}, chain=not_implemented_gen):
    """
    Interactive chat function that processes user input through a specified chain.
    
    Parameters:
        state (dict): Maintains chat history and context.
        chain (callable): Function to generate responses based on the chat history.
    """
    assert isinstance(state, dict)
    state["messages"] = state.get("messages", [])
    while True:
        try:
            human_msg = input("\n[Human]:")
            if not human_msg.strip(): break
            agent_msg = ""
            state["messages"] += [("user", human_msg)]
            print(flush=True)
            print("[Agent]: ", end="", flush=True)
            for token in getattr(chain, "stream", chain)(state):
                agent_msg += token
                print(getattr(token, "content", token), end="", flush=True)
            state["messages"] += [("ai", agent_msg)]
        except KeyboardInterrupt:
            print("KeyboardInterrupt")
            break

## Initialize chat with the placeholder generator
chat_with_chain()
```

<br>



從這裡,我們可以使用大型語言模型(LLM)、提示(Prompt)模板和起始狀態(starting state)定義一個對話管線(Pipeline)。已提供提示(Prompt)、大型語言模型(LLM)和輸出解析器(parser),因此請將它們組合成一個鏈(Chain)用於您的 `chat_with_chain` 函式(function):

```python
from langchain_nvidia import ChatNVIDIA
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from functools import partial

## Define an NVIDIA-backed LLM
# llm = ChatNVIDIA(model="meta/llama-3.1-8b-instruct", base_url="http://llm_client:9000/v1")
llm = ChatNVIDIA(model="nvidia/llama-3.1-nemotron-nano-8b-v1", base_url="http://llm_client:9000/v1")

## Define a structured prompt
sys_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a helpful assistant for NVIDIA Deep Learning Institute (DLI). "
     "Assist users with their workshop-related queries using the provided context. "
     "Do not reference the 'context' as 'context' explicitly."),
    ("user", "<context>\n{context}</context>"),
    ("ai", "Thank you. I will not restart the conversation and will abide by the context."),
    ("placeholder", "{messages}")
])

## Construct the processing pipeline
chat_chain = sys_prompt | llm | StrOutputParser()

## Initialize chatbot state
state = {
    "messages": [("ai", "Hello! I'm the NVIDIA DLI Chatbot! How can I help you?")],
    "context": "",  # Empty for now; will be updated later
}

## Wrap function to integrate AI response generation
chat = partial(chat_with_chain, chain=chat_chain)

## Start the chatbot with the AI pipeline
chat(state)
```



<hr><br>

### 第 2 部分: 引入一些脈絡資訊(Context)

對於本課程,我們將從使用 GTC 2025 研討會的工作坊目錄(workshop catalog)小型資料集開始。這包括真實的工作坊選集,每個工作坊都是獨立提出的,並且詳細程度各不相同。這應該讓人想起有機累積(organically-accumulated)的資料池(datapool)... 部分原因是它本身就是一個有機累積(organically-accumulated)的資料池。資料可以在 [gtc-data-2025.csv](./gtc-data-2025.csv) 中找到,所以讓我們繼續將其載入為列表!

```python
import pandas as pd
import json

## Load dataset
filepath = "gtc-data-2025.csv"
df = pd.read_csv(filepath)

## Convert to JSON for structured processing
raw_entries = json.loads(df.to_json(orient="records"))

## Display the first few records
raw_entries[:4]
```

<br>



我們可以快速將它們處理成更自然的格式,然後嘗試將它們串聯在一起以為我們的模型建立一個可行的(viable)「脈絡資訊(Context)字串」。在真實工作流程中,建立脈絡資訊(Context)的自動化對於增強(Augmentation)大型語言模型(LLM)相當常見(popular),所以沒有理由不在這裡這樣做。

```python
def stringify(entry, description_key='description'):
    """Formats workshop details into a human-readable string."""
    return (
        f"{entry.get('name')}\n"
        f"Presenters: {entry.get('instructors')}\n"
        f"Description: {entry.get(description_key)}"
    )

## Convert dataset entries to structured text
raw_blurbs = [
    f"[Session {i+1}]\n{stringify(entry)}" 
    for i, entry in enumerate(raw_entries)
]

## Construct full context string
raw_context = "The following workshops are slated to be presented at NVIDIA's GTC 2025 Conference:\n\n"
raw_context += "\n\n".join(raw_blurbs)

## Display context statistics
print(f"Full Context Length (characters): {len(raw_context)}")
print("-"*40)
print(raw_context[:2000])  # Preview the first portion
```

```python
## Using your previous abstraction, pass the context into your prompt and see if it works:
## TODO: Initialize your state based on your opinionated chat chain
state = {}

try:
    ## TODO: Perform the conversation with your long context (it's ok if it fails)
    pass
except Exception as e:
    print(e)
```


<details><summary><b>提示</b></summary>

回想一下,我們只有一個 chat 函式(function),它包裝了一個可重複使用的鏈(Chain)。所以我們只需要使用 `chat(state)` 來 `invoke` (調用)它以處理某個 `state` 。然後,我們只需要弄清楚應該在我們的提示(Prompt)中放入什麼內容。重溫您的記憶:

```python
prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a helpful instructor assistant for NVIDIA Deep Learning Institute (DLI). "
     "Assist users with their course-related queries using the provided context. "
     "Do not reference the 'context' as 'context' explicitly."),
    ("user", "<context>\n{context}</context>"),
    ("ai", "Thank you. I will not restart the conversation and will abide by the context."),
    ("placeholder", "{messages}")
])

```
</details> <details><summary><b>解決方案</b></summary>

鑑於我們的提示(Prompt)預期接收一個字典,其中包含一個 `context`(可解釋為字串)和 `messages`(可解釋為訊息清單,如 `[("user", "Hello World")]`),我們可以在沒有訊息歷史紀錄(History)的情況下初始化我們的提示(Prompt),並將 `raw_context` 作為我們的脈絡資訊(Context)。

```python
state = {"messages": [], "context": raw_context,}
try:
    chat(state)
except Exception as e:
    print(e)

```


</details> <br>

這可能不起作用,而且有充分的理由。該模型以 `2^13 = 8192` 個符記(token)的最大脈絡資訊(Context)啟動,而當前脈絡資訊(Context)可能有點太長了。讓我們使用這個模型的[符記器(tokenizer)](https://huggingface.com/unsloth/Meta-Llama-3.1-8B-Instruct/blob/main/tokenizer.json)來驗證它。

```python
from transformers import PreTrainedTokenizerFast

llama_tokenizer = PreTrainedTokenizerFast(tokenizer_file="tokenizer.json", clean_up_tokenization_spaces=True)

def token_len(text):
    """Counts token length of given text."""
    return len(llama_tokenizer.encode(text=text))

print(f"String Length of Context: {len(raw_context)}")
print(f"Token Length of Context: {token_len(raw_context)}")

## Preview context
print(raw_context[:2000])
```

<br>


__您可能會想「大多數模型不是都有更長的脈絡資訊(Context)嗎」,您是對的,但有幾個關鍵注意事項:__

- 使用 API 服務,您仍然需要為符記(token)付費,所以也許擁有一個長的靜態脈絡資訊(Context)並不是最好的主意?

- 即使支援您的脈絡資訊(Context)長度,隨著輸入(Intake)變長,大多數模型仍然會經歷一定程度的品質下降。此外,更多輸入(Intake) = 更多衝突資料和文字(Text)結構的機會。

- 對於任意文件甚至文件池(document pool),您可能會發現自己經常會使用到最大脈絡資訊長度(Max Context)。即使模型對於此資料集來說是足夠的,它對於資料庫仍然能正常運作嗎?

在我們的情況下,我們正在處理各種詳細程度和品質的課程描述樣本,這些描述累積成一個大型的不一致(inconsistent)資料(Entries)池:

```python
import matplotlib.pyplot as plt
import numpy as np

sorted_raw_blurbs = sorted(raw_blurbs, key=token_len)

def plot_token_len(entries, color="green", alpha=1, len_fn=token_len):
    """Plots token lengths of all entries."""
    plt.bar(x=range(len(entries)), height=[len_fn(v) for v in entries], width=1.0, color=color, alpha=alpha)

plot_token_len(sorted_raw_blurbs, color="green")
plt.xlabel("Entry Sample Number")
plt.ylabel("Token Length")
plt.show() 

print("SHORTEST ENTRIES:")
sample_blurbs = sorted_raw_blurbs[:3] + sorted_raw_blurbs[-3:]

for entry in sample_blurbs:
    print(entry, "\n")
```



<hr><br>

### 第 3 部分: 總結我們的長脈絡資訊(Context)

也許我們可以將每個資料(Entries)轉換為更短且更統一的內容?也許作為預處理步驟,我們可以將所有這些資料(Entries)處理成更一致的形式。這不僅有助於我們的模型對完整脈絡資訊(Context)進行分析推理(Reasoning),而且我們還能夠利用資料(Entries)的統一性質來提高提示(Prompt)的一致性。

```python
%%time
## TODO: Create a symmary system message to instruct the LLM.
## Reuse the chat_chain as-it-was, remembering that it expects "messages" and "context"
summary_msg = (
    "Summarize the presentation description down to only a few important sentences."
    " Start with '(Summary) '"
    ## Feel free to customize
)

def summarize(context_str, summary_msg=summary_msg):
    return "(Summary) No summary"

print(summarize(stringify(raw_entries[1])))
```

<br>


<details><summary><b>解決方案</b></summary>

```python
return chat_chain.invoke({
    "messages": [("user", summary_msg)],
    "context": context_str
})
```


 </details> <br>


它是自然語言,不需要格式良好,但我們可以充分地對其進行提示工程(Prompt Engineering)以實現簡單的文字(Text)到文字(Text)轉換函式(transformation function)。我們還可以使用 LangChain 批次處理功能來大大簡化我們的並行執行(concurrency)管理:

```python
%%time
from langchain_core.runnables import RunnableLambda
from tqdm.auto import tqdm
import threading

batch_inputs = [stringify(entry_dict) for entry_dict in raw_entries]

## Simple version of a batched process. No progress bar
# summaries = RunnableLambda(summarize).batch(batch_inputs, config={"max_concurrency": 20})

## Modified version which also has progress bars! Marginally-slower, same backbone
def batch_process(fn, inputs, max_concurrency=20):
    lock = threading.Lock()
    pbar = tqdm(total=len(inputs))
    def process_doc(value):
        try:
            output = fn(value)
        except Exception as e: 
            print(f"Exception in thread: {e}")
        with lock:
            pbar.update(1)
        return output
    try:
        lc_runnable = fn if hasattr(fn, "batch") else RunnableLambda(process_doc)
        return lc_runnable.batch(inputs, config={"max_concurrency": max_concurrency})
    finally:
        pbar.close()

summaries = batch_process(summarize, batch_inputs)
```

```python
summaries[:5]
```

<br>


現在我們有了這個新的總結(summary),我們可以看看當我們使用這個合成綜合結果(Synthesis)描述而不是原始描述時會發生什麼,並考慮我們的脈絡資訊(Context)長度如何減少。

```python
#############################################################################
## Defined Earlier

# def stringify(entry, description_key='description'):
#     return (
#         f"{entry.get('name')}"
#         f"\nPresentors: {entry.get('instructors')}"
#         f"\nDescription: {entry.get(description_key)}"
#     )

## Defined Earlier
#############################################################################

for summary, pres_entry in zip(summaries, raw_entries):
    words = summary.split()
    ## Remove "summary" or "(summary)" from text
    if "summary" in words[0].lower():
        words = words[1:]
    pres_entry["summary"] = " ".join(words)

print(stringify(raw_entries[0], "summary"))
raw_entries[0]
```

```python
import matplotlib.pyplot as plt
import numpy as np

contexts_with_summaries = [stringify(entry, "summary") for entry in raw_entries]
contexts_with_descripts = [stringify(entry) for entry in raw_entries]

def plot_token_len(entries, color="green", alpha=1, len_fn=token_len):
    plt.bar(x=range(len(entries)), height=[len_fn(v) for v in entries], width=1.0, color=color, alpha=alpha)    

## Create arrays of the token lengths
sorted_summs = [v for _,v in sorted(zip((token_len(x) for x in contexts_with_summaries), contexts_with_summaries))]
sorted_origs = [v for _,v in sorted(zip((token_len(x) for x in contexts_with_descripts), contexts_with_descripts))]
aligned_summs = [v for _,v in sorted(zip((token_len(x) for x in contexts_with_descripts), contexts_with_summaries))]
plot_token_len(sorted_origs, alpha=0.6, color="green")
plot_token_len(sorted_summs, alpha=0.6, color="grey")
## Lightgreen bars represent the new context length for their respective original green bars
plot_token_len(aligned_summs, alpha=0.6, color="lightgreen")
plt.xlabel("Entry Sample")
plt.ylabel("Token Length")
plt.show() 

print("Samples:")
sorted_raw_entries = sorted(raw_entries, key=(lambda v: token_len(str(v.get("description")))))
for entry in sorted_raw_entries[:3] + sorted_raw_entries[-3:]:
    print(
        f"{entry.get('name')}"
        f"\nPresentors: {entry.get('instructors')}"
        f"\nDescription: {entry.get('description')}"
        f"\nSummary: {entry.get('summary')}\n\n"
    )
```

<br>



聽起來是一個有前景的方向!讓我們在實踐中實作它,並將此變更應用到我們所有的資料(Entries)上。

```python
## Construct full context string
new_context = "The following workshops are slated to be presented at NVIDIA's GTC 2025 Conference:\n\n"
new_context += "\n\n".join(contexts_with_summaries)
print("New Context Length:", len(new_context))
print(f"New Context Tokens: {token_len(new_context)}")

## Preview context
print(new_context[:2000])
```



突然之間,我們低於我們的輸入(input)大小的閾值(threshold)了!是時候替換我們的脈絡資訊(Context)並進行測試了。

```python
#############################################################################
## Defined Earlier. Feel free to play around with this

## Define an NVIDIA-backed LLM
llm = ChatNVIDIA(model="meta/llama-3.1-8b-instruct", base_url="http://llm_client:9000/v1")

## Define a structured prompt
prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a helpful instructor assistant for NVIDIA Deep Learning Institute (DLI). "
     "Assist users with their course-related queries using the provided context. "
     "Do not reference the 'context' as 'context' explicitly."),
    ("user", "<context>\n{context}</context>"),
    ("ai", "Thank you. I will not restart the conversation and will abide by the context."),
    ("placeholder", "{messages}")
])

## Construct the processing pipeline
chat_chain = prompt | llm | StrOutputParser()

## Initialize chatbot state
state = {
    "messages": [("ai", "Hello! I'm the NVIDIA DLI Chatbot! How can I help you?")],
    "context": "",  # Empty for now; will be updated later
}

## Wrap function to integrate AI response generation
chat = partial(chat_with_chain, chain=chat_chain)

## Defined Earlier
#############################################################################

state = {
    "messages": [],
    "context": new_context,
}

try:  ## HINT: Consider putting your call logic in the try-catch
    chat(state)
except Exception as e:
    print(e)
```

```python
## Consider saving the material as well, since it will be useful for later
## For those who may take this course over multiple sessions, a version is provided.
with open("simple_long_context.txt", "w") as f:
    f.write(new_context)
```

<hr><br>

### 第 4 部分: 反思本練習

這個練習相當簡單,並且在某種意義上確實產生了一個有趣的系統。

- 在表面層次上,我們所做的只是將過長的脈絡資訊(Context)轉換為不太過長的脈絡資訊(Context)。

- 換句話說,我們將全域環境(global environment)中的元素「標準化(canonicalized)」為一個有助於形成對於我們主要大型語言模型(LLM)合理的「標準化脈絡資訊(Canonical Context)」的形式。

- 悲觀地說,我們透過使脈絡資訊(Context)略短於我們的最大輸入(Intake)長度,為我們受限的脈絡資訊空間(limited-context-space)下的多輪(multi-turn problem)問題創建了一個非常短期的解決方案。

- 樂觀地說,我們現在擁有一個可重複使用的脈絡資訊(Context),它可以幫助將我們的整個脈絡資訊(Context)保持在我們模型可以適用於大多數單輪問題(包括那些可能補充多輪解決方案的問題)情況的輸入領域(input domain)內。

我們將在接下來的 Notebook 中繼續使用本練習的結果,因此希望隨著我們的進行,這個簡單過程的效用變得顯而易見!

<br>
<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>


