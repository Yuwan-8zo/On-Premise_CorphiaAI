# Corphia AI Platform — Sample Document

Welcome to Corphia AI! This file is a quick sample to help you try the full pipeline: **upload → auto-vectorize → ask the AI**.

## What is Corphia

Corphia is an **on-premise** enterprise AI platform that bundles together:

- **Local LLMs** running entirely on your own server (Qwen2.5, Llama, Mistral). Your data never leaves the building.
- **Vector database** (pgvector): your documents are chunked, embedded, and stored inside PostgreSQL so the AI can retrieve them by meaning.
- **RAG (Retrieval-Augmented Generation)**: when a user asks a question, the system first finds the most relevant passages from your documents, then sends them to the LLM with explicit source citations.
- **Audit trail**: every conversation, every operation is logged for enterprise compliance.

## Try it out

1. Once you upload this file it goes through:
   - Parsing — read the text content
   - Chunking — split into 200-1000 token segments
   - Embedding — each chunk becomes a 768- or 1024-dim vector
   - Indexing — written to pgvector, plus a BM25 inverted index
2. Switch to "Project" chat mode and add this file to a project.
3. Ask things like: "How does Corphia process data?" or "What embedding model is used?"
4. Watch the AI cite this document, and check the similarity scores in the RAG debug panel.

## Security & Privacy

This file never leaves your server. All inference runs locally; the vectors live in your own PostgreSQL. Corphia ships with PII masking, prompt-injection detection, and DLP topic blocklists so your data stays safe in an enterprise environment.

When demoing to others, remember to switch on **Demo Mode** under Settings → Theme — the admin console will automatically hide absolute paths and other sensitive strings.
