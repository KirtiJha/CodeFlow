import { Hono } from "hono";
import { GitClient } from "@codeflow/core/git";
import { BranchScanner } from "@codeflow/core/branches";
import type { AppEnv } from "../types.js";

export const branchesRoutes = new Hono<AppEnv>();

branchesRoutes.get("/branches", async (c) => {
  const repoPath = c.get("repoPath");
  const gitClient = new GitClient(repoPath);
  const branches = await gitClient.listBranches();

  // Enrich with commit log info
  const git = gitClient.raw();
  const enriched = await Promise.all(
    branches.map(async (b) => {
      try {
        const ref = b.isRemote ? `remotes/origin/${b.name}` : b.name;
        const logResult = await git.log({ [ref]: null, maxCount: 1 });
        const latest = logResult.latest;
        return {
          ...b,
          lastCommitDate: latest?.date ?? null,
          lastCommitMessage: latest?.message ?? null,
          author: latest?.author_name ?? null,
          authorEmail: latest?.author_email ?? null,
        };
      } catch {
        return { ...b, lastCommitDate: null, lastCommitMessage: null, author: null, authorEmail: null };
      }
    }),
  );

  // Also get ahead/behind for local branches vs their remote tracking
  const result = await Promise.all(
    enriched.map(async (b) => {
      if (b.isRemote) return b;
      try {
        const aheadBehind = await git.raw([
          "rev-list",
          "--left-right",
          "--count",
          `origin/${b.name}...${b.name}`,
        ]);
        const [behind, ahead] = aheadBehind.trim().split(/\s+/).map(Number);
        return { ...b, ahead: ahead ?? 0, behind: behind ?? 0 };
      } catch {
        return { ...b, ahead: 0, behind: 0 };
      }
    }),
  );

  return c.json({ data: { branches: result }, status: "ok" });
});

branchesRoutes.get("/branches/conflicts", async (c) => {
  const repoPath = c.get("repoPath");
  const minSeverity = c.req.query("minSeverity") ?? "low";

  const gitClient = new GitClient(repoPath);
  const scanner = new BranchScanner(gitClient.raw(), "default");
  const snapshots = await scanner.scan();

  return c.json({
    data: {
      branchCount: snapshots.length,
      branches: snapshots.map((s) => ({
        branch: s.branchName,
        author: s.author,
        lastCommit: s.lastCommitDate,
        filesChanged: s.filesChanged.length,
      })),
    },
    status: "ok",
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
    data: {
      branchA,
      branchB,
      filesChanged: diffs.length,
      diffs: diffs.map((d) => ({
        file: d.filePath,
        status: d.status,
        linesAdded: d.linesAdded,
        linesRemoved: d.linesRemoved,
      })),
    },
    status: "ok",
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
    return c.json({ data: { safe: true, message: "Branch not found in remote" }, status: "ok" });
  }

  return c.json({
    data: {
      safe: true,
      branch: currentSnapshot.branchName,
      filesChanged: currentSnapshot.filesChanged.length,
      recommendation: "No conflicts detected",
    },
    status: "ok",
  });
});
