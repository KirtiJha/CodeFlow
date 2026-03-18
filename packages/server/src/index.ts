import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { resolve } from "node:path";
import type { AppEnv } from "./types.js";
import { corsMiddleware } from "./middleware/cors.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { validationMiddleware } from "./middleware/validation.js";
import { analysisRoutes } from "./routes/analysis.js";
import { branchesRoutes } from "./routes/branches.js";
import { traceRoutes } from "./routes/trace.js";
import { testsRoutes } from "./routes/tests.js";
import { securityRoutes } from "./routes/security.js";
import { schemaRoutes } from "./routes/schema.js";
import { riskRoutes } from "./routes/risk.js";
import { searchRoutes } from "./routes/search.js";
import { eventsRoute } from "./routes/events.js";
import { cloneRoutes } from "./routes/clone.js";
import { setActiveRepo, getActiveRepo } from "./state.js";

export interface ServerConfig {
  port?: number;
  host?: string;
  repoPath: string;
}

export async function startServer(config: ServerConfig): Promise<void> {
  const app = new Hono<AppEnv>();
  const port = config.port ?? 3100;
  const host = config.host ?? "127.0.0.1";

  // Initialize with the startup repoPath
  setActiveRepo(config.repoPath);

  // Context middleware — inject repo config into all routes
  app.use("*", async (c, next) => {
    const repo = getActiveRepo();
    c.set("repoPath", repo.repoPath);
    c.set("dbPath", repo.dbPath);
    await next();
  });

  // Global middleware
  app.use("*", corsMiddleware());
  app.use("/api/*", rateLimitMiddleware());
  app.use("/api/*", validationMiddleware());

  // Routes
  app.route("/api", analysisRoutes);
  app.route("/api", branchesRoutes);
  app.route("/api", traceRoutes);
  app.route("/api", testsRoutes);
  app.route("/api", securityRoutes);
  app.route("/api", schemaRoutes);
  app.route("/api", riskRoutes);
  app.route("/api", searchRoutes);
  app.route("/api", cloneRoutes);
  app.route("/api", eventsRoute);

  // Health check
  app.get("/health", (c) => c.json({ status: "ok", version: "0.1.0" }));

  console.log(`CodeFlow server listening on http://${host}:${port}`);
  serve({ fetch: app.fetch, port, hostname: host });
}
