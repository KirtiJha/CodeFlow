# CodeFlow

**Data-aware code intelligence platform.** Understand how data moves through your code — trace flows, predict conflicts, detect vulnerabilities, and assess risk. All from static analysis.

![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## What It Does

CodeFlow builds a **knowledge graph** of your codebase and runs a 12-phase analysis pipeline to answer questions like:

- **Where does this user input end up?** — Data flow tracing from sources to sinks
- **Will these branches conflict?** — Semantic merge conflict prediction
- **What tests should I run?** — Test impact analysis from code changes
- **Is this function risky?** — Composite risk scoring (complexity, coupling, blast radius, coverage)
- **Are there injection vulnerabilities?** — Security taint analysis (source → sanitizer → sink)
- **What breaks if I change this schema?** — Database schema impact analysis

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  @codeflow/web                   │
│         React 19 · Tailwind · Sigma.js           │
│       Dashboard · Trace · Graph · Risk           │
└───────────────────────┬─────────────────────────┘
                        │ REST + SSE
┌───────────────────────┴─────────────────────────┐
│                @codeflow/server                   │
│            Hono · SQLite · Rate Limiting          │
│    /api/trace  /api/risk  /api/security  ...      │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────┐
│                 @codeflow/core                    │
│                                                   │
│  ┌─────────┐  ┌──────┐  ┌──────┐  ┌──────────┐  │
│  │ Parsers │→ │ CFG  │→ │ DFG  │→ │ CallGraph│  │
│  │ (13 lang)│  │      │  │ SSA  │  │          │  │
│  └─────────┘  └──────┘  └──────┘  └──────────┘  │
│  ┌──────────┐ ┌───────┐ ┌───────┐ ┌──────────┐  │
│  │Community │ │ Taint │ │ Risk  │ │ Branches │  │
│  │Detection │ │Engine │ │Scorer │ │ Conflict │  │
│  └──────────┘ └───────┘ └───────┘ └──────────┘  │
└─────────────────────────────────────────────────┘
```

### Monorepo Structure

| Package | Description |
|---------|-------------|
| **`packages/core`** | Analysis engine — parsers, pipeline, graph, DFG/CFG, taint, risk scoring |
| **`packages/server`** | HTTP API — Hono REST + SSE, SQLite persistence, middleware |
| **`packages/web`** | Web dashboard — React, interactive graph visualization, real-time progress |

## Analysis Pipeline

CodeFlow runs a **12-phase pipeline** on every repository:

| # | Phase | What it does |
|---|-------|-------------|
| 1 | **Parse** | Walk files, parse with tree-sitter, extract symbols/imports/calls |
| 2 | **Symbols** | Build symbol table, resolve import/export edges |
| 3 | **CFG** | Construct control flow graphs for functions |
| 4 | **DFG** | Build data flow graphs (SSA, use-def chains, reaching defs) |
| 5 | **Call Graph** | Resolve cross-file function calls |
| 6 | **Summaries** | Generate function behavior summaries |
| 7 | **Communities** | Leiden community detection on code modules |
| 8 | **Processes** | Detect entry points, trace end-to-end workflows |
| 9 | **Tests** | Map test files to production code |
| 10 | **Schema** | Extract ORM/DB models and relationships |
| 11 | **Taint** | Security analysis — sources → sanitizers → sinks |
| 12 | **Metrics** | Complexity, coupling, blast radius, risk scores |

## Language Support

CodeFlow uses [tree-sitter](https://tree-sitter.github.io/) for parsing. Supported languages:

**Full extractors:** TypeScript/JavaScript · Python · Java · Go

**Generic support:** C · C++ · Rust · PHP · Ruby · C# · Kotlin · Swift

## Quick Start

### Prerequisites

- **Node.js** ≥ 22
- **pnpm** ≥ 9

### Install & Build

```bash
git clone https://github.com/KirtiJha/CodeFlow.git
cd CodeFlow
pnpm install
pnpm build
```

### Run the Server

```bash
cd packages/server
node dist/cli.js --repo /path/to/your/project
```

The server starts on `http://localhost:3100` with the API at `/api`.

### Run the Web UI

```bash
cd packages/web
pnpm dev
```

Opens at `http://localhost:5173`. The dev server proxies API calls to the backend automatically.

### Analyze a Repository

1. Open the web UI at `http://localhost:5173`
2. Enter a **local path** or **GitHub URL**
3. Click **Analyze** — the 12-phase pipeline runs with real-time progress
4. Explore the dashboard: data flows, risk heatmaps, security findings, branch conflicts

## API Endpoints

All endpoints are under `/api`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Start analysis pipeline |
| `/api/analyze/:jobId` | GET | Poll analysis progress |
| `/api/status` | GET | Current repo stats |
| `/api/trace` | POST | Trace data flow for a variable |
| `/api/branches` | GET | List branches with conflict predictions |
| `/api/tests/impact` | POST | Get affected tests for code changes |
| `/api/security/findings` | GET | Security taint analysis results |
| `/api/schema` | GET | Database schema models |
| `/api/risk/overall` | GET | Aggregate risk scores |
| `/api/risk/hotspots` | GET | Highest-risk functions |
| `/api/search` | POST | Hybrid search (keyword + semantic) |
| `/api/graph` | GET | Full knowledge graph |
| `/api/clone` | POST | Clone a GitHub repository |
| `/api/repos` | GET | List analyzed repositories |
| `/api/events` | GET | SSE stream for real-time updates |
| `/health` | GET | Health check |

## Risk Scoring

CodeFlow computes a composite risk score for every function using 6 weighted factors:

| Factor | Weight | What it measures |
|--------|--------|-----------------|
| Test Coverage | 25% | Inverse coverage — low coverage = high risk |
| Data Sensitivity | 20% | Handles secrets, PII, or auth tokens |
| Blast Radius | 15% | Number of transitive callers |
| Complexity | 15% | Cyclomatic + cognitive complexity |
| Error Handling | 15% | Defensive coding patterns |
| Change Velocity | 10% | Git churn frequency |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Parsing** | tree-sitter (13 language grammars) |
| **Analysis** | Custom CFG/DFG builders, SSA transform, Leiden clustering |
| **Storage** | SQLite (better-sqlite3) with WAL mode |
| **Server** | Hono 4 on Node.js |
| **Frontend** | React 19 · React Router 7 · Tailwind CSS 4 · Framer Motion |
| **Visualization** | Sigma.js (graph) · React Flow (diagrams) · Recharts (charts) |
| **Build** | Turborepo · tsup (server/core) · Vite (web) |
| **Package Manager** | pnpm workspaces |

## Development

```bash
# Start all packages in dev mode (with hot reload)
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck

# Build everything
pnpm build
```

## License

[MIT](LICENSE)
