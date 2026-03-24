# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Native build tools for better-sqlite3 and tree-sitter
RUN apt-get update && apt-get install -y \
    python3 make g++ git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package manifests for dependency resolution
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/

# Install all dependencies (native addons compile here)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/core/ packages/core/
COPY packages/server/ packages/server/
COPY tsconfig.base.json ./

# Build core first, then server
RUN pnpm --filter @codeflow/core build && \
    pnpm --filter @codeflow/server build

# ── Stage 2: Production ────────────────────────────────────────
FROM node:22-slim AS runner

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Runtime deps: git (for clone/analysis), python3 (better-sqlite3 rebuild if needed)
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built output from builder
COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/server/dist packages/server/dist

# Copy native addons that were compiled in builder
COPY --from=builder /app/node_modules/.pnpm/better-sqlite3*/node_modules/better-sqlite3/build node_modules/.pnpm/better-sqlite3*/node_modules/better-sqlite3/build/
COPY --from=builder /app/node_modules/.pnpm/tree-sitter*/node_modules/tree-sitter/build node_modules/.pnpm/tree-sitter*/node_modules/tree-sitter/build/

# Create data directory for SQLite databases
RUN mkdir -p /data

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3100

EXPOSE 3100

# Start the server — default repo path points to /data
CMD ["node", "packages/server/dist/cli.js", "/data"]
