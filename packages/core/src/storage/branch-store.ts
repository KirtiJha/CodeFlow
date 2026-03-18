import type Database from "better-sqlite3";
import { StatementCache } from "./db.js";
import type {
  BranchSnapshot,
  BranchConflict,
  BranchFingerprint,
  ConflictDetail,
} from "../branches/conflict-types.js";

export class BranchStore {
  private readonly stmts: StatementCache;

  constructor(private readonly db: Database.Database) {
    this.stmts = new StatementCache(db);
  }

  // ─── Snapshots ───

  upsertSnapshot(snapshot: BranchSnapshot): void {
    this.stmts
      .get(
        `INSERT OR REPLACE INTO branch_snapshots
         (id, repo_id, branch_name, author, last_commit_hash, last_commit_date,
          commit_count, files_changed_json, fingerprint_json, scanned_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        snapshot.id,
        snapshot.repoId,
        snapshot.branchName,
        snapshot.author ?? null,
        snapshot.lastCommitHash,
        snapshot.lastCommitDate,
        snapshot.commitCount,
        JSON.stringify(snapshot.filesChanged),
        snapshot.fingerprint
          ? serializeFingerprint(snapshot.fingerprint)
          : null,
        snapshot.scannedAt,
      );
  }

  getSnapshot(repoId: string, branchName: string): BranchSnapshot | null {
    const row = this.stmts
      .get(
        "SELECT * FROM branch_snapshots WHERE repo_id = ? AND branch_name = ?",
      )
      .get(repoId, branchName) as SnapshotRow | undefined;
    return row ? rowToSnapshot(row) : null;
  }

  getAllSnapshots(repoId: string): BranchSnapshot[] {
    const rows = this.stmts
      .get(
        "SELECT * FROM branch_snapshots WHERE repo_id = ? ORDER BY last_commit_date DESC",
      )
      .all(repoId) as SnapshotRow[];
    return rows.map(rowToSnapshot);
  }

  deleteSnapshot(id: string): void {
    this.stmts.get("DELETE FROM branch_snapshots WHERE id = ?").run(id);
  }

  // ─── Conflicts ───

  insertConflict(conflict: BranchConflict): void {
    this.stmts
      .get(
        `INSERT OR REPLACE INTO branch_conflicts
         (id, repo_id, branch_a, branch_b, level, severity, details_json, detected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        conflict.id,
        conflict.repoId,
        conflict.branchA,
        conflict.branchB,
        conflict.level,
        conflict.severity,
        JSON.stringify(conflict.details),
        conflict.detectedAt,
      );
  }

  getConflicts(repoId: string): BranchConflict[] {
    const rows = this.stmts
      .get(
        "SELECT * FROM branch_conflicts WHERE repo_id = ? ORDER BY level DESC",
      )
      .all(repoId) as ConflictRow[];
    return rows.map(rowToConflict);
  }

  getConflictsForBranch(repoId: string, branchName: string): BranchConflict[] {
    const rows = this.stmts
      .get(
        `SELECT * FROM branch_conflicts
         WHERE repo_id = ? AND (branch_a = ? OR branch_b = ?)
         ORDER BY level DESC`,
      )
      .all(repoId, branchName, branchName) as ConflictRow[];
    return rows.map(rowToConflict);
  }

  clearConflicts(repoId: string): void {
    this.stmts
      .get("DELETE FROM branch_conflicts WHERE repo_id = ?")
      .run(repoId);
  }

  deleteByRepo(repoId: string): void {
    this.stmts
      .get("DELETE FROM branch_conflicts WHERE repo_id = ?")
      .run(repoId);
    this.stmts
      .get("DELETE FROM branch_snapshots WHERE repo_id = ?")
      .run(repoId);
  }
}

// ─── Row types & serialization ───

interface SnapshotRow {
  id: string;
  repo_id: string;
  branch_name: string;
  author: string | null;
  last_commit_hash: string;
  last_commit_date: string;
  commit_count: number;
  files_changed_json: string;
  fingerprint_json: string | null;
  scanned_at: string;
}

interface ConflictRow {
  id: string;
  repo_id: string;
  branch_a: string;
  branch_b: string;
  level: number;
  severity: string;
  details_json: string;
  detected_at: string;
}

function rowToSnapshot(row: SnapshotRow): BranchSnapshot {
  return {
    id: row.id,
    repoId: row.repo_id,
    branchName: row.branch_name,
    author: row.author ?? "",
    lastCommitHash: row.last_commit_hash,
    lastCommitDate: row.last_commit_date,
    commitCount: row.commit_count,
    filesChanged: JSON.parse(row.files_changed_json),
    fingerprint: row.fingerprint_json
      ? deserializeFingerprint(row.fingerprint_json)
      : null,
    scannedAt: row.scanned_at,
  };
}

function rowToConflict(row: ConflictRow): BranchConflict {
  return {
    id: row.id,
    repoId: row.repo_id,
    branchA: row.branch_a,
    branchB: row.branch_b,
    level: row.level as 1 | 2 | 3 | 4 | 5,
    severity: row.severity as BranchConflict["severity"],
    details: JSON.parse(row.details_json) as ConflictDetail,
    detectedAt: row.detected_at,
  };
}

function serializeFingerprint(fp: BranchFingerprint): string {
  return JSON.stringify({
    filesChanged: [...fp.filesChanged],
    symbolsAdded: [...fp.symbolsAdded],
    symbolsRemoved: [...fp.symbolsRemoved],
    symbolsModified: Object.fromEntries(fp.symbolsModified),
    signaturesChanged: Object.fromEntries(fp.signaturesChanged),
    summariesChanged: Object.fromEntries(fp.summariesChanged),
    schemasChanged: Object.fromEntries(fp.schemasChanged),
  });
}

function deserializeFingerprint(json: string): BranchFingerprint {
  const raw = JSON.parse(json);
  return {
    filesChanged: new Set(raw.filesChanged),
    symbolsAdded: new Set(raw.symbolsAdded),
    symbolsRemoved: new Set(raw.symbolsRemoved),
    symbolsModified: new Map(Object.entries(raw.symbolsModified)),
    signaturesChanged: new Map(Object.entries(raw.signaturesChanged)),
    summariesChanged: new Map(Object.entries(raw.summariesChanged)),
    schemasChanged: new Map(Object.entries(raw.schemasChanged)),
  };
}
