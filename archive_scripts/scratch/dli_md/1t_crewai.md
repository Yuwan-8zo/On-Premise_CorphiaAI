<br>
<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>
</a>
<h1 style="line-height: 1.4;"><font color="#76b900"><b>使用大型語言模型建構Agentic AI應用程式</h1>
<h2><b>Notebook 2:</b> 試用CrewAI</h2>
<br>





**在 Notebook 1** 中,我們實際上定義了我們自己的小型 Agent 系統(system),目的是為了適當地讓兩個或更多非人類 Agent 能夠以合理的方式彼此對話。在本 Notebook 中, 我們將簡要地介紹一個特別受歡迎且對於建模基於角色的 Agent 非常有用的 Agent 框架(framework), 它並且能相當容易設定以處理這類問題:[CrewAI](https://www.crewai.com/open-source)!

### 學習目標:

__在這個Notebook中，我們將:__

- 了解預建的Agent框架，這些框架以不同的角度實作了我們先前的想法(abstractions)並提供更廣泛的涵蓋範圍。​

- 特別研究CrewAI，並考慮我們如何複製先前的師生對話。​


<hr><br>

### 定義一個 Agent框架


無論您是否完全理解，Notebook1a中展示的兩個系統實際上都是 __Agent系統__。它們是軟體系統，其中至少有一個軟體元件在語義上感知環境並盡其所能回應以滿足模糊的目標。​

- 基本的聊天迴圈實際上只是一個迴圈，在迴圈中從大型語言模型(LLM)和使用者採樣回應。環境就是整個訊息匯流排(message bus)，Agent是您和大型語言模型(LLM)，而流程(process) 由Agent之間流動的回應所表示。​

- 局部視角(local-perspective) 系統也在一個迴圈中定義，非常相似但對於多個不同角色(personas)的建模(modeling)有更好的支援。它們從某些全域狀態(global state)系統映射到大型語言模型(LLM)適合處理的方式，並以相同方式映射回全域狀態。​

我們在技術上依賴LangChain軟體架構(software stack)在大量的抽象層(a plethora of abstractions)之下連接到我們的模型，但我們實際上只是使用一些簡單的基本元件來使我們的Agent系統運作。真正有趣的部分涉及組織這些基本元件，以創建協同(synergized)元件，來讓我們的Agent——甚至人類——能夠適當地溝通。​

__在這個Notebook中，我們將簡要介紹CrewAI作為一個值得關注的潛在框架__。雖然本課程不會大量使用CrewAI——我們將很快解釋原因——但了解以下內容很重要:​

- CrewAI是什麼。​

- CrewAI解決哪些問題。​

- 為什麼人們可能選擇使用它。​

<br>


## 什麼是CrewAI?

以下是[官方CrewAI文件](https://docs.crewai.com/introduction)的直接摘錄（採樣於2025年2月21日）:​

<img src="images/crewai-purpose.png" style="width: 800px"/>


<!-- > **CrewAI 是一個用於流程協調管理(Orchestration)自主 AI Agent 的尖端框架.**
> 
> CrewAI 使您能夠創建 AI 團隊,其中每個 Agent 都具有特定的角色、工具和目標,共同協作以完成複雜的任務。.
>
> CrewAI 使您能夠創建 AI 團隊,其中每個 Agent 都具有特定的角色、工具和目標,共同協作以完成複雜的任務。CrewAI 使您能夠創建 AI 團隊,其中每個 Agent 都具有特定的角色、工具和目標,共同協作以完成複雜的任務。 -->

如以上的宣稱所述，CrewAI是一個構建良好且通用的多Agent框架，這大致意味著它具有:​

- 它內建使用的通信(Correspondence)機制。​

- 它所宣稱的一些可以簡化整個流程的核心工作流程。​

- 定義的一些基本元件(primitives)，使這些工作流程易於執行。​

- 發布到正式環境(Production)化的路徑，用於多租戶(multi-tenant)和並行(concurrent)執行。(稍後詳述)​

在下一節中，我們將利用其一些內建基本元件，研究該系統如何運作，並考慮何時可能使用它。​

### CrewAI心智圖

像所有框架一樣，CrewAI對Agent系統應該如何構建/它最優先支援哪些類型有一套核心想法。以下是他們為初次了解此框架的人提供的最新工作心智圖。​

<img src="images/crewai-mindmap.png" style="width: 800px"/>
每當您看到這樣的內容時，請理解這是一種可能作為實作Agent的概念(abstractions)的思考方向。每個思考方向都有其優缺點，我們認為在倡導CrewAI的同時不針對其特定做法進行詳細教學是重要的。​

明確的說，他們的想法(abstractions)足以執行本課程範圍內涵蓋的流程，我們鼓勵您在課程結束後針對更複雜的使用案例親自嘗試!​


#### 定義我們的大型語言模型(LLM)客戶端

儘管CrewAI和LangChain確實有一些共享的整合(integrations)和相容性層，但CrewAI一開始就喜歡遵循自己對大型語言模型(LLM)客戶端的定義，這與LangChain的不同。​

歸根結底，它們都做大致相同的事情，但為兩個框架實作了不同的介面以供使用。因此，我們需要以稍微不同的方式構建我們的介面:​

```python
from crewai import LLM

llm = LLM(
    model="meta/llama-3.1-8b-instruct",
    provider="openai",
    base_url="http://llm_client:9000/v1",
    temperature=0.7,
    api_key="PLACEHOLDER",                           ## API key is required by default.
)

llm.call(messages=[{"role": "user", "content": "What is the capital of France?"}])  ## Call, not "invoke"
```


#### 定義我們的"鏈(Chain)基本元件 (Primitives)"

在LangChain中，可運行物件(runnable)介面讓我們能夠輕鬆地將多個元件鏈(Chain)接在一起，以鏈接緩衝區和/或簡單的調用​。回想一下無處不在的`prompt | llm | StrOutputParser()`鏈(Chain)，並注意我們稍後將探索這些想法(abstractions)更有趣的副產品​。

在CrewAI中，他們的許多核心基本元件更專門用於表示非常特定的機制，這些機制以非常明確定義的方式與代理式通信緩衝區(Agentic Communication Buffer)互動。例如，以下儲存格顯示了最小CrewAI `Crew` 的典型構造，或向工作目標進行的Agent池(Agent pool):​

> 您可以定義一個或多個CrewAI [Agents](https://docs.crewai.com/concepts/agents) ，這些是基於角色(persona-based)的Agent會與其他Agent溝通(communicate)。結合Prompts 工具(utility)的概念(abstraction)，`task_execution()`方法為您提供Agent的基礎提示(Prompt)（稍後可以通過其他機制添加）。​
>
> 相比之下，[Task](https://docs.crewai.com/concepts/tasks) 概念(abstraction)為您的Agent指定實際指令以執行。這需要一組不同的參數，封裝Agent實體(Entity)以溝通哪些Agent可以在這個流程中幫忙，並透過`.prompt()`方法計算(computes)適當的提示(Prompt)元件。​
>
>最重要的是， [Crew](https://docs.crewai.com/concepts/crews) 概念(abstraction)包含Task和Agent，並允許它們以順序或階層結構(Hierarchy)方式溝通(communicate)（透過`Process`類別）以實現`Tasks`清單。​

__更簡單地說，CrewAI的主要概念(abstraction)讓您:​__

- __定義Agent__，它們具有角色(personas)、背景和通用目標。​

- __定義任務(Task)__，可以由Agent子集以某種方式執行。​

- __定義Agent團隊(Crew)__，它們使用各種見證機制處理一組組的任務(groups of tasks)。​

這導致控制流決策(control flow decisions)和提示(Prompt)注入(injections)最終到達您的大型語言模型(LLM)端點(Endpoints)，而產生的回應有助於引導(guide)對話和執行環境。​

### 查看一些程式碼

我們已經討論了典型的CrewAI工作流程，讓我們看看它如何對應到實際程式碼:​

```python
from crewai import Agent
from crewai.utilities import Prompts

## - You can define one or more CrewAI `Agent`s, which are persona-based agents that communicates with other Agents.
##     - Combined with the `Prompts` utility abstraction, the `task_execution()` method gives you a base prompt for the agent 
##       (which can be added to by other mechanisms later).

## https://docs.crewai.com/concepts/agents#direct-code-definition

teacher_agent = Agent(
    role='Teacher',
    goal="Help students with concerns and make sure they are learning their material well.",
    backstory=(
        "You are a computer science teacher in high school holding office hours, and you have a meeting."
        " This is the middle of the semester, and various students have various discussion topics across your classes."
        " You are having a meeting right now. Please engage with the student."
    ),
    verbose=True,     ## Enable detailed execution logs for debugging
    memory=True,
    llm=llm,
)

student_agent = Agent(
    role='Student',
    goal="Be a good student while also maintaining personal interests and a healthy social life.",
    backstory=(
        "You are taking Dr. John's intro to algorithms course and are struggling with some of the homework problems."
    ),
    verbose=True,     ## Enable detailed execution logs for debugging
    memory=True,
    llm=llm,
)

print(Prompts(agent=teacher_agent).task_execution())
print("*" * 64)
print(Prompts(agent=student_agent).task_execution()["prompt"])
```



此範例使用預設提示(Prompt)模板，其語言可以在[這裡](https://github.com/crewAIInc/crewAI/blob/main/src/crewai/translations/en.json)找到。可以自訂提示(Prompt)以實現特定行為。​

```python
from crewai import Task

## - In contrast, the `Task` abstraction specifies actual directives for your agents to execute on.
##     - This requires a different set of arguments, encapsulates `Agent` entities to communicate which ones can work
##       on the process, and computes an appropriate prompt component via the `.prompt()` method.

## https://docs.crewai.com/concepts/tasks#direct-code-definition-alternative

teacher_task = Task(
    description="Engage in dialog to help the student out.",
    expected_output="Conversational output that is supportive and helpful.",
    agent=teacher_agent,
    async_execution=False,
    # human_input=True,     ## Human-in-the-loop mechanism to correct the agent responses 
)

student_task = Task(
    description="Meet with your teacher to help you understand class material.",
    expected_output="Conversational responses",
    agent=student_agent,
    async_execution=False,
    # human_input=True,     ## Human-in-the-loop mechanism to correct the agent responses 
)

teacher_task.prompt()
```


`Agent`　和`Task`也可以使用`tools`初始化，我們稍後會詳細討論。​

```python
from crewai import Crew, Process

## - And to top it off, the `Crew` abstraction contains both `Task`s and `Agent`s, and allows them to communicate 
##   (via a `Process` class) in a sequential or hierarchical manner to achieve the list of `Tasks`.

chatbot_crew = Crew(
    ## Shift state between teacher and student 4 times (i.e. t->s->t->s->...->s)
    agents=[teacher_agent, student_agent] * 4,
    tasks=[teacher_task, student_task] * 4,
    process=Process.sequential,     ## By default, tasks in CrewAI are managed through a sequential process. However,
                                    ##  adopting a hierarchical approach allows for a clear hierarchy in task management,
                                    ##  where a ‘manager’ agent coordinates the workflow, delegates tasks, and validates
                                    ##  outcomes for streamlined and effective execution. Configuring the manager_llm
                                    ##  parameter is crucial for the hierarchical process. 
    verbose=True,
)
```

```python
## Kick off the routine. If there are any {var}s in an agent/task prompt, you can specify inputs={'var': value, ...}
chatbot_crew.kickoff()
```


### __反思(Reflection):__ 這比LangChain更好嗎?

___有時是，有時不是!​___

- 對於一般的大型語言模型(LLM)工程，__LangChain提供的基本元件更加靈活__。本課程涵蓋範圍之外還有許多模組和相容性層(compatability layers)，它們可用於製作近乎任意的資料管線(Pipeline)，具有優良的隱藏屬性，有助於最終的正式環境(Production)化。​

- 對於利用基於角色系統(persona-based)的Agent應用程式，__當您想要部署一群有清楚角色的Agent群組時，CrewAI可能是最簡單的入門方式__。您已經可以看到有很多內建(baked-in)假設，檢查參數列表將揭示各種自訂選項，有助於減輕開發者對系統規格說明和眾多樣板(boilerplate)的痛苦。​

- 對於需要更複雜狀態管理(state management)系統的高度客製化應用程式，__LangGraph是我們稍後將利用的另一個絕佳選項__。這個框架使深入自訂領域變得容易，同時仍然堅持核心想法(abstraction)，但它通常也需要對Agent系統設計有更好的理解，因此具有更高的學習曲線。​

從進入Agent的角度來看，可以說CrewAI框架更容易上手，因為它將您限制在某些特定的工作流程作法(Paradigm)中。所有這些作法(Paradigm)都可以使用LangChain或LangGraph提供的基本元件來製作，但一個有主見(opinionated)的框架具有重要價值，該框架為您做出艱難的決定，只讓您進入其設計概念(abstraction)而不會帶來太多複雜度。因此，當我們看到CrewAI會有助於課程敘述時，我們將嘗試指出　__CrewAI__ 的範例解決方案。​

<br>
<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>



