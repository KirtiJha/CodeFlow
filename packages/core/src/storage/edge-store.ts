import type Database from "better-sqlite3";
import { StatementCache } from "./db.js";
import type { GraphEdge, EdgeKind } from "../graph/types.js";

export class EdgeStore {
  private readonly stmts: StatementCache;

  constructor(private readonly db: Database.Database) {
    this.stmts = new StatementCache(db);
  }

  insert(edge: GraphEdge): void {
    this.stmts
      .get(
        `INSERT OR REPLACE INTO edges
         (id, repo_id, source_id, target_id, kind, confidence, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        edge.id,
        edge.repoId,
        edge.sourceId,
        edge.targetId,
        edge.kind,
        edge.confidence ?? 1.0,
        edge.metadata ? JSON.stringify(edge.metadata) : null,
      );
  }

  insertBatch(edges: GraphEdge[]): void {
    this.db.transaction(() => {
      for (const edge of edges) {
        this.insert(edge);
      }
    })();
  }

  getById(id: string): GraphEdge | null {
    const row = this.stmts.get("SELECT * FROM edges WHERE id = ?").get(id) as
      | EdgeRow
      | undefined;
    return row ? rowToEdge(row) : null;
  }

  getBySource(sourceId: string): GraphEdge[] {
    const rows = this.stmts
      .get("SELECT * FROM edges WHERE source_id = ?")
      .all(sourceId) as EdgeRow[];
    return rows.map(rowToEdge);
  }

  getByTarget(targetId: string): GraphEdge[] {
    const rows = this.stmts
      .get("SELECT * FROM edges WHERE target_id = ?")
      .all(targetId) as EdgeRow[];
    return rows.map(rowToEdge);
  }

  getByKind(repoId: string, kind: EdgeKind): GraphEdge[] {
    const rows = this.stmts
      .get("SELECT * FROM edges WHERE repo_id = ? AND kind = ?")
      .all(repoId, kind) as EdgeRow[];
    return rows.map(rowToEdge);
  }

  getByRepo(repoId: string): GraphEdge[] {
    const rows = this.stmts
      .get("SELECT * FROM edges WHERE repo_id = ?")
      .all(repoId) as EdgeRow[];
    return rows.map(rowToEdge);
  }

  delete(id: string): void {
    this.stmts.get("DELETE FROM edges WHERE id = ?").run(id);
  }

  deleteByRepo(repoId: string): void {
    this.stmts.get("DELETE FROM edges WHERE repo_id = ?").run(repoId);
  }

  /** Alias for insert — uses INSERT OR REPLACE semantics. */
  upsert(edge: GraphEdge): void {
    this.insert(edge);
  }

  count(repoId?: string): number {
    if (repoId) {
      const row = this.stmts
        .get("SELECT COUNT(*) as cnt FROM edges WHERE repo_id = ?")
        .get(repoId) as { cnt: number };
      return row.cnt;
    }
    const row = this.stmts.get("SELECT COUNT(*) as cnt FROM edges").get() as {
      cnt: number;
    };
    return row.cnt;
  }

  /** Return all edges (no repo filter). */
  getAll(): GraphEdge[] {
    const rows = this.stmts.get("SELECT * FROM edges").all() as EdgeRow[];
    return rows.map(rowToEdge);
  }

  /** Get outgoing edges from a node, optionally filtered by kind. */
  getOutgoing(sourceId: string, kind?: string): GraphEdge[] {
    if (kind) {
      const rows = this.stmts
        .get("SELECT * FROM edges WHERE source_id = ? AND kind = ?")
        .all(sourceId, kind) as EdgeRow[];
      return rows.map(rowToEdge);
    }
    return this.getBySource(sourceId);
  }
}

interface EdgeRow {
  id: string;
  repo_id: string;
  source_id: string;
  target_id: string;
  kind: string;
  confidence: number;
  metadata_json: string | null;
}

function rowToEdge(row: EdgeRow): GraphEdge {
  return {
    id: row.id,
    repoId: row.repo_id,
    sourceId: row.source_id,
    targetId: row.target_id,
    kind: row.kind as EdgeKind,
    confidence: row.confidence,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
  };
}
