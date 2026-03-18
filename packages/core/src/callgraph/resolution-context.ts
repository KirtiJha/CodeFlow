import type { ResolvedCall, ResolutionTier } from "./call-resolver.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("callgraph:context");

export interface ResolutionStats {
  total: number;
  byTier: Record<ResolutionTier, number>;
  averageConfidence: number;
  unresolvedCount: number;
  unresolvedCalls: string[];
}

/**
 * Tracks resolution quality and provides confidence scoring metrics
 * for the call graph construction process.
 */
export class ResolutionContext {
  private readonly resolved: ResolvedCall[] = [];
  private readonly unresolved: string[] = [];

  addResolved(call: ResolvedCall): void {
    this.resolved.push(call);
  }

  addUnresolved(calleeName: string, filePath: string, line: number): void {
    this.unresolved.push(`${filePath}:${line}:${calleeName}`);
  }

  getStats(): ResolutionStats {
    const byTier: Record<ResolutionTier, number> = {
      same_file_exact: 0,
      import_scoped: 0,
      type_narrowed: 0,
      global_fuzzy: 0,
      unresolved: 0,
    };

    let confidenceSum = 0;
    for (const r of this.resolved) {
      byTier[r.tier]++;
      confidenceSum += r.confidence;
    }

    byTier.unresolved = this.unresolved.length;
    const total = this.resolved.length + this.unresolved.length;

    return {
      total,
      byTier,
      averageConfidence:
        this.resolved.length > 0 ? confidenceSum / this.resolved.length : 0,
      unresolvedCount: this.unresolved.length,
      unresolvedCalls: this.unresolved.slice(0, 50), // Cap for display
    };
  }

  /**
   * Filter resolved calls by minimum confidence threshold.
   */
  getHighConfidenceCalls(minConfidence = 0.8): ResolvedCall[] {
    return this.resolved.filter((r) => r.confidence >= minConfidence);
  }

  /**
   * Get all resolved calls.
   */
  getAllResolved(): ResolvedCall[] {
    return [...this.resolved];
  }

  logSummary(): void {
    const stats = this.getStats();
    log.info(
      {
        total: stats.total,
        resolved: this.resolved.length,
        unresolved: stats.unresolvedCount,
        avgConfidence: stats.averageConfidence.toFixed(2),
        tier1: stats.byTier.same_file_exact,
        tier2: stats.byTier.import_scoped,
        tier3: stats.byTier.type_narrowed,
        tier4: stats.byTier.global_fuzzy,
      },
      "Call resolution summary",
    );
  }

  reset(): void {
    this.resolved.length = 0;
    this.unresolved.length = 0;
  }
}
