<br>
<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>
</a>
<h1 style="line-height: 1.4;"><font color="#76b900"><b>使用 LLMs 建構 Agentic AI 應用程式</h1>
<h2><b>課程練習 3:</b> 使用 LangGraph 實作 Persona System </h2>
<br>


.

...



在先前的章節中，你探索了如何使用 LangGraph 來流程協調管理(Orchestration)節點(Node)與邊(edges)，以建構基本的 Agent 工作流程。現在，讓我們重新審視第一節中關於教師、學生與家長的小型 persona agent 問題。我們現在已經具備結構化輸出與 LangGraph 的經驗，也許我們可以使用這個新的想法來流程協調管理(Orchestration)我們的系統?你將會學到如何設定每個 persona 的資料、建立統一的提示(Prompt)格式、生成結構化的 JSON 回應，並在狀態圖(state graph)中將這些 Agent 串連在一起。

### 學習目標:

__在本 Notebook 中，我們將:__

- 練習使用 LangGraph，並熟悉其狀態管理的想法。
- 根據 LLM 的指示嘗試實作適當的任務派送（Routing）(相對於我們在 Notebook 2t 中失敗的 ReAct 嘗試)。

```python
from langchain_nvidia import ChatNVIDIA

## NOTE: Each of these models may have slight difference in performance/assumptions.
## Some may also be overloaded at any given time. 
## Please check on the build endpoints and find models which you'd like to use.

# llm = ChatNVIDIA(model="meta/llama-3.1-8b-instruct", base_url="http://llm_client:9000/v1")
llm = ChatNVIDIA(model="meta/llama-3.3-70b-instruct", base_url="http://llm_client:9000/v1")
```

<hr><br>


### Part 1: 引入我們的 Personas

你可能還記得我們在基礎 Python 中的客製化系統以及在 CrewAI 中的簡化系統，所以讓我們將這些規格整合在一起，建立我們的幾個 personas:

```python
teacher_args = dict(
    role="John Doe (Teacher)",
    backstory=(
        "You are a computer science teacher in high school holding office hours, and you have a meeting."
        " This is the middle of the semester, and various students have various discussion topics across your classes."
        " You are having a meeting right now. Please engage with the students and help their parent."
    ), 
    directive="You are having a meeting right now. Please engage with the other speakers and help them out with their concerns.",
)

student1_args = dict(
    role="Jensen (Student)",
    backstory="You are taking Dr. Doe's intro to algorithms course and are struggling with some of the homework problems.", 
    directive="Meet with your teacher to help you understand class material. Respond and ask directed questions, contributing to discussion.",
)

student2_args = dict(
    role="Albert (Student)",
    backstory="You are taking Dr. Doe's intro to algorithms course and are struggling with some of the homework problems.", 
    directive="Meet with your teacher to help you understand class material. Respond and ask directed questions, contributing to discussion.",
)

parent_args = dict(
    role="Sally (Parent)",
    backstory="You are here with your kids, who are students in the teacher's class.", 
    directive="Meet with your kids and the teacher to help support the students and see what you can do better.",
)

agent_unique_spec_dict = {args.get("role"):args for args in [teacher_args, student1_args, student2_args, parent_args]}
```

<br>

現在，讓我們建構一個 `ChatPromptTemplate`，它足夠靈活以適用於每個 persona。你會看到以下占位符(Placeholder):

- 來自我們 agent 規格的` {role}`、`{backstory}` 與 `{directive}`。
- 一個用於最終 schema_hint 的空間，我們將使用它來協助路由我們的系統。
- 訊息占位符(Placeholder)，它將包含到目前為止的對話訊息。

```python
from langchain_core.prompts import ChatPromptTemplate
from course_utils import SCHEMA_HINT  ## <- Convenience method to get schema hint template

## Define the structured prompt template
prompt = ChatPromptTemplate.from_messages([
    ("system", (
        "You are {role}. {backstory}"
        "\nThe following people are in the room: {role_options}."
        " {directive}\n" f"{SCHEMA_HINT}"
    )),
    ("placeholder", "{messages}"),
])
```

<hr><br>



### Step 2: 定義我們的回應結構描述(Response Schema)

使用與 Notebook 2 相似的邏輯，我們可以為我們的系統賦予結構化輸出，不僅協助我們獲得自然語言回應，還能生成路徑變數，我們可以用它來路由我們的對話。

根據當前狀態的合法路徑來引導解碼有點難以管理，但可以透過調整發送到 LLM 端點(Endpoints)的結構描述(Schema)來控制。下方定義了一個便利方法 `get_finite_schema`。

```python
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Literal

## Definition of Desired Schema
class AgentResponse(BaseModel):
    """
    Defines the structured response of an agent in the conversation.
    Ensures that each agent response includes the speaker's identity,
    a list of response messages, and a defined routing option.
    """
    speaker: Literal["option1", "option2"] = Field(description="Who are you responding as?")
    response: List[str] = Field(description="Response to contribute to the conversation")
    route: Literal["option1", "option2"] = Field(description="A choice of the next person")

    @classmethod
    def get_default(cls):
        return cls(speaker="option1", response=[], route="option1")
    
    @classmethod
    def get_finite_schema(cls, key_options: Dict[str, List[str]]) -> Dict[str, Any]:
        """
        Dynamically modifies the schema to adjust the possible routing options.
        This is useful for ensuring the model respects dynamic conversation flows.
        """
        schema = cls.model_json_schema()
        for key, options in key_options.items():
            if "enum" in schema["properties"].get(key, {}):
                schema["properties"][key]["enum"] = options
            if "items" in schema["properties"].get(key, {}):
                schema["properties"][key]["items"] = {'enum': options, 'type': 'string'}
        return schema

role_options = list(agent_unique_spec_dict.keys()) + ["End"]
schema_hint = AgentResponse.get_finite_schema({"speaker": role_options[:1], "route": role_options})
schema_hint
```

<br>


就這樣，我們現在擁有填充提示(Prompt)模板所需的本地與全域規格。這些將作為我們建構專用 __Agent__ 類別的參數。

```python
## Shared parameters across agents
shared_args = dict(
    llm=llm, 
    schema=AgentResponse.get_default(), 
    schema_hint=schema_hint, 
    prompt=prompt, 
    routes=role_options, 
    roles=role_options
)

## Initialize agent specifications with shared parameters
agent_spec_dict = {
    role: {**unique_specs, **shared_args} 
    for role, unique_specs in agent_unique_spec_dict.items()
}
```


<hr><br>

### Step 3: 定義我們的 Agent 類別

為了讓我們最終的流程協調管理(Orchestration)圖保持簡潔，我們可以實作一些具有狀態的 agents，就像我們在 CrewAI 範例中找到的那些一樣。

- 為了堅持我們理論導向的 agentics 方法，通往與來自 LLM 的介面被稱為 `_convert_to_local` 與 `_convert_to_global`。如果你檢視它們，你會發現它們看起來非常眼熟。

- 你會注意到在 `_get_llm` 中，我們使用我們希望 LLM 從中選擇(或沒有選擇權)的類別來參數化 `get_finite_method`。請注意，這不是 LangChain/LangGraph 官方支援的方法，只是為了簡化我們的程式碼庫。

- 我們上次並沒有特別提到，但你會注意到我們使用 `.invoke` 呼叫 llm。如果當我們實際使用這個類別時它開始串流(stream)輸出，那就太奇怪了...

```python
from langchain_core.output_parsers import JsonOutputParser 
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field, ValidationError
from typing import List, Literal, Dict, Any
import ast


class Agent:
    """
    Represents an interactive agent that responds to messages in a structured format.
    Each agent is initialized with an LLM and a predefined prompt to ensure consistency.
    """
    
    def __init__(self, llm, prompt, role, routes, schema=None, **kwargs):
        self.llm = llm
        self.role = role
        self.prompt = prompt
        self.routes = routes
        self.schema = schema
        ## Let's funnel all of our prompt arguments into the default_kwargs
        self.default_kwargs = {**kwargs, "role": self.role, "role_options": "/".join(self.routes)}

    def __call__(self, config=None, **kwargs):
        """
        Calls the agent with a given message and retrieves a structured response.
        """
        kwarg_pool = {**self.default_kwargs, **kwargs}
        global_inputs = kwarg_pool.get("messages")
        local_inputs = self._convert_to_local(**{**kwarg_pool, "messages": global_inputs})
        local_outputs = self._invoke_llm(**{**kwarg_pool, "messages": local_inputs})
        global_outputs = self._convert_to_global(**{**kwarg_pool, "messages": local_outputs})
        return global_outputs
    
    def _get_llm(self, **kwargs):
        """
        Retrieves the LLM with the appropriate structured output schema if available.
        """
        if self.schema:
            if hasattr(self.schema, "get_finite_schema"):
                current_schema = self.schema.get_finite_schema({
                    "speaker": [self.role], 
                    "route": [r for r in self.routes if r != self.role],
                })
            else: 
                current_schema = getattr(self.schema, "model_json_schema", lambda: self.schema)()
            return self.llm.with_structured_output(schema=current_schema, strict=True)
        return self.llm
    
    def _invoke_llm(self, config=None, **kwargs):
        """
        Invokes the LLM with the constructed prompt and provided configuration.
        Adds debugging support to inspect inputs.
        """
        llm_inputs = self.prompt.invoke(kwargs)
        # print("\nINPUT TO LLM:", "\n".join(repr(m) for m in llm_inputs.messages[1:]))
        llm_output = self._get_llm(**kwargs).invoke(llm_inputs, config=config)
        # print("\nOUTPUT FROM LLM:", repr(llm_output))
        return [llm_output]

    def _convert_to_local(self, messages: List[tuple], **kwargs) -> List[tuple]:
        """
        Converts input messages into a format suitable for processing by the LLM.
        """
        dict_messages = self._convert_to_global(messages)
        roled_messages = [(v.get("speaker"), v.get("response")) for v in dict_messages]
        local_messages = list((
            "ai" if speaker == self.role else "user", 
            f"[{speaker}] " + '\n'.join(content) if isinstance(content, list) else content
        ) for speaker, content in roled_messages)
        return local_messages
    
    def _convert_to_global(self, messages, **kwargs) -> Dict[str, Any]:
        """
        Converts various response formats into a structured dictionary format.
        Handles potential edge cases, including string responses.
        """
        outputs = []
        for msg in messages:
            if isinstance(msg, tuple):
                outputs += [{"speaker": msg[0], "response": msg[1]}]
            elif isinstance(msg, dict):
                outputs += [msg]
            elif isinstance(msg, str) or hasattr(msg, "content"):   
                try:
                    outputs += [ast.literal_eval(getattr(msg, "content", msg))]  ## Strongly assumes good format
                except (SyntaxError, ValueError) as e:
                    print(f"Error parsing response: {e}")
                    outputs += [{"speaker": "Unknown", "response": ["Error encountered"], "route": "End"}]
            else:
                print(f"Encountered Unknown Message Type: {e}")
                outputs += [{"speaker": "Unknown", "response": ["Error encountered"], "route": "End"}]
        return outputs
    

## Initialize conversation
messages = [("Jensen (Student)", "Hello! How's it going?")]

## Start with the first agent
teacher_agent = Agent(**list(agent_spec_dict.values())[0])
response = teacher_agent(messages=messages)[0]
print(response)
messages.append((response.get("speaker"), response.get("response")))

## TODO: Route to the next agent based on response
next_agent = Agent(**agent_spec_dict.get(response.get("route"), {}))
response = next_agent(messages=messages)[0]
print(response)
messages.append((response.get("speaker"), response.get("response")))

## TODO: Continue the conversation
next_agent = Agent(**agent_spec_dict.get(response.get("route"), {}))
response = next_agent(messages=messages)[0]
print(response)
```

<details><summary><b>提示</b></summary>

確保充分利用你的訊息緩衝區。也許第一步是將生成的訊息加入緩衝區?從那裡開始，我們只需要根據回應分派任務(route)到適當的 agent...

</details>


<details><summary><b>解答</b></summary>

```python
## Start with the first agent
teacher_agent = Agent(**list(agent_spec_dict.values())[0])
response = teacher_agent(messages=messages)[0]
print(response)
messages.append((response.get("speaker"), response.get("response")))

## TODO: Route to the next agent based on response
next_agent = Agent(**agent_spec_dict.get(response.get("route"), {}))
response = next_agent(messages=messages)[0]
print(response)
messages.append((response.get("speaker"), response.get("response")))

## TODO: Continue the conversation
next_agent = Agent(**agent_spec_dict.get(response.get("route"), {}))
response = next_agent(messages=messages)[0]
print(response)
```

</details>




<hr><br>

### Part 4: 整合所有元件

現在我們擁有所有這些元件，我們可以將它們整合在一起，建立適合此使用案例的 agent 系統。與之前的方式非常相似,我們可以僅使用單一 agent 想法來完成所有這些工作,但每個 agent 可以擁有自己的類別實體(Instance)。作為練習,看看你能否在不查看解答的情況下建構 agent 類別!

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.constants import START, END
from langgraph.graph import StateGraph
from langgraph.types import interrupt, Command
from langgraph.graph.message import add_messages

from typing import Annotated, Dict, List, Optional, TypedDict
import operator

##################################################################
## Define the authoritative state system (environment) for your use-case

class State(TypedDict):
    """The Graph State for your Agent System"""
    messages: Annotated[list, add_messages] = []
    agent_dict: Dict[str, dict]
    speakers: List[str] = []  ## <- use this to keep track of routing/enqueueing

##################################################################
## Define the operations (Nodes) that can happen on your environment

def agent(state: State):
    """Edge option where transition is generated at runtime"""
    agent_dict = state.get("agent_dict")
    current_speaker = state.get("speakers")[-1]
    ## TODO: If a speaker is retrieved properly, construct the agent connector,
    ## generate the response, and route to the appropriate next speaker.
    if current_speaker in agent_dict:
        current_agent = Agent(**agent_dict[current_speaker])
        response = current_agent(**state)[0]
        return Command(update={
            "messages": [("ai", str(response))], 
            "speakers": [response.get("route")],
        }, goto="agent")

##################################################################
## Define the system that organizes your nodes (and maybe edges)

builder = StateGraph(State)
builder.add_node("agent", agent)
builder.add_edge(START, "agent")  ## A start node is always necessary
```

```python
from course_utils import stream_from_app
from functools import partial
import uuid

checkpointer = MemorySaver()
app = builder.compile(checkpointer=checkpointer)
config = {"configurable": {"thread_id": uuid.uuid4()}, "recursion_limit": 1000}
app_stream = partial(app.stream, config=config)

## We can stream over it until an interrupt is received

initial_inputs = {"messages": [], "agent_dict": agent_spec_dict, "speakers": list(agent_spec_dict.keys())[:1]}
for token in stream_from_app(app_stream, input_buffer=[initial_inputs], verbose=False, debug=False):
    if token == "[Agent]: ":
        print("\n", flush=True)
    print(token, end="", flush=True)
```


<hr><br>

### Part 5: 反思此練習

這很可能是你今天實作的最困難系統。我們必須遵循 LangGraph 邏輯、定義一些客製化的非直觀工具,並在每個步驟驗證我們的決策。到現在你可能已經看到,這比我們在 CrewAI 中的方法困難得多,這沒關係!LangGraph 的部分吸引力在於,事實上,它是一個高度可客製化的解決方案,可以相對輕鬆地擴展到正式環境(Production),並在任何層級定義高度的可觀察性與控制。

你可能記得 LangGraph ReAct 迴圈從我們的模型(model)開箱即用效果不太好,儘管它是以合理的方式實作的,因此不同的模型(model)實際上會運作得更好。我們可以完全顛覆這個想法並完全按照我們想要的方式製作它,就像我們在這裡所做的那樣,這才是真正值得欣賞的特性。而且,在評量(Assessment)之前我們需要提供一些練習,所以...很合適!

__在下一節中,準備好嘗試評量(Assessment),看看你是否能根據我們今天討論的工具製作一個有趣的研究 agent!(但在那之前,暖身練習可能會很有趣)__

<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>


.

...

