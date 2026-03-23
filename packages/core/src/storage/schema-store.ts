import type Database from "better-sqlite3";
import { StatementCache } from "./db.js";
import type {
  SchemaModel,
  SchemaField,
  SchemaRef,
} from "../schema/schema-types.js";

interface ModelRow {
  id: string;
  repo_id: string;
  name: string;
  orm: string | null;
  file_path: string | null;
  line: number | null;
}

interface FieldRow {
  id: string;
  model_id: string;
  name: string;
  field_type: string | null;
  nullable: number;
  is_primary: number;
  is_unique: number;
}

interface RefRow {
  id: string;
  repo_id: string;
  field_id: string;
  node_id: string;
  ref_kind: string;
  file_path: string | null;
  line: number | null;
  code: string | null;
}

export class SchemaStore {
  private readonly stmts: StatementCache;

  constructor(private readonly db: Database.Database) {
    this.stmts = new StatementCache(db);
  }

  // ── Models ──────────────────────────────────────────────────

  insertModel(model: SchemaModel): void {
    this.stmts
      .get(
        `INSERT OR REPLACE INTO schema_models (id, repo_id, name, orm, file_path, line)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(model.id, model.repoId, model.name, model.orm, model.filePath, model.line);

    for (const field of model.fields) {
      this.insertField(field);
    }
  }

  insertModelBatch(models: SchemaModel[]): void {
    this.db.transaction(() => {
      for (const m of models) this.insertModel(m);
    })();
  }

  getAllModels(repoId?: string): SchemaModel[] {
    const rows = repoId
      ? (this.stmts
          .get("SELECT * FROM schema_models WHERE repo_id = ?")
          .all(repoId) as ModelRow[])
      : (this.stmts.get("SELECT * FROM schema_models").all() as ModelRow[]);

    return rows.map((r) => ({
      id: r.id,
      repoId: r.repo_id,
      name: r.name,
      orm: (r.orm ?? "raw_sql") as SchemaModel["orm"],
      filePath: r.file_path ?? "",
      line: r.line ?? 0,
      fields: this.getFieldsByModel(r.id),
    }));
  }

  // ── Fields ──────────────────────────────────────────────────

  private insertField(field: SchemaField): void {
    this.stmts
      .get(
        `INSERT OR REPLACE INTO schema_fields
         (id, model_id, name, field_type, nullable, is_primary, is_unique)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        field.id,
        field.modelId,
        field.name,
        field.fieldType,
        field.nullable ? 1 : 0,
        field.isPrimary ? 1 : 0,
        field.isUnique ? 1 : 0,
      );
  }

  getFieldsByModel(modelId: string): SchemaField[] {
    const rows = this.stmts
      .get("SELECT * FROM schema_fields WHERE model_id = ?")
      .all(modelId) as FieldRow[];

    return rows.map((r) => ({
      id: r.id,
      modelId: r.model_id,
      name: r.name,
      fieldType: r.field_type ?? "unknown",
      nullable: r.nullable === 1,
      isPrimary: r.is_primary === 1,
      isUnique: r.is_unique === 1,
    }));
  }

  // ── Refs ────────────────────────────────────────────────────

  insertRef(ref: SchemaRef): void {
    this.stmts
      .get(
        `INSERT OR REPLACE INTO schema_refs
         (id, repo_id, field_id, node_id, ref_kind, file_path, line, code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(ref.id, ref.repoId, ref.fieldId, ref.nodeId, ref.refKind, ref.filePath, ref.line, ref.code);
  }

  insertRefBatch(refs: SchemaRef[]): void {
    this.db.transaction(() => {
      for (const r of refs) this.insertRef(r);
    })();
  }

  getRefsByField(fieldId: string): SchemaRef[] {
    const rows = this.stmts
      .get("SELECT * FROM schema_refs WHERE field_id = ?")
      .all(fieldId) as RefRow[];
    return rows.map(rowToRef);
  }

  getRefsByRepo(repoId: string): SchemaRef[] {
    const rows = this.stmts
      .get("SELECT * FROM schema_refs WHERE repo_id = ?")
      .all(repoId) as RefRow[];
    return rows.map(rowToRef);
  }

  getAllRefs(): SchemaRef[] {
    const rows = this.stmts.get("SELECT * FROM schema_refs").all() as RefRow[];
    return rows.map(rowToRef);
  }

  clearRepo(repoId: string): void {
    this.db.transaction(() => {
      this.stmts.get("DELETE FROM schema_refs WHERE repo_id = ?").run(repoId);
      this.stmts.get("DELETE FROM schema_models WHERE repo_id = ?").run(repoId);
    })();
  }
}

function rowToRef(r: RefRow): SchemaRef {
  return {
    id: r.id,
    repoId: r.repo_id,
    fieldId: r.field_id,
    nodeId: r.node_id,
    refKind: r.ref_kind as SchemaRef["refKind"],
    filePath: r.file_path ?? "",
    line: r.line ?? 0,
    code: r.code ?? "",
  };
}
