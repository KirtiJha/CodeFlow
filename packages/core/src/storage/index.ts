export {
  openDatabase,
  initializeSchema,
  getDatabase,
  closeDatabase,
  withTransaction,
  StatementCache,
} from "./db.js";
export type { DatabaseOptions } from "./db.js";
export { applyMigrations, getCurrentVersion } from "./migrations.js";
export { NodeStore } from "./node-store.js";
export { EdgeStore } from "./edge-store.js";
export { DFGStore } from "./dfg-store.js";
export { SummaryStore } from "./summary-store.js";
export { BranchStore } from "./branch-store.js";
export { SchemaStore } from "./schema-store.js";
export { QueryEngine } from "./query-engine.js";
export type { RepoRecord } from "./query-engine.js";
