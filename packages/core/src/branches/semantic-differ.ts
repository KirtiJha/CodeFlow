import type { FunctionSummary } from "../summaries/summary-types.js";
import type { SummaryDiff, BranchFingerprint } from "./conflict-types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("branches:semantic-differ");

/**
 * Computes behavioral diffs between two branches by comparing
 * function summaries rather than raw text.
 */
export class SemanticDiffer {
  /**
   * Compare function summaries between two fingerprints.
   * Only considers symbols that are modified in both branches (overlap).
   */
  diffSummaries(
    fpA: BranchFingerprint,
    fpB: BranchFingerprint,
    summariesA: Map<string, FunctionSummary>,
    summariesB: Map<string, FunctionSummary>,
    baseSummaries: Map<string, FunctionSummary>,
  ): Map<string, SummaryDiff> {
    const result = new Map<string, SummaryDiff>();

    // Consider all symbols modified in either branch
    const candidates = new Set<string>();
    for (const sym of fpA.symbolsModified.keys()) candidates.add(sym);
    for (const sym of fpB.symbolsModified.keys()) candidates.add(sym);

    for (const qualifiedName of candidates) {
      const base = baseSummaries.get(qualifiedName);
      const summA = summariesA.get(qualifiedName);
      const summB = summariesB.get(qualifiedName);

      if (!base) continue;

      // Compare each branch's summary against the base
      const diffA = summA ? this.compareSummary(base, summA) : null;
      const diffB = summB ? this.compareSummary(base, summB) : null;

      // If both branches changed the same function's behavior, report it
      if (diffA && diffB && (diffA.hasChanges || diffB.hasChanges)) {
        result.set(qualifiedName, this.mergeDiffs(qualifiedName, diffA, diffB));
      } else if (diffA?.hasChanges) {
        result.set(qualifiedName, this.toDiff(qualifiedName, diffA));
      } else if (diffB?.hasChanges) {
        result.set(qualifiedName, this.toDiff(qualifiedName, diffB));
      }
    }

    log.debug({ count: result.size }, "Computed semantic diffs");
    return result;
  }

  /**
   * Compare a modified summary against the base version.
   */
  private compareSummary(
    base: FunctionSummary,
    modified: FunctionSummary,
  ): SummaryComparison {
    const addedSideEffects: string[] = [];
    const removedSideEffects: string[] = [];
    const changedParamFlows: string[] = [];

    // Compare side effects
    const baseEffects = new Set(
      base.sideEffects.map((e) => `${e.kind}:${e.target}`),
    );
    const modEffects = new Set(
      modified.sideEffects.map((e) => `${e.kind}:${e.target}`),
    );

    for (const effect of modEffects) {
      if (!baseEffects.has(effect)) addedSideEffects.push(effect);
    }
    for (const effect of baseEffects) {
      if (!modEffects.has(effect)) removedSideEffects.push(effect);
    }

    // Compare param flows
    for (const baseFlow of base.paramFlows) {
      const modFlow = modified.paramFlows.find(
        (f) => f.paramIndex === baseFlow.paramIndex,
      );
      if (!modFlow) {
        changedParamFlows.push(`param[${baseFlow.paramIndex}]:removed`);
        continue;
      }
      const baseTargets = new Set(
        baseFlow.flowsTo.map((t) => `${t.kind}:${t.target}`),
      );
      const modTargets = new Set(
        modFlow.flowsTo.map((t) => `${t.kind}:${t.target}`),
      );
      for (const t of modTargets) {
        if (!baseTargets.has(t)) {
          changedParamFlows.push(
            `param[${baseFlow.paramIndex}]:added_flow:${t}`,
          );
        }
      }
      for (const t of baseTargets) {
        if (!modTargets.has(t)) {
          changedParamFlows.push(
            `param[${baseFlow.paramIndex}]:removed_flow:${t}`,
          );
        }
      }
    }

    const nullChange = base.canReturnNull !== modified.canReturnNull;
    const undefinedChange =
      base.canReturnUndefined !== modified.canReturnUndefined;

    return {
      hasChanges:
        addedSideEffects.length > 0 ||
        removedSideEffects.length > 0 ||
        changedParamFlows.length > 0 ||
        nullChange ||
        undefinedChange,
      beforeCanReturnNull: base.canReturnNull,
      afterCanReturnNull: modified.canReturnNull,
      addedSideEffects,
      removedSideEffects,
      changedParamFlows,
    };
  }

  private toDiff(qualifiedName: string, comp: SummaryComparison): SummaryDiff {
    return {
      qualifiedName,
      beforeCanReturnNull: comp.beforeCanReturnNull,
      afterCanReturnNull: comp.afterCanReturnNull,
      addedSideEffects: comp.addedSideEffects,
      removedSideEffects: comp.removedSideEffects,
      changedParamFlows: comp.changedParamFlows,
    };
  }

  private mergeDiffs(
    qualifiedName: string,
    diffA: SummaryComparison,
    diffB: SummaryComparison,
  ): SummaryDiff {
    return {
      qualifiedName,
      beforeCanReturnNull: diffA.beforeCanReturnNull,
      afterCanReturnNull: diffA.afterCanReturnNull || diffB.afterCanReturnNull,
      addedSideEffects: [
        ...new Set([...diffA.addedSideEffects, ...diffB.addedSideEffects]),
      ],
      removedSideEffects: [
        ...new Set([...diffA.removedSideEffects, ...diffB.removedSideEffects]),
      ],
      changedParamFlows: [
        ...new Set([...diffA.changedParamFlows, ...diffB.changedParamFlows]),
      ],
    };
  }
}

interface SummaryComparison {
  hasChanges: boolean;
  beforeCanReturnNull: boolean;
  afterCanReturnNull: boolean;
  addedSideEffects: string[];
  removedSideEffects: string[];
  changedParamFlows: string[];
}
