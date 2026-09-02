# Concall Intelligence Pipeline

[![Phase 1 Status](https://img.shields.io/badge/Phase_1-Completed-emerald)](#current-phase)
[![Tech Stack](https://img.shields.io/badge/Stack-Node.js_|_Express_|_React_|_PostgreSQL_|_Redis-blue)](#tech-stack)

## Overview

The **Concall Intelligence Pipeline** is an end-to-end real-time platform designed to monitor, extract, chunk, summarize, and serve intelligence from earnings call transcripts filed by listed companies on the National Stock Exchange (NSE) and Bombay Stock Exchange (BSE).

Earnings call transcripts often span 20-40 pages of dense financial, strategic, and operational discussions. This system automates the ingestion of corporate announcements as soon as they are filed, parses and cleans PDF transcripts, handles large context windows via intelligent text chunking, generates structured AI summaries using an LLM, and streams live updates directly to a financial analyst dashboard via WebSockets.

## Architecture

The target pipeline follows an event-driven micro-service architecture:

```
NSE / BSE Corporate Announcements
             │
             ▼
   [ Announcements Watcher ]
             │ (Queue Job)
             ▼
    [ Redis / BullMQ ]
             │
             ▼
   [ PDF Downloader & Extractor ]
             │ (Cleaned Text)
             ▼
   [ Transcript Chunking Engine ]
             │ (Chunk Streams)
             ▼
     [ LLM Summarizer ]
             │ (Structured Summary)
             ▼
    [ PostgreSQL (Drizzle) ] ◄──── [ REST API (Express) ] ◄──── [ React Dashboard ]
                                              │                         ▲
                                              └─────── [ WebSocket ] ───┘
```

> **Note:** As per the project roadmap, Phase 1 implements the foundation & development infrastructure (Express server, React frontend, PostgreSQL via Drizzle, Redis connection, and Health API). Scrapers, PDF parsing, LLM summarization, and WebSockets will be introduced in subsequent phases.

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
| **PDF Processing** | `pdfjs-dist` |
| **Infrastructure** | Docker Compose |
| **Package Manager** | pnpm workspaces |

---

## Local Development

Follow these steps to set up and run the project locally.

### Prerequisites

- **Node.js**: v20.x or v24.x
- **pnpm**: v9.x or v10.x (`npm i -g pnpm`)
- **Docker & Docker Compose**: Installed and running

### 1. Install Dependencies

From the repository root:

```bash
pnpm install
```

### 2. Start PostgreSQL & Redis

Run Docker Compose to launch PostgreSQL (port 5432) and Redis (port 6379):

```bash
docker compose up -d
```

### 3. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Default settings in `.env.example`:
- `DATABASE_URL=postgres://postgres:postgres@localhost:5432/concall_db`
- `REDIS_URL=redis://localhost:6379`
- `PORT=3001`
- `FRONTEND_URL=http://localhost:5173`
- `NODE_ENV=development`

### 4. Start Development Servers

You can start both backend and frontend concurrently from the root directory:

```bash
pnpm dev
```

Or start them individually:

- **Backend only:**
  ```bash
  pnpm --filter @concall/backend dev
  ```
- **Frontend only:**
  ```bash
  pnpm --filter @concall/frontend dev
  ```

Access the applications:
- **Frontend UI:** [http://localhost:5173](http://localhost:5173)
- **Backend Health Check:** [http://localhost:3001/api/health](http://localhost:3001/api/health)

---

## Workspace Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Starts frontend and backend concurrently in development mode |
| `pnpm build` | Compiles all TypeScript packages (`@concall/shared`, `@concall/backend`, `@concall/frontend`) |
| `pnpm typecheck` | Runs `tsc --noEmit` across all workspace projects |
| `pnpm lint` | Runs lint checks across the codebase |

---

## Current Phase

### Phase 1: Foundation & Infrastructure (Current)

✅ Monorepo setup with `pnpm` workspaces (`apps/frontend`, `apps/backend`, `packages/shared`)  
✅ Docker Compose configuration for PostgreSQL 16 and Redis 7  
✅ Express backend server with typed env validation (`zod`)  
✅ Database connection module with Drizzle ORM  
✅ Redis connection module (`ioredis`)  
✅ Health API endpoint (`GET /api/health`)  
✅ Minimal React + Vite + Tailwind CSS frontend with backend connection status badge  
✅ Strict TypeScript compilation without errors across all packages  

---

## Directory Structure

```
concall-intelligence-pipeline/
├── apps/
│   ├── frontend/        # React + Vite + TypeScript + Tailwind CSS
│   └── backend/         # Express + Drizzle ORM + Redis
├── packages/
│   └── shared/          # Shared Zod schemas & TypeScript types
├── data/
│   ├── raw/             # Storage for raw PDF filings (future phase)
│   ├── extracted/       # Storage for extracted text (future phase)
│   └── summaries/       # Storage for LLM summaries (future phase)
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── .env.example
└── README.md
```
