# Atlas

A private AI assistant with retrieval augmented generation that runs entirely on your machine. Chat with your own documents, search the web, and keep every byte local. No cloud, no API keys.

![Next.js 16](https://img.shields.io/badge/Next.js-16-black) ![AI SDK 6](https://img.shields.io/badge/AI%20SDK-6-E8B339) ![Ollama](https://img.shields.io/badge/Ollama-CPU-blue)

## Features

- Streaming chat powered by local models through Ollama.
- Retrieval augmented generation over your own PDF, DOCX, TXT, and Markdown files.
- Source viewer that opens the original page and highlights the cited passage.
- Keyless web search through DuckDuckGo or a self hosted SearXNG instance.
- Hybrid reranking that fuses vector similarity with BM25 keyword scoring.
- Safety guardrail backed by Llama Guard 3, with a fast rule based pre filter.
- Conversation history with automatic titles and one click Markdown export.
- Adjustable retrieval depth and a switchable chat model.

## Architecture

![Atlas architecture](docs/architecture.svg)

The browser talks to Next.js route handlers. Ingestion parses a file, splits it into chunks, embeds them, and writes vectors to LanceDB. A query passes the guardrail, retrieves matching chunks and optional web results, reranks them, builds grounded context, and streams the answer from Ollama. Everything stays on the device.

## Requirements

- Node.js 20 or newer.
- Ollama installed and running, with these models pulled:

```bash
ollama pull llama3.2:3b
ollama pull qwen2.5:7b-instruct
ollama pull nomic-embed-text
ollama pull llama-guard3:1b
```

Without `llama-guard3:1b` the guardrail falls back to the rule based pre filter.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000, upload a document from the Library tab, then ask a question. Each answer lists the sources it used.

## Configuration

Settings live in `.env.local`.

| Variable | Default | Description |
| --- | --- | --- |
| `CHAT_MODEL` | `qwen2.5:7b-instruct` | High quality chat model |
| `CHAT_MODEL_FAST` | `llama3.2:3b` | Default chat model, fast on CPU |
| `GUARD_MODEL` | `llama-guard3:1b` | Safety moderation model |
| `GUARD_BLOCK` | `S1,S2,S3,S4,S9,S10,S11,S12,S14` | Llama Guard categories that block a request |
| `EMBED_MODEL` | `nomic-embed-text` | Embedding model, 768 dimensions |
| `RAG_TOP_K` | `4` | Number of chunks retrieved |
| `RAG_CHUNK_SIZE` | `900` | Chunk size in characters |
| `RAG_CHUNK_OVERLAP` | `120` | Overlap between chunks |
| `SEARXNG_URL` | empty | Optional SearXNG endpoint for the most reliable web search |

Web search uses DuckDuckGo by default and needs internet access. If your network blocks DuckDuckGo, run a local SearXNG instance and set `SEARXNG_URL`.

## Project structure

```
app/
  api/chat            streaming chat with RAG, web, rerank, and guardrail
  api/ingest          upload, parse, chunk, embed, and index
  api/documents       list and delete documents
  api/conversations   save, load, and delete chat history
  api/files/[id]      serve the original file for the source viewer
  api/title           generate a short conversation title
  page.tsx            main interface
lib/
  rag/                parse, chunk, embeddings, vectorstore, ingest, retrieve, rerank, files
  websearch.ts        keyless web search with SearXNG and DuckDuckGo backends
  guardrail.ts        Llama Guard moderation with a rule based pre filter
  store.ts            conversation persistence
  ollama.ts           Ollama provider
  config.ts           central configuration
components/           Sidebar, Composer, MessageBubble, Sources, SourceViewer, Brandmark
```

## Privacy

Atlas runs every model locally through Ollama. Documents, embeddings, and chat history are written only to your disk under `uploads`, `.lancedb`, and `.data`, all of which are excluded from version control.
