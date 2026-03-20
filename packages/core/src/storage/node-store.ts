import type Database from "better-sqlite3";
import { StatementCache } from "./db.js";
import type { GraphNode, NodeKind, Language } from "../graph/types.js";

export class NodeStore {
  private readonly stmts: StatementCache;

  constructor(private readonly db: Database.Database) {
    this.stmts = new StatementCache(db);
  }

  insert(node: GraphNode): void {
    this.stmts
      .get(
        `INSERT OR REPLACE INTO nodes
         (id, repo_id, kind, name, qualified_name, file_path, start_line, end_line,
          language, signature, param_count, return_type, owner_id, community_id,
          complexity_cyclomatic, complexity_cognitive, risk_score, is_test,
          is_entry_point, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        node.id,
        node.repoId,
        node.kind,
        node.name,
        node.qualifiedName ?? null,
        node.filePath,
        node.startLine ?? node.location?.start.line ?? null,
        node.endLine ?? node.location?.end.line ?? null,
        node.language ?? null,
        node.signature ?? node.metadata?.signature ?? null,
        node.paramCount ?? node.metadata?.paramCount ?? null,
        node.returnType ?? node.metadata?.returnType ?? null,
        node.ownerId ?? node.metadata?.ownerId ?? null,
        node.communityId ?? node.metadata?.communityId ?? null,
        node.complexityCyclomatic ?? node.metadata?.complexityCyclomatic ?? null,
        node.complexityCognitive ?? node.metadata?.complexityCognitive ?? null,
        node.riskScore ?? node.metadata?.riskScore ?? null,
        (node.isTest ?? node.metadata?.isTest) ? 1 : 0,
        (node.isEntryPoint ?? node.metadata?.isEntryPoint) ? 1 : 0,
        node.metadata ? JSON.stringify(node.metadata) : null,
      );
  }

  insertBatch(nodes: GraphNode[]): void {
    this.db.transaction(() => {
      for (const node of nodes) {
        this.insert(node);
      }
    })();
  }

  getById(id: string): GraphNode | null {
    const row = this.stmts.get("SELECT * FROM nodes WHERE id = ?").get(id) as
      | NodeRow
      | undefined;
    return row ? rowToNode(row) : null;
  }

  getByRepo(repoId: string): GraphNode[] {
    const rows = this.stmts
      .get("SELECT * FROM nodes WHERE repo_id = ?")
      .all(repoId) as NodeRow[];
    return rows.map(rowToNode);
  }

  getByKind(repoId: string, kind: NodeKind): GraphNode[] {
    const rows = this.stmts
      .get("SELECT * FROM nodes WHERE repo_id = ? AND kind = ?")
      .all(repoId, kind) as NodeRow[];
    return rows.map(rowToNode);
  }

  getByFile(repoId: string, filePath: string): GraphNode[] {
    const rows = this.stmts
      .get("SELECT * FROM nodes WHERE repo_id = ? AND file_path = ?")
      .all(repoId, filePath) as NodeRow[];
    return rows.map(rowToNode);
  }

  search(repoId: string, query: string, limit = 50): GraphNode[] {
    const rows = this.stmts
      .get(
        `SELECT nodes.* FROM nodes_fts
         JOIN nodes ON nodes.rowid = nodes_fts.rowid
         WHERE nodes_fts MATCH ? AND nodes.repo_id = ?
         LIMIT ?`,
      )
      .all(query, repoId, limit) as NodeRow[];
    return rows.map(rowToNode);
  }

  delete(id: string): void {
    this.stmts.get("DELETE FROM nodes WHERE id = ?").run(id);
  }

  deleteByRepo(repoId: string): void {
    this.stmts.get("DELETE FROM nodes WHERE repo_id = ?").run(repoId);
  }

  /** Alias for insert — uses INSERT OR REPLACE semantics. */
  upsert(node: GraphNode): void {
    this.insert(node);
  }

  count(repoId?: string): number {
    if (repoId) {
      const row = this.stmts
        .get("SELECT COUNT(*) as cnt FROM nodes WHERE repo_id = ?")
        .get(repoId) as { cnt: number };
      return row.cnt;
    }
    const row = this.stmts.get("SELECT COUNT(*) as cnt FROM nodes").get() as {
      cnt: number;
    };
    return row.cnt;
  }

  /** Return all nodes (no repo filter). */
  getAll(): GraphNode[] {
    const rows = this.stmts.get("SELECT * FROM nodes").all() as NodeRow[];
    return rows.map(rowToNode);
  }

  /** Find nodes by name or qualified_name. */
  findByName(name: string): GraphNode[] {
    const rows = this.stmts
      .get("SELECT * FROM nodes WHERE name = ? OR qualified_name = ?")
      .all(name, name) as NodeRow[];
    return rows.map(rowToNode);
  }

  /** Find nodes at a specific file and line. */
  findByFileAndLine(filePath: string, line: number): GraphNode[] {
    const rows = this.stmts
      .get(
        "SELECT * FROM nodes WHERE file_path = ? AND start_line <= ? AND (end_line >= ? OR end_line IS NULL)",
      )
      .all(filePath, line, line) as NodeRow[];
    return rows.map(rowToNode);
  }

  /** Find all nodes in a file (no repo filter). */
  findByFile(filePath: string): GraphNode[] {
    const rows = this.stmts
      .get("SELECT * FROM nodes WHERE file_path = ?")
      .all(filePath) as NodeRow[];
    return rows.map(rowToNode);
  }

  /** Count nodes by kind (no repo filter). */
  countByKind(kind: string): number {
    const row = this.stmts
      .get("SELECT COUNT(*) as cnt FROM nodes WHERE kind = ?")
      .get(kind) as { cnt: number };
    return row.cnt;
  }
}

interface NodeRow {
  id: string;
  repo_id: string;
  kind: string;
  name: string;
  qualified_name: string | null;
  file_path: string;
  start_line: number | null;
  end_line: number | null;
  language: string | null;
  signature: string | null;
  param_count: number | null;
  return_type: string | null;
  owner_id: string | null;
  community_id: string | null;
  complexity_cyclomatic: number | null;
  complexity_cognitive: number | null;
  risk_score: number | null;
  is_test: number;
  is_entry_point: number;
  metadata_json: string | null;
}

function rowToNode(row: NodeRow): GraphNode {
  return {
    id: row.id,
    repoId: row.repo_id,
    kind: row.kind as NodeKind,
    name: row.name,
    qualifiedName: row.qualified_name ?? undefined,
    filePath: row.file_path,
    startLine: row.start_line ?? undefined,
    endLine: row.end_line ?? undefined,
    language: (row.language as Language) ?? undefined,
    signature: row.signature ?? undefined,
    paramCount: row.param_count ?? undefined,
    returnType: row.return_type ?? undefined,
    ownerId: row.owner_id ?? undefined,
    communityId: row.community_id ?? undefined,
    complexityCyclomatic: row.complexity_cyclomatic ?? undefined,
    complexityCognitive: row.complexity_cognitive ?? undefined,
    riskScore: row.risk_score ?? undefined,
    isTest: row.is_test === 1,
    isEntryPoint: row.is_entry_point === 1,
    location:
      row.start_line != null
        ? {
            start: { line: row.start_line, column: 0 },
            end: { line: row.end_line ?? row.start_line, column: 0 },
          }
        : undefined,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
  };
}
