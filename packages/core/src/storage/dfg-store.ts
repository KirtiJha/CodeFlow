import type Database from "better-sqlite3";
import { StatementCache } from "./db.js";
import type {
  DFGNode,
  DFGEdge,
  DFGNodeKind,
  DFGEdgeKind,
  SourceKind,
  SinkKind,
} from "../dfg/dfg-types.js";

export class DFGStore {
  private readonly stmts: StatementCache;

  constructor(private readonly db: Database.Database) {
    this.stmts = new StatementCache(db);
  }

  // ─── DFG Nodes ───

  insertNode(node: DFGNode): void {
    this.stmts
      .get(
        `INSERT OR REPLACE INTO dfg_nodes
         (id, repo_id, function_id, kind, code, file_path, line, col,
          data_type, is_source, is_sink, is_sanitizer, source_kind, sink_kind)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        node.id,
        node.repoId,
        node.functionId,
        node.kind,
        node.code ?? null,
        node.filePath,
        node.line ?? null,
        node.column ?? null,
        node.dataType ?? null,
        node.isSource ? 1 : 0,
        node.isSink ? 1 : 0,
        node.isSanitizer ? 1 : 0,
        node.sourceKind ?? null,
        node.sinkKind ?? null,
      );
  }

  insertNodeBatch(nodes: DFGNode[]): void {
    this.db.transaction(() => {
      for (const node of nodes) {
        this.insertNode(node);
      }
    })();
  }

  getNodesByFunction(functionId: string): DFGNode[] {
    const rows = this.stmts
      .get("SELECT * FROM dfg_nodes WHERE function_id = ?")
      .all(functionId) as DFGNodeRow[];
    return rows.map(rowToDFGNode);
  }

  getSources(repoId: string): DFGNode[] {
    const rows = this.stmts
      .get("SELECT * FROM dfg_nodes WHERE repo_id = ? AND is_source = 1")
      .all(repoId) as DFGNodeRow[];
    return rows.map(rowToDFGNode);
  }

  getSinks(repoId: string): DFGNode[] {
    const rows = this.stmts
      .get("SELECT * FROM dfg_nodes WHERE repo_id = ? AND is_sink = 1")
      .all(repoId) as DFGNodeRow[];
    return rows.map(rowToDFGNode);
  }

  // ─── DFG Edges ───

  insertEdge(edge: DFGEdge): void {
    this.stmts
      .get(
        `INSERT OR REPLACE INTO dfg_edges
         (id, repo_id, source_id, target_id, kind, transform, is_sanitizing)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        edge.id,
        edge.repoId,
        edge.sourceId,
        edge.targetId,
        edge.kind,
        edge.transform ?? null,
        edge.isSanitizing ? 1 : 0,
      );
  }

  insertEdgeBatch(edges: DFGEdge[]): void {
    this.db.transaction(() => {
      for (const edge of edges) {
        this.insertEdge(edge);
      }
    })();
  }

  getEdgesBySource(sourceId: string): DFGEdge[] {
    const rows = this.stmts
      .get("SELECT * FROM dfg_edges WHERE source_id = ?")
      .all(sourceId) as DFGEdgeRow[];
    return rows.map(rowToDFGEdge);
  }

  getEdgesByTarget(targetId: string): DFGEdge[] {
    const rows = this.stmts
      .get("SELECT * FROM dfg_edges WHERE target_id = ?")
      .all(targetId) as DFGEdgeRow[];
    return rows.map(rowToDFGEdge);
  }

  deleteByRepo(repoId: string): void {
    this.stmts.get("DELETE FROM dfg_edges WHERE repo_id = ?").run(repoId);
    this.stmts.get("DELETE FROM dfg_nodes WHERE repo_id = ?").run(repoId);
  }
}

// ─── Row types ───

interface DFGNodeRow {
  id: string;
  repo_id: string;
  function_id: string;
  kind: string;
  code: string | null;
  file_path: string;
  line: number | null;
  col: number | null;
  data_type: string | null;
  is_source: number;
  is_sink: number;
  is_sanitizer: number;
  source_kind: string | null;
  sink_kind: string | null;
}

interface DFGEdgeRow {
  id: string;
  repo_id: string;
  source_id: string;
  target_id: string;
  kind: string;
  transform: string | null;
  is_sanitizing: number;
}

function rowToDFGNode(row: DFGNodeRow): DFGNode {
  return {
    id: row.id,
    repoId: row.repo_id,
    functionId: row.function_id,
    kind: row.kind as DFGNodeKind,
    code: row.code ?? "",
    filePath: row.file_path ?? "",
    line: row.line ?? undefined,
    column: row.col ?? undefined,
    dataType: row.data_type ?? undefined,
    isSource: row.is_source === 1,
    isSink: row.is_sink === 1,
    isSanitizer: row.is_sanitizer === 1,
    sourceKind: (row.source_kind as SourceKind) ?? undefined,
    sinkKind: (row.sink_kind as SinkKind) ?? undefined,
  };
}

function rowToDFGEdge(row: DFGEdgeRow): DFGEdge {
  return {
    id: row.id,
    repoId: row.repo_id,
    sourceId: row.source_id,
    targetId: row.target_id,
    kind: row.kind as DFGEdgeKind,
    transform: row.transform ?? undefined,
    isSanitizing: row.is_sanitizing === 1,
  };
}
