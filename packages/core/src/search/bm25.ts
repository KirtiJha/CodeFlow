import type { Database } from "better-sqlite3";
import { createLogger } from "../utils/logger.js";

const log = createLogger("search:bm25");

export interface SearchResult {
  nodeId: string;
  name: string;
  qualifiedName: string;
  filePath: string;
  score: number;
}

/**
 * BM25 keyword search using SQLite FTS5.
 */
export class BM25Search {
  constructor(private readonly db: Database) {}

  /**
   * Full-text search across the nodes_fts table.
   */
  search(query: string, limit: number = 50): SearchResult[] {
    if (!query.trim()) return [];

    // Escape FTS5 special characters
    const escaped = this.escapeFts5(query);

    const stmt = this.db.prepare(`
      SELECT
        n.id AS nodeId,
        n.name,
        n.qualified_name AS qualifiedName,
        n.file_path AS filePath,
        rank AS score
      FROM nodes_fts
      JOIN nodes n ON n.rowid = nodes_fts.rowid
      WHERE nodes_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);

    const rows = stmt.all(escaped, limit) as SearchResult[];
    log.debug({ query, count: rows.length }, "BM25 search");
    return rows;
  }

  /**
   * Search within a specific file.
   */
  searchInFile(
    query: string,
    filePath: string,
    limit: number = 20,
  ): SearchResult[] {
    if (!query.trim()) return [];

    const escaped = this.escapeFts5(query);

    const stmt = this.db.prepare(`
      SELECT
        n.id AS nodeId,
        n.name,
        n.qualified_name AS qualifiedName,
        n.file_path AS filePath,
        rank AS score
      FROM nodes_fts
      JOIN nodes n ON n.rowid = nodes_fts.rowid
      WHERE nodes_fts MATCH ? AND n.file_path = ?
      ORDER BY rank
      LIMIT ?
    `);

    return stmt.all(escaped, filePath, limit) as SearchResult[];
  }

  /**
   * Escape FTS5 special characters to prevent query syntax errors.
   */
  private escapeFts5(query: string): string {
    // FTS5 uses double-quotes for phrase queries and special operators
    // Wrap each token in double-quotes to treat as literals
    return query
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => `"${token.replace(/"/g, '""')}"`)
      .join(" ");
  }
}
