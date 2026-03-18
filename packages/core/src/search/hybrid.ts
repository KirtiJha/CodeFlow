import type { Database } from "better-sqlite3";
import { BM25Search, type SearchResult } from "./bm25.js";
import { SemanticSearch, type SemanticResult } from "./semantic.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("search:hybrid");

export interface HybridResult {
  nodeId: string;
  name: string;
  qualifiedName: string;
  filePath: string;
  score: number;
  bm25Rank: number | null;
  semanticRank: number | null;
}

/**
 * Reciprocal Rank Fusion (RRF) combining BM25 keyword and semantic search.
 *
 * RRF Formula: score = Σ 1/(k + rank_i) for each ranker i
 * where k is a constant (typically 60) that dampens the contribution
 * of low-ranked results.
 */
export class HybridSearch {
  private readonly bm25: BM25Search;
  private readonly semantic: SemanticSearch;
  private readonly k: number;

  constructor(db: Database, k: number = 60) {
    this.bm25 = new BM25Search(db);
    this.semantic = new SemanticSearch(db);
    this.k = k;
  }

  async initialize(): Promise<void> {
    await this.semantic.initialize();
  }

  /**
   * Execute hybrid search with RRF fusion.
   */
  search(query: string, limit: number = 50): HybridResult[] {
    const fetchCount = limit * 3; // Fetch more to improve fusion quality

    const bm25Results = this.bm25.search(query, fetchCount);
    const semanticResults = this.semantic.search(query, fetchCount);

    return this.fuse(bm25Results, semanticResults, limit);
  }

  /**
   * Keyword-only search (no semantic).
   */
  keywordSearch(query: string, limit: number = 50): SearchResult[] {
    return this.bm25.search(query, limit);
  }

  /**
   * Semantic-only search (no keywords).
   */
  semanticSearch(query: string, limit: number = 50): SemanticResult[] {
    return this.semantic.search(query, limit);
  }

  private fuse(
    bm25Results: SearchResult[],
    semanticResults: SemanticResult[],
    limit: number,
  ): HybridResult[] {
    const scoreMap = new Map<
      string,
      {
        nodeId: string;
        name: string;
        qualifiedName: string;
        filePath: string;
        score: number;
        bm25Rank: number | null;
        semanticRank: number | null;
      }
    >();

    // Add BM25 rank contributions
    for (let i = 0; i < bm25Results.length; i++) {
      const r = bm25Results[i];
      if (!r) continue;
      const rrfScore = 1 / (this.k + i + 1);
      const existing = scoreMap.get(r.nodeId);
      if (existing) {
        existing.score += rrfScore;
        existing.bm25Rank = i + 1;
      } else {
        scoreMap.set(r.nodeId, {
          nodeId: r.nodeId,
          name: r.name,
          qualifiedName: r.qualifiedName,
          filePath: r.filePath,
          score: rrfScore,
          bm25Rank: i + 1,
          semanticRank: null,
        });
      }
    }

    // Add semantic rank contributions
    for (let i = 0; i < semanticResults.length; i++) {
      const r = semanticResults[i];
      if (!r) continue;
      const rrfScore = 1 / (this.k + i + 1);
      const existing = scoreMap.get(r.nodeId);
      if (existing) {
        existing.score += rrfScore;
        existing.semanticRank = i + 1;
      } else {
        scoreMap.set(r.nodeId, {
          nodeId: r.nodeId,
          name: r.name,
          qualifiedName: r.qualifiedName,
          filePath: r.filePath,
          score: rrfScore,
          bm25Rank: null,
          semanticRank: i + 1,
        });
      }
    }

    const results = [...scoreMap.values()];
    results.sort((a, b) => b.score - a.score);

    log.debug(
      {
        query: bm25Results.length > 0 ? "has_bm25" : "no_bm25",
        bm25Count: bm25Results.length,
        semanticCount: semanticResults.length,
        fusedCount: results.length,
      },
      "RRF fusion",
    );

    return results.slice(0, limit);
  }
}
