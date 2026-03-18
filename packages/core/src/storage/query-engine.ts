import type Database from "better-sqlite3";
import { StatementCache } from "./db.js";

/**
 * General-purpose parameterized query engine for ad-hoc queries.
 */
export class QueryEngine {
  private readonly stmts: StatementCache;

  constructor(private readonly db: Database.Database) {
    this.stmts = new StatementCache(db);
  }

  // ─── Repo Management ───

  createRepo(repo: {
    id: string;
    name: string;
    path: string;
    branch?: string;
  }): void {
    this.stmts
      .get(
        `INSERT OR REPLACE INTO repos (id, name, path, branch)
         VALUES (?, ?, ?, ?)`,
      )
      .run(repo.id, repo.name, repo.path, repo.branch ?? "main");
  }

  getRepo(id: string): RepoRecord | null {
    return (
      (this.stmts.get("SELECT * FROM repos WHERE id = ?").get(id) as
        | RepoRecord
        | undefined) ?? null
    );
  }

  updateRepoStats(
    id: string,
    data: {
      analyzedAt: string;
      commitHash: string;
      stats: Record<string, number>;
    },
  ): void {
    this.stmts
      .get(
        `UPDATE repos SET analyzed_at = ?, commit_hash = ?, stats_json = ?
         WHERE id = ?`,
      )
      .run(data.analyzedAt, data.commitHash, JSON.stringify(data.stats), id);
  }

  // ─── Cross-table queries ───

  getCallers(
    nodeId: string,
  ): Array<{ id: string; name: string; filePath: string }> {
    return this.stmts
      .get(
        `SELECT n.id, n.name, n.file_path as filePath
         FROM edges e JOIN nodes n ON n.id = e.source_id
         WHERE e.target_id = ? AND e.kind = 'calls'`,
      )
      .all(nodeId) as Array<{ id: string; name: string; filePath: string }>;
  }

  getCallees(
    nodeId: string,
  ): Array<{ id: string; name: string; filePath: string }> {
    return this.stmts
      .get(
        `SELECT n.id, n.name, n.file_path as filePath
         FROM edges e JOIN nodes n ON n.id = e.target_id
         WHERE e.source_id = ? AND e.kind = 'calls'`,
      )
      .all(nodeId) as Array<{ id: string; name: string; filePath: string }>;
  }

  getTransitiveCallers(nodeId: string, maxDepth = 10): string[] {
    const visited = new Set<string>();
    const queue = [nodeId];
    let depth = 0;

    while (queue.length > 0 && depth < maxDepth) {
      const size = queue.length;
      for (let i = 0; i < size; i++) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        const callers = this.getCallers(current);
        for (const caller of callers) {
          if (!visited.has(caller.id)) {
            queue.push(caller.id);
          }
        }
      }
      depth++;
    }

    visited.delete(nodeId);
    return [...visited];
  }

  getTestsForNode(
    nodeId: string,
  ): Array<{ testNodeId: string; testName: string; linkType: string }> {
    return this.stmts
      .get(
        `SELECT tm.test_node_id as testNodeId, n.name as testName, tm.link_type as linkType
         FROM test_mappings tm JOIN nodes n ON n.id = tm.test_node_id
         WHERE tm.production_node_id = ?`,
      )
      .all(nodeId) as Array<{
      testNodeId: string;
      testName: string;
      linkType: string;
    }>;
  }

  getTaintFlows(
    repoId: string,
    severity?: string,
  ): Array<Record<string, unknown>> {
    if (severity) {
      return this.stmts
        .get("SELECT * FROM taint_flows WHERE repo_id = ? AND severity = ?")
        .all(repoId, severity) as Array<Record<string, unknown>>;
    }
    return this.stmts
      .get("SELECT * FROM taint_flows WHERE repo_id = ?")
      .all(repoId) as Array<Record<string, unknown>>;
  }

  // ─── Metrics ───

  recordMetrics(entry: {
    id: string;
    repoId: string;
    nodeId: string;
    commitHash: string;
    riskScore: number;
    complexityCyclomatic: number;
    complexityCognitive: number;
    testCount: number;
    changeCount30d: number;
  }): void {
    this.stmts
      .get(
        `INSERT INTO metrics_history
         (id, repo_id, node_id, commit_hash, measured_at, risk_score,
          complexity_cyclomatic, complexity_cognitive, test_count, change_count_30d)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.repoId,
        entry.nodeId,
        entry.commitHash,
        new Date().toISOString(),
        entry.riskScore,
        entry.complexityCyclomatic,
        entry.complexityCognitive,
        entry.testCount,
        entry.changeCount30d,
      );
  }

  getMetricsHistory(
    nodeId: string,
    limit = 30,
  ): Array<Record<string, unknown>> {
    return this.stmts
      .get(
        "SELECT * FROM metrics_history WHERE node_id = ? ORDER BY measured_at DESC LIMIT ?",
      )
      .all(nodeId, limit) as Array<Record<string, unknown>>;
  }
}

export interface RepoRecord {
  id: string;
  name: string;
  path: string;
  branch: string;
  analyzed_at: string | null;
  commit_hash: string | null;
  stats_json: string | null;
}
