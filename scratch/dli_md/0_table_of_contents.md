<br>
<a href="https://www.nvidia.com/en-us/training/">
    <div style="width: 55%; background-color: white; margin-top: 50px;">
    <img src="https://dli-lms.s3.amazonaws.com/assets/general/nvidia-logo.png"
         width="400"
         height="186"
         style="margin: 0px -25px -5px; width: 300px"/>
</a>
<h1 style="line-height: 1.4;"><font color="#76b900"><b>使用 LLMs 建構 Agentic AI 應用程式</b></h1>



<h2><b>課程大綱</b></h2>

### **歡迎參加本課程!** 

本課程探討如何使用大型語言模型(large language models)建構 Agent 人工智慧應用程式。你將學習建立能夠進行分析推理(Reasoning)、使用工具(tools)，並透過 LangChain、LangGraph 和 CrewAI 的實作練習來與環境互動的系統。.

**在整個課程中，你將可以存取多個運行中的(Live)服務，這些服務為你的開發環境提供支援:**

```python
%%html
<iframe src="services.html" width="100%" height="600px" style="border:1px solid #ccc; border-radius:4px;"></iframe>
```



## <font color="#76b900">課程結構</font>
本課程分為以下幾個部分：

##### <font color="#76b900">第 1 部分：製作簡單的 Agent</font>
- 1a_basic_chat.ipynb - 建構你的第一個聊天機器人(chatbot)和多 Agent 系統
- 1e_dataset_chat.ipynb - 建立與資料集(datasets)互動的聊天機器人
- 1t_crewai.ipynb - 探索以角色為基礎的 Agent 的 CrewAI 框架(framework)

##### <font color="#76b900">第 2 部分：架構化思考與輸出</font>
- 2a_structured_thought.ipynb - 學習架構化大型語言模型(LLM)的分析推理(Reasoning)與輸出
- 2e_metadata_gen.ipynb - 生成結構化的中介資料(Metadata)和長篇的(long-form)文件
- t_tools.ipynb - 建構具備工具化(Tooling)功能的大型語言模型(LLM)系統

##### <font color="#76b900">第 3 部分：使用 LangGraph</font>
- 3a_langgraph.ipynb - 精通用於 Agent 式工作流程(workflows)的 LangGraph
- 3e_custom_persona.ipynb - 實作具有路由(routing)功能的自訂角色系統

####  <font color="#76b900">第 4 部分：評量(Assessment)</font>
- 4a_retriever.ipynb - 建構基礎的檢索增強(Retrieval-augmented)系統（暖身）
- 4e_researcher.ipynb - 建立研究型 Agent（最終評量）

<hr><br>

## <font color="#76b900">第一步：測試你的環境</font>

讓我們驗證所有服務是否正常運行：

```python
import requests

print("🔍 Checking running services...\n")

services = {
    "LLM Client": "http://llm_client:9000/v1/models",
    "Docker Router": "http://docker_router:8070/health",
    "Jaeger (Tracing)": "http://jaeger:16686",
    "DDG Cache": "http://ddg-cache:7860",
    "LangGraph Viz": "http://lg_viz:3002",
}

for name, url in services.items():
    try:
        response = requests.get(url, timeout=5)
        status = "Running" if response.status_code == 200 else f"Status {response.status_code}"
    except Exception as e:
        status = f"Not accessible"
    print(f"{name:20} {status}")
```

```python
print("\nTesting the LLM...\n")

from langchain_nvidia import ChatNVIDIA

llm = ChatNVIDIA(model="meta/llama-3.1-8b-instruct", base_url="http://llm_client:9000/v1")
prompt = "Say hello in one sentence!"
response = llm.invoke(prompt)
print(response.content)

for token in llm.stream([("human", prompt), ("ai", response.content), ("user", "Now say goodbye!")]):
    print(token.content, end="", flush=True)
```


### 額外資源

- 可觀測性(Observability)：造訪 Jaeger UI 以追蹤系統中的請求
- 日誌(Logs)：查看 Dozzle 以取得即時日誌串流
- 資料庫(Database)：在 DbGate 中探索快取資料
- LangGraph 視覺化：在 LangGraph Viz 檢視執行圖表(graphs)


### 準備好開始了嗎？
從 __1a_basic_chat.ipynb__ 開始建構你的第一個 Agent，或探索任何你感興趣的部分。所有 Notebook 都是獨立的，並具有明確的學習目標。

<center><a href="https://www.nvidia.com/dli"> <img src="https://dli-lms.s3.amazonaws.com/assets/general/DLI_Header_White.png" alt="Header" style="width: 400px;"/> </a></center>



