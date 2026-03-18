# CodeFlow — Complete Architecture & Development Plan

> **Data-Aware Code Intelligence with Branch Conflict Prediction**
> Answers: "What does the code do with data?" and "Which branches will collide?"

---

## Table of Contents

1. [Vision & Problem Statement](#1-vision--problem-statement)
2. [Feature Overview](#2-feature-overview)
3. [System Architecture](#3-system-architecture)
4. [Tech Stack](#4-tech-stack)
5. [Project Structure](#5-project-structure)
6. [Core Engine — Analysis Pipeline](#6-core-engine--analysis-pipeline)
7. [Feature Module: Data Flow Tracing](#7-feature-module-data-flow-tracing)
8. [Feature Module: Branch Conflict Intelligence](#8-feature-module-branch-conflict-intelligence)
9. [Feature Module: Smart Test Selection](#9-feature-module-smart-test-selection)
10. [Feature Module: Security Flow Detection](#10-feature-module-security-flow-detection)
11. [Feature Module: Schema & API Impact](#11-feature-module-schema--api-impact)
12. [Feature Module: Code Risk Scoring](#12-feature-module-code-risk-scoring)
13. [CLI Design](#13-cli-design)
14. [MCP Server Design](#14-mcp-server-design)
15. [HTTP API Server](#15-http-api-server)
16. [Web Application — UI/UX Design](#16-web-application--uiux-design)
17. [Data Models & Storage](#17-data-models--storage)
18. [Worker Architecture](#18-worker-architecture)
19. [Git Integration](#19-git-integration)
20. [Configuration System](#20-configuration-system)
21. [Testing Strategy](#21-testing-strategy)
22. [Performance Targets](#22-performance-targets)
23. [File-by-File Implementation Manifest](#23-file-by-file-implementation-manifest)

---

## 1. Vision & Problem Statement

### The Gap

Existing code intelligence tools (GitNexus, CodeQL, Semgrep) answer structural questions: "What calls what?", "What imports what?". Developers' actual daily questions are **behavioral**:

| Daily Question                                       | Current Answer                       |
| ---------------------------------------------------- | ------------------------------------ |
| "Where does this user input end up?"                 | Manually trace through files         |
| "If I change this DB schema, what code breaks?"      | Deploy and find out                  |
| "Which tests do I run for this 3-line change?"       | Run all 3,000 tests (15 min)         |
| "Is this PR risky? How risky?"                       | Gut feeling                          |
| "Are there branches that will conflict with mine?"   | Open a PR and see                    |
| "Is user input reaching this SQL query unvalidated?" | Security audit (expensive, periodic) |

### CodeFlow's Answer

Build a **data flow graph** from source code that tracks every value from origin to destination, across functions, files, and branches. Layer behavioral intelligence on top: test mapping, security taint analysis, schema tracking, risk scoring, and proactive cross-branch conflict detection.

### Non-Goals

- CodeFlow is NOT a replacement for IDE language servers (no autocomplete, no go-to-definition)
- CodeFlow is NOT a linter (no style checks, no formatting rules)
- CodeFlow is NOT a CI/CD tool (no builds, no deployments)
- CodeFlow does NOT require cloud connectivity — fully local-first

---

## 2. Feature Overview

### Six Core Features

```
┌──────────────────────────────────────────────────────────────────┐
│                        CodeFlow Features                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │  DATA FLOW       │  │  BRANCH CONFLICT │  │  SMART TEST    │  │
│  │  TRACING         │  │  INTELLIGENCE    │  │  SELECTION     │  │
│  │                  │  │                  │  │                │  │
│  │  Track any value │  │  Predict merge   │  │  Run only the  │  │
│  │  from source to  │  │  conflicts across│  │  tests that    │  │
│  │  every sink      │  │  active branches │  │  matter for    │  │
│  │                  │  │  before they     │  │  your diff     │  │
│  │  "Where does     │  │  happen          │  │                │  │
│  │   req.body end   │  │                  │  │  "8 tests, not │  │
│  │   up?"           │  │  "Sarah & Alex   │  │   3,000"       │  │
│  │                  │  │   will collide"  │  │                │  │
│  └─────────────────┘  └──────────────────┘  └────────────────┘  │
│                                                                   │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │  SECURITY FLOW   │  │  SCHEMA & API    │  │  CODE RISK     │  │
│  │  DETECTION       │  │  IMPACT          │  │  SCORING       │  │
│  │                  │  │                  │  │                │  │
│  │  Source→sink     │  │  Rename a DB     │  │  Composite     │  │
│  │  taint analysis  │  │  column → see    │  │  risk score    │  │
│  │  without CodeQL  │  │  every code path │  │  for any PR    │  │
│  │                  │  │  that breaks     │  │                │  │
│  │  "SQL injection  │  │                  │  │  "73/100 HIGH  │  │
│  │   at line 42"    │  │  "17 locations   │  │   — needs      │  │
│  │                  │  │   in 9 files"    │  │   senior review│  │
│  └─────────────────┘  └──────────────────┘  └────────────────┘  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CodeFlow System                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  INTERFACE LAYER                                                        │
│  ├── CLI (commander.js)          → codeflow analyze|trace|branches|...  │
│  ├── MCP Server (stdio)          → AI agent integration                 │
│  ├── HTTP API (Hono)             → Web UI backend                       │
│  └── Web App (React + Vite)      → Visual dashboard                    │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ANALYSIS ENGINE                                                        │
│  ├── Phase 1: AST Extraction     → tree-sitter (13 languages)          │
│  ├── Phase 2: Symbol Resolution  → imports, exports, type inference     │
│  ├── Phase 3: CFG Construction   → control flow per function            │
│  ├── Phase 4: DFG Construction   → data flow (intra + inter-proc)      │
│  ├── Phase 5: Call Graph         → resolved call relationships          │
│  ├── Phase 6: Function Summaries → param→output, side effects          │
│  ├── Phase 7: Community Detection→ Leiden clustering on call+data graph │
│  ├── Phase 8: Process Detection  → execution flow tracing              │
│  ├── Phase 9: Test Mapping       → test→production code linking         │
│  ├── Phase 10: Schema Extraction → ORM/API spec → field-level refs     │
│  ├── Phase 11: Taint Analysis    → source→sink with sanitizer tracking │
│  └── Phase 12: Metrics           → complexity, coupling, cohesion      │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  BRANCH ENGINE                                                          │
│  ├── Branch Scanner              → detect active remote branches        │
│  ├── Diff Analyzer               → per-branch change fingerprinting     │
│  ├── Conflict Detector           → 5-level cross-branch overlap         │
│  ├── Merge Simulator             → virtual merge to predict textual     │
│  └── Notification Engine         → alerts, webhooks, PR comments        │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  STORAGE LAYER                                                          │
│  ├── SQLite (better-sqlite3)     → primary storage (nodes, edges, DFG)  │
│  ├── FTS5                        → keyword search index                 │
│  └── File-based cache            → analysis snapshots per branch/commit │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SEARCH LAYER                                                           │
│  ├── BM25 (FTS5)                 → keyword search                      │
│  ├── Semantic (ONNX/Transformers)→ embedding-based search              │
│  └── Hybrid (RRF)               → reciprocal rank fusion               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Tech Stack

### Core Engine (TypeScript — Node.js)

| Component          | Technology                | Rationale                                           |
| ------------------ | ------------------------- | --------------------------------------------------- |
| **Language**       | TypeScript 5.x (ESM)      | Type safety, ecosystem, same as target analysis     |
| **Runtime**        | Node.js 22+               | Native ESM, worker threads, performance             |
| **Build**          | tsup (esbuild)            | Fast bundling, ESM output, tree-shaking             |
| **AST Parsing**    | tree-sitter (native)      | Proven, incremental, 13-language support            |
| **Database**       | better-sqlite3            | Synchronous, single-file, WAL mode, FTS5 built-in   |
| **CLI**            | commander.js              | Standard, mature, subcommand support                |
| **MCP**            | @modelcontextprotocol/sdk | Standard MCP protocol                               |
| **HTTP Server**    | Hono                      | Lightweight, fast, middleware-friendly, SSE support |
| **Worker Threads** | Node worker_threads       | CPU-parallel parsing and analysis                   |
| **Git**            | simple-git                | Programmatic git operations (branch listing, diff)  |
| **Testing**        | Vitest                    | Fast, ESM-native, compatible with project setup     |
| **Embeddings**     | @huggingface/transformers | Local ONNX model, no external API needed            |

### Web Application (React — Vite)

| Component               | Technology                  | Rationale                                             |
| ----------------------- | --------------------------- | ----------------------------------------------------- |
| **Framework**           | React 19                    | Concurrent features, use() hook for data loading      |
| **Build**               | Vite 6                      | Fast HMR, native ESM, plugin ecosystem                |
| **Styling**             | Tailwind CSS 4              | Utility-first, dark mode, responsive                  |
| **Component Library**   | Radix UI + custom           | Accessible primitives, full control over design       |
| **Animations**          | Framer Motion               | Declarative animations, layout transitions, gestures  |
| **Graph Visualization** | Sigma.js 3 + Graphology     | WebGL rendering, handles 50k+ nodes                   |
| **Data Flow Viz**       | React Flow                  | Purpose-built for node/edge flow diagrams             |
| **Charts**              | Recharts                    | Simple, composable, React-native                      |
| **Icons**               | Lucide React                | Consistent, tree-shakeable, 1000+ icons               |
| **State Management**    | Zustand                     | Minimal boilerplate, devtools, persistence middleware |
| **Routing**             | React Router v7             | Standard, nested layouts, loaders                     |
| **Code Display**        | Shiki (via @shikijs/react)  | VS Code-quality syntax highlighting, WASM             |
| **Markdown**            | react-markdown + remark-gfm | Rich markdown rendering                               |
| **Forms**               | React Hook Form + Zod       | Validation, performance, type-safe schemas            |
| **HTTP Client**         | ky                          | Tiny, modern, retry support, streaming                |
| **WebSocket**           | Native EventSource (SSE)    | Branch monitoring, live updates                       |
| **Layout**              | Allotment                   | Resizable split panes                                 |
| **Notifications**       | Sonner                      | Animated toast notifications                          |

---

## 5. Project Structure

```
CodeFlow/
├── ARCHITECTURE.md              # This file
├── LICENSE
├── README.md
│
├── packages/
│   ├── core/                    # Analysis engine (shared between CLI, server, web worker)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/
│   │       ├── index.ts                    # Public API barrel export
│   │       │
│   │       ├── parsing/                    # Phase 1: AST extraction
│   │       │   ├── index.ts
│   │       │   ├── parser.ts               # Tree-sitter parser wrapper
│   │       │   ├── language-loader.ts       # Dynamic tree-sitter language loading
│   │       │   ├── queries/                 # Tree-sitter query definitions
│   │       │   │   ├── index.ts
│   │       │   │   ├── typescript.ts
│   │       │   │   ├── python.ts
│   │       │   │   ├── java.ts
│   │       │   │   ├── go.ts
│   │       │   │   ├── rust.ts
│   │       │   │   ├── csharp.ts
│   │       │   │   ├── kotlin.ts
│   │       │   │   ├── php.ts
│   │       │   │   ├── ruby.ts
│   │       │   │   ├── swift.ts
│   │       │   │   ├── c.ts
│   │       │   │   └── cpp.ts
│   │       │   └── extractors/              # Per-language symbol extraction
│   │       │       ├── index.ts
│   │       │       ├── base-extractor.ts    # Abstract extractor interface
│   │       │       ├── typescript.ts
│   │       │       ├── python.ts
│   │       │       ├── java.ts
│   │       │       ├── go.ts
│   │       │       ├── rust.ts
│   │       │       ├── csharp.ts
│   │       │       ├── kotlin.ts
│   │       │       ├── php.ts
│   │       │       ├── ruby.ts
│   │       │       ├── swift.ts
│   │       │       ├── c.ts
│   │       │       └── cpp.ts
│   │       │
│   │       ├── symbols/                     # Phase 2: Symbol resolution
│   │       │   ├── index.ts
│   │       │   ├── symbol-table.ts          # Dual-index symbol lookup
│   │       │   ├── import-resolver.ts       # Cross-file import resolution
│   │       │   ├── export-resolver.ts       # Re-export chain walking
│   │       │   └── type-inference.ts        # Type environment (scope-aware)
│   │       │
│   │       ├── cfg/                         # Phase 3: Control Flow Graph
│   │       │   ├── index.ts
│   │       │   ├── cfg-builder.ts           # AST → CFG construction
│   │       │   ├── cfg-types.ts             # BasicBlock, CFGEdge, CFG types
│   │       │   ├── branch-analyzer.ts       # If/else, switch, try/catch handling
│   │       │   └── builders/                # Language-specific CFG quirks
│   │       │       ├── typescript.ts         # Optional chaining, nullish coalescing
│   │       │       ├── python.ts             # With statements, comprehensions
│   │       │       ├── java.ts               # Checked exceptions, synchronized
│   │       │       ├── go.ts                 # Defer, goroutine, select
│   │       │       ├── rust.ts               # Match arms, Result/Option, ? operator
│   │       │       └── shared.ts             # Common patterns (loops, early returns)
│   │       │
│   │       ├── dfg/                         # Phase 4: Data Flow Graph
│   │       │   ├── index.ts
│   │       │   ├── dfg-types.ts             # DFGNode, DFGEdge, DataFlowGraph
│   │       │   ├── dfg-builder.ts           # CFG → DFG construction
│   │       │   ├── ssa-transform.ts         # Static Single Assignment conversion
│   │       │   ├── reaching-defs.ts         # Reaching definitions analysis
│   │       │   ├── use-def-chains.ts        # Use-definition chain computation
│   │       │   └── interprocedural.ts       # Cross-function DFG via summaries
│   │       │
│   │       ├── callgraph/                   # Phase 5: Call Graph
│   │       │   ├── index.ts
│   │       │   ├── call-resolver.ts         # Tiered call resolution
│   │       │   ├── receiver-resolver.ts     # Method receiver type narrowing
│   │       │   └── resolution-context.ts    # Confidence scoring
│   │       │
│   │       ├── summaries/                   # Phase 6: Function Summaries
│   │       │   ├── index.ts
│   │       │   ├── summary-builder.ts       # Analyze function behavior
│   │       │   ├── summary-types.ts         # FunctionSummary interface
│   │       │   ├── side-effect-detector.ts  # DB writes, API calls, IO
│   │       │   └── param-flow-tracker.ts    # Parameter → output/sink mapping
│   │       │
│   │       ├── community/                   # Phase 7: Clustering
│   │       │   ├── index.ts
│   │       │   ├── leiden.ts                # Leiden algorithm implementation
│   │       │   └── labeler.ts               # Heuristic community naming
│   │       │
│   │       ├── processes/                   # Phase 8: Execution Flows
│   │       │   ├── index.ts
│   │       │   ├── entry-detector.ts        # Framework-aware entry detection
│   │       │   └── flow-tracer.ts           # BFS flow tracing
│   │       │
│   │       ├── tests/                       # Phase 9: Test Mapping
│   │       │   ├── index.ts
│   │       │   ├── test-detector.ts         # Identify test files + test functions
│   │       │   ├── test-linker.ts           # Map tests → production functions
│   │       │   ├── coverage-mapper.ts       # Import/call-based coverage inference
│   │       │   └── frameworks/              # Framework-specific parsers
│   │       │       ├── jest.ts
│   │       │       ├── vitest.ts
│   │       │       ├── mocha.ts
│   │       │       ├── pytest.ts
│   │       │       ├── unittest.ts
│   │       │       ├── junit.ts
│   │       │       ├── go-test.ts
│   │       │       ├── rspec.ts
│   │       │       └── rust-test.ts
│   │       │
│   │       ├── schema/                      # Phase 10: Schema Extraction
│   │       │   ├── index.ts
│   │       │   ├── schema-types.ts          # SchemaField, SchemaModel, APIEndpoint
│   │       │   ├── schema-linker.ts         # Connect schema fields to code refs
│   │       │   ├── orm-parsers/             # ORM-specific extraction
│   │       │   │   ├── prisma.ts
│   │       │   │   ├── typeorm.ts
│   │       │   │   ├── sequelize.ts
│   │       │   │   ├── drizzle.ts
│   │       │   │   ├── sqlalchemy.ts
│   │       │   │   ├── django-orm.ts
│   │       │   │   └── gorm.ts
│   │       │   └── api-parsers/             # API spec extraction
│   │       │       ├── openapi.ts
│   │       │       ├── graphql.ts
│   │       │       ├── trpc.ts
│   │       │       └── route-detector.ts    # Express/Flask/Gin route detection
│   │       │
│   │       ├── taint/                       # Phase 11: Security Analysis
│   │       │   ├── index.ts
│   │       │   ├── taint-types.ts           # Source, Sink, Sanitizer, TaintFlow
│   │       │   ├── taint-engine.ts          # Taint propagation algorithm
│   │       │   ├── source-registry.ts       # Known input sources per framework
│   │       │   ├── sink-registry.ts         # Known dangerous sinks
│   │       │   └── sanitizer-registry.ts    # Known sanitization functions
│   │       │
│   │       ├── metrics/                     # Phase 12: Code Metrics
│   │       │   ├── index.ts
│   │       │   ├── complexity.ts            # Cyclomatic + cognitive complexity
│   │       │   ├── coupling.ts              # Afferent/efferent coupling
│   │       │   ├── churn.ts                 # Change frequency from git log
│   │       │   └── risk-scorer.ts           # Composite risk score engine
│   │       │
│   │       ├── branches/                    # Branch Conflict Engine
│   │       │   ├── index.ts
│   │       │   ├── branch-scanner.ts        # List active branches, age, author
│   │       │   ├── diff-analyzer.ts         # Per-branch change fingerprinting
│   │       │   ├── conflict-detector.ts     # 5-level pairwise conflict detection
│   │       │   ├── merge-simulator.ts       # Virtual merge (textual conflict check)
│   │       │   ├── semantic-differ.ts       # DFG-based behavioral contract diff
│   │       │   └── conflict-types.ts        # ConflictLevel, BranchConflict types
│   │       │
│   │       ├── graph/                       # Graph data structures
│   │       │   ├── index.ts
│   │       │   ├── types.ts                 # Node, Edge, Graph interfaces
│   │       │   └── knowledge-graph.ts       # In-memory graph implementation
│   │       │
│   │       ├── search/                      # Hybrid search
│   │       │   ├── index.ts
│   │       │   ├── bm25.ts                  # FTS5-based keyword search
│   │       │   ├── semantic.ts              # Embedding-based search
│   │       │   └── hybrid.ts               # RRF fusion
│   │       │
│   │       ├── storage/                     # Database layer
│   │       │   ├── index.ts
│   │       │   ├── db.ts                    # SQLite connection manager
│   │       │   ├── schema.sql               # Complete DDL (tables, indexes, FTS)
│   │       │   ├── migrations.ts            # Schema versioning
│   │       │   ├── node-store.ts            # Node CRUD + batch insert
│   │       │   ├── edge-store.ts            # Edge CRUD + batch insert
│   │       │   ├── dfg-store.ts             # Data flow graph persistence
│   │       │   ├── branch-store.ts          # Branch snapshots + conflict cache
│   │       │   ├── summary-store.ts         # Function summary persistence
│   │       │   └── query-engine.ts          # Parameterized query builder
│   │       │
│   │       ├── pipeline/                    # Orchestration
│   │       │   ├── index.ts
│   │       │   ├── pipeline.ts              # Main 12-phase pipeline orchestrator
│   │       │   ├── progress.ts              # Progress reporting interface
│   │       │   └── chunk-manager.ts         # Byte-budget chunking
│   │       │
│   │       ├── workers/                     # Parallel processing
│   │       │   ├── worker-pool.ts           # Generic CPU-parallel job scheduler
│   │       │   ├── parse-worker.ts          # AST extraction worker
│   │       │   └── analysis-worker.ts       # CFG/DFG/taint analysis worker
│   │       │
│   │       ├── git/                         # Git integration
│   │       │   ├── index.ts
│   │       │   ├── git-client.ts            # simple-git wrapper
│   │       │   ├── diff-parser.ts           # Unified diff → structured changes
│   │       │   ├── blame-analyzer.ts        # Author attribution per line
│   │       │   └── log-analyzer.ts          # Change frequency, authorship stats
│   │       │
│   │       └── utils/                       # Shared utilities
│   │           ├── language-detect.ts        # File extension → language mapping
│   │           ├── ast-cache.ts             # LRU tree-sitter tree cache
│   │           ├── path-utils.ts            # Cross-platform path normalization
│   │           ├── fs-walker.ts             # Gitignore-aware file walking
│   │           └── logger.ts               # Structured logging (pino)
│   │
│   ├── cli/                     # CLI application
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/
│   │       ├── index.ts                     # Entry point + commander setup
│   │       ├── commands/
│   │       │   ├── analyze.ts               # Index a repository
│   │       │   ├── trace.ts                 # Data flow tracing
│   │       │   ├── branches.ts              # Branch conflict analysis
│   │       │   ├── test-impact.ts           # Smart test selection
│   │       │   ├── security.ts              # Security scan
│   │       │   ├── schema-impact.ts         # Schema/API impact
│   │       │   ├── risk.ts                  # Risk scoring
│   │       │   ├── query.ts                 # Hybrid search
│   │       │   ├── serve.ts                 # Start HTTP server
│   │       │   ├── mcp.ts                   # Start MCP server
│   │       │   └── status.ts               # Show index status
│   │       └── formatters/
│   │           ├── table.ts                 # Terminal table output
│   │           ├── tree.ts                  # Tree-style output
│   │           ├── json.ts                  # JSON output
│   │           └── color.ts                 # Chalk-based coloring
│   │
│   ├── mcp/                     # MCP server
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/
│   │       ├── index.ts                     # MCP server setup
│   │       ├── server.ts                    # Tool/resource/prompt registration
│   │       ├── tools/
│   │       │   ├── trace-data.ts            # Data flow tracing tool
│   │       │   ├── branch-conflicts.ts      # Branch conflict tool
│   │       │   ├── test-impact.ts           # Test selection tool
│   │       │   ├── security-scan.ts         # Security scan tool
│   │       │   ├── schema-impact.ts         # Schema impact tool
│   │       │   ├── risk-score.ts            # Risk scoring tool
│   │       │   ├── query.ts                 # Hybrid search tool
│   │       │   ├── context.ts               # Symbol context (360° view)
│   │       │   └── impact.ts               # Structural impact analysis
│   │       ├── resources/
│   │       │   ├── repo-context.ts
│   │       │   ├── branches.ts
│   │       │   ├── processes.ts
│   │       │   ├── schema.ts
│   │       │   └── security-report.ts
│   │       └── transport/
│   │           └── stdio-transport.ts       # Dual-framing MCP transport
│   │
│   ├── server/                  # HTTP API server
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/
│   │       ├── index.ts                     # Hono app setup
│   │       ├── routes/
│   │       │   ├── analysis.ts              # /api/analysis/* endpoints
│   │       │   ├── branches.ts              # /api/branches/* endpoints
│   │       │   ├── trace.ts                 # /api/trace/* endpoints
│   │       │   ├── tests.ts                 # /api/tests/* endpoints
│   │       │   ├── security.ts              # /api/security/* endpoints
│   │       │   ├── schema.ts                # /api/schema/* endpoints
│   │       │   ├── risk.ts                  # /api/risk/* endpoints
│   │       │   ├── search.ts                # /api/search/* endpoints
│   │       │   └── events.ts               # /api/events (SSE stream)
│   │       ├── middleware/
│   │       │   ├── cors.ts
│   │       │   ├── rate-limit.ts
│   │       │   └── validation.ts
│   │       └── sse/
│   │           └── event-emitter.ts         # Server-sent events for live updates
│   │
│   └── web/                     # Web application
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsconfig.app.json
│       ├── tsconfig.node.json
│       ├── vite.config.ts
│       ├── index.html
│       ├── public/
│       │   └── fonts/                       # Self-hosted Inter + JetBrains Mono
│       └── src/
│           ├── main.tsx                     # React + Router mount
│           ├── App.tsx                      # Root layout with sidebar
│           ├── index.css                    # Tailwind directives + CSS variables
│           │
│           ├── stores/                      # Zustand state management
│           │   ├── app-store.ts             # Global app state
│           │   ├── analysis-store.ts        # Analysis results + graph data
│           │   ├── branch-store.ts          # Branch conflict state
│           │   ├── trace-store.ts           # Data flow trace state
│           │   ├── test-store.ts            # Test impact state
│           │   ├── security-store.ts        # Security scan state
│           │   ├── settings-store.ts        # User preferences (persisted)
│           │   └── ui-store.ts              # Panel visibility, sidebar, theme
│           │
│           ├── pages/                       # Route-based pages
│           │   ├── DashboardPage.tsx         # Main dashboard / overview
│           │   ├── TracePage.tsx             # Data flow tracing interface
│           │   ├── BranchesPage.tsx          # Branch conflict dashboard
│           │   ├── TestImpactPage.tsx        # Smart test selection
│           │   ├── SecurityPage.tsx          # Security scan results
│           │   ├── SchemaPage.tsx            # Schema/API impact
│           │   ├── RiskPage.tsx              # Code risk scoring
│           │   ├── GraphPage.tsx             # Interactive graph explorer
│           │   ├── SettingsPage.tsx          # Configuration
│           │   └── OnboardingPage.tsx        # Initial setup / repo selection
│           │
│           ├── components/                  # Shared components
│           │   ├── layout/
│           │   │   ├── Sidebar.tsx           # Navigation sidebar
│           │   │   ├── Header.tsx            # Top bar with search + status
│           │   │   ├── CommandPalette.tsx    # Cmd+K command palette
│           │   │   └── StatusBar.tsx         # Bottom status bar
│           │   │
│           │   ├── graph/
│           │   │   ├── GraphCanvas.tsx       # Sigma.js graph renderer
│           │   │   ├── GraphControls.tsx     # Zoom, filter, layout controls
│           │   │   ├── GraphLegend.tsx       # Node type legend
│           │   │   └── GraphMinimap.tsx      # Overview minimap
│           │   │
│           │   ├── flow/
│           │   │   ├── FlowDiagram.tsx       # React Flow data flow diagram
│           │   │   ├── FlowNode.tsx          # Custom flow node component
│           │   │   ├── FlowEdge.tsx          # Custom flow edge (animated)
│           │   │   └── FlowControls.tsx      # Trace controls (depth, filter)
│           │   │
│           │   ├── branch/
│           │   │   ├── BranchMatrix.tsx      # N×N conflict matrix
│           │   │   ├── BranchTimeline.tsx    # Timeline of branch activity
│           │   │   ├── ConflictCard.tsx      # Single conflict detail card
│           │   │   ├── ConflictDiff.tsx      # Side-by-side conflict view
│           │   │   └── BranchGraph.tsx       # Branch relationship graph
│           │   │
│           │   ├── test/
│           │   │   ├── TestList.tsx           # Affected test list
│           │   │   ├── TestCoverage.tsx       # Coverage visualization
│           │   │   └── UncoveredPaths.tsx    # Untested code paths
│           │   │
│           │   ├── security/
│           │   │   ├── TaintFlowDiagram.tsx  # Source→sink flow visualization
│           │   │   ├── VulnerabilityCard.tsx # Single vulnerability detail
│           │   │   └── SecurityScore.tsx     # Overall security posture
│           │   │
│           │   ├── schema/
│           │   │   ├── SchemaGraph.tsx        # Schema entity relationship diagram
│           │   │   ├── FieldImpactList.tsx   # Fields affected by change
│           │   │   └── MigrationPreview.tsx  # Predicted migration diff
│           │   │
│           │   ├── risk/
│           │   │   ├── RiskGauge.tsx         # Animated circular risk score
│           │   │   ├── RiskBreakdown.tsx     # Factor-by-factor breakdown
│           │   │   └── RiskHistory.tsx       # Risk trend over time
│           │   │
│           │   ├── code/
│           │   │   ├── CodeViewer.tsx         # Shiki syntax highlighted viewer
│           │   │   ├── DiffViewer.tsx         # Unified/split diff display
│           │   │   ├── FileTree.tsx           # File explorer tree
│           │   │   └── SymbolSearch.tsx      # Symbol search + jump
│           │   │
│           │   └── shared/
│           │       ├── Badge.tsx              # Severity/type badges
│           │       ├── Card.tsx               # Animated card container
│           │       ├── EmptyState.tsx         # Empty state illustrations
│           │       ├── LoadingSpinner.tsx     # Pulse/skeleton loading
│           │       ├── ProgressBar.tsx        # Animated progress bar
│           │       ├── Tooltip.tsx            # Radix tooltip wrapper
│           │       ├── Dialog.tsx             # Radix dialog wrapper
│           │       ├── Select.tsx             # Radix select wrapper
│           │       ├── Tabs.tsx               # Radix tabs wrapper
│           │       └── AnimatedCounter.tsx   # Number animation component
│           │
│           ├── hooks/                       # Custom React hooks
│           │   ├── useAnalysis.ts            # Analysis pipeline trigger
│           │   ├── useBranches.ts            # Branch monitoring via SSE
│           │   ├── useGraph.ts               # Graph interaction (Sigma)
│           │   ├── useSearch.ts              # Cmd+K search functionality
│           │   ├── useKeyboard.ts            # Keyboard shortcuts
│           │   ├── useSSE.ts                 # Server-sent events connection
│           │   └── useMediaQuery.ts          # Responsive breakpoints
│           │
│           ├── lib/                         # Utility functions
│           │   ├── api-client.ts             # HTTP client (ky wrapper)
│           │   ├── graph-adapter.ts          # Backend graph → Graphology
│           │   ├── color-system.ts           # Node type → color mapping
│           │   ├── formatters.ts             # Number, date, severity formatting
│           │   └── constants.ts             # App-wide constants
│           │
│           └── types/                       # Shared TypeScript types
│               ├── analysis.ts              # Analysis result types
│               ├── branch.ts                # Branch/conflict types
│               ├── trace.ts                 # Data flow trace types
│               ├── security.ts              # Taint/vulnerability types
│               ├── graph.ts                 # Graph node/edge types
│               └── api.ts                   # API request/response types
│
├── turbo.json                    # Turborepo pipeline config
├── package.json                  # Root workspace package.json
├── tsconfig.base.json            # Shared TypeScript config
├── .gitignore
└── .npmrc
```

---

## 6. Core Engine — Analysis Pipeline

### Pipeline Orchestration

The pipeline runs 12 sequential phases. Each phase receives the output of all prior phases and produces structured results stored in SQLite.

```typescript
// packages/core/src/pipeline/pipeline.ts

interface PipelineConfig {
  repoPath: string; // Absolute path to repository root
  languages: Language[]; // Languages to analyze (auto-detect if empty)
  branch?: string; // Specific branch (default: current HEAD)
  maxFileSize: number; // Skip files larger than this (default: 512KB)
  byteBudget: number; // Memory budget per chunk (default: 20MB)
  workerCount: number; // Parallel workers (default: min(8, cpus - 1))
  onProgress: (phase: Phase, pct: number, message: string) => void;
}

interface PipelineResult {
  stats: {
    files: number;
    symbols: number;
    functions: number;
    edges: number;
    communities: number;
    processes: number;
    dataFlows: number;
    testMappings: number;
    schemaModels: number;
    taintFlows: number;
    duration: number;
  };
  dbPath: string; // Path to SQLite database
}

type Phase =
  | "parsing" // AST extraction
  | "symbols" // Symbol table + imports + types
  | "cfg" // Control flow graphs
  | "dfg" // Data flow graphs
  | "callgraph" // Call resolution
  | "summaries" // Function behavior summaries
  | "communities" // Leiden clustering
  | "processes" // Execution flow detection
  | "tests" // Test mapping
  | "schema" // Schema/API extraction
  | "taint" // Security analysis
  | "metrics"; // Code metrics
```

### Phase Details

#### Phase 1 — AST Extraction (parsing/)

**Input**: Repository file tree
**Output**: Per-file AST nodes with extracted symbols, imports, calls, heritage

```
For each file:
  1. Detect language from extension
  2. Load tree-sitter parser for language
  3. Parse file content → AST tree
  4. Run tree-sitter queries to extract:
     - Definitions: class, function, method, interface, enum, struct, trait
     - Imports: module paths, named imports, aliases
     - Calls: function invocations, method calls, constructor calls
     - Heritage: extends, implements relations
     - Decorators/Annotations: framework markers
     - Type annotations: explicit types on params, returns, variables
```

**Worker parallelism**: Files chunked by byte budget (20MB), dispatched to worker pool. Each worker loads tree-sitter languages lazily on first use.

#### Phase 2 — Symbol Resolution (symbols/)

**Input**: Extracted symbols + imports
**Output**: Symbol table, resolved imports, type environment

```
1. Build file-scoped symbol index (O(1) exact lookup)
2. Build global symbol index (name → [definitions])
3. Resolve imports:
   - Named imports: import { X } from './foo' → lookup X in foo.ts
   - Default imports: import X from './foo' → lookup default export
   - Namespace imports: import * as X from './foo' → create namespace binding
   - Re-export chains: walk up to 5 levels
4. Build type environment per file:
   - Tier 0: Explicit annotations (const x: User)
   - Tier 1: Constructor inference (new User() → User)
   - Tier 2: Assignment propagation (b = a where a:User)
   - Tier 3: Return type inference (calls to functions with known return type)
```

#### Phase 3 — Control Flow Graph (cfg/)

**Input**: AST trees per function
**Output**: CFG per function (basic blocks + edges)

This is the first major departure from GitNexus's approach. Instead of treating functions as atomic units, we decompose them into basic blocks connected by control flow edges.

```
BasicBlock = {
  id: string;
  statements: ASTNode[];     // Sequential statements
  predecessors: BasicBlock[];
  successors: BasicBlock[];
}

CFGEdge = {
  from: BasicBlock;
  to: BasicBlock;
  kind: 'normal' | 'true_branch' | 'false_branch' | 'exception'
        | 'break' | 'continue' | 'return' | 'fallthrough';
  condition?: ASTNode;        // Branch condition expression
}
```

**Construction algorithm**:

```
For each function body:
  1. Create ENTRY and EXIT blocks
  2. Walk AST statements sequentially, appending to current block
  3. On branching statements (if, while, for, switch, try):
     - Create new blocks for each branch target
     - Add conditional edges
     - Merge branches at join points (phi nodes)
  4. On return/throw/break/continue:
     - Add edge to appropriate target (EXIT, catch, loop header, etc.)
     - Start new block after (dead code detection candidate)
  5. Language-specific handling:
     - Go: defer → edge to EXIT, goroutine → fork edge
     - Rust: ? operator → error edge to return, match → switch-like
     - Python: with → try/finally pattern, yield → suspend edge
     - TypeScript: optional chain → short-circuit edge
```

#### Phase 4 — Data Flow Graph (dfg/)

**Input**: CFGs + type environments
**Output**: DFG per function + inter-procedural summary

This is the core differentiator. The DFG tracks how data values flow through assignments, function parameters, returns, and field accesses.

```
DFGNode = {
  id: string;
  kind: 'param' | 'assignment' | 'call_result' | 'field_read'
       | 'field_write' | 'return' | 'literal' | 'binary_op'
       | 'source' | 'sink' | 'phi';  // phi = merge point
  code: string;                       // Source text
  location: SourceLocation;
  dataType?: string;                  // Inferred type
}

DFGEdge = {
  from: DFGNode;
  to: DFGNode;
  kind: 'data_dep'       // Value flows from → to
      | 'param_bind'     // Argument binds to parameter
      | 'return_flow'    // Return value flows to call result
      | 'field_flow'     // Object field access
      | 'alias'          // Same reference (pointer/reference)
      | 'transform';     // Value is transformed (e.g., sanitized)
  transformDescription?: string; // "JSON.parse", "parseInt", "escape"
}
```

**Construction (intra-procedural)**:

```
For each function:
  1. Convert CFG to SSA form (each variable assigned exactly once)
  2. For each basic block, in CFG order:
     a. For each statement:
        - Assignment: create DFG node, add data_dep edges from RHS operands
        - Call: create call_result node, add param_bind edges to arguments
        - Return: create return node, add data_dep from return expression
        - Field access (a.b): create field_read node, add field_flow from a
        - Field write (a.b = c): create field_write node, edges from a and c
     b. At phi nodes (branch merges): create phi node with edges from both defs
  3. Record function signature: which params flow to which return/sink nodes
```

**Construction (inter-procedural)**:

```
Using function summaries (Phase 6):
  For each call site in the DFG:
    1. Look up callee's summary
    2. For each (param → output/sink) mapping in summary:
       - Add inter-procedural edges from argument DFG node to:
         a. Call result DFG node (if summary says param flows to return)
         b. Side effect node (if summary says param flows to DB/IO/log)
    3. Transitively compose summaries (depth ≤ 10)
```

#### Phase 5 — Call Graph (callgraph/)

**Input**: Extracted calls + symbol table + type environment
**Output**: Resolved CALLS edges with confidence scores

Same tiered resolution approach as GitNexus (proven to work well):

- Tier 1: Same-file exact match (0.95 confidence)
- Tier 2: Import-scoped match (0.90 confidence)
- Tier 3: Global fuzzy match (0.50 confidence)

Enhanced with receiver type narrowing from DFG data (instead of just constructor inference).

#### Phase 6 — Function Summaries (summaries/)

**Input**: DFGs + call graph + type information
**Output**: Compact behavioral description per function

```
FunctionSummary = {
  id: string;
  name: string;
  filePath: string;

  // Parameter → Output flow map
  paramFlows: Array<{
    paramIndex: number;
    paramName: string;
    flowsTo: Array<{
      kind: 'return' | 'field_write' | 'db_write' | 'api_call'
           | 'log' | 'file_write' | 'exec' | 'parameter_of_callee';
      target: string;            // e.g., "db.users.email" or "return"
      transforms: string[];      // e.g., ["validate", "toLowerCase"]
      isSanitized: boolean;
    }>;
  }>;

  // Side effects (independent of params)
  sideEffects: Array<{
    kind: 'db_read' | 'db_write' | 'api_call' | 'file_io' | 'log'
         | 'env_read' | 'cache_access' | 'event_emit';
    target: string;
    description: string;
  }>;

  // Error behavior
  throws: Array<{ type: string; condition?: string }>;
  canReturnNull: boolean;
  canReturnUndefined: boolean;

  // Complexity
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
}
```

Summaries are built bottom-up: leaf functions first (no callees), then callers by composing callee summaries. Cycle breaking via fixed-point iteration (max 3 rounds).

#### Phase 7 — Community Detection (community/)

Leiden clustering on combined CALLS + DATA_FLOW weighted edges. Data flow edges get 2× weight (functions that share data belong together more strongly than functions that merely call each other).

#### Phase 8 — Process Detection (processes/)

Same BFS approach as GitNexus (proven), enhanced with:

- Data flow awareness: trace data transformations along the process path
- Branch awareness: note where processes fork (error handling alternate paths)
- Framework detection: mark HTTP handler chains, event listeners, cron jobs

#### Phase 9 — Test Mapping (tests/)

**Input**: Symbol table + call graph + DFG + test file detection
**Output**: test → production function mappings

```
1. Detect test files:
   - Filename patterns: *.test.ts, *.spec.ts, test_*.py, *_test.go
   - Directory patterns: __tests__/, test/, tests/, spec/
   - Framework-specific: @Test annotation (JUnit), def test_* (pytest)

2. For each test function:
   a. Extract direct imports of production code
   b. Trace calls through DFG to production functions
   c. Record transitive coverage (test → helper → production)

3. Build reverse index: production function → [test functions that exercise it]

4. Detect test gaps: production functions with zero test coverage
```

#### Phase 10 — Schema Extraction (schema/)

**Input**: Source files + AST + known ORM patterns
**Output**: Schema models, fields, and code references

```
1. Detect ORM type:
   - Prisma: parse schema.prisma file
   - TypeORM: detect @Entity, @Column decorators
   - Sequelize: detect Model.init() calls
   - Drizzle: detect pgTable/sqliteTable calls
   - SQLAlchemy: detect Base subclasses with Column()
   - Django: detect models.Model subclasses
   - GORM: detect struct tags with `gorm:"..."`

2. Extract schema models:
   SchemaModel = { name, fields: [{name, type, nullable, primary, unique}] }

3. Detect API endpoints:
   - Express: app.get/post/put/delete('/path', handler)
   - Flask: @app.route('/path') decorator
   - FastAPI: @app.get('/path') decorator
   - Gin: router.GET('/path', handler)
   - tRPC: router.query/mutation definitions
   - GraphQL: type Query/Mutation definitions

4. Link schema fields to code references:
   - Find all code locations that read/write each field
   - Track through DFG: field → variable → parameter → callee param
```

#### Phase 11 — Taint Analysis (taint/)

**Input**: DFGs + function summaries + source/sink registries
**Output**: Taint flows (source → path → sink) with sanitizer tracking

```
Source Registry (automatic detection):
  - HTTP inputs: req.body, req.query, req.params, req.headers
  - Environment: process.env, os.environ
  - Database reads: db.query result, ORM .find() result
  - File reads: fs.readFile, open()
  - User input: readline, input(), Scanner

Sink Registry (automatic detection):
  - SQL execution: db.query(), cursor.execute(), raw SQL strings
  - Command execution: exec(), spawn(), child_process
  - File writes: fs.writeFile, open('w')
  - HTTP responses: res.send(), res.json(), render()
  - Logging with PII: logger.info/debug with data params
  - eval/Function constructor: eval(), new Function()
  - URL construction: fetch(userInput), axios.get(userInput)

Sanitizer Registry (automatic detection):
  - Validation: Zod/Joi/Yup schema validation
  - Escaping: escapeHtml, encodeURIComponent, parameterized queries
  - Type coercion: parseInt, Number(), String()
  - Framework sanitizers: express-validator, bleach

Algorithm:
  1. For each source node in the DFG:
     a. Forward-propagate taint through data_dep and param_bind edges
     b. At each node, check if it's a sanitizer → mark taint as "sanitized"
     c. At each node, check if it's a sink → record TaintFlow
  2. Report:
     - CRITICAL: source → sink with NO sanitizer on any path
     - WARNING: source → sink with sanitizer on SOME paths but not all
     - INFO: source → sink with sanitizer on ALL paths (safe, for reference)
```

#### Phase 12 — Metrics (metrics/)

**Input**: CFGs + DFGs + call graph + git history
**Output**: Per-function and per-file metrics

```
Computed Metrics:
  - Cyclomatic complexity (branches in CFG)
  - Cognitive complexity (nesting depth, recursion, boolean ops)
  - Afferent coupling (incoming dependencies — who calls me?)
  - Efferent coupling (outgoing dependencies — who do I call?)
  - Change frequency (commits touching this function in last 90 days)
  - Author count (distinct committers — bus factor proxy)
  - Lines of code (function body)
  - Parameter count
  - Test coverage ratio (tests / dependents)
  - Data sensitivity (handles PII, auth, crypto?)
```

---

## 7. Feature Module: Data Flow Tracing

### CLI Interface

```bash
# Trace from a specific source
codeflow trace --from "req.body.email" --in src/api/signup.ts

# Trace to a specific sink
codeflow trace --to "db.insert" --in src/api/signup.ts

# Trace a specific variable
codeflow trace --var "user" --in src/services/auth.ts --line 42

# Full repo trace report
codeflow trace --all --format json
```

### Output Format

```
req.body.email (src/api/signup.ts:15)  [SOURCE: http_input]
  │
  ├─→ validateEmail(email)  (src/validators/email.ts:8)
  │   └─→ returns boolean  [SANITIZER: validated]
  │
  ├─→ createUser({email})  (src/services/user.ts:22)
  │   ├─→ db.insert('users', {email})  (src/db/users.ts:45)  [SINK: database]
  │   │   Status: ✅ SAFE — input validated before DB write
  │   │
  │   └─→ sendWelcomeEmail(email)  (src/email/welcome.ts:12)  [SINK: external_api]
  │       Status: ✅ SAFE — validated input
  │
  └─→ logger.info(`signup: ${email}`)  (src/api/signup.ts:28)  [SINK: log]
      Status: ⚠️  WARNING — PII (email) written to logs
```

### API Response Shape

```typescript
interface TraceResult {
  source: {
    code: string;
    location: SourceLocation;
    kind: SourceKind; // 'http_input' | 'env' | 'db_read' | ...
  };
  paths: TracePath[];
}

interface TracePath {
  steps: TraceStep[];
  sinks: TraceSink[];
  isSafe: boolean;
  riskLevel: "safe" | "warning" | "critical";
}

interface TraceStep {
  code: string;
  location: SourceLocation;
  kind: "assignment" | "param_bind" | "return" | "field_access" | "transform";
  transform?: string; // "validate", "escape", "parseInt"
  isSanitizer: boolean;
}

interface TraceSink {
  code: string;
  location: SourceLocation;
  kind: SinkKind; // 'database' | 'log' | 'exec' | 'http_response' | ...
  sanitizedOnAllPaths: boolean;
  risklabel: string;
}
```

---

## 8. Feature Module: Branch Conflict Intelligence

### 5-Level Conflict Detection

```
Level 1 — FILE OVERLAP
  Detectable with: git diff --name-only (no analysis needed)
  "Both branches edit src/auth/validate.ts"
  Severity: LOW

Level 2 — SYMBOL OVERLAP
  Detectable with: AST diff (tree-sitter parse both versions)
  "Both branches modify the validateUser function"
  Severity: MEDIUM

Level 3 — SIGNATURE CONFLICT
  Detectable with: Symbol table diff
  "Branch A adds param to validateUser(); Branch B adds new caller with old signature"
  Severity: HIGH

Level 4 — SEMANTIC CONFLICT
  Detectable with: Function summary diff (DFG-based)
  "Branch A changes return behavior; Branch B depends on old behavior"
  Severity: CRITICAL

Level 5 — SCHEMA/CONTRACT CONFLICT
  Detectable with: Schema extraction diff
  "Branch A renames users.email; Branch B adds query using users.email"
  Severity: CRITICAL
```

### Branch Scanning Algorithm

```
scanBranches():
  1. List all remote-tracking branches: git branch -r --list 'origin/*'
  2. Filter to active (committed in last 30 days) and exclude main/master
  3. For each branch:
     a. Compute diff vs. main: git diff main...branch --name-only
     b. Get changed lines: git diff main...branch --unified=0
     c. Extract metadata: author, last commit date, commit count
  4. Store BranchSnapshot in SQLite

fingerPrintBranch(branch):
  1. For each changed file:
     a. Parse BEFORE (main version) and AFTER (branch version) with tree-sitter
     b. Diff AST: identify added/removed/modified symbols
     c. For modified symbols: compare signatures (params, return types)
     d. If DFG is available: compare function summaries (behavioral diff)
  2. Return BranchFingerprint:
     {
       filesChanged: Set<string>,
       symbolsAdded: Set<QualifiedName>,
       symbolsRemoved: Set<QualifiedName>,
       symbolsModified: Map<QualifiedName, SymbolDiff>,
       signaturesChanged: Map<QualifiedName, SignatureDiff>,
       summariesChanged: Map<QualifiedName, SummaryDiff>,
       schemasChanged: Map<ModelField, FieldDiff>
     }

detectConflicts(branchA, branchB):
  fpA = fingerprints[branchA]
  fpB = fingerprints[branchB]

  conflicts = []

  // Level 1: File overlap
  fileOverlap = intersect(fpA.filesChanged, fpB.filesChanged)
  if fileOverlap.size > 0:
    conflicts.push({ level: 1, severity: 'low', files: fileOverlap })

  // Level 2: Symbol overlap
  symbolOverlap = intersect(
    union(fpA.symbolsModified.keys(), fpA.symbolsAdded),
    union(fpB.symbolsModified.keys(), fpB.symbolsAdded)
  )
  if symbolOverlap.size > 0:
    conflicts.push({ level: 2, severity: 'medium', symbols: symbolOverlap })

  // Level 3: Signature conflict
  for each signature change in fpA.signaturesChanged:
    check if fpB adds callers using the OLD signature
  for each signature change in fpB.signaturesChanged:
    check if fpA adds callers using the OLD signature
  → push level 3 conflicts (HIGH)

  // Level 4: Semantic conflict
  for each summary change in fpA.summariesChanged:
    check if fpB adds code that depends on the OLD behavior
    (e.g., null-check for function that now throws instead of returning null)
  → push level 4 conflicts (CRITICAL)

  // Level 5: Schema conflict
  for each schema change in fpA.schemasChanged:
    check if fpB references the old field name/type
  → push level 5 conflicts (CRITICAL)

  return conflicts sorted by severity DESC
```

### Merge Simulation

For Level 1 conflicts, actually attempt a virtual merge to determine if textual conflicts will occur:

```
simulateMerge(branchA, branchB):
  1. Create temporary worktree (git worktree add --detach)
  2. Attempt merge: git merge --no-commit --no-ff branchB
  3. Check for conflicts: git diff --check
  4. If conflicts: parse conflict markers, identify exact conflicting lines
  5. Clean up: git merge --abort, git worktree remove
  6. Return: { hasTextualConflicts: boolean, conflictingFiles: FileConflict[] }
```

### CLI Interface

```bash
# Overview of all branch conflicts
codeflow branches

# Deep comparison of two branches
codeflow branch-diff feature/oauth refactor/auth-service

# Pre-push check (current branch vs. all others)
codeflow pre-push

# Watch mode (re-scan on commits)
codeflow branches --watch

# Output as JSON (for CI integration)
codeflow branches --format json
```

### Continuous Monitoring

```
Branch monitoring via SSE (Server-Sent Events):
  1. Server polls git for branch changes every 60 seconds (configurable)
  2. On new commit detected on any branch:
     a. Re-fingerprint that branch (incremental — only changed files)
     b. Re-run conflict detection against all other branches
     c. Push updates to connected web clients via SSE
  3. Web dashboard updates in real-time without page refresh
```

---

## 9. Feature Module: Smart Test Selection

### Algorithm

```
testImpact(diff):
  1. Parse diff → list of changed functions/methods/classes
  2. For each changed symbol:
     a. Look up reverse test index: production_function → [tests]
     b. Add all directly-linked tests
  3. Expand transitively:
     a. For each changed symbol, find all callers (from call graph)
     b. For each caller, look up reverse test index
     c. Add transitively-linked tests (marked as "indirect")
  4. Detect untested changes:
     a. Changed symbols with ZERO tests (direct or transitive)
     b. Flag these as "test gaps"
  5. Estimate run time:
     a. If test duration data available (from previous runs), sum test durations
     b. Otherwise, count tests and estimate

  Return:
    {
      testsToRun: [{ testFile, testName, linkType: 'direct'|'transitive', via: string }],
      testsSkipped: number,
      testGaps: [{ symbol, filePath, reason: 'no_test_coverage' }],
      estimatedDuration: number
    }
```

### CLI Interface

```bash
# Test impact for current uncommitted changes
codeflow test-impact

# Test impact for a specific diff
codeflow test-impact --diff HEAD~3

# Test impact for a branch (vs. main)
codeflow test-impact --branch feature/oauth

# Output as test filter (for CI)
codeflow test-impact --format filter
# Output: --testPathPattern="test/auth|test/api/protected"

# Show untested paths
codeflow test-impact --gaps
```

---

## 10. Feature Module: Security Flow Detection

### CLI Interface

```bash
# Full security scan
codeflow security

# Scan specific directory
codeflow security --path src/api/

# Only critical findings
codeflow security --severity critical

# Output as SARIF (for GitHub Security tab)
codeflow security --format sarif
```

### Output Format

```
SECURITY SCAN RESULTS
═══════════════════════════════════════════════════════════════

  CRITICAL ───────────────────────────────────────────────────

  [SQL-001] SQL Injection
  Source: req.query.search  (src/api/search.ts:15)
  Path:
    → req.query.search
    → buildQuery(search)        ❌ NO SANITIZATION
    → db.raw(`...${search}...`) [SINK: sql_execution]
  Fix: Use parameterized query: db.raw('... WHERE name LIKE ?', [search])

  WARNING ────────────────────────────────────────────────────

  [PII-001] PII in Logs
  Source: user.email  (src/auth/login.ts:28)
  Path:
    → user.email
    → logger.info(`Login: ${user.email}`)  [SINK: log]
  Fix: Mask PII: logger.info(`Login: ${maskEmail(user.email)}`)

  SUMMARY ────────────────────────────────────────────────────
  Critical:  1
  Warning:   3
  Info:      7
```

---

## 11. Feature Module: Schema & API Impact

### CLI Interface

```bash
# Impact of a schema change
codeflow schema-impact --model User --field email --rename primary_email

# Impact of adding a required field
codeflow schema-impact --model User --add-field mfaEnabled:boolean:required

# Impact of removing a field
codeflow schema-impact --model User --remove-field legacyId

# API endpoint impact
codeflow schema-impact --endpoint "POST /api/signup" --remove-field password_confirm
```

### Analysis Process

```
schemaImpact(change):
  1. Find all code references to the affected field:
     a. Direct references: user.email, data['email'], data.get('email')
     b. ORM queries: User.findBy({email: ...}), WHERE email = ?
     c. API contracts: {email: string} in request/response types
     d. Migration files: CreateColumn('email', ...), ALTER TABLE
     e. Test fixtures: {email: 'test@example.com'}
     f. Config/seeds: default values referencing the field

  2. Classify impact:
     - WILL BREAK: direct reference to removed/renamed field
     - NEEDS UPDATE: ORM query referencing old field name
     - CHECK MANUALLY: dynamic access patterns (data[fieldName])

  3. Generate migration suggestion:
     - For renames: find-and-replace in code + ALTER TABLE
     - For additions: find all object creation → add default value
     - For removals: find all reads → suggest removal or fallback

  Return:
    {
      affectedLocations: [{file, line, code, impactKind}],
      affectedTests: [{testFile, testName}],
      affectedEndpoints: [{method, path, bodyField|responseField}],
      migrationSteps: [string],
      riskLevel: 'low' | 'medium' | 'high' | 'critical'
    }
```

---

## 12. Feature Module: Code Risk Scoring

### Composite Risk Score

```
riskScore(target):  // target = function, file, or diff

  factors = {}

  // Factor 1: Complexity (0-10)
  factors.complexity = normalize(cyclomaticComplexity + cognitiveComplexity)

  // Factor 2: Test Coverage (0-10, inverted — low coverage = high risk)
  factors.testCoverage = 10 - normalize(testCount / dependentCount)

  // Factor 3: Data Sensitivity (0-10)
  factors.dataSensitivity = scoreSensitivity({
    handlesPII: ...,           // email, phone, SSN, address
    handlesAuth: ...,          // passwords, tokens, sessions
    handlesCrypto: ...,        // encryption keys, signatures
    handlesPayment: ...,       // credit cards, bank accounts
  })

  // Factor 4: Blast Radius (0-10)
  factors.blastRadius = normalize(transitiveCallerCount)

  // Factor 5: Change Velocity (0-10)
  factors.changeVelocity = normalize(commitsInLast30Days)

  // Factor 6: Error Handling (0-10, inverted — good handling = low risk)
  factors.errorHandling = 10 - scoreErrorHandling({
    uncaughtThrows: ...,
    missingNullChecks: ...,
    unhandledPromises: ...,
  })

  // Weighted composite
  weights = { complexity: 0.15, testCoverage: 0.25, dataSensitivity: 0.20,
              blastRadius: 0.15, changeVelocity: 0.10, errorHandling: 0.15 }
  score = sum(factors[k] * weights[k] for k in factors) * 10  // 0-100

  Return:
    {
      score: number,           // 0-100
      level: 'low' | 'medium' | 'high' | 'critical',
      factors: Map<string, {score: number, weight: number, detail: string}>,
      recommendation: string
    }
```

### CLI Interface

```bash
# Risk score for current diff
codeflow risk

# Risk score for a specific file
codeflow risk --file src/auth/validate.ts

# Risk score for a branch (vs. main)
codeflow risk --branch feature/oauth

# Risk history (trend)
codeflow risk --history --days 30
```

---

## 13. CLI Design

```
codeflow <command> [options]

Commands:
  analyze          Index a repository (run full pipeline)
  trace            Trace data flow from source to sinks
  branches         Show cross-branch conflict analysis
  branch-diff      Deep-compare two specific branches
  pre-push         Check current branch for conflicts before push
  test-impact      Show which tests to run for a change
  security         Security vulnerability scan
  schema-impact    Analyze impact of schema/API changes
  risk             Code risk scoring
  query            Hybrid search (keyword + semantic)
  context          360° symbol view
  serve            Start HTTP API server
  mcp              Start MCP server (stdio)
  status           Show index status and stats
  clean            Remove analysis cache

Global Options:
  --repo <path>    Repository path (default: cwd)
  --format <fmt>   Output format: text | json | sarif (default: text)
  --verbose        Show detailed progress
  --no-color       Disable color output
  --version        Show version
  --help           Show help
```

---

## 14. MCP Server Design

### Tools

```typescript
const tools = [
  // Core Analysis
  {
    name: 'codeflow_query',
    description: 'Search the codebase with hybrid keyword + semantic search',
    params: { query: string, limit?: number }
  },
  {
    name: 'codeflow_context',
    description: '360° view of a symbol: callers, callees, data flows, tests, risk',
    params: { symbol: string, depth?: number }
  },
  {
    name: 'codeflow_impact',
    description: 'Blast radius analysis: what depends on this symbol',
    params: { symbol: string, depth?: number }
  },

  // Data Flow
  {
    name: 'codeflow_trace',
    description: 'Trace a data value from source to all sinks',
    params: { from?: string, to?: string, file: string, line?: number }
  },

  // Branch Intelligence
  {
    name: 'codeflow_branches',
    description: 'List all active branch conflicts',
    params: { minSeverity?: 'low' | 'medium' | 'high' | 'critical' }
  },
  {
    name: 'codeflow_branch_diff',
    description: 'Deep comparison of two branches',
    params: { branchA: string, branchB: string }
  },
  {
    name: 'codeflow_pre_push',
    description: 'Check current branch against all others before pushing',
    params: {}
  },

  // Test Intelligence
  {
    name: 'codeflow_test_impact',
    description: 'Which tests should run for a given diff',
    params: { diff?: string, branch?: string }
  },

  // Security
  {
    name: 'codeflow_security',
    description: 'Find security vulnerabilities (taint analysis)',
    params: { path?: string, severity?: 'critical' | 'warning' | 'info' }
  },

  // Schema/API
  {
    name: 'codeflow_schema_impact',
    description: 'Impact of a schema or API change',
    params: { model: string, field: string, action: 'rename' | 'remove' | 'add', newName?: string }
  },

  // Risk
  {
    name: 'codeflow_risk',
    description: 'Risk score for a function, file, or diff',
    params: { target?: string, diff?: string }
  }
];
```

### Resources

```
codeflow://repo/{name}/overview          # Stats, languages, communities
codeflow://repo/{name}/branches          # Active branches + conflict summary
codeflow://repo/{name}/security          # Security posture summary
codeflow://repo/{name}/schema            # Schema models + field graph
codeflow://repo/{name}/processes         # Execution flows
codeflow://repo/{name}/test-gaps         # Functions with no test coverage
codeflow://repo/{name}/risk-hotspots     # Top-20 highest risk functions
```

---

## 15. HTTP API Server

### Endpoints

```
Analysis
  POST   /api/analyze              Start analysis pipeline (returns job ID)
  GET    /api/analyze/:jobId       Check analysis progress
  GET    /api/status               Index status + stats

Search
  POST   /api/search               Hybrid search { query, limit }
  POST   /api/context              Symbol context { symbol, depth }
  POST   /api/impact               Impact analysis { symbol, depth }

Data Flow
  POST   /api/trace                Trace data flow { from, to, file, line }

Branches
  GET    /api/branches             List active branches + conflicts
  GET    /api/branches/conflicts   All pairwise conflicts
  POST   /api/branches/diff        Deep-compare two branches { branchA, branchB }
  POST   /api/branches/pre-push    Pre-push check { branch }

Tests
  POST   /api/tests/impact         Test impact { diff, branch }
  GET    /api/tests/gaps           Untested functions

Security
  POST   /api/security/scan        Run security scan { path, severity }
  GET    /api/security/report      Full security report

Schema
  GET    /api/schema/models        All schema models
  POST   /api/schema/impact        Schema impact analysis { model, field, action }

Risk
  POST   /api/risk/score           Risk score { target, diff }
  GET    /api/risk/hotspots        Top risk functions

Live Updates
  GET    /api/events               SSE stream (branch changes, scan progress)
```

---

## 16. Web Application — UI/UX Design

### Design Principles

1. **Dark-first**: Deep slate background (#0a0a0f), vibrant accent colors
2. **Glass morphism**: Frosted glass panels with backdrop-blur
3. **Motion-rich**: Framer Motion for page transitions, list animations, graph state changes
4. **Information density**: Dashboard-style layout — multiple data cards visible at once
5. **Progressive disclosure**: Summary first, drill down for details
6. **Responsive**: Mobile-friendly (branch conflict alerts still useful on phone)
7. **Accessible**: Radix primitives, keyboard navigation, screen reader support

### Color System

```
Background:       #0a0a0f  (near-black)
Surface:          #12121c  (dark panel)
Surface elevated: #1a1a2e  (cards, popovers)
Border:           #2a2a3e  (subtle dividers)
Text primary:     #e4e4ef  (high contrast)
Text secondary:   #8888a0  (subdued)
Text muted:       #55556a  (disabled/hints)

Accents:
  Blue:       #3b82f6  (primary actions, links)
  Green:      #10b981  (safe, passing, low risk)
  Amber:      #f59e0b  (warning, medium risk)
  Red:        #ef4444  (critical, failing, high risk)
  Purple:     #8b5cf6  (data flow, semantic)
  Cyan:       #06b6d4  (branches, git)
  Pink:       #ec4899  (security, taint)

Severity gradient:
  LOW:       #10b981 → #065f46  (green gradient)
  MEDIUM:    #f59e0b → #92400e  (amber gradient)
  HIGH:      #ef4444 → #991b1b  (red gradient)
  CRITICAL:  #ef4444 → #7f1d1d  (deep red pulse animation)
```

### Page Designs

#### 1. Onboarding Page (`/`)

Full-screen landing with three entry options, animated with Framer Motion staggered reveal:

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                   │
│                    ⬡ CodeFlow                                     │
│           Data-Aware Code Intelligence                            │
│                                                                   │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│   │  📁 Local     │  │  🔗 Git URL   │  │  🖥️  Server   │          │
│   │  Repository   │  │               │  │  Connection  │          │
│   │               │  │  Clone from   │  │               │          │
│   │  Browse to    │  │  GitHub/Lab   │  │  Connect to   │          │
│   │  local dir    │  │               │  │  running      │          │
│   │               │  │  [paste URL]  │  │  instance     │          │
│   │  [Select]     │  │  [Clone]      │  │  [Connect]    │          │
│   └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│   Recent repositories:                                           │
│   ┌─ my-app (analyzed 2h ago) ─ 1,245 symbols, 12 processes ──┐ │
│   └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

#### 2. Dashboard Page (`/dashboard`)

Overview with key metric cards and quick-action sections:

```
┌─ Sidebar ─┐┌─────────────────────────────────────────────────────┐
│            ││  Dashboard                              ⌘K Search   │
│  ⬡ Code   │├─────────────────────────────────────────────────────┤
│    Flow    ││                                                      │
│            ││  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  📊 Dash   ││  │ Symbols │ │ Data    │ │ Branch  │ │ Risk    │  │
│  🔀 Trace  ││  │  2,847  │ │ Flows   │ │ Alerts  │ │ Score   │  │
│  🌿 Branch ││  │  ↑ 123  │ │  4,231  │ │ 2 CRIT  │ │  67/100 │  │
│  🧪 Tests  ││  │         │ │         │ │ 5 HIGH  │ │ MEDIUM  │  │
│  🔒 Secur. ││  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
│  📐 Schema ││                                                      │
│  ⚠️  Risk   ││  ┌─── Security ──────┐  ┌─── Test Coverage ─────┐  │
│  🔍 Graph  ││  │ ● 1 Critical       │  │ ████████░░  78%       │  │
│  ⚙️  Config ││  │ ● 3 Warning        │  │ 42 functions untested │  │
│            ││  │ ● 7 Info           │  │ [View gaps →]          │  │
│            ││  │ [Scan details →]   │  │                        │  │
│            ││  └────────────────────┘  └────────────────────────┘  │
│            ││                                                      │
│            ││  ┌─── Branch Conflicts ───────────────────────────┐  │
│            ││  │ ⚠️  feature/oauth ↔ refactor/auth (CRITICAL)    │  │
│            ││  │     2 semantic, 3 textual conflicts             │  │
│            ││  │ ⚠  feature/profiles ↔ feature/oauth (HIGH)     │  │
│            ││  │     Schema overlap in users table               │  │
│            ││  │ [View all branches →]                           │  │
│            ││  └─────────────────────────────────────────────────┘  │
└────────────┘└─────────────────────────────────────────────────────┘
```

#### 3. Data Flow Trace Page (`/trace`)

Interactive trace interface with React Flow visualization:

```
┌─ Sidebar ─┐┌─────────────────────────────────────────────────────┐
│            ││  Data Flow Tracing                                   │
│            │├─────────────────────────────────────────────────────┤
│            ││  Source: [req.body.email   ▼]  File: [src/api/ ▼]  │
│            ││  Direction: [Forward ▼]        [Trace →]            │
│            │├─────────────────────────────────────────────────────┤
│            ││                                                      │
│            ││  ┌─────────────────────────────────────────────┐    │
│            ││  │          REACT FLOW DIAGRAM                  │    │
│            ││  │                                              │    │
│            ││  │  [req.body.email]                            │    │
│            ││  │       │                                      │    │
│            ││  │       ├──→ [validateEmail()] ✅               │    │
│            ││  │       │         │                            │    │
│            ││  │       │    ┌────┴────┐                       │    │
│            ││  │       │    ▼         ▼                       │    │
│            ││  │       │  [db.insert] [sendEmail]             │    │
│            ││  │       │   ✅ safe     ✅ safe                 │    │
│            ││  │       │                                      │    │
│            ││  │       └──→ [logger.info]                     │    │
│            ││  │            ⚠️  PII in logs                    │    │
│            ││  │                                              │    │
│            ││  └─────────────────────────────────────────────┘    │
│            ││                                                      │
│            ││  ┌─ Code View ──────────────────────────────────┐   │
│            ││  │  src/api/signup.ts                            │   │
│            ││  │                                              │   │
│            ││  │  15│ const { email } = req.body; ← SOURCE   │   │
│            ││  │  16│ const valid = validateEmail(email);      │   │
│            ││  │  17│ if (valid) {                             │   │
│            ││  │  18│   await createUser({ email });          │   │
│            ││  │  19│   logger.info(`signup: ${email}`); ← ⚠  │   │
│            ││  │  20│ }                                       │   │
│            ││  └──────────────────────────────────────────────┘   │
└────────────┘└─────────────────────────────────────────────────────┘
```

#### 4. Branch Conflict Page (`/branches`)

Network graph of branches with conflict edges + detail panel:

```
┌─ Sidebar ─┐┌─────────────────────────────────────────────────────┐
│            ││  Branch Conflicts                    [Refresh 🔄]   │
│            │├─────────────────────────────────────────────────────┤
│            ││  ┌───────────────────────────────────────────────┐  │
│            ││  │        BRANCH RELATIONSHIP GRAPH               │  │
│            ││  │                                                │  │
│            ││  │    [feature/oauth]                             │  │
│            ││  │       │  ╲                                     │  │
│            ││  │  CRIT │   ╲ HIGH                               │  │
│            ││  │       │    ╲                                   │  │
│            ││  │  [refactor/auth]    [feature/profiles]         │  │
│            ││  │                    /                            │  │
│            ││  │              ✅  /                              │  │
│            ││  │   [fix/password-reset]                         │  │
│            ││  │                                                │  │
│            ││  └───────────────────────────────────────────────┘  │
│            ││                                                      │
│            ││  ┌─ Conflict Detail ──────────────────────────────┐ │
│            ││  │ feature/oauth ↔ refactor/auth-service          │ │
│            ││  │ Severity: CRITICAL        Since: 2 days ago    │ │
│            ││  │                                                │ │
│            ││  │ SEMANTIC CONFLICTS:                            │ │
│            ││  │ ● AuthService.validate() — contract changed   │ │
│            ││  │   refactor: returns User, throws AuthError     │ │
│            ││  │   oauth: expects User|null return              │ │
│            ││  │                                                │ │
│            ││  │ TEXTUAL CONFLICTS (predicted):                 │ │
│            ││  │ ● src/auth/validate.ts: lines 42-67           │ │
│            ││  │ ● src/auth/session.ts: lines 15-30            │ │
│            ││  │                                                │ │
│            ││  │ RECOMMENDATION:                                │ │
│            ││  │ Sarah and Alex should sync. Alex's refactor   │ │
│            ││  │ changes validate() behavior that Sarah's new  │ │
│            ││  │ OAuthController depends on.                   │ │
│            ││  └────────────────────────────────────────────────┘ │
└────────────┘└─────────────────────────────────────────────────────┘
```

#### 5. Test Impact Page (`/tests`)

Diff-driven test selection with coverage gaps:

```
┌─ Sidebar ─┐┌─────────────────────────────────────────────────────┐
│            ││  Smart Test Selection                                │
│            │├─────────────────────────────────────────────────────┤
│            ││  Source: [Current diff ▼]  Branch: [feature/oauth]  │
│            ││                                                      │
│            ││  Changed symbols: 8    Affected tests: 12 / 3,247  │
│            ││  Estimated time: 23s (vs 14min for all tests)       │
│            ││  ┌──────────────────────────────────────────────┐   │
│            ││  │  ████░░░░░░░░░░░░░░░░░░░░░░░░  0.4% of tests│   │
│            ││  └──────────────────────────────────────────────┘   │
│            ││                                                      │
│            ││  TESTS TO RUN                                       │
│            ││  ┌──────────────────────────────────────────────┐   │
│            ││  │ ✅ test/auth/validate.test.ts                 │   │
│            ││  │    validateToken, refreshToken           DIRECT │   │
│            ││  │                                               │   │
│            ││  │ ✅ test/api/protected-routes.test.ts           │   │
│            ││  │    checkAuth middleware                TRANSITIVE│   │
│            ││  │    via: validateToken → authMiddleware         │   │
│            ││  │ ...                                           │   │
│            ││  └──────────────────────────────────────────────┘   │
│            ││                                                      │
│            ││  ⚠️  TEST GAPS (untested changed code)              │
│            ││  ┌──────────────────────────────────────────────┐   │
│            ││  │ 🔴 refreshToken → revokeOldToken              │   │
│            ││  │    NO TEST COVERAGE for this path             │   │
│            ││  │    Recommendation: Add test for token          │   │
│            ││  │    revocation during refresh flow             │   │
│            ││  └──────────────────────────────────────────────┘   │
│            ││                                                      │
│            ││  [Copy test filter command]  [Run selected tests]   │
└────────────┘└─────────────────────────────────────────────────────┘
```

#### 6. Security Page (`/security`)

Taint flow visualization with severity grouping:

```
┌─ Sidebar ─┐┌─────────────────────────────────────────────────────┐
│            ││  Security Analysis                                   │
│            │├─────────────────────────────────────────────────────┤
│            ││  ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│            ││  │ Critical│ │ Warning │ │  Info   │              │
│            ││  │    1    │ │    3    │ │    7    │              │
│            ││  └─────────┘ └─────────┘ └─────────┘              │
│            ││                                                      │
│            ││  ┌─ CRITICAL ──────────────────────────────────┐    │
│            ││  │                                              │    │
│            ││  │  [SQL-001] SQL Injection                     │    │
│            ││  │  req.query.search → db.raw()                │    │
│            ││  │                                              │    │
│            ││  │  ┌─ Taint Flow Diagram ──────────────────┐  │    │
│            ││  │  │ [req.query.search] ─🔴─→ [buildQuery] │  │    │
│            ││  │  │                     NO     ─🔴─→       │  │    │
│            ││  │  │               SANITIZER   [db.raw()]   │  │    │
│            ││  │  └──────────────────────────────────────┘  │    │
│            ││  │                                              │    │
│            ││  │  📄 src/api/search.ts                        │    │
│            ││  │  ┌──────────────────────────────────────┐   │    │
│            ││  │  │ 14│ const search = req.query.search; │   │    │
│            ││  │  │ 15│ const query = buildQuery(search);│   │    │
│            ││  │  │ 16│ const results = db.raw(query);   │   │    │
│            ││  │  └──────────────────────────────────────┘   │    │
│            ││  │                                              │    │
│            ││  │  💡 Fix: Use parameterized query            │    │
│            ││  │  db.raw('SELECT * WHERE name LIKE ?', [s]) │    │
│            ││  │                                              │    │
│            ││  └──────────────────────────────────────────────┘    │
└────────────┘└─────────────────────────────────────────────────────┘
```

#### 7. Schema Impact Page (`/schema`)

Entity-relationship diagram with impact highlights:

```
┌─ Sidebar ─┐┌─────────────────────────────────────────────────────┐
│            ││  Schema & API Impact                                 │
│            │├─────────────────────────────────────────────────────┤
│            ││  Simulate: [Rename ▼] Model: [User ▼]              │
│            ││  Field: [email ▼]  New name: [primary_email    ]   │
│            ││  [Analyze Impact →]                                  │
│            ││                                                      │
│            ││  ┌─ Entity Relationship Diagram ────────────────┐   │
│            ││  │                                              │   │
│            ││  │   ┌────────┐    ┌──────────┐   ┌────────┐  │   │
│            ││  │   │ User   │──→ │ Session  │   │ Order  │  │   │
│            ││  │   │────────│    │──────────│   │────────│  │   │
│            ││  │   │⚠ email │    │ userId   │   │ userId │  │   │
│            ││  │   │ name   │    │ token    │   │ total  │  │   │
│            ││  │   │ hash   │    └──────────┘   └────────┘  │   │
│            ││  │   └────────┘                                │   │
│            ││  └──────────────────────────────────────────────┘   │
│            ││                                                      │
│            ││  IMPACT: 17 locations in 9 files                    │
│            ││  ┌──────────────────────────────────────────────┐   │
│            ││  │ WILL BREAK (9):                               │   │
│            ││  │  src/models/user.ts:24    field reference     │   │
│            ││  │  src/api/signup.ts:31     INSERT query        │   │
│            ││  │  src/api/profile.ts:18    SELECT query        │   │
│            ││  │  ...                                         │   │
│            ││  │                                               │   │
│            ││  │ AFFECTED TESTS (6):                           │   │
│            ││  │  test/models/user.test.ts                     │   │
│            ││  │  test/api/signup.test.ts                      │   │
│            ││  │  ...                                         │   │
│            ││  │                                               │   │
│            ││  │ AFFECTED API ENDPOINTS (2):                   │   │
│            ││  │  POST /signup    body.email                   │   │
│            ││  │  GET  /profile   response.email               │   │
│            ││  └──────────────────────────────────────────────┘   │
└────────────┘└─────────────────────────────────────────────────────┘
```

#### 8. Risk Scoring Page (`/risk`)

Animated gauge with breakdown and historical trend:

```
┌─ Sidebar ─┐┌─────────────────────────────────────────────────────┐
│            ││  Code Risk Analysis                                  │
│            │├─────────────────────────────────────────────────────┤
│            ││  Target: [Current diff ▼]  Branch: [feature/oauth]  │
│            ││                                                      │
│            ││  ┌──────────────────────────────────────────────┐   │
│            ││  │                                              │   │
│            ││  │        ┌─────────────────┐                  │   │
│            ││  │        │   RISK: 73/100  │                  │   │
│            ││  │        │   ████████░░    │                  │   │
│            ││  │        │     HIGH        │                  │   │
│            ││  │        └─────────────────┘                  │   │
│            ││  │                                              │   │
│            ││  │  Test Coverage:     ████████████░  9/10      │   │
│            ││  │  Data Sensitivity:  ████████░░░░  6/10      │   │
│            ││  │  Complexity:        ████████████░  8/10      │   │
│            ││  │  Change Velocity:   ████████████░░ 7/10     │   │
│            ││  │  Blast Radius:      █████░░░░░░░  4/10      │   │
│            ││  │  Error Handling:     ████████░░░  6/10      │   │
│            ││  │                                              │   │
│            ││  └──────────────────────────────────────────────┘   │
│            ││                                                      │
│            ││  Recommendation:                                    │
│            ││  ┌──────────────────────────────────────────────┐   │
│            ││  │ 🔴 2 modified functions have ZERO test coverage│   │
│            ││  │ 🟡 Handles PII (email, password hash)          │   │
│            ││  │ 🟡 auth/validate.ts changed 14× in 30 days    │   │
│            ││  │ → Requires senior review. Add tests first.    │   │
│            ││  └──────────────────────────────────────────────┘   │
│            ││                                                      │
│            ││  ┌─ Risk Trend (30 days) ──────────────────────┐   │
│            ││  │  80│        ╱╲                               │   │
│            ││  │  60│ ─────╱  ╲───────╱╲─── current          │   │
│            ││  │  40│╱                    ╲                   │   │
│            ││  │  20│                                         │   │
│            ││  │    └────────────────────────────────────────│   │
│            ││  └──────────────────────────────────────────────┘   │
└────────────┘└─────────────────────────────────────────────────────┘
```

#### 9. Graph Explorer Page (`/graph`)

Full-screen interactive graph (same approach as GitNexus but with data flow edges):

```
┌─ Sidebar ─┐┌─────────────────────────────────────────────────────┐
│            ││  ┌─ Controls ──────────────────────────────────────┐│
│            ││  │ Nodes: [✓ Function ✓ Class □ File □ Test]       ││
│            ││  │ Edges: [✓ Calls ✓ DataFlow □ Imports □ Tests]   ││
│            ││  │ Depth: [2 ▼]  Layout: [Force ▼]  [Fit] [Reset] ││
│            ││  └──────────────────────────────────────────────────┘│
│            ││  ┌──────────────────────────────────────────────────┐│
│            ││  │                                                   ││
│            ││  │              SIGMA.JS GRAPH CANVAS                ││
│            ││  │                                                   ││
│            ││  │     ● ─── ● ─── ●                                ││
│            ││  │    /│╲         ╱│╲                                ││
│            ││  │   ● ● ●     ● ● ●                               ││
│            ││  │        ╲   ╱                                      ││
│            ││  │         ● ●                                       ││
│            ││  │                                                   ││
│            ││  │                     LEGEND                        ││
│            ││  │     ● Function  ● Class  ─ Call  ═ DataFlow      ││
│            ││  │                                                   ││
│            ││  └──────────────────────────────────────────────────┘│
│            ││  ┌─ Node Detail ─────────────────────────────────┐  │
│            ││  │ validateUser (Function)                        │  │
│            ││  │ src/auth/validate.ts:15                        │  │
│            ││  │ Complexity: 12  Risk: 73  Tests: 3             │  │
│            ││  │ Data flows: email → db.users, password → hash  │  │
│            ││  │ [Trace Data ↗] [Impact ↗] [View Source ↗]     │  │
│            ││  └───────────────────────────────────────────────┘  │
└────────────┘└─────────────────────────────────────────────────────┘
```

#### 10. Settings Page (`/settings`)

```
┌─ Sidebar ─┐┌─────────────────────────────────────────────────────┐
│            ││  Settings                                            │
│            │├─────────────────────────────────────────────────────┤
│            ││                                                      │
│            ││  ANALYSIS                                           │
│            ││  ┌──────────────────────────────────────────────┐   │
│            ││  │ Max file size:    [512 KB ▼]                 │   │
│            ││  │ Worker threads:   [Auto (7) ▼]               │   │
│            ││  │ Analysis depth:   [Standard ▼]               │   │
│            ││  │ Languages:        [Auto-detect ▼]            │   │
│            ││  └──────────────────────────────────────────────┘   │
│            ││                                                      │
│            ││  BRANCHES                                           │
│            ││  ┌──────────────────────────────────────────────┐   │
│            ││  │ Scan interval:    [60 seconds ▼]             │   │
│            ││  │ Max branch age:   [30 days ▼]                │   │
│            ││  │ Exclude patterns: [release/*     ]           │   │
│            ││  │ Main branch:      [main          ]           │   │
│            ││  └──────────────────────────────────────────────┘   │
│            ││                                                      │
│            ││  SECURITY                                           │
│            ││  ┌──────────────────────────────────────────────┐   │
│            ││  │ Custom sources:   [Add pattern...]           │   │
│            ││  │ Custom sinks:     [Add pattern...]           │   │
│            ││  │ Ignored paths:    [vendor/*, dist/*  ]       │   │
│            ││  └──────────────────────────────────────────────┘   │
│            ││                                                      │
│            ││  NOTIFICATIONS                                      │
│            ││  ┌──────────────────────────────────────────────┐   │
│            ││  │ Slack webhook:    [https://hooks.slack...]    │   │
│            ││  │ Alert threshold:  [HIGH ▼]                   │   │
│            ││  └──────────────────────────────────────────────┘   │
│            ││                                                      │
└────────────┘└─────────────────────────────────────────────────────┘
```

### Animation Specifications

| Element             | Animation               | Library                         | Duration        |
| ------------------- | ----------------------- | ------------------------------- | --------------- |
| Page transitions    | Slide + fade            | Framer Motion `AnimatePresence` | 300ms           |
| Card entry          | Staggered fade-up       | Framer Motion `staggerChildren` | 100ms stagger   |
| Risk gauge          | Animated arc draw       | Framer Motion `pathLength`      | 1200ms ease-out |
| Metric counters     | Count-up from 0         | Custom `AnimatedCounter`        | 800ms           |
| Severity badges     | Pulse glow (critical)   | CSS keyframes                   | 2s infinite     |
| Graph highlights    | Node ripple effect      | Sigma.js node program           | 600ms           |
| Branch edges        | Dash animation          | CSS stroke-dashoffset           | 2s infinite     |
| Loading states      | Skeleton shimmer        | Tailwind animate-pulse          | --              |
| Toast notifications | Slide-in from right     | Sonner                          | 300ms           |
| Panel resize        | Spring physics          | Framer Motion `layout`          | 400ms spring    |
| Sidebar collapse    | Width transition        | Framer Motion                   | 200ms           |
| Data flow edges     | Animated particle flow  | React Flow custom edge          | 3s infinite     |
| Conflict severity   | Color pulse (red/amber) | Framer Motion                   | 1.5s infinite   |

---

## 17. Data Models & Storage

### SQLite Schema

```sql
-- Core tables
CREATE TABLE repos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  analyzed_at TEXT,
  commit_hash TEXT,
  stats_json TEXT
);

-- Symbol nodes (all code symbols)
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  kind TEXT NOT NULL,          -- 'function' | 'class' | 'method' | 'file' | ...
  name TEXT NOT NULL,
  qualified_name TEXT,         -- 'MyClass.myMethod'
  file_path TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  language TEXT,
  signature TEXT,              -- Full signature string
  param_count INTEGER,
  return_type TEXT,
  owner_id TEXT,               -- Parent class/module
  community_id TEXT,
  complexity_cyclomatic INTEGER,
  complexity_cognitive INTEGER,
  risk_score REAL,
  is_test INTEGER DEFAULT 0,
  is_entry_point INTEGER DEFAULT 0,
  metadata_json TEXT           -- Extensible metadata
);

-- Edges (all relationships)
CREATE TABLE edges (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  source_id TEXT NOT NULL REFERENCES nodes(id),
  target_id TEXT NOT NULL REFERENCES nodes(id),
  kind TEXT NOT NULL,          -- 'calls' | 'imports' | 'data_flow' | 'extends' | ...
  confidence REAL DEFAULT 1.0,
  metadata_json TEXT           -- { reason, transform, taint_status, ... }
);

-- Data Flow Graph (statement-level)
CREATE TABLE dfg_nodes (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  function_id TEXT NOT NULL REFERENCES nodes(id),
  kind TEXT NOT NULL,          -- 'param' | 'assignment' | 'call_result' | 'return' | ...
  code TEXT,
  file_path TEXT NOT NULL,
  line INTEGER,
  column INTEGER,
  data_type TEXT,
  is_source INTEGER DEFAULT 0,
  is_sink INTEGER DEFAULT 0,
  is_sanitizer INTEGER DEFAULT 0,
  source_kind TEXT,            -- 'http_input' | 'env' | 'db_read' | ...
  sink_kind TEXT               -- 'database' | 'log' | 'exec' | 'http_response' | ...
);

CREATE TABLE dfg_edges (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  source_id TEXT NOT NULL REFERENCES dfg_nodes(id),
  target_id TEXT NOT NULL REFERENCES dfg_nodes(id),
  kind TEXT NOT NULL,          -- 'data_dep' | 'param_bind' | 'return_flow' | 'field_flow' | ...
  transform TEXT,              -- 'validate' | 'escape' | 'parseInt' | ...
  is_sanitizing INTEGER DEFAULT 0
);

-- Function summaries
CREATE TABLE summaries (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES nodes(id),
  repo_id TEXT NOT NULL REFERENCES repos(id),
  param_flows_json TEXT,       -- Serialized ParamFlow[]
  side_effects_json TEXT,      -- Serialized SideEffect[]
  throws_json TEXT,            -- Serialized ThrowInfo[]
  can_return_null INTEGER DEFAULT 0,
  can_return_undefined INTEGER DEFAULT 0
);

-- Control Flow Graph blocks
CREATE TABLE cfg_blocks (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  function_id TEXT NOT NULL REFERENCES nodes(id),
  kind TEXT NOT NULL,          -- 'entry' | 'exit' | 'normal' | 'branch' | 'loop' | 'catch'
  start_line INTEGER,
  end_line INTEGER,
  statement_count INTEGER
);

CREATE TABLE cfg_edges (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  source_block_id TEXT NOT NULL REFERENCES cfg_blocks(id),
  target_block_id TEXT NOT NULL REFERENCES cfg_blocks(id),
  kind TEXT NOT NULL,          -- 'normal' | 'true_branch' | 'false_branch' | 'exception' | ...
  condition TEXT               -- Branch condition expression
);

-- Communities (functional clusters)
CREATE TABLE communities (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  label TEXT,
  cohesion REAL,
  symbol_count INTEGER,
  keywords_json TEXT
);

-- Processes (execution flows)
CREATE TABLE processes (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  name TEXT,
  entry_id TEXT REFERENCES nodes(id),
  kind TEXT,                   -- 'http_handler' | 'cron' | 'event_listener' | 'main' | ...
  step_count INTEGER,
  crosses_communities INTEGER DEFAULT 0
);

CREATE TABLE process_steps (
  id TEXT PRIMARY KEY,
  process_id TEXT NOT NULL REFERENCES processes(id),
  node_id TEXT NOT NULL REFERENCES nodes(id),
  step_order INTEGER NOT NULL,
  community_id TEXT
);

-- Test mapping
CREATE TABLE test_mappings (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  test_node_id TEXT NOT NULL REFERENCES nodes(id),
  production_node_id TEXT NOT NULL REFERENCES nodes(id),
  link_type TEXT NOT NULL,     -- 'direct' | 'transitive'
  via TEXT                     -- Intermediate function (for transitive)
);

-- Schema models
CREATE TABLE schema_models (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  name TEXT NOT NULL,
  orm TEXT,                    -- 'prisma' | 'typeorm' | 'sqlalchemy' | ...
  file_path TEXT,
  line INTEGER
);

CREATE TABLE schema_fields (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES schema_models(id),
  name TEXT NOT NULL,
  field_type TEXT,
  nullable INTEGER DEFAULT 0,
  is_primary INTEGER DEFAULT 0,
  is_unique INTEGER DEFAULT 0
);

CREATE TABLE schema_refs (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  field_id TEXT NOT NULL REFERENCES schema_fields(id),
  node_id TEXT NOT NULL REFERENCES nodes(id),
  ref_kind TEXT NOT NULL,      -- 'read' | 'write' | 'query' | 'migration' | 'fixture'
  file_path TEXT,
  line INTEGER,
  code TEXT
);

-- API endpoints
CREATE TABLE api_endpoints (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  method TEXT NOT NULL,        -- 'GET' | 'POST' | 'PUT' | 'DELETE' | ...
  path TEXT NOT NULL,
  handler_id TEXT REFERENCES nodes(id),
  file_path TEXT,
  line INTEGER,
  request_schema_json TEXT,
  response_schema_json TEXT
);

-- Taint flows (security)
CREATE TABLE taint_flows (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  severity TEXT NOT NULL,      -- 'critical' | 'warning' | 'info'
  category TEXT NOT NULL,      -- 'sql_injection' | 'xss' | 'command_injection' | 'pii_leak' | ...
  source_dfg_node_id TEXT NOT NULL REFERENCES dfg_nodes(id),
  sink_dfg_node_id TEXT NOT NULL REFERENCES dfg_nodes(id),
  path_json TEXT,              -- Serialized DFGNode[] (intermediate steps)
  is_sanitized INTEGER DEFAULT 0,
  sanitizer_location TEXT,
  fix_suggestion TEXT
);

-- Branch analysis
CREATE TABLE branch_snapshots (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  branch_name TEXT NOT NULL,
  author TEXT,
  last_commit_hash TEXT,
  last_commit_date TEXT,
  commit_count INTEGER,
  files_changed_json TEXT,     -- Serialized string[]
  fingerprint_json TEXT,       -- Serialized BranchFingerprint
  scanned_at TEXT
);

CREATE TABLE branch_conflicts (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  branch_a TEXT NOT NULL,
  branch_b TEXT NOT NULL,
  level INTEGER NOT NULL,      -- 1-5
  severity TEXT NOT NULL,      -- 'low' | 'medium' | 'high' | 'critical'
  details_json TEXT,           -- Serialized ConflictDetail
  detected_at TEXT
);

-- Metrics history
CREATE TABLE metrics_history (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id),
  node_id TEXT NOT NULL REFERENCES nodes(id),
  commit_hash TEXT,
  measured_at TEXT,
  risk_score REAL,
  complexity_cyclomatic INTEGER,
  complexity_cognitive INTEGER,
  test_count INTEGER,
  change_count_30d INTEGER
);

-- Indexes
CREATE INDEX idx_nodes_repo ON nodes(repo_id);
CREATE INDEX idx_nodes_kind ON nodes(repo_id, kind);
CREATE INDEX idx_nodes_file ON nodes(repo_id, file_path);
CREATE INDEX idx_nodes_name ON nodes(repo_id, name);
CREATE INDEX idx_nodes_qualified ON nodes(repo_id, qualified_name);
CREATE INDEX idx_edges_repo ON edges(repo_id);
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);
CREATE INDEX idx_edges_kind ON edges(repo_id, kind);
CREATE INDEX idx_dfg_function ON dfg_nodes(function_id);
CREATE INDEX idx_dfg_edges_source ON dfg_edges(source_id);
CREATE INDEX idx_dfg_edges_target ON dfg_edges(target_id);
CREATE INDEX idx_test_mappings_prod ON test_mappings(production_node_id);
CREATE INDEX idx_test_mappings_test ON test_mappings(test_node_id);
CREATE INDEX idx_schema_refs_field ON schema_refs(field_id);
CREATE INDEX idx_schema_refs_node ON schema_refs(node_id);
CREATE INDEX idx_taint_severity ON taint_flows(repo_id, severity);
CREATE INDEX idx_branch_snapshots ON branch_snapshots(repo_id, branch_name);
CREATE INDEX idx_branch_conflicts ON branch_conflicts(repo_id, severity);

-- Full-text search
CREATE VIRTUAL TABLE nodes_fts USING fts5(
  name, qualified_name, file_path,
  content=nodes, content_rowid=rowid
);
```

---

## 18. Worker Architecture

### Worker Pool Design

```
Main Thread                          Worker Pool (N workers)
─────────────                        ──────────────────────
                                     Worker 1: [parse chunk 1]
  Dispatch chunk 1  ──────────────→  Worker 2: [parse chunk 2]
  Dispatch chunk 2  ──────────────→  Worker 3: [parse chunk 3]
  Dispatch chunk 3  ──────────────→  ...
  ...                                Worker N: [idle]

  Collect results   ←──────────────  Worker 1: [done] → results
  Collect results   ←──────────────  Worker 2: [done] → results

  Phase 3-4 (CFG/DFG analysis):
  Dispatch batch 1  ──────────────→  Worker 1: [build CFG+DFG]
  Dispatch batch 2  ──────────────→  Worker 2: [build CFG+DFG]
  ...
```

**Workers**:

1. **Parse Worker** — Tree-sitter parsing + symbol extraction (Phase 1)
2. **Analysis Worker** — CFG + DFG + taint analysis per function (Phases 3-4, 11)

**Communication**: Structured clone (postMessage). No SharedArrayBuffer needed — results are serialized symbol/edge data.

**Sizing**: `min(8, os.cpus().length - 1)` workers. Sub-batches of 1500 files per message to limit structured clone overhead.

---

## 19. Git Integration

### Git Operations

```typescript
// packages/core/src/git/git-client.ts

interface GitClient {
  // Branch operations
  listBranches(): Promise<BranchInfo[]>;
  getCurrentBranch(): Promise<string>;
  getMainBranch(): Promise<string>; // Detect main/master

  // Diff operations
  diffBranch(branch: string, base?: string): Promise<FileDiff[]>;
  diffRange(from: string, to: string): Promise<FileDiff[]>;
  diffWorktree(): Promise<FileDiff[]>; // Uncommitted changes

  // History operations
  log(file?: string, days?: number): Promise<LogEntry[]>;
  blame(file: string): Promise<BlameLine[]>;

  // Content operations
  showFile(path: string, ref: string): Promise<string>; // File at specific commit

  // Merge simulation
  canMerge(branchA: string, branchB: string): Promise<MergeResult>;
}
```

### Git Hooks

For continuous branch monitoring, CodeFlow can install git hooks:

```bash
# .git/hooks/post-commit
#!/bin/sh
codeflow branches --refresh --quiet

# .git/hooks/post-checkout
#!/bin/sh
codeflow branches --refresh --quiet
```

---

## 20. Configuration System

### Config File (`.codeflow.json`)

```json
{
  "analysis": {
    "maxFileSize": 524288,
    "byteBudget": 20971520,
    "workerCount": 0,
    "languages": [],
    "exclude": ["vendor/**", "dist/**", "node_modules/**", "*.generated.*"]
  },
  "branches": {
    "scanInterval": 60,
    "maxBranchAge": 30,
    "mainBranch": "main",
    "excludePatterns": ["release/*", "dependabot/*"],
    "enableMergeSimulation": true
  },
  "security": {
    "customSources": [],
    "customSinks": [],
    "ignoredPaths": [],
    "severityThreshold": "warning"
  },
  "schema": {
    "ormAutoDetect": true,
    "customModelPatterns": []
  },
  "risk": {
    "weights": {
      "complexity": 0.15,
      "testCoverage": 0.25,
      "dataSensitivity": 0.2,
      "blastRadius": 0.15,
      "changeVelocity": 0.1,
      "errorHandling": 0.15
    }
  },
  "notifications": {
    "slackWebhook": null,
    "alertThreshold": "high"
  }
}
```

### Environment Variables

```
CODEFLOW_DB_DIR=~/.codeflow/        # Database storage directory
CODEFLOW_LOG_LEVEL=info              # Logging level
CODEFLOW_WORKERS=0                   # Worker count (0 = auto)
CODEFLOW_NO_COLOR=false              # Disable terminal colors
```

---

## 21. Testing Strategy

### Test Categories

```
test/
├── unit/                            # Pure function tests (no I/O)
│   ├── parsing/                     # AST extraction tests
│   ├── cfg/                         # CFG construction tests
│   ├── dfg/                         # DFG construction tests
│   ├── taint/                       # Taint propagation tests
│   ├── branches/                    # Conflict detection tests
│   ├── metrics/                     # Risk scoring tests
│   └── schema/                      # ORM parser tests
│
├── integration/                     # Multi-component tests (with I/O)
│   ├── pipeline/                    # Full pipeline on fixture repos
│   ├── git/                         # Git operations on test repos
│   ├── api/                         # HTTP API endpoint tests
│   └── mcp/                         # MCP tool tests
│
├── fixtures/                        # Test source code files
│   ├── typescript/                  # TS fixtures for each feature
│   ├── python/                      # Python fixtures
│   ├── java/                        # Java fixtures
│   ├── repos/                       # Complete mini-repos for integration
│   └── schemas/                     # ORM schema fixtures (Prisma, TypeORM, etc.)
│
└── helpers/                         # Test utilities
    ├── create-test-repo.ts          # Create temp git repos for branch tests
    ├── parse-fixture.ts             # Quick fixture parsing helpers
    └── assert-helpers.ts            # Custom assertions for DFG/CFG
```

### Test Coverage Targets

| Module            | Target | Rationale                                    |
| ----------------- | ------ | -------------------------------------------- |
| CFG builder       | 95%+   | Correctness-critical, many edge cases        |
| DFG builder       | 95%+   | Core differentiator, must be reliable        |
| Taint engine      | 90%+   | Security-critical                            |
| Conflict detector | 90%+   | Key selling feature                          |
| Call resolver     | 85%+   | Proven approach (from GitNexus patterns)     |
| ORM parsers       | 85%+   | Each ORM has specific patterns               |
| Risk scorer       | 80%+   | Configurable weights, needs boundary testing |
| CLI commands      | 75%+   | Integration-heavy, harder to test            |
| Web components    | 70%+   | Visual, harder to assert correctness         |

### Testing Tools

- **Vitest** — Test runner (fast, ESM-native)
- **Vitest UI** — Browser-based test interface
- **Testing Library** — React component tests
- **MSW** — API mocking for frontend tests
- **temp directories** — Ephemeral git repos for branch tests

---

## 22. Performance Targets

| Operation                          | Target  | Method                          |
| ---------------------------------- | ------- | ------------------------------- |
| Full analysis (10k files)          | < 60s   | Worker parallelism + chunking   |
| Full analysis (1k files)           | < 10s   | Single-thread viable            |
| Incremental re-analysis            | < 5s    | Only re-parse changed files     |
| Branch conflict scan (10 branches) | < 15s   | Parallel fingerprinting         |
| Data flow trace (single source)    | < 500ms | Pre-computed DFG lookups        |
| Test impact (100-file diff)        | < 2s    | Pre-computed reverse index      |
| Security scan (full repo)          | < 10s   | Taint propagation on stored DFG |
| Risk score (single function)       | < 100ms | Pre-computed metrics            |
| Hybrid search query                | < 200ms | FTS5 + vector index             |
| Web app initial load               | < 2s    | Code splitting + lazy routes    |
| Web app graph render (5k nodes)    | 60fps   | Sigma.js WebGL                  |

### Memory Targets

| Scenario                      | Target     |
| ----------------------------- | ---------- |
| Analysis (10k files)          | < 1GB peak |
| Steady-state (server mode)    | < 200MB    |
| SQLite database (10k symbols) | < 100MB    |
| Web app (5k node graph)       | < 300MB    |

---

## 23. File-by-File Implementation Manifest

Every file that needs to be created, in dependency order:

### Layer 0 — Root Configuration

| #   | File                 | Purpose                          |
| --- | -------------------- | -------------------------------- |
| 1   | `package.json`       | Root workspace (pnpm workspaces) |
| 2   | `turbo.json`         | Turborepo pipeline config        |
| 3   | `tsconfig.base.json` | Shared TypeScript config         |
| 4   | `.gitignore`         | Standard ignores                 |
| 5   | `.npmrc`             | pnpm config (hoist patterns)     |
| 6   | `README.md`          | Project README                   |
| 7   | `LICENSE`            | MIT License                      |

### Layer 1 — Core Package Setup

| #   | File                           | Purpose                  |
| --- | ------------------------------ | ------------------------ |
| 8   | `packages/core/package.json`   | Core package manifest    |
| 9   | `packages/core/tsconfig.json`  | Core TypeScript config   |
| 10  | `packages/core/tsup.config.ts` | Core build config        |
| 11  | `packages/core/src/index.ts`   | Public API barrel export |

### Layer 2 — Types & Utilities

| #   | File                                           | Purpose                        |
| --- | ---------------------------------------------- | ------------------------------ |
| 12  | `packages/core/src/graph/types.ts`             | Node, Edge, Graph interfaces   |
| 13  | `packages/core/src/graph/knowledge-graph.ts`   | In-memory graph implementation |
| 14  | `packages/core/src/graph/index.ts`             | Graph barrel export            |
| 15  | `packages/core/src/cfg/cfg-types.ts`           | CFG type definitions           |
| 16  | `packages/core/src/dfg/dfg-types.ts`           | DFG type definitions           |
| 17  | `packages/core/src/summaries/summary-types.ts` | Function summary types         |
| 18  | `packages/core/src/branches/conflict-types.ts` | Branch conflict types          |
| 19  | `packages/core/src/taint/taint-types.ts`       | Security taint types           |
| 20  | `packages/core/src/schema/schema-types.ts`     | Schema model types             |
| 21  | `packages/core/src/utils/language-detect.ts`   | Language detection             |
| 22  | `packages/core/src/utils/ast-cache.ts`         | LRU tree cache                 |
| 23  | `packages/core/src/utils/path-utils.ts`        | Path normalization             |
| 24  | `packages/core/src/utils/fs-walker.ts`         | Gitignore-aware walking        |
| 25  | `packages/core/src/utils/logger.ts`            | Structured logging             |

### Layer 3 — Storage

| #   | File                                         | Purpose                   |
| --- | -------------------------------------------- | ------------------------- |
| 26  | `packages/core/src/storage/schema.sql`       | Complete DDL              |
| 27  | `packages/core/src/storage/db.ts`            | SQLite connection manager |
| 28  | `packages/core/src/storage/migrations.ts`    | Schema versioning         |
| 29  | `packages/core/src/storage/node-store.ts`    | Node CRUD                 |
| 30  | `packages/core/src/storage/edge-store.ts`    | Edge CRUD                 |
| 31  | `packages/core/src/storage/dfg-store.ts`     | DFG persistence           |
| 32  | `packages/core/src/storage/summary-store.ts` | Summary persistence       |
| 33  | `packages/core/src/storage/branch-store.ts`  | Branch snapshots          |
| 34  | `packages/core/src/storage/query-engine.ts`  | Parameterized queries     |
| 35  | `packages/core/src/storage/index.ts`         | Storage barrel export     |

### Layer 4 — Parsing (Phase 1)

| #     | File                                                     | Purpose                            |
| ----- | -------------------------------------------------------- | ---------------------------------- |
| 36    | `packages/core/src/parsing/parser.ts`                    | Tree-sitter wrapper                |
| 37    | `packages/core/src/parsing/language-loader.ts`           | Dynamic language loading           |
| 38    | `packages/core/src/parsing/queries/index.ts`             | Query barrel                       |
| 39    | `packages/core/src/parsing/queries/typescript.ts`        | TS queries                         |
| 40    | `packages/core/src/parsing/queries/python.ts`            | Python queries                     |
| 41    | `packages/core/src/parsing/queries/java.ts`              | Java queries                       |
| 42    | `packages/core/src/parsing/queries/go.ts`                | Go queries                         |
| 43    | `packages/core/src/parsing/queries/rust.ts`              | Rust queries                       |
| 44    | `packages/core/src/parsing/queries/csharp.ts`            | C# queries                         |
| 45    | `packages/core/src/parsing/queries/kotlin.ts`            | Kotlin queries                     |
| 46    | `packages/core/src/parsing/queries/php.ts`               | PHP queries                        |
| 47    | `packages/core/src/parsing/queries/ruby.ts`              | Ruby queries                       |
| 48    | `packages/core/src/parsing/queries/swift.ts`             | Swift queries                      |
| 49    | `packages/core/src/parsing/queries/c.ts`                 | C queries                          |
| 50    | `packages/core/src/parsing/queries/cpp.ts`               | C++ queries                        |
| 51    | `packages/core/src/parsing/extractors/base-extractor.ts` | Abstract extractor                 |
| 52-63 | `packages/core/src/parsing/extractors/{lang}.ts`         | Per-language extractors (12 files) |
| 64    | `packages/core/src/parsing/extractors/index.ts`          | Extractor barrel                   |
| 65    | `packages/core/src/parsing/index.ts`                     | Parsing barrel                     |

### Layer 5 — Symbol Resolution (Phase 2)

| #   | File                                           | Purpose            |
| --- | ---------------------------------------------- | ------------------ |
| 66  | `packages/core/src/symbols/symbol-table.ts`    | Dual-index lookup  |
| 67  | `packages/core/src/symbols/import-resolver.ts` | Cross-file imports |
| 68  | `packages/core/src/symbols/export-resolver.ts` | Re-export chains   |
| 69  | `packages/core/src/symbols/type-inference.ts`  | Type environment   |
| 70  | `packages/core/src/symbols/index.ts`           | Symbols barrel     |

### Layer 6 — Control Flow (Phase 3)

| #   | File                                           | Purpose             |
| --- | ---------------------------------------------- | ------------------- |
| 71  | `packages/core/src/cfg/cfg-builder.ts`         | AST → CFG           |
| 72  | `packages/core/src/cfg/branch-analyzer.ts`     | Branch handling     |
| 73  | `packages/core/src/cfg/builders/shared.ts`     | Common CFG patterns |
| 74  | `packages/core/src/cfg/builders/typescript.ts` | TS-specific CFG     |
| 75  | `packages/core/src/cfg/builders/python.ts`     | Python-specific CFG |
| 76  | `packages/core/src/cfg/builders/java.ts`       | Java-specific CFG   |
| 77  | `packages/core/src/cfg/builders/go.ts`         | Go-specific CFG     |
| 78  | `packages/core/src/cfg/builders/rust.ts`       | Rust-specific CFG   |
| 79  | `packages/core/src/cfg/index.ts`               | CFG barrel          |

### Layer 7 — Data Flow (Phase 4)

| #   | File                                       | Purpose              |
| --- | ------------------------------------------ | -------------------- |
| 80  | `packages/core/src/dfg/dfg-builder.ts`     | CFG → DFG            |
| 81  | `packages/core/src/dfg/ssa-transform.ts`   | SSA conversion       |
| 82  | `packages/core/src/dfg/reaching-defs.ts`   | Reaching definitions |
| 83  | `packages/core/src/dfg/use-def-chains.ts`  | Use-def chains       |
| 84  | `packages/core/src/dfg/interprocedural.ts` | Cross-function DFG   |
| 85  | `packages/core/src/dfg/index.ts`           | DFG barrel           |

### Layer 8 — Call Graph (Phase 5)

| #   | File                                                | Purpose            |
| --- | --------------------------------------------------- | ------------------ |
| 86  | `packages/core/src/callgraph/call-resolver.ts`      | Tiered resolution  |
| 87  | `packages/core/src/callgraph/receiver-resolver.ts`  | Receiver narrowing |
| 88  | `packages/core/src/callgraph/resolution-context.ts` | Confidence scoring |
| 89  | `packages/core/src/callgraph/index.ts`              | Callgraph barrel   |

### Layer 9 — Function Summaries (Phase 6)

| #   | File                                                  | Purpose               |
| --- | ----------------------------------------------------- | --------------------- |
| 90  | `packages/core/src/summaries/summary-builder.ts`      | Build summaries       |
| 91  | `packages/core/src/summaries/side-effect-detector.ts` | Side effect detection |
| 92  | `packages/core/src/summaries/param-flow-tracker.ts`   | Param→output tracking |
| 93  | `packages/core/src/summaries/index.ts`                | Summaries barrel      |

### Layer 10 — Community & Processes (Phases 7-8)

| #   | File                                            | Purpose               |
| --- | ----------------------------------------------- | --------------------- |
| 94  | `packages/core/src/community/leiden.ts`         | Leiden algorithm      |
| 95  | `packages/core/src/community/labeler.ts`        | Community naming      |
| 96  | `packages/core/src/community/index.ts`          | Community barrel      |
| 97  | `packages/core/src/processes/entry-detector.ts` | Entry point detection |
| 98  | `packages/core/src/processes/flow-tracer.ts`    | BFS flow tracing      |
| 99  | `packages/core/src/processes/index.ts`          | Processes barrel      |

### Layer 11 — Test Mapping (Phase 9)

| #       | File                                           | Purpose                         |
| ------- | ---------------------------------------------- | ------------------------------- |
| 100     | `packages/core/src/tests/test-detector.ts`     | Identify tests                  |
| 101     | `packages/core/src/tests/test-linker.ts`       | Map tests→prod                  |
| 102     | `packages/core/src/tests/coverage-mapper.ts`   | Coverage inference              |
| 103-111 | `packages/core/src/tests/frameworks/{name}.ts` | Per-framework parsers (9 files) |
| 112     | `packages/core/src/tests/index.ts`             | Tests barrel                    |

### Layer 12 — Schema Extraction (Phase 10)

| #       | File                                             | Purpose               |
| ------- | ------------------------------------------------ | --------------------- |
| 113     | `packages/core/src/schema/schema-linker.ts`      | Field→code linking    |
| 114-120 | `packages/core/src/schema/orm-parsers/{name}.ts` | ORM parsers (7 files) |
| 121-124 | `packages/core/src/schema/api-parsers/{name}.ts` | API parsers (4 files) |
| 125     | `packages/core/src/schema/index.ts`              | Schema barrel         |

### Layer 13 — Security (Phase 11)

| #   | File                                            | Purpose            |
| --- | ----------------------------------------------- | ------------------ |
| 126 | `packages/core/src/taint/taint-engine.ts`       | Taint propagation  |
| 127 | `packages/core/src/taint/source-registry.ts`    | Source patterns    |
| 128 | `packages/core/src/taint/sink-registry.ts`      | Sink patterns      |
| 129 | `packages/core/src/taint/sanitizer-registry.ts` | Sanitizer patterns |
| 130 | `packages/core/src/taint/index.ts`              | Taint barrel       |

### Layer 14 — Metrics (Phase 12)

| #   | File                                       | Purpose                |
| --- | ------------------------------------------ | ---------------------- |
| 131 | `packages/core/src/metrics/complexity.ts`  | Cyclomatic + cognitive |
| 132 | `packages/core/src/metrics/coupling.ts`    | Coupling metrics       |
| 133 | `packages/core/src/metrics/churn.ts`       | Change frequency       |
| 134 | `packages/core/src/metrics/risk-scorer.ts` | Composite risk         |
| 135 | `packages/core/src/metrics/index.ts`       | Metrics barrel         |

### Layer 15 — Branch Engine

| #   | File                                              | Purpose               |
| --- | ------------------------------------------------- | --------------------- |
| 136 | `packages/core/src/branches/branch-scanner.ts`    | List active branches  |
| 137 | `packages/core/src/branches/diff-analyzer.ts`     | Change fingerprinting |
| 138 | `packages/core/src/branches/conflict-detector.ts` | 5-level detection     |
| 139 | `packages/core/src/branches/merge-simulator.ts`   | Virtual merge         |
| 140 | `packages/core/src/branches/semantic-differ.ts`   | Behavioral diff       |
| 141 | `packages/core/src/branches/index.ts`             | Branches barrel       |

### Layer 16 — Git & Search

| #   | File                                      | Purpose          |
| --- | ----------------------------------------- | ---------------- |
| 142 | `packages/core/src/git/git-client.ts`     | Git wrapper      |
| 143 | `packages/core/src/git/diff-parser.ts`    | Diff parsing     |
| 144 | `packages/core/src/git/blame-analyzer.ts` | Blame analysis   |
| 145 | `packages/core/src/git/log-analyzer.ts`   | Log analysis     |
| 146 | `packages/core/src/git/index.ts`          | Git barrel       |
| 147 | `packages/core/src/search/bm25.ts`        | Keyword search   |
| 148 | `packages/core/src/search/semantic.ts`    | Embedding search |
| 149 | `packages/core/src/search/hybrid.ts`      | RRF fusion       |
| 150 | `packages/core/src/search/index.ts`       | Search barrel    |

### Layer 17 — Workers & Pipeline

| #   | File                                           | Purpose              |
| --- | ---------------------------------------------- | -------------------- |
| 151 | `packages/core/src/workers/worker-pool.ts`     | Generic worker pool  |
| 152 | `packages/core/src/workers/parse-worker.ts`    | Parse worker         |
| 153 | `packages/core/src/workers/analysis-worker.ts` | Analysis worker      |
| 154 | `packages/core/src/pipeline/progress.ts`       | Progress reporting   |
| 155 | `packages/core/src/pipeline/chunk-manager.ts`  | Byte-budget chunking |
| 156 | `packages/core/src/pipeline/pipeline.ts`       | Main orchestrator    |
| 157 | `packages/core/src/pipeline/index.ts`          | Pipeline barrel      |

### Layer 18 — CLI

| #       | File                                    | Purpose                     |
| ------- | --------------------------------------- | --------------------------- |
| 158     | `packages/cli/package.json`             | CLI package manifest        |
| 159     | `packages/cli/tsconfig.json`            | CLI TypeScript config       |
| 160     | `packages/cli/tsup.config.ts`           | CLI build config            |
| 161     | `packages/cli/src/index.ts`             | CLI entry + commander       |
| 162-172 | `packages/cli/src/commands/{name}.ts`   | CLI commands (11 files)     |
| 173-176 | `packages/cli/src/formatters/{name}.ts` | Output formatters (4 files) |

### Layer 19 — MCP Server

| #       | File                                            | Purpose                 |
| ------- | ----------------------------------------------- | ----------------------- |
| 177     | `packages/mcp/package.json`                     | MCP package manifest    |
| 178     | `packages/mcp/tsconfig.json`                    | MCP TypeScript config   |
| 179     | `packages/mcp/tsup.config.ts`                   | MCP build config        |
| 180     | `packages/mcp/src/index.ts`                     | MCP entry               |
| 181     | `packages/mcp/src/server.ts`                    | MCP server registration |
| 182-190 | `packages/mcp/src/tools/{name}.ts`              | MCP tools (9 files)     |
| 191-195 | `packages/mcp/src/resources/{name}.ts`          | MCP resources (5 files) |
| 196     | `packages/mcp/src/transport/stdio-transport.ts` | Dual-framing transport  |

### Layer 20 — HTTP Server

| #       | File                                       | Purpose                  |
| ------- | ------------------------------------------ | ------------------------ |
| 197     | `packages/server/package.json`             | Server package manifest  |
| 198     | `packages/server/tsconfig.json`            | Server TypeScript config |
| 199     | `packages/server/tsup.config.ts`           | Server build config      |
| 200     | `packages/server/src/index.ts`             | Hono app setup           |
| 201-209 | `packages/server/src/routes/{name}.ts`     | Route handlers (9 files) |
| 210-212 | `packages/server/src/middleware/{name}.ts` | Middleware (3 files)     |
| 213     | `packages/server/src/sse/event-emitter.ts` | SSE implementation       |

### Layer 21 — Web Application

| #       | File                                              | Purpose                       |
| ------- | ------------------------------------------------- | ----------------------------- |
| 214     | `packages/web/package.json`                       | Web package manifest          |
| 215     | `packages/web/tsconfig.json`                      | Web TypeScript config         |
| 216     | `packages/web/tsconfig.app.json`                  | App TypeScript config         |
| 217     | `packages/web/tsconfig.node.json`                 | Node TypeScript config        |
| 218     | `packages/web/vite.config.ts`                     | Vite build config             |
| 219     | `packages/web/index.html`                         | HTML entry point              |
| 220     | `packages/web/src/main.tsx`                       | React + Router mount          |
| 221     | `packages/web/src/App.tsx`                        | Root layout                   |
| 222     | `packages/web/src/index.css`                      | Tailwind + CSS variables      |
| 223-230 | `packages/web/src/stores/{name}.ts`               | Zustand stores (8 files)      |
| 231-240 | `packages/web/src/pages/{name}.tsx`               | Route pages (10 files)        |
| 241-244 | `packages/web/src/components/layout/{name}.tsx`   | Layout components (4 files)   |
| 245-248 | `packages/web/src/components/graph/{name}.tsx`    | Graph components (4 files)    |
| 249-252 | `packages/web/src/components/flow/{name}.tsx`     | Flow components (4 files)     |
| 253-257 | `packages/web/src/components/branch/{name}.tsx`   | Branch components (5 files)   |
| 258-260 | `packages/web/src/components/test/{name}.tsx`     | Test components (3 files)     |
| 261-263 | `packages/web/src/components/security/{name}.tsx` | Security components (3 files) |
| 264-266 | `packages/web/src/components/schema/{name}.tsx`   | Schema components (3 files)   |
| 267-269 | `packages/web/src/components/risk/{name}.tsx`     | Risk components (3 files)     |
| 270-273 | `packages/web/src/components/code/{name}.tsx`     | Code components (4 files)     |
| 274-283 | `packages/web/src/components/shared/{name}.tsx`   | Shared components (10 files)  |
| 284-290 | `packages/web/src/hooks/{name}.ts`                | Custom hooks (7 files)        |
| 291-295 | `packages/web/src/lib/{name}.ts`                  | Utility functions (5 files)   |
| 296-301 | `packages/web/src/types/{name}.ts`                | TypeScript types (6 files)    |

### Layer 22 — Tests

| #    | File                             | Purpose                                 |
| ---- | -------------------------------- | --------------------------------------- |
| 302  | `packages/core/vitest.config.ts` | Test config                             |
| 303+ | `packages/core/test/**`          | Test files (following structure in §21) |

**Total files: ~330+**

---

## Summary

CodeFlow is a **data-aware code intelligence platform** that goes beyond structural analysis to answer behavioral questions about code. It combines:

1. **Proven techniques** from GitNexus (tree-sitter parsing, worker parallelism, Leiden clustering, RRF search)
2. **New analysis layers** (CFG, DFG, SSA, taint analysis, function summaries)
3. **Unique features** no existing tool provides (branch conflict prediction, smart test selection, schema impact, composite risk scoring)
4. **Modern UI/UX** with dark theme, animations, interactive visualizations, and real-time updates
5. **Multiple interfaces** (CLI, MCP for AI agents, HTTP API, Web dashboard)

The monorepo structure with 4 packages (core, cli, mcp, server, web) enables clean separation of concerns while sharing the analysis engine.
