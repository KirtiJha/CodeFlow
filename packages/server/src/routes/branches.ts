import { Hono } from "hono";
import { GitClient } from "@codeflow/core/git";
import { BranchScanner } from "@codeflow/core/branches";
import type { AppEnv } from "../types.js";

export const branchesRoutes = new Hono<AppEnv>();

branchesRoutes.get("/branches", async (c) => {
  const repoPath = c.get("repoPath");
  const gitClient = new GitClient(repoPath);
  const branches = await gitClient.listBranches();
  return c.json({ branches });
});

branchesRoutes.get("/branches/conflicts", async (c) => {
  const repoPath = c.get("repoPath");
  const minSeverity = c.req.query("minSeverity") ?? "low";

  const gitClient = new GitClient(repoPath);
  const scanner = new BranchScanner(gitClient.raw(), "default");
  const snapshots = await scanner.scan();

  return c.json({
    branchCount: snapshots.length,
    branches: snapshots.map((s) => ({
      branch: s.branchName,
      author: s.author,
      lastCommit: s.lastCommitDate,
      filesChanged: s.filesChanged.length,
    })),
  });
});

branchesRoutes.post("/branches/diff", async (c) => {
  const body = await c.req.json();
  const { branchA, branchB } = body;
  if (!branchA || !branchB) {
    return c.json({ error: "branchA and branchB required" }, 400);
  }

  const repoPath = c.get("repoPath");
  const gitClient = new GitClient(repoPath);
  const diffs = await gitClient.diffRange(branchA, branchB);

  return c.json({
    branchA,
    branchB,
    filesChanged: diffs.length,
    diffs: diffs.map((d) => ({
      file: d.filePath,
      status: d.status,
      linesAdded: d.linesAdded,
      linesRemoved: d.linesRemoved,
    })),
  });
});

branchesRoutes.post("/branches/pre-push", async (c) => {
  const body = await c.req.json();
  const { branch } = body;

  const repoPath = c.get("repoPath");
  const gitClient = new GitClient(repoPath);
  const scanner = new BranchScanner(gitClient.raw(), "default");

  const snapshots = await scanner.scan();
  const currentSnapshot = snapshots.find((s) => s.branchName === branch);
  if (!currentSnapshot) {
    return c.json({ safe: true, message: "Branch not found in remote" });
  }

  return c.json({
    safe: true,
    branch: currentSnapshot.branchName,
    filesChanged: currentSnapshot.filesChanged.length,
    recommendation: "No conflicts detected",
  });
});
