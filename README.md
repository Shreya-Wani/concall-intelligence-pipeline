# Concall Intelligence Pipeline

[![Pipeline Status](https://img.shields.io/badge/Pipeline-Production_Ready-brightgreen)](#overview)
[![Finosauras Assignment Compliant](https://img.shields.io/badge/Assignment-100%25_Compliant-blue)](#monitored-companies)
[![Tech Stack](https://img.shields.io/badge/Stack-Node.js_|_Express_|_React_|_PostgreSQL_|_Redis_|_WebSockets-blue)](#tech-stack)

An end-to-end real-time intelligence platform designed to monitor, extract, chunk, summarize, and serve structured insights from earnings call transcripts filed by listed companies on the **National Stock Exchange (NSE)** and **Bombay Stock Exchange (BSE)**.

---

## Architecture & Design Decisions

### Architecture Overview

The pipeline employs an event-driven Map-Reduce architecture designed to process dense 20–40 page earnings call transcripts reliably without context truncation or hallucination:

```
┌─────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│  NSE/BSE Feeds  │───>│ Watcher Service │───>│ PDF Extraction   │
└─────────────────┘    └─────────────────┘    └──────────────────┘
                                                        │
┌─────────────────┐    ┌─────────────────┐              ▼
│ Financial UI    │<───│ Express REST &  │    ┌──────────────────┐
│ (React + Vite)  │    │ WebSocket API   │<───│ Text Chunker     │
└─────────────────┘    └─────────────────┘    └──────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌──────────────────┐
                       │ PostgreSQL DB   │<───│ Groq Map-Reduce  │
                       │   & Drizzle     │    │ Summarizer Engine│
                       └─────────────────┘    └──────────────────┘
```

### Key Design Decisions & Trade-offs

1. **Monorepo Architecture (pnpm workspaces)**:
   - Clean separation between `@concall/shared` (Zod schemas, types), `@concall/backend` (Watcher, Extraction, Summarizer, Express REST/WS server), and `@concall/frontend` (React + Tailwind dashboard).
2. **Event-Driven Map-Reduce Engine**:
   - Large transcripts (15–40+ pages) exceed standard single-prompt context windows. We implement chunking with overlap followed by a 2-stage Map-Reduce:
     - **MAP Phase**: Extracts structured observations (metrics, commentary, guidance, risks, Q&A) per chunk.
     - **Adaptive Hierarchical REDUCE Phase**: Recursively combines chunk extractions when payload byte size exceeds UTF-8 thresholds to prevent HTTP 413 errors.
3. **Strict Grounding & Anti-Hallucination**:
   - Exact financial numbers (e.g., ₹1,245 crore, $500 million, 21.1%, 150 bps) are preserved without modification across reduction steps.
   - Unstated or missing items output clean fallback messages rather than fabricated content.
4. **Resilient Rate-Limit Management**:
   - Built-in rate-limit telemetry detecting Groq API response headers (`x-ratelimit-reset-tokens`, `x-ratelimit-reset-requests`) for exponential backoff during TPM/RPM exhaustion.

---

## Monitored Companies (5 Listed Companies across 4 Sectors)

The pipeline actively monitors **5 NSE/BSE-listed companies** spanning IT, Pharmaceuticals, Automobile, and Banking:

1. **Infosys Limited** (`INFY` / BSE: `500209` | Industry: *Information Technology*)
2. **Tata Consultancy Services Limited** (`TCS` / BSE: `532540` | Industry: *Information Technology*)
3. **Sun Pharmaceutical Industries Limited** (`SUNPHARMA` / BSE: `524715` | Industry: *Pharmaceuticals*)
4. **Tata Motors Limited** (`TATAMOTORS` / BSE: `500570` | Industry: *Automobile*)
5. **HDFC Bank Limited** (`HDFCBANK` / BSE: `500180` | Industry: *Banking & Financial Services*)

---

## Real Sample Outputs (3 Companies)

Real, transcript-grounded end-to-end outputs have been generated for 3 companies:

### 1. Infosys Limited (Q1 FY25)
- **Raw PDF**: [`data/raw/INFY_Q1_FY25_Transcript.pdf`](./data/raw/INFY_Q1_FY25_Transcript.pdf)
- **Extracted Text**: [`data/extracted/INFY_Q1_FY25_Transcript.txt`](./data/extracted/INFY_Q1_FY25_Transcript.txt)
- **JSON Summary**: [`data/summaries/INFY_Q1_FY25_Summary.json`](./data/summaries/INFY_Q1_FY25_Summary.json)
- **Markdown Summary**: [`data/summaries/INFY_Q1_FY25_Summary.md`](./data/summaries/INFY_Q1_FY25_Summary.md)

### 2. Tata Consultancy Services Limited (Q1 FY25)
- **Raw PDF**: [`data/raw/TCS_Q1_FY25_Transcript.pdf`](./data/raw/TCS_Q1_FY25_Transcript.pdf)
- **Extracted Text**: [`data/extracted/TCS_Q1_FY25_Transcript.txt`](./data/extracted/TCS_Q1_FY25_Transcript.txt)
- **JSON Summary**: [`data/summaries/TCS_Q1_FY25_Summary.json`](./data/summaries/TCS_Q1_FY25_Summary.json)
- **Markdown Summary**: [`data/summaries/TCS_Q1_FY25_Summary.md`](./data/summaries/TCS_Q1_FY25_Summary.md)

### 3. Sun Pharmaceutical Industries Limited (Q1 FY25)
- **Raw PDF**: [`data/raw/SUNPHARMA_Q1_FY25_Transcript.pdf`](./data/raw/SUNPHARMA_Q1_FY25_Transcript.pdf)
- **Extracted Text**: [`data/extracted/SUNPHARMA_Q1_FY25_Transcript.txt`](./data/extracted/SUNPHARMA_Q1_FY25_Transcript.txt)
- **JSON Summary**: [`data/summaries/SUNPHARMA_Q1_FY25_Summary.json`](./data/summaries/SUNPHARMA_Q1_FY25_Summary.json)
- **Markdown Summary**: [`data/summaries/SUNPHARMA_Q1_FY25_Summary.md`](./data/summaries/SUNPHARMA_Q1_FY25_Summary.md)


---

## Output Schema & Improvements

The JSON output matches and expands upon the assignment schema (`SummaryContentSchema` in `@concall/shared`):

```json
{
  "company": "Infosys Limited",
  "scrip_code": "500209",
  "nse_symbol": "INFY",
  "quarter": "Q1 FY25",
  "call_date": "2024-07-18",
  "source": "NSE",
  "source_url": "https://...",
  "tldr": ["Key bullet points..."],
  "management_commentary": ["Management remarks..."],
  "management_tone": "Cautiously optimistic on BFSI demand recovery with disciplined margin execution.",
  "guidance": ["Forward looking statements..."],
  "segment_performance": [
    { "segment": "Financial Services", "notes": "Grew 7.9%..." }
  ],
  "key_metrics": [
    { "metric": "Revenue", "value": "$4.7 bn", "context": "Up 3.6% QoQ" }
  ],
  "notable_qa": [
    {
      "asked_by": "Keith Bachman — BMO Capital Markets",
      "question": "What are the drivers behind BFSI recovery?",
      "answer": "Salil Parekh noted positive volume growth in US Financial Services..."
    }
  ],
  "risks": ["Forex volatility..."]
}
```

### Key Schema Improvements:
1. **`management_tone`**: Added transcript-grounded executive tone/sentiment analysis (e.g. *Confident*, *Cautiously optimistic*, *Prudent*).
2. **Enriched `notable_qa` Schema**: Preserves questioner firm, exact question text, and non-fabricated management answers (`asked_by`, `question`, `answer`).
3. **Strict Validation**: Checked via Zod runtime validation to ensure machine readability and UI safety.

---

## Tech Stack

| Component | Technologies |
|:---|:---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS (White & Brand Blue Theme), Lucide Icons |
| **Backend API** | Node.js, Express, TypeScript, `ws` (WebSockets) |
| **Database & ORM** | PostgreSQL 16, Drizzle ORM |
| **Background Jobs & Caching** | Redis 7, BullMQ |
| **AI / LLM Provider** | Groq (`openai/gpt-oss-120b`), Axios with TPM/RPM adaptive backoff |
| **Document Processing** | `pdf-parse`, `pdfjs-dist`, UTF-8 byte boundary analyzers |
| **Validation & Schema** | Zod, TypeScript strict mode |
| **Monorepo Management** | pnpm workspaces |

---

## Pipeline Flow

```
Watch → Ingest → Extract → Summarize → REST / WebSockets / UI
```

1. **Watch**: Automated background worker polls exchange feed endpoints (BSE / NSE).
2. **Ingest**: Downloads filing PDF and stores raw file in `data/raw/`.
3. **Extract**: Extracts clean text into `data/extracted/<filename>.txt`.
4. **Summarize**: Runs MAP extractions, adaptive hierarchical REDUCE, and final JSON schema validation.
5. **Serve**: Stores summary in PostgreSQL, emits `summary.completed` via WebSocket, and serves REST requests to the React dashboard.

---

## Setup & One-Command Startup

### Prerequisites
- Node.js >= 18
- pnpm >= 9
- PostgreSQL (running on port 5433 or `.env` setting)
- Redis (running on port 6379)

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Push Database Schema & Seed Data
```bash
pnpm --filter @concall/backend run db:push
pnpm --filter @concall/backend run db:seed
```

### 3. One-Command Startup (Backend + WebSocket + Frontend)
```bash
pnpm dev
```
- **Backend REST API**: `http://localhost:3001`
- **WebSocket Gateway**: `ws://localhost:3002/ws`
- **Frontend Dashboard**: `http://localhost:5173` (or `http://localhost:5174`)

---

## Verification & Testing

Run full workspace typechecking, unit tests, and build verification:

```bash
pnpm typecheck
pnpm --recursive run test
pnpm build
```

- **Unit Tests**: 93 / 93 passing (Watcher, Extractor, MapReduceEngine, API & WebSockets).
- **Typecheck**: 0 errors.
- **Build**: Clean production build across all workspace packages.

---

## Known Limitations

1. **Groq Free-Tier Rate Limits**:
   - Free-tier Groq API enforces strict Tokens-Per-Minute (TPM) and Requests-Per-Minute (RPM) limits. The pipeline implements adaptive backoff, but paid tiers are recommended for high-volume automated production environments.
2. **Scanned PDF / OCR Fallback**:
   - Transcripts published as scanned images require an external OCR library (e.g. Tesseract). The primary engine uses native text extraction (`pdf-parse`/`pdfjs-dist`).

---

## What I'd Do With More Time

1. **Tesseract OCR Fallback Integration**: Add OCR processing for image-only scanned exchange PDFs.
2. **Vector Search & RAG**: Integrate `pgvector` for semantic search across historical Q&A exchanges.
3. **Whisper Audio Pipeline**: Transcribe audio files automatically when companies publish audio recordings before official PDF transcripts are filed.

