import type Database from "better-sqlite3";
import { StatementCache } from "./db.js";
import type { FunctionSummary } from "../summaries/summary-types.js";

export class SummaryStore {
  private readonly stmts: StatementCache;

  constructor(private readonly db: Database.Database) {
    this.stmts = new StatementCache(db);
  }

  insert(summary: FunctionSummary): void {
    this.stmts
      .get(
        `INSERT OR REPLACE INTO summaries
         (id, node_id, repo_id, param_flows_json, side_effects_json,
          throws_json, can_return_null, can_return_undefined)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        summary.id,
        summary.nodeId,
        (summary as FunctionSummary & { repoId?: string }).repoId ?? "",
        JSON.stringify(summary.paramFlows),
        JSON.stringify(summary.sideEffects),
        JSON.stringify(summary.throws),
        summary.canReturnNull ? 1 : 0,
        summary.canReturnUndefined ? 1 : 0,
      );
  }

  insertBatch(summaries: FunctionSummary[]): void {
    this.db.transaction(() => {
      for (const s of summaries) {
        this.insert(s);
      }
    })();
  }

  getByNodeId(nodeId: string): FunctionSummary | null {
    const row = this.stmts
      .get("SELECT * FROM summaries WHERE node_id = ?")
      .get(nodeId) as SummaryRow | undefined;
    return row ? rowToSummary(row) : null;
  }

  getByRepo(repoId: string): FunctionSummary[] {
    const rows = this.stmts
      .get("SELECT * FROM summaries WHERE repo_id = ?")
      .all(repoId) as SummaryRow[];
    return rows.map(rowToSummary);
  }

  /** Alias for insert — uses INSERT OR REPLACE semantics. */
  upsert(summary: FunctionSummary): void {
    this.insert(summary);
  }

  delete(id: string): void {
    this.stmts.get("DELETE FROM summaries WHERE id = ?").run(id);
  }

  deleteByRepo(repoId: string): void {
    this.stmts.get("DELETE FROM summaries WHERE repo_id = ?").run(repoId);
  }
}

interface SummaryRow {
  id: string;
  node_id: string;
  repo_id: string;
  param_flows_json: string | null;
  side_effects_json: string | null;
  throws_json: string | null;
  can_return_null: number;
  can_return_undefined: number;
}

function rowToSummary(row: SummaryRow): FunctionSummary {
  return {
    id: row.id,
    nodeId: row.node_id,
    name: "",
    filePath: "",
    paramFlows: row.param_flows_json ? JSON.parse(row.param_flows_json) : [],
    sideEffects: row.side_effects_json ? JSON.parse(row.side_effects_json) : [],
    throws: row.throws_json ? JSON.parse(row.throws_json) : [],
    canReturnNull: row.can_return_null === 1,
    canReturnUndefined: row.can_return_undefined === 1,
    cyclomaticComplexity: 0,
    cognitiveComplexity: 0,
  };
}
