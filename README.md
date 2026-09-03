# Concall Intelligence Pipeline

[![Pipeline Status](https://img.shields.io/badge/Pipeline-Production_Ready-brightgreen)](#overview)
[![Phase 8D-P Validated](https://img.shields.io/badge/Infosys_Q1_FY25-Successfully_Summarized-blue)](#phase-8d-p-validation--real-data-authenticity)
[![Tech Stack](https://img.shields.io/badge/Stack-Node.js_|_Express_|_React_|_PostgreSQL_|_Redis_|_WebSockets-blue)](#tech-stack)

An end-to-end real-time intelligence platform designed to monitor, extract, chunk, summarize, and serve structured insights from earnings call transcripts filed by listed companies on the **National Stock Exchange (NSE)** and **Bombay Stock Exchange (BSE)**.

---

## Architecture Overview

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

1. **Watcher Component**: Polls official exchange feeds (NSE/BSE) for raw corporate announcement filings.
2. **Ingestion & Text Extractor**: Downloads PDFs, parses native text via `pdf-parse`/`pdfjs-dist`, cleans structural whitespace, and validates text quality.
3. **Text Chunker**: Splits transcripts into semantic, overlap-aware chunks based on sentence boundaries and token thresholds.
4. **Hierarchical Map-Reduce Summarization Engine**:
   - **MAP Phase**: Runs parallel/sequential structured extractions per chunk for executive commentary, financial metrics, guidance, risks, and structured Q&A exchanges.
   - **Adaptive Hierarchical REDUCE Phase**: Consolidates chunk outputs recursively if prompt size exceeds UTF-8 payload limits (protecting against HTTP 413 Payload Too Large).
   - **TPM & RPM Rate-Limit Handling**: Backs off dynamically based on Groq API headers (`x-ratelimit-reset-tokens`, `x-ratelimit-reset-requests`) when rate limits occur.
5. **Persistence & Serving Layer**: Validates JSON schema via Zod, generates formatted Markdown, stores records in PostgreSQL, and broadcasts real-time events via WebSockets.

---

## Tech Stack

| Component | Technologies |
|:---|:---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons |
| **Backend API** | Node.js, Express, TypeScript, `ws` (WebSockets) |
| **Database & ORM** | PostgreSQL 16 (WIN1252/UTF-8 compatible), Drizzle ORM |
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
3. **Extract**: Extracts and cleans raw text into `data/extracted/<filename>.txt`, generating quality metrics.
4. **Summarize**: Runs 9-chunk MAP extractions, adaptive hierarchical REDUCE, and final JSON schema validation.
5. **Serve**: Persists summary to PostgreSQL, emits `summary.completed` via WebSocket, and serves REST requests to the React UI dashboard.

---

## Phase 8D-P Validation & Real Data Authenticity

In **Phase 8D-P**, the pipeline successfully completed an end-to-end real production summarization of the full **Infosys Q1 FY25 Earnings Call Transcript**:

- **Company**: Infosys Limited (`INFY`)
- **Quarter**: Q1 FY25
- **Document Specs**: 25 pages, ~50,003 extracted characters
- **Filing Record ID**: `c5712768-b653-4765-b343-3a11bd966096`
- **Summary Record ID**: `8f1608b5-8638-4a56-a600-21b8b3cf73a9`
- **Filing Status**: `COMPLETED`
- **LLM Provider**: Groq (`openai/gpt-oss-120b`)
- **Validation**: 100% Zod schema validation passed, zero mock data used, PostgreSQL WIN1252 encoding sanitized.

---

## Database Schema Overview

The database schema is defined using Drizzle ORM in `packages/shared/src/schema`:

- `companies`: Core company directory (Symbol, Name, BSE Code, ISIN, Industry, Aliases).
- `filings`: Corporate filing records tracking lifecycle state (`DISCOVERED` → `DOWNLOADED` → `EXTRACTED` → `SUMMARIZED` / `COMPLETED` / `FAILED`).
- `transcripts`: Extracted text artifacts with page counts, character counts, and extraction quality metrics.
- `summaries`: Structured AI summaries containing `summaryJson` (Zod verified) and `summaryMarkdown`.

---

## Environment Variables

Copy `.env.example` to `.env` in the root directory:

```env
# Node Environment
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgres://postgres@localhost:5433/concall_db

# Redis Configuration
REDIS_URL=redis://localhost:6379

# LLM Provider Configuration
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
LLM_REQUEST_DELAY_MS=5000

# Backend Server Ports
PORT=3001
WS_PORT=3002
```

---

## Setup & Running the Project

### Prerequisites
- Node.js >= 18
- pnpm >= 9
- PostgreSQL 16+ (running on port 5433 or configured in `.env`)
- Redis 7+ (running on port 6379)

### 1. Install Workspace Dependencies
```bash
pnpm install
```

### 2. Set Up Database Schema & Seed Data
```bash
pnpm --filter @concall/backend db:push
pnpm --filter @concall/backend db:seed
```

### 3. One-Command Startup (Backend + Frontend)
```bash
pnpm dev
```
- **Backend API Server**: `http://localhost:3001`
- **WebSocket Gateway**: `ws://localhost:3002`
- **Frontend Dashboard**: `http://localhost:5173`

### 4. Running Full Test Suite & Build Verification
```bash
pnpm typecheck
pnpm --recursive run test
pnpm build
```

---

## Manual Ingestion CLI

To ingest a transcript manually:

```bash
pnpm --filter @concall/backend ingest:manual --file "data/raw/INFY_Q1_FY25_Transcript.pdf" --company "INFY" --quarter "Q1 FY25" --source "BSE"
```

---

## Sample Output Locations

Sample artifacts from the verified Infosys Q1 FY25 transcript are located at:

- **Raw Transcript PDF**: `data/raw/INFY_Q1_FY25_Transcript.pdf`
- **Extracted Text**: `data/extracted/INFY_Q1_FY25_Transcript.txt`
- **Structured JSON Summary**: `data/summaries/INFY_Q1_FY25_Summary.json`
- **Rendered Markdown Summary**: `data/summaries/INFY_Q1_FY25_Summary.md`

---

## REST API Endpoints

- `GET /api/health`: Health status of backend, PostgreSQL, and Redis connections.
- `GET /api/companies`: List of seeded companies.
- `GET /api/filings/:id`: Filing status and metadata by ID.
- `GET /api/summaries`: Paginated list of generated earnings summaries.
- `GET /api/summaries/:id`: Full structured JSON and Markdown summary by ID.

---

## Known Limitations

1. **Groq Free-Tier Rate Limits (TPM / RPM)**:
   - Free-tier Groq API enforces strict Tokens-Per-Minute (TPM) and Requests-Per-Minute (RPM) rate limits.
   - While the pipeline includes TPM/RPM backoff logic with header detection (`x-ratelimit-reset-tokens`, `x-ratelimit-reset-requests`), rapid repeated runs can exhaust account-level daily quotas. In production, a paid API tier or higher TPM quota model should be configured.
2. **Scanned PDF / OCR Limitation**:
   - The current text extractor relies on native text layer extraction (`pdf-parse` / `pdfjs-dist`).
   - Scanned transcripts without text layers require an OCR engine (such as Tesseract) which is outside the scope of the current native extraction pipeline.
