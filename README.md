# Local AI Chatbot · RAG

Chatbot AI yang berjalan **100% lokal** di laptop Anda — chat streaming + tanya-jawab
atas dokumen sendiri (RAG), tanpa mengirim data ke cloud.

![stack](https://img.shields.io/badge/Next.js-16-black) ![ai](https://img.shields.io/badge/AI%20SDK-6-22c55e) ![ollama](https://img.shields.io/badge/Ollama-CPU-blue)

## Stack

| Lapisan | Teknologi |
|---|---|
| LLM runtime | **Ollama** (CPU) — `qwen2.5:7b-instruct` + `nomic-embed-text` |
| App | **Next.js 16** (App Router, TypeScript) |
| AI/streaming | **Vercel AI SDK 6** + `ollama-ai-provider-v2` |
| Vector store | **LanceDB** embedded (file lokal `./.lancedb`) |
| UI | Tailwind v4, dark OLED, Inter, streaming bubbles + sitasi |
| Parsing | `pdf-parse` (PDF), `mammoth` (DOCX), teks/markdown |
| Guardrail | **Llama Guard 3 (1B)** + pre-filter rule-based (toggle on/off) |
| Riwayat | Persistensi percakapan lokal (JSON di `./.data`) |

## Fitur

- **Chat streaming** token-by-token via Ollama (CPU).
- **RAG**: upload PDF/DOCX/TXT/MD → jawaban dirujuk ke sumber dengan penanda `[n]`.
- **Source viewer**: klik kartu sumber → panel kanan menampilkan **halaman asli**
  (PDF native di halaman yang tepat / teks file) + kutipan relevan.
- **Pencarian web** (keyless, toggle): DuckDuckGo (atau SearXNG via `SEARXNG_URL`).
  Hasil web jadi sumber `[n]` dengan tautan. Tanpa API key.
- **Rerank hybrid** (toggle): fusi BM25 + vektor (RRF) → retrieval lebih akurat,
  tanpa model tambahan.
- **Guardrail keamanan** (toggle): moderasi input dengan Llama Guard 3 + pre-filter
  regex. Permintaan tidak aman diblokir sebelum dikirim ke model.
- **Riwayat percakapan**: otomatis tersimpan + **auto-judul** (model cepat), bisa
  dibuka/hapus dari sidebar (tab Riwayat). **Export** chat ke Markdown.
- **Pengaturan**: pilih model (7B/3B), top-k, toggle RAG / Web / Rerank / Guardrail.

## Arsitektur

```
Ingest:  file → parse (pdf/docx/txt) → chunk → embed (nomic) → LanceDB + simpan file asli
Query:   pesan → [guardrail] → embed query → top-N LanceDB → rerank (BM25+vektor)
                            ↘ web search (opsional) ↗
         → context gabungan → LLM (stream) → jawaban + sitasi [n] → source viewer
```

## Prasyarat

- **Node.js 20+**
- **Ollama** terpasang & berjalan, dengan model:
  ```bash
  ollama pull qwen2.5:7b-instruct
  ollama pull nomic-embed-text
  ollama pull llama-guard3:1b
  ```
  Opsional (mode cepat): `ollama pull llama3.2:3b`

  > Tanpa `llama-guard3:1b`, guardrail otomatis fallback ke pre-filter rule-based saja.

## Menjalankan

```bash
npm install
npm run dev
```
Buka http://localhost:3000

1. Unggah dokumen (PDF/DOCX/TXT/MD) lewat sidebar kiri.
2. Pastikan **Mode dokumen (RAG)** aktif.
3. Tanyakan apa saja — jawaban dirujuk ke sumber (lihat "sumber dirujuk").

## Konfigurasi

Edit [.env.local](.env.local):

| Variabel | Default | Keterangan |
|---|---|---|
| `CHAT_MODEL` | `qwen2.5:7b-instruct` | Model chat utama |
| `CHAT_MODEL_FAST` | `llama3.2:3b` | Model cepat (selector UI) |
| `GUARD_MODEL` | `llama-guard3:1b` | Model moderasi guardrail |
| `EMBED_MODEL` | `nomic-embed-text` | Model embedding (dim 768) |
| `RAG_TOP_K` | `4` | Jumlah potongan yang diambil |
| `RAG_CHUNK_SIZE` / `RAG_CHUNK_OVERLAP` | `900` / `120` | Ukuran chunk (karakter) |
| `SEARXNG_URL` | _(kosong)_ | Opsional: instance SearXNG untuk web search paling andal. Kosong = pakai DuckDuckGo |

> **Web search**: default keyless via DuckDuckGo (butuh internet). Bila jaringan
> memblokir DuckDuckGo, jalankan SearXNG lokal (`docker run searxng/searxng`) dan
> set `SEARXNG_URL`.

## Struktur

```
app/
  api/chat          streaming chat (RAG + web + rerank + guardrail)
  api/ingest        upload → parse → chunk → embed → simpan + file asli
  api/documents     list / delete dokumen
  api/conversations list / save / get / delete riwayat chat
  api/files/[id]    serve file asli (untuk source viewer)
  api/title         auto-judul percakapan (model cepat)
  api/health        cek status Ollama
  page.tsx          UI utama
lib/
  rag/          parse · chunk · embeddings · vectorstore · ingest · retrieve · rerank · files
  websearch.ts  pencarian web keyless (SearXNG / DuckDuckGo) + parser
  guardrail.ts  moderasi Llama Guard + rule-based
  store.ts      persistensi percakapan (JSON)
  ollama.ts     provider Ollama  ·  config.ts  konfigurasi terpusat
components/      Sidebar · Composer · MessageBubble · Sources · SourceViewer · Markdown
```

## Catatan performa

Tanpa GPU NVIDIA, inferensi berjalan di CPU. Pada Intel i7-13620H + 16 GB RAM,
`qwen2.5:7b` ~8–12 token/dtk. Jika terasa lambat, ganti ke **Llama 3.2 3B** dari
selector model di sidebar.
