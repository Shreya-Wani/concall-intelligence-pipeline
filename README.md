# Concall Intelligence Pipeline

[![Phase 8B Status](https://img.shields.io/badge/Phase_8B-Audited_&_Enforced-blue)](#end-to-end-verification)
[![Tech Stack](https://img.shields.io/badge/Stack-Node.js_|_Express_|_React_|_PostgreSQL_|_Redis_|_WebSockets-blue)](#tech-stack)

## Overview

The **Concall Intelligence Pipeline** is an end-to-end real-time platform designed to monitor, extract, chunk, summarize, and serve intelligence from earnings call transcripts filed by listed companies on the National Stock Exchange (NSE) and Bombay Stock Exchange (BSE).

Earnings call transcripts often span 20-40 pages of dense financial, strategic, and operational discussions. This system automates the ingestion of corporate announcements as soon as they are filed, parses and cleans PDF transcripts, handles large context windows via intelligent text chunking, generates structured AI summaries using an LLM, and streams live updates directly to a financial analyst dashboard via WebSockets.

---

## Real Data & Authenticity Matrix (Phase 8B Audit)

| Company | Quarter | Source | Document Type | Pages | Extraction | LLM | Grounding | DB | API | UI |
|:---|:---|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Tata Consultancy Services** | Q1 FY25 | BSE Archive | `SHORT_TRANSCRIPT_EXCERPT` | 1 | **PASS** (`pdf_text`) | **PENDING_KEY** | **BLOCKED** | `EXTRACTED` | **PASS** (Empty state) | **PASS** (Empty state) |
| **Tata Motors Limited** | Q1 FY25 | BSE Archive | `SHORT_TRANSCRIPT_EXCERPT` | 1 | **PASS** (`pdf_text`) | **PENDING_KEY** | **BLOCKED** | `EXTRACTED` | **PASS** (Empty state) | **PASS** (Empty state) |
| **Sun Pharmaceutical** | Q1 FY25 | BSE Archive | `SHORT_TRANSCRIPT_EXCERPT` | 1 | **PASS** (`pdf_text`) | **PENDING_KEY** | **BLOCKED** | `EXTRACTED` | **PASS** (Empty state) | **PASS** (Empty state) |

### Strict Pipeline Safety & Grounding Directives

1. **LLM Fallback Protection:** Real manual ingestion (`ingest:manual`) strictly rejects `LLM_PROVIDER=fallback` outside automated unit tests.
2. **Missing Key Guard:** Production LLM providers (`gemini` or `openai`) require valid API key credentials. When API keys are unconfigured, the pipeline terminates immediately with a configuration error, preventing ungrounded summary generation and leaving filing status at `EXTRACTED`.
3. **Data Integrity:** All 37 unit and integration tests enforce zero-hallucination discipline across chunking, map-reduce, REST endpoints, WebSockets, and React frontend components.

---

## Tech Stack

| Category | Technology |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL 16, Drizzle ORM, drizzle-kit |
| **Background Jobs & Cache** | Redis 7, BullMQ |
| **Realtime** | WebSocket (`ws` package) |
| **HTTP & Validation** | Axios, Zod |
| **PDF Processing** | `pdf-parse`, `pdfjs-dist` |
| **Infrastructure** | Docker Compose |
| **Package Manager** | pnpm workspaces |

---

## API Documentation & Contracts

### REST API Endpoints

#### 1. `GET /api/health`
Returns backend service health, PostgreSQL, and Redis connection status.

#### 2. `GET /api/companies`
Returns the list of seeded companies ordered by company name.

#### 3. `GET /api/filings/:id`
Returns a single corporate announcement filing by UUID.

#### 4. `GET /api/summaries`
Returns a paginated list of generated earnings call summaries.

#### 5. `GET /api/summaries/:id`
Returns the full structured summary JSON and rendered Markdown by UUID.

---

## Local Development & Ingestion CLI

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Seed Database
```bash
pnpm --filter @concall/backend db:push
pnpm --filter @concall/backend db:seed
```

### 3. Run Manual Ingestion CLI (Requires GEMINI_API_KEY or OPENAI_API_KEY)
```bash
export LLM_PROVIDER="gemini"
export GEMINI_API_KEY="your-api-key"
pnpm --filter @concall/backend ingest:manual --file "data/raw/TCS_Q1_FY25_Transcript.pdf" --company "TCS" --quarter "Q1 FY25" --source "BSE" --source-url "https://www.bseindia.com/corporates"
```

### 4. Run Backend & Frontend Servers
- **Backend:** `pnpm --filter @concall/backend dev`
- **Frontend:** `pnpm --filter @concall/frontend dev`
- **Full stack tests:** `pnpm --recursive run test`
