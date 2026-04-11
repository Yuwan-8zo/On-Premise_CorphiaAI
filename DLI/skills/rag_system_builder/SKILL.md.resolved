---
name: RAG System Builder
description: 建構檢索增強生成 (RAG) 系統，整合向量搜尋與 LLM 生成
version: 1.0.0
category: rag_engineering
tags: [rag, retrieval, embedding, vector-search]
author: NVIDIA DLI Course
difficulty: advanced
---

# RAG System Builder

建構完整的 RAG 系統，讓 LLM 能夠存取外部知識庫。

## 前置需求
- Python 3.8+, LangChain, 向量資料庫 (FAISS)

## 步驟

### 1. 文件分塊
```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500, chunk_overlap=50
)
chunks = splitter.split_text(content)
```

### 2. 建立向量索引
```python
from langchain_nvidia import NVIDIAEmbeddings
from langchain_community.vectorstores import FAISS

embed = NVIDIAEmbeddings(model="nvidia/llama-3.2-nv-embedqa-1b-v2")
vectorstore = FAISS.from_texts(chunks, embed)
```

### 3. 檢索與重排序
```python
from langchain_nvidia import NVIDIARerank

# 檢索
docs = vectorstore.similarity_search(query, k=20)

# 重排序
reranker = NVIDIARerank(model="nvidia/llama-3.2-nv-rerankqa-1b-v2")
final_docs = reranker.compress_documents(docs, query)
```

### 4. RAG 生成
```python
context = "\n\n".join([doc.page_content for doc in final_docs])

prompt = f"""
使用以下上下文回答問題:
{context}

問題: {query}
"""

answer = llm.invoke(prompt)
```

## 進階技巧
- **查詢改寫**: 優化搜尋查詢
- **混合搜尋**: 結合向量與關鍵字
- **父文件檢索**: 小片段檢索，大片段上下文

參考: LangChain RAG Tutorial
