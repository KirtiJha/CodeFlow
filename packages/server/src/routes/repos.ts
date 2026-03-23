import { Hono } from "hono";
import { readdirSync, statSync, rmSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { homedir } from "node:os";
import { openDatabase, initializeSchema } from "@codeflow/core/storage";
import type { AppEnv } from "../types.js";
import { setActiveRepo, getActiveRepo } from "../state.js";

export const reposRoutes = new Hono<AppEnv>();

const CLONE_BASE = resolve(homedir(), ".codeflow", "repos");

/** Discover all repos that have been analyzed (have a .codeflow/codeflow.db) */
function discoverRepos(): Array<{
  id: string;
  name: string;
  path: string;
  dbPath: string;
  size: number;
  isCloned: boolean;
}> {
  const repos: ReturnType<typeof discoverRepos> = [];

  // 1) Scan cloned repos under ~/.codeflow/repos/
  if (existsSync(CLONE_BASE)) {
    for (const org of safeReadDir(CLONE_BASE)) {
      const orgDir = resolve(CLONE_BASE, org);
      if (!isDir(orgDir)) continue;
      for (const repoName of safeReadDir(orgDir)) {
        const repoDir = resolve(orgDir, repoName);
        if (!isDir(repoDir)) continue;
        const dbPath = resolve(repoDir, ".codeflow", "codeflow.db");
        if (existsSync(dbPath)) {
          repos.push({
            id: `${org}/${repoName}`,
            name: `${org}/${repoName}`,
            path: repoDir,
            dbPath,
            size: safeFileSize(dbPath),
            isCloned: true,
          });
        }
      }
    }
  }

  // 2) Check the current active repo (may be a local path not under ~/.codeflow/repos)
  const active = getActiveRepo();
  if (active.repoPath && active.dbPath && existsSync(active.dbPath)) {
    const already = repos.find((r) => r.path === active.repoPath);
    if (!already) {
      repos.push({
        id: active.repoPath,
        name: basename(active.repoPath),
        path: active.repoPath,
        dbPath: active.dbPath,
        size: safeFileSize(active.dbPath),
        isCloned: false,
      });
    }
  }

  return repos;
}

/** Read repo stats from its database */
function readRepoStats(dbPath: string) {
  try {
    const db = openDatabase({ path: dbPath });
    initializeSchema(db);

    const repo = db
      .prepare("SELECT analyzed_at, stats_json FROM repos LIMIT 1")
      .get() as { analyzed_at: string | null; stats_json: string | null } | undefined;

    const nodeCount = (
      db.prepare("SELECT COUNT(*) as cnt FROM nodes").get() as { cnt: number }
    ).cnt;
    const edgeCount = (
      db.prepare("SELECT COUNT(*) as cnt FROM edges").get() as { cnt: number }
    ).cnt;
    const fileCount = (
      db.prepare("SELECT COUNT(*) as cnt FROM nodes WHERE kind='file'").get() as {
        cnt: number;
      }
    ).cnt;
    const funcCount = (
      db.prepare(
        "SELECT COUNT(*) as cnt FROM nodes WHERE kind IN ('function','method')",
      ).get() as { cnt: number }
    ).cnt;
    const classCount = (
      db.prepare("SELECT COUNT(*) as cnt FROM nodes WHERE kind='class'").get() as {
        cnt: number;
      }
    ).cnt;

    const langRows = db
      .prepare(
        "SELECT DISTINCT language FROM nodes WHERE language IS NOT NULL AND language != ''",
      )
      .all() as { language: string }[];
    const languages = langRows.map((r) => r.language).sort();

    const persisted = repo?.stats_json ? JSON.parse(repo.stats_json) : {};

    return {
      nodes: nodeCount,
      edges: edgeCount,
      files: fileCount,
      functions: funcCount,
      classes: classCount,
      languages,
      analyzedAt: repo?.analyzed_at ?? null,
      duration: persisted.durationMs ?? null,
    };
  } catch {
    return null;
  }
}

/* ── Endpoints ─────────────────────────────────────────────────── */

/** GET /repos — list all discovered repos with their stats */
reposRoutes.get("/repos", (c) => {
  const discovered = discoverRepos();
  const active = getActiveRepo();

  const repos = discovered.map((r) => {
    const stats = readRepoStats(r.dbPath);
    return {
      id: r.id,
      name: r.name,
      path: r.path,
      dbSize: r.size,
      isCloned: r.isCloned,
      isActive: r.path === active.repoPath,
      stats,
    };
  });

  return c.json({ data: { repos }, status: "ok" });
});

/** POST /repos/switch — switch the active repo */
reposRoutes.post("/repos/switch", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const repoPath = (body as { repoPath?: string }).repoPath;

  if (!repoPath) {
    return c.json({ error: "Missing repoPath" }, 400);
  }

  setActiveRepo(repoPath);

  // Ensure DB tables exist for the new active repo
  const active = getActiveRepo();
  try {
    const db = openDatabase({ path: active.dbPath });
    initializeSchema(db);
  } catch {
    // DB may not exist yet — that's fine
  }

  return c.json({ data: { repoPath, dbPath: active.dbPath }, status: "ok" });
});

/** DELETE /repos/:id — delete all analysis data for a repo */
reposRoutes.delete("/repos/:id{.+}", (c) => {
  const id = c.req.param("id");
  const discovered = discoverRepos();
  const target = discovered.find((r) => r.id === id);

  if (!target) {
    return c.json({ error: "Repository not found" }, 404);
  }

  // Delete the .codeflow directory (contains the DB)
  const codeflowDir = resolve(target.path, ".codeflow");
  if (existsSync(codeflowDir)) {
    rmSync(codeflowDir, { recursive: true, force: true });
  }

  // If this was the active repo, clear stats
  const active = getActiveRepo();
  if (active.repoPath === target.path) {
    // Re-init so server doesn't crash on next request
    try {
      const db = openDatabase({ path: active.dbPath });
      initializeSchema(db);
    } catch {
      // May fail if we just deleted it — fine
    }
  }

  return c.json({ data: { deleted: id }, status: "ok" });
});

/* ── Helpers ─────────────────────────────────────────────────── */

function safeReadDir(dir: string): string[] {
  try {
    return readdirSync(dir).filter((f) => !f.startsWith("."));
  } catch {
    return [];
  }
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function safeFileSize(p: string): number {
  try {
    return statSync(p).size;
  } catch {
    return 0;
  }
}
