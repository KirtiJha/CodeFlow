import { Hono } from "hono";
import { Pipeline } from "@codeflow/core/pipeline";
import { EventEmitter } from "../sse/event-emitter.js";
import { openDatabase } from "@codeflow/core/storage";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import type { AppEnv } from "../types.js";
import { setActiveRepo } from "../state.js";

export const analysisRoutes = new Hono<AppEnv>();

// In-memory job tracking
const jobs = new Map<
  string,
  {
    status: string;
    progress: number;
    phase: string;
    result?: unknown;
    error?: string;
  }
>();

analysisRoutes.post("/analyze", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  // Allow the client to specify a repoPath (e.g. after cloning)
  const repoPath = (body.repoPath as string) || (c.get("repoPath") as string);
  // Update the global active repo so ALL subsequent requests use the correct DB
  setActiveRepo(repoPath);
  const jobId = crypto.randomUUID();

  jobs.set(jobId, { status: "running", progress: 0, phase: "initializing" });

  const emitter = EventEmitter.getInstance();

  // Run pipeline asynchronously
  const pipeline = new Pipeline({
    repoPath,
    languages: body.languages,
    enableCfg: body.enableCfg,
    enableDfg: body.enableDfg,
    enableTaint: body.enableTaint,
    onProgress: (phase, pct, message) => {
      const job = jobs.get(jobId);
      if (job) {
        job.progress = pct;
        job.phase = phase;
      }
      emitter.emit("analysis:progress", { jobId, phase, pct, message });
    },
  });

  pipeline
    .run()
    .then((result) => {
      const job = jobs.get(jobId);
      if (job) {
        job.status = "completed";
        job.progress = 100;
        job.result = result.stats;
      }
      emitter.emit("analysis:complete", { jobId, stats: result.stats });
    })
    .catch((err) => {
      console.error("Pipeline failed:", err);
      const job = jobs.get(jobId);
      if (job) {
        job.status = "failed";
        job.error = err instanceof Error ? err.message : String(err);
      }
      emitter.emit("analysis:error", { jobId, error: job?.error });
    });

  return c.json({ data: { jobId }, status: "ok" }, 202);
});

analysisRoutes.get("/analyze/:jobId", (c) => {
  const jobId = c.req.param("jobId");
  const job = jobs.get(jobId);
  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }
  return c.json({ data: { status: job.status, progress: job.progress, phase: job.phase, error: job.error }, status: "ok" });
});

analysisRoutes.get("/status", (c) => {
  const dbPath = c.get("dbPath") as string;
  const repoPath = c.get("repoPath") as string;
  try {
    const db = openDatabase({ path: dbPath });
    const nodeStore = new NodeStore(db);
    const edgeStore = new EdgeStore(db);

    const stats = {
      nodes: nodeStore.count(),
      edges: edgeStore.count(),
      files: nodeStore.countByKind("file"),
      functions:
        nodeStore.countByKind("function") + nodeStore.countByKind("method"),
      classes: nodeStore.countByKind("class"),
      communities: nodeStore.countByKind("community"),
    };

    return c.json({
      data: { indexed: true, repoPath, stats },
      status: "ok",
    });
  } catch {
    return c.json({
      data: { indexed: false, repoPath, stats: {} },
      status: "ok",
    });
  }
});
