<br>
<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>
</a>
<h1 style="line-height: 1.4;"><font color="#76b900"><b>使用大型語言模型(LLM)建構Agentic AI 應用程式</h1>
 <h2><b>練習 2:</b> 中介資料(Metadata)生成</h2> <br>




__歡迎來到第二個練習!__

這是一個精簡的練習,旨在強化結構化輸出(structured output)的概念,並嘗試將課程教材甚至長篇的(long-form) Markdown 作為練習媒介。具體來說,我們將考慮如何首先生成真實的中介資料(Metadata),然後使用前一節的工具實際生成一個 Jupyter Notebook。

### 學習目標:
__在本 Notebook 中,我們將:__

- 考慮一個更複雜的結構化輸出範例,可以直接應用於合成(synthetic)內容(如果負責任地使用)。
- 超越您的大型語言模型(LLM)系統的生成式(Generative)先驗知識,以疊代(Iterate)方式改進較長篇的(long-form)文件。​

### 設定
在執行此操作之前,讓我們從前一個 Notebook 載入設定並繼續使用它:

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_nvidia import ChatNVIDIA
from functools import partial

from course_utils import chat_with_chain

# llm = ChatNVIDIA(model="meta/llama-3.1-8b-instruct", base_url="http://llm_client:9000/v1")
llm = ChatNVIDIA(model="nvidia/llama-3.1-nemotron-nano-8b-v1", base_url="http://llm_client:9000/v1")

## Minimum Viable Invocation
# print(llm.invoke("How is it going? 1 sentence response.").content)

## Back-and-forth loop
prompt = ChatPromptTemplate.from_messages([
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
chat_chain = prompt | llm | StrOutputParser()

with open("simple_long_context.txt", "r") as f:
    full_context = f.read()

long_context_state = {
    "messages": [],
    "context": full_context,
}

# chat = partial(chat_with_chain, chain=chat_chain)
# chat(long_context_state)
```


<hr><br>

### 第 1 部分: 生成簡單的中介資料(Metadata)
在課程 Notebook 中,我們學習了一些技術,只需友善地詢問並強制執行樣式即可生成資料。這依賴於模型的先驗知識(priors)。我們注意到每個模型在這方面都有某些限制。為了簡化事情,讓我們從一個實際可在正式環境(Production)中使用的案例開始,即使是 8B 模型也能表現出色;__短篇資料萃取(Short-Form Data Extraction)__。

我們的工作坊資料集有很多自然語言描述,而我們的網站前端需要它具有某種結構描述(Schema),所以如果我們可以使用大型語言模型(LLM)來初始化這些值,那不是很好嗎?

好的,我們可以定義一個結構描述(Schema)來幫助我們生成這些值:

```python
from pydantic import BaseModel, Field
from typing import List

class MetaCreator(BaseModel):
    short_abstract: str = Field(description=(
        "A concise, SEO-optimized summary (1-2 sentences) of the course for students."
        " Ensure accuracy and relevance without overstating the workshop's impact."
    ))
    topics_covered: List[str] = Field(description=(
        "A natural-language list of key topics, techniques, and technologies covered."
        " Should start with 'This workshop' and follow a structured listing format that lists at least 4 points."
    ))
    abstract_body: str = Field(description=(
        "A detailed expansion of the short abstract, providing more context and information."
    ))
    long_abstract: str = Field(description=(
        "An extended version of the short abstract, followed by the objectives."
        " The first paragraph should introduce the topic with a strong hook and highlight its relevance."
    ))
    objectives: List[str] = Field(description=(
        "Key learning outcomes that students will achieve, emphasizing big-picture goals rather than specific notebook content."
    ))
    outline: List[str] = Field(description=(
        "A structured sequence of key topics aligned with major course sections, providing a clear learning path."
    ))
    on_completion: str = Field(description=(
        "A brief summary of what students will be able to accomplish upon completing the workshop."
    ))
    prerequisites: List[str] = Field(description=(
        "Essential prior knowledge and skills expected from students before taking the course."
    ))

def get_schema_hint(schema):
    schema = getattr(schema, "model_json_schema", lambda: None)() or schema
    return ( # PydanticOutputParser(pydantic_object=Obj.model_schema_json()).get_format_instructions()
        'The output should be formatted as a JSON instance that conforms to the JSON schema below.\n\nAs an example, for the schema'
        ' {"properties": {"foo": {"title": "Foo", "description": "a list of strings", "type": "array", "items": {"type": "string"}}},'
        ' "required": ["foo"]}\nthe object {"foo": ["bar", "baz"]} is a well-formatted instance of the schema.'
        ' The object {"properties": {"foo": ["bar", "baz"]}} is not well-formatted.\n\nHere is the output schema:\n```\n' + str(schema) + '\n```'
    )

schema_hint = get_schema_hint(MetaCreator)
# schema_hint
```

<br>


然後,如果我們只是綁定我們的大型語言模型(LLM)客戶端以遵守結構描述(Schema),那麼我們應該能夠生成它。下面的程式碼不僅做到了這一點,還展示了如何串流(stream)資料甚至過濾資料。

```python
structured_llm = llm.with_structured_output(
    schema=MetaCreator.model_json_schema(), 
    strict=True
)

meta_chain = prompt | structured_llm
meta_gen_directive = (
    # f"Can you generate a course entry on the Earth-2 course? {schema_hint}"
    # f"Can you combine the topics of the Earth-2 course and the NeRF/3DGS courses and generate a compelling course entry? {schema_hint}"
    f"Can you combine the topics of the Earth-2 course and the NeRF/3DGS courses and generate a compelling course entry? Make sure to explain how they combine. {schema_hint}"
) 
meta_gen_state = {
    "messages": [("user", meta_gen_directive)],
    "context": full_context,
}

# answer = meta_chain.invoke(meta_gen_state)
# print(answer)

from IPython.display import clear_output

answer = {}
for chunk in meta_chain.stream(meta_gen_state):
    clear_output(wait=True)
    for key, value in chunk.items():
        print(f"{key}: {value}", end="\n\n", flush=True)
        answer[key] = value

# llm._client.last_response.json()
```

<br>




好的!還不錯!它反映了我們在課程中討論的相同限制,但它似乎確實充分利用了其脈絡資訊(Context)(而不會退化為無意義的內容)。也許我們可以要求它改進?

```python
## TODO: See if you can't prompt-engineer this solution to lead to an improved autoregression.
meta_gen_state = {
    "messages": [
        ("user", meta_gen_directive),
        ("ai", str(answer)),
        ("user", "Great! Can you please correct any mistakes and flesh out some vagueness?")
    ],
    # "context": full_context,  ## Maybe we don't need the full context
    "context": "",
}

answer2 = {}
for chunk in meta_chain.stream(meta_gen_state):
    clear_output(wait=True)
    for key, value in chunk.items():
        print(f"{key}: {value}", end="\n\n", flush=True)
        answer2[key] = value
```

<br>


__是的...它可以改進到某個程度。__

- 如果我們納入聊天歷史紀錄(History),當模型開始達到其脈絡限制時,您將很快遇到問題。

- 如果我們不這樣做,我們仍然可以從大型語言模型(LLM)中擠出一些客製化內容,並且可以合理地生成更好或更長的大綱(outline)...到某個程度。

對於這個案例,這個模型實際上還不錯,但對於更長一點的內容,限制顯然開始顯現...

```python
## Pick your preferred option
final_answer = answer2
```


<hr><br>

### 第 2 部分: 生成 Notebook

我們在嘗試生成中介資料(Metadata)時看到了一些模糊的限制,所以讓我們看看當我們變得更有野心時是否會開始看到更明顯的問題。下面,我們展示了使用 GPT-4o 模型生成 Notebook 的嘗試:

```python
from IPython.display import display, Markdown, Latex
with open("chats/make_me_a_notebook/input.txt", "r") as f:
    notebook_input_full = f.read()
    notebook_input_prompt = notebook_input_full.split("\n\n")[-1]
# print(notebook_input_full)
print(notebook_input_prompt)
```

```python
# !cat chats/make_me_a_notebook/output.txt
display(Markdown("chats/make_me_a_notebook/output.txt"))
display(Markdown("<hr><br><br>"))
```

<br>


[`chats/make_me_a_notebook/output.txt`](./chats/make_me_a_notebook/output.txt) 中的 Notebook 輸出是當我根據 [`chats/make_me_a_notebook/input.txt`](./chats/make_me_a_notebook/input.txt) 要求 GPT-4o 生成 Notebook 時產生的第一次嘗試輸出。對於如此模糊的輸入來說,它已經足夠實用,並且可以在某種程度上透過只是要求它提供更好的輸出、批評它並給它足夠的資訊來改進。

常見的警語「垃圾輸入,垃圾輸出(garbage in, garbage out)」浮現腦海,因為大型語言模型(LLM)只是在鏡射與您特定輸入相對應的合理輸出樣式。但由於訓練的對話性質(在訊息被導入的對話提示(Prompt)的幫助下並沒有改善),對於許多進階使用案例來說,您的輸出通常會不舒服地短,而且不夠精確。

不過,讓我們看看是否可以通過給大型語言模型(LLM)一個風格參考並要求它稍微改寫 Notebook 來改進這個輸出:

```python
import json

def notebook_to_markdown(path: str) -> str:
    """Load a Jupyter notebook from a given path and convert it to Markdown format."""
    with open(path, 'r', encoding='utf-8') as file:
        notebook = json.load(file)
    markdown_content = []
    for cell in notebook['cells']:
        if cell['cell_type'] == 'code':          # Combine code into one block
            markdown_content += [f'```python\n{"".join(cell["source"])}\n```']
        elif cell['cell_type'] == 'markdown':    # Directly append markdown source
            markdown_content += ["".join(cell["source"])]
        # for output in cell.get('outputs', []):   # Optionally, you can include cell outputs
        #     if output['output_type'] == 'stream':
        #         markdown_content.append(f'```\n{"".join(output["text"])}\n```')
    return '\n\n'.join(markdown_content)

notebook_example = notebook_to_markdown("extra_utils/general_representative_notebook.ipynb")

context = str(final_answer)
# context = (
#     f"THE FOLLOWING IS AN EXAMPLE NOTEBOOK FOR STYLE ONLY: \n\n{notebook_example}"
#     "\n\n=========\n\n"
#     f"THE FOLLOWING IS THE TOPIC COURSE THAT WE ARE DISCUSSING:\n\n{final_answer}\n\n"
# )

long_context_state = {
    "messages": [],
    "context": context,
}

chat = partial(chat_with_chain, chain=chat_chain)
chat(long_context_state)

## EXAMPLE INPUTS ##
## Option: Can you please construct a good notebook in markdown format?
## Option: That's great, but there is no code. Can you please flesh out each section within an end-to-end narrative?
```

<br>


在我們的案例中,我們的模型相當小,而且我們也限制了端點(Endpoints)的短輸入和短輸出(為了它自己好),因此它可以生成的內容量確實非常有限。然而,無論模型品質如何,這種限制確實會在所有實際場景中表現出來。

對於任何現代大型語言模型(LLM):

- 雖然直接解碼(straight decoding)解決方案可以適用於某些脈絡資訊(Context),但它們無法擴展到任意大的輸入或輸出。

- 當我們處理較長的序列時,品質輸出長度通常短於品質輸入長度。這在訓練期間被強化,並同時強化高效的生成成本和減少脈絡累積強的良好的特性。

換句話說,可以給予或期望大型語言模型(LLM)的事物空間(space of things) $>>$ 大型語言模型(LLM)實際上可以很好理解的事物空間 $>>$ 大型語言模型(LLM)實際上可以很好輸出的事物空間。 ($>>$ = "遠大於")



鑑於這一見解,我們可以理解,,試圖強迫大型語言模型(LLM)一次產生一個 Notebook 可能會導致全局規模(global scale)的不連貫(incoherence)。然而,它似乎至少在某種程度上開始還可以,所以也許這種作法(Paradigm)有一些優點。


<hr><br>

### 第 3 部分: 使用 Agent Canvas

當我們觀察到我們無法直接輸出我們想要的東西時,下一個問題是「我們能否接收我們想要的東西」。

- 似乎大型語言模型(LLM)在我們只給它前提作為輸入(Input)時能夠大致遵循前提(premise),但當我們給它一個代表性範例(example)時開始偏軌(Derailment)。

- 此外,它可能實際上能夠通過對話改進您的 Notebook,所以也許我們可以從那裡開始。

__畫布作法(Canvasing Approach)__: 與其讓模型預測完整文件,不如讓它將文件視為環境並向大型語言模型(LLM)提出以下建議之一:

> - ___「請提出一個可以改善文件狀態的修改。這是您的選項。選擇一個/多個,它們將被執行。」___

> - ___「這是整個狀態,您的任務是僅改進其中的這個子部分。請輸出您對該部分的更新。不會修改其他部分。」___

> - ___「這是整份文件。此部分不好,因為以下一個或多個原因:{批評}。用改進的版本替換它。」___

如果模型能夠理解完整環境和指令,那麼它可以直接自回歸(Autoregressing)僅一小部分甚至針對輸出進行策略性修改。將此作法(Paradigm)與結構化輸出或思維鏈(chain of thought)結合,您很可能會得到一個雖然不完美但有助於將潛在輸出長度接近模型潛在輸入長度的正式化(Formalize)方式。

```python
## TODO: Insert a notebook of choice
STARTING_NOTEBOOK = """

""".strip()
```

```python
prompt = ChatPromptTemplate.from_messages([
    ("system",
         "You are a helpful instructor assistant for NVIDIA Deep Learning Institute (DLI). "
         " Please help to answer user questions about the course. The first message is your context."
         " Restart from there, and strongly rely on it as your knowledge base. Do not refer to your 'context' as 'context'."
    ),
    ("user", "<context>\n{context}</context>"),
    ("ai", "Thank you. I will not restart the conversation and will abide by the context."),
    ("user", (
        "The following section needs some improvements:\n\n<<<SECTION>>>\n\n{section}\n\n<<</SECTION>>>\n\n"
        "Please propose an upgrade that would improve the overall notebook quality."
        " Later sections will follow and will be adapted by other efforts."
        " You may only output modifications to the section provided here, no later or earlier sections."
        " Follow best style practices, and assume the sections before this one are more enforcing that the latter ones."
        " Make sure to number your section, continuing from the previous ones."
    )),
])

## An LCEL chain to pass into chat_with_generator
sub_chain = prompt | llm | StrOutputParser()

delimiter = "###"  ## TODO: Pick a delimiter that works for your notebook
WORKING_NOTEBOOK = STARTING_NOTEBOOK.split(delimiter)
output = ""
for i in range(len(WORKING_NOTEBOOK)):
    chunk = WORKING_NOTEBOOK[i]
    ## TODO: Knowing that the state needs "context" and "section" values,
    ## can you construct your input state?
    chunk_refinement_state = {
        "context": None,
        "section": None,
    }
    for token in sub_chain.stream(chunk_refinement_state):
        print(token, end="", flush=True)
        output += token
    WORKING_NOTEBOOK[i] = output
    print("\n\n" + "#" * 64 + "\n\n")
```

<br>


<details><summary><b>解決方案</b></summary> 

```python
chunk_refinement_state = {
    "context": "####".join(WORKING_NOTEBOOK),
    "section": chunk,
}
```

</details> <hr><br>


### 第 4 部分: 反思本練習

如我們所見,這種作法(Paradigm)非常有前途,因為它能夠僅通過局部修改將模型的輸出擴展到大型脈絡資訊(Context)。這個 8B 模型很快透過這種作法(Paradigm)擴大了它的訓練分布(training distribution),而且由於其模糊的輸入,它也可能開始相當積極地進入幻覺模式,但更大的模型將能夠在這個過程中疊代(Iterate)更長的時間,甚至可以加入一些錯誤修正或隨機化努力來穩定過程

這種技術也在實際應用中被使用,以實現諸如程式碼庫修改和協作文件編輯(即 OpenAI Canvas)等功能。此外,即使對此作法(Paradigm)進行微小修改也可以幫助您實現一些令人驚訝地有效且高效的解決方案:

- __尋找-取代畫布(Find-Replace Canvas)__: 與其自回歸(Autoregressing)文件的部分,您可以生成尋找-取代配對。在區塊(chunks)上執行此過程,您將得到更安全的正式化(Formalize)以及更易於追蹤的足跡。這種系統可用於實現支援人工智慧(AI)的拼字檢查器和其他形式或策略性錯誤修正。

- __文件翻譯(Document Translation)__: 更一般地說,這種作法(Paradigm)也可以用於一次翻譯文件的一個部分,從一種格式到另一種格式。類似於上述的作法(Paradigm)可以用於將文件從一種語言翻譯成另一種語言,並加入一些脈絡資訊(Context)注入來幫助提供翻譯模型管線(Pipeline)一些風格來引導它。

請注意,雖然我們將此過程稱為*「畫布(canvasing)」,您也可能會遇到相同或類似的概念,稱為 _「疊代精煉(Refinement)(iterative refinement)」_。它們幾乎是同一件事,除了後者更通用,技術上可以應用於任何支援大型語言模型(LLM)的迴圈,在許多疊代(Iterate)中將輸入推進到輸出。畫布更強烈地暗示您正在使用當前環境作為遊樂場,並可以進行策略性修改以改善狀態。

無論如何,我們現在已經測試了我們的小型模型如何實際上可以幫助我們做一些令人驚訝地有趣的事情,同時也反思了它有明顯的限制這一事實。這標誌著本課程「簡單管線(Pipeline)」練習的結束。在下一節中,我們將使用我們學到的基本元素(primitives)開始使用適當的 Agent 框架,同時堅持使用我們非常有限但令人驚訝地靈活的 Llama-8B 模型。

<br>
<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>


