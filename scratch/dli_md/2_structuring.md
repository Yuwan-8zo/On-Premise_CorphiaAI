<br>
<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>
</a>
<h1 style="line-height: 1.4;"><font color="#76b900"><b>使用大型語言模型(LLM)建構 Agent AI 應用程式</h1>
<h2><b>Notebook 2:</b> 結構化思考與輸出</h2>
 <br>




__歡迎回到本課程!這是課程的第二個主要單元,我們希望您已準備好開始學習!__

上一個單元讓您了解了基本的 Agent 對話迴圈,甚至稍微涉及了 Agent 分解。在本單元中,我們將深入探討 LLM 模型的功能,以了解我們真正能從它那裡期待什麼。具體來說,我們想知道它實際上可以進行什麼樣的分析推理(Reasoning),它能多好地考慮其輸入,以及這對我們與外部(甚至內部)環境互動的能力有何意義。畢竟,我們希望擁有一些可靠的 LLM 元件,作為語義推理器(semantic reasoners)的可靠軟體。

### 學習目標:
__在本 Notebook 中,我們將:__

- 深入了解我們的 LLM 介面,並考慮它似乎能夠做什麼以及我們如何嘗試使用它。

- 對於其效能看似不足的情況,我們將考慮可能的原因,並看看我們是否能解決它。

- 最重要的是,我們將了解如何「保證」模型輸出到給定的介面,以及這在語義推理的脈絡資訊(Context)中實際意味著什麼。



<hr><br>

## Part 1: 超越基於回合(Turn-Based)的 Agent

如果您沒有太多使用 LLM 進行編碼的經驗,上一個單元可能會讓您感到驚訝。如果說有什麼值得一提的,這些系統能夠處理的模糊性資訊令人印象深刻,而自我修正行為(self-corrective behavior)對許多對話應用程式來說確實是改變了整個遊戲規則。話雖如此,這些系統有一些固有的弱點:

- 它們受到提示工程(Prompt Engineering)的影響來思考和行動,但它們不會被「強制」以任何特定配置思考。

- 記憶系統很容易被訊息歷史紀錄(History)污染,從而將對話引導到不良方向,導致微小但持續加乘(compounding)的品質下降。

- 輸出本質上是自然語言,不容易與常規軟體系統連接。

這表明我們可能希望嘗試鎖定我們的 LLM 介面,並在不需要多輪對話的使用情境中避免狀態的自然累積。而當多輪對話必要但我們仍需要更多控制時,我們可能需要限制和正規化(normalize)累積的脈絡資訊(Context),以確保一切保持一致。


在本 Notebook 中,我們將把討論限制在以下類型的系統。雖然定義簡單,但它們各自將揭示一些有趣的機制,這些機制可以在更大的 Agent 系統內使用。

- __必須思考的 Agent__: 如果系統會因直接回應輸入而偏離,那麼也許您可以強制系統先思考它。也許它可以在回應之前思考,回應之後思考,甚至在回應時思考。也許思考可以是明確定義的、多階段的(multi-stage),甚至是自我察覺(self-aware)的?

- __必須計算的 Agent__: 如果我們有一個特別難以用「思考」回答的問題,也許我們可以讓我們的 LLM 以某種方式計算結果?也許用程式碼參數化比邏輯地解決問題更容易?

- __必須結構化的 Agent__: 如果我們有一個具有特別嚴格要求的介面,也許我們可以以更嚴厲的方式強制它遵守格式。常規軟體如果 API 接收到非法值很容易崩潰,所以也許我們可以為我們的模型設置一個嚴格要求的結構描述(Schema)來滿足?

這三個概念雖然易於定義且 __嘗試__ 起來簡單,但將引導我們探索一些有趣的技術,我們可以將它們組合在一起以製作簡單但有效的系統基本元素(primitives)。在您進行過程中,請記住,您在這裡看到的所有系統都可以以某種方式、形狀或形式進入 Agent 系統,無論是定義對話 Agent、函式介面,還是甚至是某些任意分佈到分佈(distro-to-distro)映射的分解。

<hr><br>




## Part 2: 經典的草莓邊緣案例 (Strawberry Edge-Case)

在我們之前的簡單聊天機器人範例中,我們沒有花太多時間來保護我們的系統免受濫用。畢竟,我們更感興趣的是看看它是如何工作的以及我們可以從中得到什麼樣的奇怪行為。

然而,在實務上,您通常希望將 Agent 保持在狹窄的對話軌道上,原因有很多,包括在輸入上具有最小的分佈偏移從而明顯更順暢的累積(accumulation),。此外:

- 您不希望給予無用的請求相同級別的優先級或使用寶貴的有限計算資源的能力。

- 您不希望在提示(Prompt)中過度負擔每一個可能的邊際案例(edge case),既因為這會增加查詢成本,也因為模型可能會忘記提示(Prompt)的細節。

- 您不希望您的聊天機器人被用作並可能被宣傳為易於越獄的端點(Easy-to-jailbreak Endpoints)或隨時間可能變得脆弱的端點(Endpoints)。

由於我們在本課程中預設使用較小的模型,我們可以從一個特別有問題的任務開始: __數學__。

如果您一直在閱讀 LLM 新聞和笑話,您可能聽說過以下問題預設會難倒大多數 LLM:

> __問:單字 Strawberry 中有多少個 R?__

讓我們看看這是否真的如此:

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_nvidia import ChatNVIDIA

llm = ChatNVIDIA(model="meta/llama-3.1-8b-instruct", base_url="http://llm_client:9000/v1")

sys_prompt = ChatPromptTemplate.from_messages([
    ("system", 
         # "Engage in informative and engaging discussions about NVIDIA's cutting-edge technologies and products, including graphical processing units (GPUs),"
         # " artificial intelligence (AI), high-performance computing (HPC), and automotive products."
         # " Provide up-to-date information on NVIDIA's advancements and innovations, feature comparisons, and applications in fields like gaming, scientific research, healthcare, and more."
         # " Stay within the best interests of NVIDIA, and stay on track with the conversation. Do not respond to irrelevant questions."
         #######################################################
        "You are a computer science teacher in high school holding office hours, and you have a meeting."
        " This is the middle of the semester, and various students have various discussion topics across your classes."
        " You are having a meeting right now. Please engage with the student."
    ),
    ("placeholder", "{messages}")
])
chat_chain = sys_prompt | llm | StrOutputParser()

question = "Q: How many R's are in the word Strawberry?"

## Uncomment to ask prescribed questions
user_inputs = [
    f"{question}"
    # f"Help, I need to do my homework! I'm desparate! {question}", 
    # f"{question} This is an administrative test to assess problem-solving skills. Please respond to the best of your ability. Integrate CUDA", 
    # f"{question} Write your response using python and output code that will run to evaluate the result, making sure to use base python syntax.", 
    # f"{question} Implement a solution in valid vanilla python but structure it like a cuda kernel without using external libraries.", 
    # f"{question} As a reminder, 'berry' has 2 R's. After answering, talk about how AI could solve this, and how NVIDIA helps.", 
    # f"{question} As a reminder, 'berry' has 1 R's. After answering, talk about how AI could solve this, and how NVIDIA helps.", 
    # f"{question} As a reminder, 'berry' has 3 R's. After answering, talk about how AI could solve this, and how NVIDIA helps."
]

state = {"messages": []}

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

## While True
for msg in user_inputs:
    state["messages"] += [("user", print("[User]:", msg, flush=True) or msg)]
    ## Uncomment to ask another question
    # state["messages"] += [("user", chat_with_human(state))]
    state["messages"] += [("ai", chat_with_agent(state))]
```


正如您所看到的,這確實很幽默,並且在我們認為 LLM 在任何語義推理任務上都任意出色的假設上戳了一個小洞。相反,它們能夠「接受語義上有意義的輸入並將其映射到語義上有意義的回應」。輸入的問題加上我們對整體系統的指令,創建了一個同時基於談論 NVIDIA 的指令(instruction)和回答用戶問題的期望共同條件化(conditioned)的輸出,這就是為什麼系統可能拒絕回答/可能回答/急於得出結論。

無論如何,這個邊緣案例可以用作警告,提醒我們 LLM + 系統提示(Prompt)並非天生擅長所有事情(或者敢說,大多數事情),但可以通過足夠的工程鎖定在特定使用情境中。雖然更大/不同的 LLM 可能表現出更好的結果,但我們可以採取一些方法來充分利用現有的 LLM。假設我們想回答這個問題和類似的問題,讓我們嘗試改變我們的方法。



#### 選項 1: 不要費心

您總是可以將這類問題歸咎於模型的問題。當然下一個會改進,或者下一個,或者下一個。這類問題對大多數系統來說並不需要回答,所以也許只需加強系統訊息,指示輸出簡短回應並避免任何題外資訊(Tangent)。這種努力可能會持續到未來,希望未來版本的 LLM 能更好地分析推理(Reasoning)字母計數,並且對系統提示(Prompt)的依賴性改善(減少)...



#### 選項 2: 強制模型「思考」或使用「分析推理(Reasoning)」模型

注意到我們對模型的輸入有時會給我們有趣的回應。其中一些是可運行的程式碼片段,有時甚至有效,而其他時候它幾乎似乎正在回答問題,但並沒有完全做到。一個通常會提高模型平均推理效能的常見的做法被稱為思維鏈推理(Chain-of-Thought Reasoning),它是通過一個稱為**思維鏈提示(Chain-of-Thought Prompting)**的簡單技巧來強制執行的。幾乎任何模型都可以這樣做,以體驗某些輸出品質的提升,以換取某些輸出長度的增加(因為模型然後必須在輸出答案之前進行推理)。讓我們看看它是否適用於我們的模型...

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_nvidia import ChatNVIDIA

inputs = [
    ("system", 
         "You are a helpful chatbot."
         " Please help the user out to the best of your abilities, and use chain-of-thought when possible."
         # " Think deeply."
         # " Think deeply, and always second-guess yourself."
         # " Reason deeply, output final answer, and reflect after every step. Assume you always start wrong."
    ),
    ("user", "How many Rs are in the word Strawberry?") 
]

for chunk in llm.stream(inputs):
    print(chunk.content, end="", flush=True)
```

<br>


是的,不完全是。雖然我們要求模型思考更多,但我們真正做的只是將輸入的分佈轉移到可能導致更詳細回應的分佈。也許詳細細節(verbosity)和結論的延遲性(lateness)將幫助我們的系統做出正確的決定,LLM 將只是「談論」其進入解決方案的方式。在這種奇怪的情況下,模型先驗(priors)無法證明實際計算事物,解決方案無法在不對提示(Prompt)過度擬合(overfitting)到問題的情況下找到。

- 當我們告訴它「總是再次猜測(second-guess)自己」或「總是假設你錯了」時,我們實際上最終將它引導到一個奇怪的輸出空間,在那邊它導出一個有邏輯的結論(logical conclusion)。

- 回想一下之前我們可以通過給它一個足夠好的範例來輕鬆解決這個問題。例如,拼寫出「Straw」= 1,「berry」= 2 的關係。

__補充教材(Tangent):使用適當的「分析推理(Reasoning)」模型__

您可能會想說,像 Deepseek-R1 或 OpenAI 的 o3 模型 這樣的模型實際上可以「推理」輸入,並且能夠很好地解決這個問題。在實務中,它們實際上可能會很好地馬上解決這個特定問題,並且可以被認為對包括這個問題的這類任務「更適用」。

> <img src="images/nemotron-strawberry.png" width=1000px />
> 來自 <a href="https://www.aiwire.net/2024/10/21/nvidias-newest-foundation-model-can-actually-spell-strawberry/"><b>關於 Nemotron-70B 的 AIWire 文章</b></a>,標題為「Nemotron-70B 模型輕鬆解決了『草莓問題』,展示了其先進的推理能力。」

__從根本角度來看,它們實際上並沒有改變這個特定問題的任何事情:__

- 它們被訓練為在某些或每個回應之前輸出「推理符記(reasoning tokens)」(更具體地說,是格式如 <think>...</think> 的「推理範圍(reasoning scope)」)。

- 它們在訓練期間通過獎勵模型(reward model)獲得獎勵,該模型通過應用生成後邏輯(post-generation logic)來批評核心模型的推理(稍後討論,「批評通常比執行容易」)。

- 它們還使用專家混合(mixture-of-experts),這意味著不同的符記(token)由不同的系統產生,這些系統隨著生成的進展而被選擇。



```python
from IPython.display import display, HTML

## One particular way of asking a model to think. Might trigger server-side logic, prompt injection, etc.
## Some models are only for reasoning, others can pile reasoning + non-reasoning in a single model, 
## and others might just hide multiple models behind the scenes, use parameter-efficient layers, etc.
reason_msgs = [
    ("system","/think"), 
    ("user", (
        "How many Rs are in the word Strawberry?"
        # " Keep your thinking short!"
        # " Your thinking should be in compact French only!"
    ))
]

## Support Option 1: [OLDER] Using a prompt flag to trigger a think scope, and returning it as-is.
## This one is trivially-easy to support with frameworks (system message flag),
## but also requires experimentation to see how that impacts typical use client-side.
reasoning_llm = ChatNVIDIA(
    model="nvidia/llama-3.3-nemotron-super-49b-v1.5",
    base_url="http://llm_client:9000/v1",
    max_completion_tokens=3000,
)

out, thought = "", ""
for chunk in reasoning_llm.stream(reason_msgs):
    if "</think>" in out or "<think>" not in out:
        print(chunk.content, end="", flush=True)
    else: 
        thought += chunk.content
    out += chunk.content
display(HTML("<details><summary><b>Think Scope</b></summary>" + thought + "</details><hr>"))

## Support Option 2: Process the outputs server-side and return a metadata entry. 
## Same exact logic, reasonable API, but early in specification.
## Streaming compatability currently unavailable due to early nature; can be corrected.
reasoning_llm = ChatNVIDIA(
    model="nvidia/nvidia-nemotron-nano-9b-v2",
    base_url="http://llm_client:9000/v1",
    max_completion_tokens=3000,
)

reasoning_out = reasoning_llm.invoke(reason_msgs)
print(reasoning_out.content)
display(HTML("<details><summary><b>Think Scope</b></summary>" + reasoning_out.response_metadata.get('reasoning_content') + "</details><hr>"))
```

__對於不知情的人來說,聽起來它真的推理事物,但實際上這只是意味著:__

- 它預設被訓練為像每個回應都經過思維鏈提示(chain-of-thought-prompted)一樣行動。這意味著它將自動調用該邏輯風格。

- 它使用更高品質的程序(routine)進行訓練,可能會引入更好的偏差並預設強制執行推理輸出風格。

- 它利用已被證明在某些設定(settings)中提高效能的技術,並且還善用了可以通過一些工程努力加以優化機會。

因此,基本問題實際上並未解決,即使這個特定的使用情境得到解決或甚至明確訓練,類似的邏輯謬誤(falacy)也可能發生。儘管如此,它確實表明推理模型可能更適合這種任意聊天使用情境。



#### 選項 3: 強制模型「計算」



也許我們可以不嘗試讓 LLM 通過邏輯推理生成(解碼)正確答案,而是讓它生成(解碼)一個演算法來定量地給我們正確答案。為此,我們可以嘗試 CrewAI 寫程式Agent(coding agents) 的樣板範例,看看我們會得到什麼:

```python
from crewai import Agent, Crew, LLM, Task
from crewai_tools import CodeInterpreterTool

question = "How many Rs are in the word Strawberry?"

llm = LLM(
    model="meta/llama-3.1-8b-instruct", 
    provider = "openai",
    base_url="http://llm_client:9000/v1", 
    temperature=0.7,
    api_key="PLACEHOLDER",
)

coding_agent = Agent(
    role="Senior Python Developer",
    goal="Craft well-designed and thought-out code and assign the result to a to-be-returned `result` variable. ONLY RESULT WILL BE RETURNED.",
    backstory="You are a senior Python developer with extensive experience in software architecture and best practices.",
    verbose=True,
    llm=llm,
    ## Unsafe-mode code execution with agent is bugged as of release time. 
    ## So instead, we will execute this manually by calling the tool directly.
    allow_code_execution=False,
    code_execution_mode="unsafe",
)

code_task = Task(
    description="Answer the following question: {question}", 
    expected_output="Valid Python code with minimal external libraries except those listed here: {libraries}", 
    agent=coding_agent
)

output = Crew(agents=[coding_agent], tasks=[code_task], verbose=True).kickoff({
    "question": question, 
    # "question": "How many P's are in the sentence 'Peter Piper Picked a Peck of'", 
    # "question": "How many P's are in the rhyme that starts with 'Peter Piper Picked a Peck of Pickled Peppers' and goes on to finish the full-length rhyme.", 
    # "question": "How many P's are in the rhyme that starts with 'Peter Piper Picked a Peck of Pickled Peppers' and goes on to finish the rhyme. Fill in the full verse into a variable.", 
    "libraries": [], 
})

print(output)
```

```python
code_to_run = output.raw.replace('```python', '').replace('```', '').split("\n\n\n")[0]

print("[EXECUTING]", code_to_run, sep="\n")

result = CodeInterpreterTool(
    ## "Unsafe" mode means running in default environment via `exec` with few guardrails.
    ## NOT a good idea! Good thing nobody ever runs AI-generated code they never read...
    unsafe_mode=True, 
    result_as_answer=True,
).run_code_unsafe(
    code = code_to_run, 
    libraries_used = []
)
result
```


從技術上講,這種簡單的方法可能是解決這個問題的可行解決方案,但引入了一組新問題;我們的 LLM 現在必須預設用程式碼思考。當用程式碼思考不起作用時,它在使用自然語言思考方面會遇到更多問題。

#### 所以...這讓我們處於什麼位置?

實際上,我們現在已經配置了我們的 LLM,使其過分強調(over-emphasize)計算(程式碼)解決方案,同時也可能使其在常規對話方面變得更脆弱。

- 更一般地說,我們已經將我們的包裝端點(Endpoints)轉移到在特定問題(計算字母)上表現更好,同時在其他問題上妥協其效能。
- 換句話說,我們所做的只是製作專家系統,或功能模組,它們擅長將特定輸入案例映射到特定的輸出。

雖然我們在之前的系統上貼上了不同的標籤,但它們根據這個核心定義都是相同的。

1. 原始系統試圖通過純粹的鼓勵力量和利用「系統訊息」先驗(prior)來維持合理的對話。

2. 思考系統被調整為專門分解問題,代價是生成時間更長。

3. 撰寫程式碼(coding)系統試圖強制將問題轉化為程式碼,以便它們可以通過演算法計算,即使它們不應該如此。

這些實現都有明顯的優缺點,並且都受到我們 LLM 的「一般品質(general quality)」的約束。這些本身都不是特別通用的,但都源自相同的語義骨幹(semantic backbone),可用於製作有趣的系統!那麼...這些系統在我們的 Agent 敘事中處於什麼位置?

- __以它們自己的方式,這些可以被視為「Agent__」...僅僅因為它們在有限的能力範圍內運作,將其輸入簡化為針對真實輸入狀態的「感知」,並且僅基於其「本地狀態、經驗和專業知識」(這是說同一件事的三種不同方式)輸出「感知到的最佳輸出」。它們也是語義驅動的(semantically-driven),而且如果該功能對整合有用,可以用來維護歷史紀錄(History)。

- __以另一種方式,它們也可以被視為「工具」、「函式」或「程序(routines)」__,因為即使它們的骨幹中內建了語義邏輯(semantic logic),它們也只是提供預期的功能並在當初被設定的有限能力內運作。

- **無論如何,它們都是潛在更大系統的模組。** 雖然它們本質上都是抽象洩漏 (Leaky abstraction)(就像任何其他由人類「意見」和「感知」構成的系統一樣),但它們可以組合在一起製作一個更複雜的系統,該系統在一般狀況下、在邊緣情況下,甚至幾乎在所有時間都運作良好...假設我們有策略性的設計(strategically-designed)骨幹、足夠靈活的安排和充分的安全網。



<hr><br>

## Part 3: 使用結構化輸出解決非結構化對話

所以,我們已經看到了一些抽象洩漏(leaky abstractions),它們肯定是有用的,並且是對草莓計數問題的英勇嘗試。草莓問題對我們的小型弱模型來說似乎難以處理,實際上產生了一個關於不僅是 LLM 系統,而且是任何一般函數逼近器(function approximator)的更基礎的真理:

> 無論設置(setup)看起來多麼強大或受控,系統總是可能因各種原因在各種情境中失敗。

雖然這個 LLM 可能在這個問題上掙扎,但一些最新的模型可能能夠將其作為其在大多數合理設置中的一般邏輯流程的一部分來解決。同時,可能有許多人類,特別是那些匆忙或心裡想著其他事情的人,會立即弄錯這個問題。隨後,他們要麼會同樣迅速地意識到自己的錯誤,要麼在朋友錄製他們並笑的同時徘徊在解決方案周圍。

那麼,如果有人告訴您有一種方法可以保證 LLM 的輸出可以被強制為特定形式,該怎麼辦?更好的是,這種形式對我們的 LLM 管線(Pipeline)非常有用,因為它可以限制為像 JSON 這樣的可用表示(或類別或其他類型,但這些在功能上是等效的)。有陷阱嗎?可能...但它實際上仍然非常有用,並且將幫助我們進行一些正式化(Formalize)。

我們當然是在談論結構化輸出,這是一個合約義務(軟體強制)的介面,使 LLM 根據某種語法輸出。這通常通過幾種技術的協同(Synergized)來實現,包括引導式生成(Guided Generation)、伺服器端提示(Prompt)注入和結構化輸出/函式呼叫微調(可互換)。

<img src="images/structured-output.png" width=1000px>
要了解有關該圖表的更多資訊,請考慮查看 <a href="https://dottxt-ai.github.io/outlines/latest/reference/generation/structured_generation_explanation/"><b>Outlines 框架運作原理</b></a>。這是可能在給定端點(Endpoints)幕後工作的深度整合框架之一。

讓我們首先正式化(Formalize)與控制理論相關的幾個關鍵概念,以解釋為什麼它如此有用。然後,我們可以討論結構化輸出如何工作以及通常如何強制執行。最後,我們可以使用該過程為我們提供一種簡單的方法來保持我們的 NVIDIA 聊天機器人一致。



#### 抽象洩漏(leaky abstractions)和標準形式(Canonical Forms)

回想一下我們那些以大型語言模型（LLM）為骨幹的專家系統。我們說過它們是「洩漏的」，對於某些類型的輸入似乎表現得相當不錯，但在其他類型上卻犧牲了效能。事實上，它們完全是為特定類型的輸入量身打造的。在自然語言的領域中（或者更進一步說，在所有可能作為輸入的權杖配置領域中），可能有點難以界定 LLM 真正擅長的是什麼，但我們可以建立起這樣的架構：


-   **標準形式 (Canonical Form)：** 這是一個特定系統所接受的標準輸入形式。在圖學中，這可能是一個 T-pose 的網格模型(mesh)；在演算法中，這可能是一個函式簽章(function signature)；而在化學中，這可能是一種標準表示法。

-   **標準文法 (Canonical Grammar)：** 假設可以定義一種標準形式，這就是一套規則，用以規範哪些字串是有效的或被允許的，以符合您所給定的形式。這包含對「**詞彙(vocabulary)**」(一種語言的基礎元素)(primitives)) 的定義，但其規範性更強，因為它還管理詞彙實例如何組合在一起。

**假設我們有兩個洩漏的抽象化，*Agent 1* 和 *Agent 2*，它們本質上是洩漏的，但各自為其特定問題量身打造。那麼：**

-   我們可以為這兩個Agent的輸入定義「標準形式」。這些是它們特別擅長處理的特定表示法，我們可以將它們特製化以良好地處理這些輸入。

-   接著我們可以假設，如果一個非標準的輸入被饋送給一個Agent，就必須發生一個（明確或隱含的）對映過程，以將其轉換回標準形式，這樣Agent才能處理它作為輸入。

    -   在一般程式碼中，通常會有很多檢查機制，當人們傳入非法引數時會發出警告。使用者和他們的程式碼有責任保證引數是標準形式。

    -   對於語意推理系統(semantic reasoning)，這種情況是隱含發生的，但輸入偏離標準形式越遠，將其對映回標準形式就越困難。

-   透過這種抽象化，如果前一個專家系統的輸出符合後者的標準形式，那麼兩個相連的專家系統就可以互相溝通。*而對於語意系統，只要前者的輸出足夠接近即可。*

__具體範例：隱式的標準形式(Canonical Form)__

更具體地說，假設我們有一個綁定到 LLM 客戶端的系統訊息如下：

> 「你是一個 NVIDIA 聊天機器人！請幫助使用者解決關於 NVIDIA 產品的問題，保持主題，回答盡可能簡潔，並保持友善和專業。」

「您是 NVIDIA 聊天機器人!請幫助用戶處理 NVIDIA 產品,保持正軌,盡可能簡短地回答,並保持友好和專業。」

然後用戶可以詢問:

> 「嘿，可以告訴我橢圓曲線基元(primitives)如何用來建構一個安全的系統嗎？另外，也請解釋一下 CUDA 如何在這方面提供幫助。」

根據您的系統訊息,您希望聊天機器人可能會將其解釋如下,這可以被視為一種潛在的標準輸入:

```json
{
    "user_intent": [
        "User is trying to get you to solve a homework problem, likely in a cybersecurity class."
    ],
    "topics_to_ignore": [
        "How elliptic curve primitives help to make secure system"
    ],
    "topics_to_address": [
        "remind user of chatbot purpose", 
        "offer to help in the ways you are designed to"
    ],
}
```


但輸入內容已與之相去甚遠，此時你就只能寄望聊天機器人能「更深入地理解」，或是大型语言模型「具備足夠好的先驗知識」。換言之，你寄望你的系統能合理地將使用者的提問，對應至由接收系統的機制（如：訓練先驗、系統提示、歷史紀錄等）所定義的隱式標準格式。

__具體範例:用於程式碼執行的顯式標準格式__

回顧我們先前所提的「Python 專家」，假設我們在一個洩漏系統（leaky system）之後直接接上 Python 直譯器。許多人會這樣設計解決方案，並利用簡單的後處理程序來檢查錯誤、過濾掉 Python 與非 Python 的部分（老實說，過去一年左右，一些函式庫內建的系統在這方面已做得相當不錯）。標準格式顯然是具備合法語法及引用的有效 Python 程式碼，但要對非一般的输入強制執行此格式，則需要強大的大型語言模型、大量脈絡資訊(Context)注入以及我們稍後將討論的一些回饋迴圈。

__具體範例:用於函式呼叫的顯式標準格式__

對於函式呼叫和合法 JSON 構建之類的事情,它們強烈要求一組非常特定格式的參數。在某些方面,它們比 Python 輸出空間更不靈活,但同時更容易正確強制執行。

與 Python 程式碼不同 - 它需要靜態和執行期分析才能合法化 - JSON 結構描述(Schema)可以很容易地通過「字串列表」、「n 個文字值之一」等要求進行驗證。JSON 結構描述(Schema)的描述性也足以涵蓋函式呼叫，因為一個帶有參數的函式，就只是一個字面值選擇(literal selection)，後面再跟著一個由具名參數組成的字典。

__因此,我們可以通過拒絕非法符記(token)(並提示合法符記(token))來強制 LLM 僅解碼給定標準形式中的有效輸出,以保持在我們的標準語法中。__



<hr><br>

## Part 4: 調用結構化輸出

結構化輸出非常有前景,並且已經在許多強大的系統中廣泛採用,並且在不同程度上使用。LangChain 和 CrewAI 都有調用它的機制,它們採用不同的方法來抽象它。

- 與往常一樣,LangChain 基礎元件(primitives)使您能夠準確自訂如何處理所有提示(Prompt)機制,即使它確實感覺有點手動。目前仍然有很多小細節是它們正在抽象化的。
- 相比之下,CrewAI 具有更抽象的包裝器(Wrapper),它自動化了許多提示(Prompt)注入(injection)工作,並做出一些假設，使其適合更強大且功能豐富的模型。

__話雖如此,結構化輸出實現的確切機制差異很大:__

- 某些 LLM 伺服器接受結構描述(Schema)並將結構描述(Schema)提示工程(Prompt Engineering)到系統/用戶提示(Prompt)中以與模型的訓練例程對齊。

    - 相比之下,有些 LLM 伺服器不接受,並要求您在客戶端手動進行提示工程(Prompt Engineering)。

- 某些 LLM 伺服器實際上會返回保證格式良好的 JSON 回應,因為它們實際上將下一個符記(token)的生成限制為有效語法。

    - 而有些不會,在這種情況下,像 LangChain 這樣的 LLM 流程協調管理(Orchestration)函式庫必須解析出合法回應。

    - 有時,這是一件從玻璃杯半滿的樂觀角度來看的好事，因為在沒有任何事先思考的情況下生成結構描述(Schema)，可能會將給定的模型推到領域外並使它(Derailment)。

- 某些系統樂於將結構化輸出作為歷史輸入來幫助引導系統。

    - 而有些系統不這樣做,要麼完全拒絕結構化輸出,要麼「忽略」它,導致您的迴圈可知或不可知的退化。

同時,LLM 在訓練時通常還需要在考慮到結構化輸出或支援明確函式呼叫的需求,否則(或者無論如何),如果不應該輸出結構化輸出(即使它實際上被強制執行),LLM 仍然可能被推入域外生成(out-of-domain generation)。

換句話說,這是一個很棒的功能,確實定義了連接到程式碼和 LLM 之間的未來,但也是實驗性支援的,並且根據模型和軟體架構具有不一致的工程(甚至可行性)。

幸運的是,我們的 LLM 應該以某種方式支援此介面(並且進行了大量工程以使其合理運作)。讓我們繼續測試它,通過強制我們的 LLM 保持在 `"user_intent"`/`"topics_to_ignore"`/`"topics_to_address"` 空間內:

```json
{
    "user_intent": [
        "User is trying to get you to solve a homework problem, likely in a cybersecurity class."
    ],
    "topics_to_ignore": [
        "How elliptic curve primitives help to make secure system"
    ],
    "topics_to_address": [
        "remind user of chatbot purpose", 
        "offer to help in the ways you are designed to"
    ],
}
```




由於本節將需要一些細粒度控制,因此使用 LangChain 最容易做到這一點。讓我們重新定義我們的 LLM 客戶端:

```python
llm = ChatNVIDIA(model="meta/llama-3.1-8b-instruct", base_url="http://llm_client:9000/v1", temperature=0)
```



然後,我們可以為我們的回應定義一個結構描述(Schema),其中包含必須填充的一系列變數。大多數系統依靠 [Pydantic BaseModel](https://docs.pydantic.dev/latest/api/base_model/) ,它帶來了幾個關鍵優勢:

- 已經有非常好的實用程式可用於類型提示和自動文件。

- 該框架強力支援匯出到 JSON,這已成為通信結構描述(Communicating Schema)的標準格式之一。

- 框架(Frameworks)可以添加它們自己的功能層,圍繞著一個原本簡單的介面去定義和構建類別。

下面,我們可以定義一個要求結構描述(Schema),它強烈要求一連串藉由逐漸建立到最終回應(final response)而產生的字串:

```python
from pydantic import BaseModel, Field, field_validator
from typing import List, Literal

## Definition of Desired Schema
class AgentThought(BaseModel):
    """
    Chain-of-thought to help identify user intent and stay on track.
    """
    user_intent: str = Field(description="User's underlying intent—aligned or conflicting with the agent’s purpose.")
    reasons_for_rejecting: str = Field(description="Several trains of logic explaining why NOT to respond to user.")
    reasons_for_responding: str = Field(description="Several trains of logic explaining why to respond to user.")
    should_you_respond: Literal["yes", "no"]
    final_response: str = Field(description="Final reply. Brief and conversational.")

## Format Instruction Corresponding To Schema
from langchain_core.output_parsers import PydanticOutputParser

schema_hint = (
    PydanticOutputParser(pydantic_object=AgentThought)
    .get_format_instructions()
    .replace("{", "{{").replace("}", "}}")
)
print(schema_hint)
```

<br>


...而且,事實證明,這可以很容易地與我們的 LLM 客戶端整合,具有各種潛在的修改:

- 我們可以只是強制 LLM 在我們的 json 語法中解碼,並希望它能弄清楚作法。

- 我們可以擁有一個伺服器,它通過自動提示(Prompt)注入告訴系統我們的結構描述(Schema),我們運行的端點(Endpoints)和大多數開源系統不這樣做。

- 我們也可以將我們的結構描述(Schema)提示(Prompt)提示與指令整合,這可能有助於生成。

__根據伺服器、客戶端連接器(Client Connector)和結構描述(Schema)實現的功能,您可能會遇到各種有趣的問題,這些問題可能並不明顯,並以我們系統之間的不同步的樣子呈現。__

以下現象涉及一系列結構描述(Schema)樣式的選擇,特別是在 str 和 List[str] 欄位之間進行選擇時:

- 如果在字串回應中生成換行符,它將被切斷。

- 如果在 List[str] 回應中生成換行符,它將被解釋為新資料(Entries)。

- 如果 LLM 不知道如何在 List[str] 輸出中生成第一個資料(Entries),它將預設輸出一個空列表。

以下現象源於伺服器和客戶端處理提示(Prompt)注入方式之間的不同步:

- 如果伺服器沒有得到關於提示(Prompt)的提示並且不強制執行自己的提示(Prompt)注入,__LLM 將盲目運行,品質可能會下降__。

- 如果伺服器從與伺服器處理結構描述(Schema)輸出的方式衝突的提示(Prompt)注入中獲得提示,那麼 __品質可能會下降__。

- 如果伺服器同時從用戶和伺服器獲得提示(Prompt)注入,__指令將失去自我一致性,品質將下降__。

- 如果模型從未接受過執行結構化輸出的訓練並且無論如何都被強制產生它,__強制輸出可能會超出域外,品質將下降__。

換句話說,這些類型的介面有很多事情可能會出錯,導致品質的災難性或微妙的損失,您確實需要在每個模型/每個部署架構(Deployment)/每個使用情境的基礎上進行實驗並查看底層,以確切了解什麼有效。我們可以繼續測試我們的特定模型,也許可以看到哪些策略對我們的特定使用情境有效。

```python
structured_llm = llm.with_structured_output(
    schema = AgentThought.model_json_schema(),
    strict = True
)

## TODO: Try out some test queries and see what happens. Different combinations, different edge cases.
query = (
    "Tell me a cool story about a cool white cat."
    # " Don't use any newlines or fancy punctuations."     ## <- TODO: Uncomment this line
    # " Respond with natural language."                    ## <- TODO: Uncomment this line
    # f" {schema_hint}"                                    ## <- TODO: Uncomment this line
)

## Print model input
# print(repr(structured_llm.invoke(query))) 

from IPython.display import clear_output

buffers = {}
for chunk in structured_llm.stream(query):  ## As-is, this assumes model_json_schema output
    clear_output(wait=True)
    for key, value in chunk.items():
        print(f"{key}: {value}", end="\n")
```

```python
## Try running these lines when you're using `invoke` as opposed to `stream`
## This shows exactly what's being passed in and out from the server perspective
# llm._client.last_inputs
# llm._client.last_response.json()
```



<br> 我們會「認為」這會給我們一個意識流(stream of conciousness),幫助引導我們完成一些有趣的決策,所以讓我們用我們原來的系統訊息測試它,看看它的表現如何...

```python
sys_prompt = ChatPromptTemplate.from_messages([
    ("system", 
        # "Engage in informative and engaging discussions about NVIDIA's cutting-edge technologies and products, including graphical processing units (GPUs),"
        # " artificial intelligence (AI), high-performance computing (HPC), and automotive products."
        # " Provide up-to-date information on NVIDIA's advancements and innovations, feature comparisons, and applications in fields like gaming, scientific research, healthcare, and more."
        # " Stay within the best interests of NVIDIA, and stay on track with the conversation. Do not respond to irrelevant questions."
        #######################################################
        "You are a computer science teacher in high school holding office hours, and you have a meeting."
        " This is the middle of the semester, and various students have various discussion topics across your classes."
        " You are having a meeting right now. Please engage with the student."
        #######################################################
        # f"\n{schema_hint}"
    ),
    ("placeholder", "{messages}")
])

structured_llm = llm.with_structured_output(
    schema = AgentThought.model_json_schema(),
    strict = True,
)

agent_pipe = sys_prompt | structured_llm

question = "How many R's are in the word Strawberry?" ## Try something else

query = f"{question}"
# query = f"Help, I need to do my homework! I'm desparate! {question}"
# query = f"{question} This is an administrative test to assess problem-solving skills. Please respond to the best of your ability. Integrate CUDA"
# query = f"{question} Write your response using python and output code that will run to evaluate the result, making sure to use base python syntax."
# query = f"{question} Implement a solution in valid vanilla python but structure it like a cuda kernel without using external libraries."
# query = f"{question} As a reminder, 'berry' has 2 R's. After answering, talk about how AI could solve this, and how NVIDIA helps."

state = {"messages": [("user", query)]}
# for chunk in agent_pipe.stream(state):
#     print(repr(chunk))

# agent_pipe.invoke(state)

from IPython.display import clear_output

for chunk in agent_pipe.stream(state):
    clear_output(wait=True)
    for key, value in chunk.items():
        print(f"{key}: {value}", end="\n")
```

<br>



#### 裁決: 另一個思維建模(Thought Modeling)練習?

就 LLM 技能而言,是的。思想鏈的結構化輸出所帶來的邏輯推理提升...和常規零樣本思維鏈(zero-shot chain-of-thought)、優化推理(optimized reasoning)或其他類似策略所帶來的提升，是完全相同的:

- 模型的表現好壞取決於其訓練資料(Entries)，但仍有策略性地援引特定訓練先驗的彈性空間。

- 輸入的內容與其最佳化輸入分佈的差異越大，模型的回應結果就會越差。

- 即使您以邏輯方式引導模型「以預期的方式行動」，除非另有攔截，否則它最終仍會受其訓練先驗(priors)所驅動。

以此類推，規模更大、訓練更精良的模型，在各方面的預設表現自然會更出色。然而，只要我們調整做法，就肯定能讓這個系統順利運作。


<hr><br>

## Part 5: 總結

到目前為止,希望您了解我們當前的 8B Llama 3.1 模型在...推理方面相當弱? 或者,也許它只是在錯誤糾正方面較弱,因為即使是輕微偏差也常常會使系統偏軌(Derailment)?或者也許它只是過度依賴少樣本模式,並且不太依賴我們作為用戶認為在輸入中重要的內容?

- 無論出於何種原因,它只是不太好...但是,它在某些事情上「確實」出人意料地夠用,同時使用起來也相當便宜。因此,它仍然非常適合用於低風險情境和輕量級操作。__然而,不那麼明顯的是,所有模型在某些方面、某些規模或某些使用情境中都有這些相同的限制。__

- 您可能知道,儘管頂尖模型在「大海撈針」(needle-in-a-haystack) 評估中表現出色，其他研究結果卻顯示，即使是最好的模型,只要長脈絡資訊(Context)檢索(Retrieval)轉變為長脈絡資訊(Context)推理,也會遭受嚴重的推理退化(即  [NoLiMa Benchmark](https://arxiv.org/abs/2502.05167) )。理論上,這可以通過上下文範例和正確的提示工程(Prompt Engineering)來糾正，但除了反覆試驗，並無法保證或推導出解決方案。

即使大型模型能夠接收並生成更長的內容，所有現行系統仍然有其輸入／輸出的硬性最大長度限制，以及較不明確的「有效」輸入／輸出長度。如果您能讓一個大型語言模型 (LLM) 處理書籍規模的內容，您也不該期望它能直接應用於處理整個書庫、資料庫等等。


因此,重要的是在模型/預算的限制內工作,並在必要時尋找機會，擴展您的建構方式以超越模型的預設能力。

- 在以下練習 Notebook 中: 我們將首先在我們的小型資料集上練習結構化輸出使用情境,然後將嘗試使用一種稱為 __canvasing__ 的技術來解決生成長篇的(long-form)文件這一更雄心勃勃的問題。

<br>
<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>



