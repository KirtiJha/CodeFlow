import type { Database } from "better-sqlite3";
import { createLogger } from "../utils/logger.js";

const log = createLogger("search:semantic");

export interface SemanticResult {
  nodeId: string;
  name: string;
  qualifiedName: string;
  filePath: string;
  similarity: number;
}

/**
 * Embedding-based semantic search.
 *
 * Uses a lightweight approach: TF-IDF vectors stored as JSON in SQLite,
 * with cosine similarity computation. This avoids heavy ONNX dependencies
 * while providing meaningful semantic search capabilities.
 *
 * For production use with ONNX/Transformers, this can be extended to
 * use proper embedding models.
 */
export class SemanticSearch {
  private vocabulary: Map<string, number> = new Map();
  private idfValues: Map<string, number> = new Map();
  private initialized = false;

  constructor(private readonly db: Database) {}

  /**
   * Build the TF-IDF vocabulary from all indexed symbols.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const rows = this.db
      .prepare(
        `
      SELECT name, qualified_name FROM nodes WHERE kind != 'file'
    `,
      )
      .all() as Array<{ name: string; qualified_name: string }>;

    const docCount = rows.length;
    const docFreq = new Map<string, number>();

    for (const row of rows) {
      const tokens = this.tokenize(`${row.name} ${row.qualified_name}`);
      const unique = new Set(tokens);
      for (const token of unique) {
        docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
      }
    }

    // Build vocabulary index and IDF values
    let idx = 0;
    for (const [term, df] of docFreq) {
      this.vocabulary.set(term, idx++);
      this.idfValues.set(term, Math.log((docCount + 1) / (df + 1)) + 1);
    }

    this.initialized = true;
    log.info(
      { vocabSize: this.vocabulary.size, docs: docCount },
      "Semantic index built",
    );
  }

  /**
   * Search for symbols semantically similar to the query.
   */
  search(query: string, limit: number = 50): SemanticResult[] {
    if (!this.initialized || !query.trim()) return [];

    const queryVector = this.vectorize(query);
    if (queryVector.size === 0) return [];

    const rows = this.db
      .prepare(
        `
      SELECT id, name, qualified_name, file_path
      FROM nodes
      WHERE kind != 'file'
    `,
      )
      .all() as Array<{
      id: string;
      name: string;
      qualified_name: string;
      file_path: string;
    }>;

    const scored: SemanticResult[] = [];

    for (const row of rows) {
      const docVector = this.vectorize(`${row.name} ${row.qualified_name}`);
      const sim = this.cosineSimilarity(queryVector, docVector);
      if (sim > 0.01) {
        scored.push({
          nodeId: row.id,
          name: row.name,
          qualifiedName: row.qualified_name,
          filePath: row.file_path,
          similarity: sim,
        });
      }
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
  }

  private vectorize(text: string): Map<string, number> {
    const tokens = this.tokenize(text);
    const tf = new Map<string, number>();

    for (const token of tokens) {
      if (this.vocabulary.has(token)) {
        tf.set(token, (tf.get(token) ?? 0) + 1);
      }
    }

    // TF-IDF weighting
    const vector = new Map<string, number>();
    for (const [term, count] of tf) {
      const idf = this.idfValues.get(term) ?? 1;
      vector.set(term, count * idf);
    }

    return vector;
  }

  private cosineSimilarity(
    a: Map<string, number>,
    b: Map<string, number>,
  ): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const [term, valA] of a) {
      normA += valA * valA;
      const valB = b.get(term);
      if (valB !== undefined) {
        dotProduct += valA * valB;
      }
    }

    for (const valB of b.values()) {
      normB += valB * valB;
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dotProduct / denom;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, " ")
      .split(/[\s_]+/)
      .filter((t) => t.length > 1);
  }
}
