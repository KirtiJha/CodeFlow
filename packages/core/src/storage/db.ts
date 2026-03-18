import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "../utils/logger.js";

const log = createLogger("storage:db");

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, "schema.sql");

export interface DatabaseOptions {
  path: string;
  readonly?: boolean;
  walMode?: boolean;
}

let _instance: Database.Database | null = null;
let _currentPath: string | null = null;

export function openDatabase(options: DatabaseOptions): Database.Database {
  // If already open at the same path, reuse
  if (_instance && _currentPath === options.path) return _instance;

  // If open at a different path, close the old one first
  if (_instance) {
    _instance.close();
    _instance = null;
    _currentPath = null;
  }

  const { path: dbPath, readonly: ro = false, walMode = true } = options;

  log.info({ dbPath }, "Opening database");

  // Ensure parent directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath, { readonly: ro });

  // Performance pragmas
  if (walMode && !ro) {
    db.pragma("journal_mode = WAL");
  }
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  db.pragma("cache_size = -64000"); // 64 MB
  db.pragma("temp_store = MEMORY");

  _instance = db;
  _currentPath = dbPath;
  return db;
}

export function initializeSchema(db: Database.Database): void {
  log.info("Initializing database schema");

  const schema = readFileSync(SCHEMA_PATH, "utf-8");

  // Remove PRAGMA statements (already set in openDatabase) and execute the rest
  const cleaned = schema
    .split("\n")
    .filter((line) => !line.trim().startsWith("PRAGMA"))
    .join("\n");

  db.exec(cleaned);

  log.info("Schema initialized");
}

export function getDatabase(): Database.Database {
  if (!_instance) {
    throw new Error("Database not initialized. Call openDatabase() first.");
  }
  return _instance;
}

export function closeDatabase(): void {
  if (_instance) {
    _instance.close();
    _instance = null;
    _currentPath = null;
    log.info("Database closed");
  }
}

/**
 * Run a batch of operations inside a single transaction for performance.
 */
export function withTransaction<T>(db: Database.Database, fn: () => T): T {
  return db.transaction(fn)();
}

/**
 * Create a prepared statement helper that caches statements.
 */
export class StatementCache {
  private readonly cache = new Map<string, Database.Statement>();
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  get(sql: string): Database.Statement {
    let stmt = this.cache.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.cache.set(sql, stmt);
    }
    return stmt;
  }

  clear(): void {
    this.cache.clear();
  }
}
