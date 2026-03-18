import type Database from "better-sqlite3";
import { createLogger } from "../utils/logger.js";

const log = createLogger("storage:migrations");

interface MigrationRecord {
  version: number;
  applied_at: string;
  description: string;
}

interface Migration {
  version: number;
  description: string;
  up: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "Initial schema",
    up: "", // Handled by schema.sql initialization
  },
];

export function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL,
      description TEXT
    );
  `);
}

export function getCurrentVersion(db: Database.Database): number {
  ensureMigrationsTable(db);
  const row = db
    .prepare("SELECT MAX(version) as ver FROM _migrations")
    .get() as { ver: number | null } | undefined;
  return row?.ver ?? 0;
}

export function applyMigrations(db: Database.Database): void {
  ensureMigrationsTable(db);
  const current = getCurrentVersion(db);

  const pending = MIGRATIONS.filter((m) => m.version > current);
  if (pending.length === 0) {
    log.debug("No pending migrations");
    return;
  }

  log.info({ pending: pending.length, current }, "Applying migrations");

  const insertMigration = db.prepare(
    "INSERT INTO _migrations (version, applied_at, description) VALUES (?, ?, ?)",
  );

  db.transaction(() => {
    for (const migration of pending) {
      if (migration.up) {
        db.exec(migration.up);
      }
      insertMigration.run(
        migration.version,
        new Date().toISOString(),
        migration.description,
      );
      log.info(
        { version: migration.version, description: migration.description },
        "Migration applied",
      );
    }
  })();
}
