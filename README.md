# Concall Intelligence Pipeline

[![Phase 6 Status](https://img.shields.io/badge/Phase_6-Completed-emerald)](#current-phase)
[![Tech Stack](https://img.shields.io/badge/Stack-Node.js_|_Express_|_React_|_PostgreSQL_|_Redis_|_WebSockets-blue)](#tech-stack)

## Overview

The **Concall Intelligence Pipeline** is an end-to-end real-time platform designed to monitor, extract, chunk, summarize, and serve intelligence from earnings call transcripts filed by listed companies on the National Stock Exchange (NSE) and Bombay Stock Exchange (BSE).

Earnings call transcripts often span 20-40 pages of dense financial, strategic, and operational discussions. This system automates the ingestion of corporate announcements as soon as they are filed, parses and cleans PDF transcripts, handles large context windows via intelligent text chunking, generates structured AI summaries using an LLM, and streams live updates directly to a financial analyst dashboard via WebSockets.

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

**Response:**
```json
{
  "data": [
    {
      "id": "aec53f57-bea8-4e96-9098-ece735047a0d",
      "name": "Sun Pharmaceutical Industries Limited",
      "nseSymbol": "SUNPHARMA",
      "bseCode": "524715",
      "isin": "INE044A01036",
      "sector": "Pharmaceuticals"
    }
  ]
}
```

#### 3. `GET /api/filings/:id`
Returns a single corporate announcement filing by UUID.

**Response:**
```json
{
  "data": {
    "id": "f8a0051e-355b-43bc-a906-8fb573715c0e",
    "company": {
      "id": "a063e19e-367e-4067-a24e-d08cb1aecfc0",
      "name": "Tata Consultancy Services Limited",
      "nseSymbol": "TCS",
      "bseCode": "532540"
    },
    "source": "NSE",
    "sourceAnnouncementId": "NSE-ANN-101",
    "filingDate": "2026-07-15T10:00:00.000Z",
    "subject": "Transcript of Earnings Call Q1 FY26",
    "status": "COMPLETED"
  }
}
```

#### 4. `GET /api/summaries`
Returns a paginated list of generated earnings call summaries.

**Query Parameters:**
- `companyId` (UUID optional)
- `source` (`NSE | BSE` optional)
- `limit` (integer 1-100, default 20)
- `offset` (integer $\ge 0$, default 0)

**Response:**
```json
{
  "items": [],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 0
  }
}
```

#### 5. `GET /api/summaries/:id`
Returns the full structured summary JSON and rendered Markdown by UUID.

---

### WebSocket Real-time Event Stream (`ws://localhost:3001/ws`)

The backend exposes a WebSocket server at path `/ws`. Clients receive typed JSON events broadcast strictly **after successful database persistence**.

#### Typed Event Payloads:

1. **`filing.discovered`**
   ```json
   {
     "type": "filing.discovered",
     "timestamp": "2026-09-03T12:20:00.000Z",
     "data": {
       "filingId": "...",
       "companyId": "...",
       "companyName": "Tata Consultancy Services Limited",
       "source": "NSE",
       "announcementId": "NSE-ANN-101",
       "subject": "Transcript of Earnings Call Q1 FY26"
     }
   }
   ```

2. **`filing.downloaded`** (Note: internal filesystem paths are omitted for security)
   ```json
   {
     "type": "filing.downloaded",
     "timestamp": "2026-09-03T12:20:05.000Z",
     "data": {
       "filingId": "...",
       "companyId": "...",
       "companyName": "Tata Consultancy Services Limited",
       "source": "NSE",
       "announcementId": "NSE-ANN-101",
       "pdfHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
       "byteSize": 1048576
     }
   }
   ```

3. **`transcript.extracted`**
   ```json
   {
     "type": "transcript.extracted",
     "timestamp": "2026-09-03T12:20:10.000Z",
     "data": {
       "filingId": "...",
       "transcriptId": "...",
       "companyName": "Tata Consultancy Services Limited",
       "pageCount": 27,
       "characterCount": 48321,
       "extractionMethod": "pdf_text"
     }
   }
   ```

4. **`summary.completed`**
   ```json
   {
     "type": "summary.completed",
     "timestamp": "2026-09-03T12:20:15.000Z",
     "data": {
       "summaryId": "...",
       "filingId": "...",
       "companyId": "...",
       "companyName": "Tata Consultancy Services Limited",
       "quarter": "Q1 FY26",
       "model": "gemini"
     }
   }
   ```

5. **`pipeline.error`**
   ```json
   {
     "type": "pipeline.error",
     "timestamp": "2026-09-03T12:20:20.000Z",
     "data": {
       "stage": "extraction",
       "filingId": "...",
       "companyName": "Tata Consultancy Services Limited",
       "errorMessage": "Scanned image PDF detected. OCR required."
     }
   }
   ```

---

## Local Development

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start Services & Database
```bash
pnpm --filter @concall/backend db:push
pnpm --filter @concall/backend db:seed
```

### 3. Run Backend Server
```bash
pnpm --filter @concall/backend dev
```

---

## Workspace Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Starts frontend and backend concurrently in development mode |
| `pnpm build` | Compiles all TypeScript packages |
| `pnpm typecheck` | Runs `tsc --noEmit` across all workspace projects |
| `pnpm --filter @concall/backend test` | Runs unit & integration test suites |
| `pnpm --filter @concall/backend ingest:once` | One-shot corporate announcement ingestion |
| `pnpm --filter @concall/backend watcher` | Continuous corporate announcement watcher |
| `pnpm --filter @concall/backend extract:once` | One-shot PDF extraction & cleaning |
| `pnpm --filter @concall/backend summarize:once` | One-shot chunking & map-reduce summarization |
