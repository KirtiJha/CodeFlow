import type {
  BranchFingerprint,
  BranchConflict,
  ConflictLevel,
  ConflictSeverity,
  ConflictDetail,
  FileOverlapDetail,
  SymbolOverlapDetail,
  SignatureConflictDetail,
  SemanticConflictDetail,
  SchemaConflictDetail,
} from "./conflict-types.js";
import { v4 as uuid } from "uuid";
import { createLogger } from "../utils/logger.js";

const log = createLogger("branches:conflict-detector");

/**
 * 5-level conflict detection between branch fingerprints.
 *
 * Level 1: File overlap (LOW)
 * Level 2: Symbol overlap (MEDIUM)
 * Level 3: Signature conflict (HIGH)
 * Level 4: Semantic conflict (CRITICAL)
 * Level 5: Schema/contract conflict (CRITICAL)
 */
export class ConflictDetector {
  /**
   * Detect conflicts between two branches at all 5 levels.
   */
  detect(
    branchA: string,
    branchB: string,
    fpA: BranchFingerprint,
    fpB: BranchFingerprint,
    repoId: string,
  ): BranchConflict[] {
    const conflicts: BranchConflict[] = [];

    // Level 1: File overlap
    const fileConflict = this.detectFileOverlap(
      branchA,
      branchB,
      fpA,
      fpB,
      repoId,
    );
    if (fileConflict) conflicts.push(fileConflict);

    // Level 2: Symbol overlap
    const symbolConflict = this.detectSymbolOverlap(
      branchA,
      branchB,
      fpA,
      fpB,
      repoId,
    );
    if (symbolConflict) conflicts.push(symbolConflict);

    // Level 3: Signature conflict
    const sigConflicts = this.detectSignatureConflicts(
      branchA,
      branchB,
      fpA,
      fpB,
      repoId,
    );
    conflicts.push(...sigConflicts);

    // Level 4: Semantic conflict
    const semanticConflicts = this.detectSemanticConflicts(
      branchA,
      branchB,
      fpA,
      fpB,
      repoId,
    );
    conflicts.push(...semanticConflicts);

    // Level 5: Schema conflict
    const schemaConflicts = this.detectSchemaConflicts(
      branchA,
      branchB,
      fpA,
      fpB,
      repoId,
    );
    conflicts.push(...schemaConflicts);

    // Sort by severity (highest first)
    conflicts.sort((a, b) => b.level - a.level);

    log.debug(
      { branchA, branchB, conflicts: conflicts.length },
      "Conflict detection complete",
    );

    return conflicts;
  }

  /**
   * Detect all pairwise conflicts among multiple branches.
   */
  detectAll(
    fingerprints: Map<string, BranchFingerprint>,
    repoId: string,
  ): BranchConflict[] {
    const branches = Array.from(fingerprints.keys());
    const allConflicts: BranchConflict[] = [];

    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        const branchA = branches[i];
        const branchB = branches[j];
        if (!branchA || !branchB) continue;
        const fpA = fingerprints.get(branchA)!;
        const fpB = fingerprints.get(branchB)!;

        const conflicts = this.detect(branchA, branchB, fpA, fpB, repoId);
        allConflicts.push(...conflicts);
      }
    }

    return allConflicts;
  }

  // ─── Level 1: File Overlap ──────────────────────────────

  private detectFileOverlap(
    branchA: string,
    branchB: string,
    fpA: BranchFingerprint,
    fpB: BranchFingerprint,
    repoId: string,
  ): BranchConflict | null {
    const overlap = this.intersect(fpA.filesChanged, fpB.filesChanged);
    if (overlap.size === 0) return null;

    return this.buildConflict(repoId, branchA, branchB, 1, "low", {
      level: 1,
      files: Array.from(overlap),
    } as FileOverlapDetail);
  }

  // ─── Level 2: Symbol Overlap ────────────────────────────

  private detectSymbolOverlap(
    branchA: string,
    branchB: string,
    fpA: BranchFingerprint,
    fpB: BranchFingerprint,
    repoId: string,
  ): BranchConflict | null {
    const aModified = new Set([
      ...fpA.symbolsModified.keys(),
      ...fpA.symbolsAdded,
    ]);
    const bModified = new Set([
      ...fpB.symbolsModified.keys(),
      ...fpB.symbolsAdded,
    ]);

    const overlap = this.intersect(aModified, bModified);
    if (overlap.size === 0) return null;

    const symbols = Array.from(overlap).map((qn) => {
      const file = qn.split("::")[0] ?? "";
      return {
        qualifiedName: qn,
        file,
        branchAChange: fpA.symbolsAdded.has(qn) ? "added" : "modified",
        branchBChange: fpB.symbolsAdded.has(qn) ? "added" : "modified",
      };
    });

    return this.buildConflict(repoId, branchA, branchB, 2, "medium", {
      level: 2,
      symbols,
    } as SymbolOverlapDetail);
  }

  // ─── Level 3: Signature Conflict ────────────────────────

  private detectSignatureConflicts(
    branchA: string,
    branchB: string,
    fpA: BranchFingerprint,
    fpB: BranchFingerprint,
    repoId: string,
  ): BranchConflict[] {
    const conflicts: BranchConflict[] = [];

    // Check if A changes a signature that B's new callers depend on
    for (const [qn, sigDiff] of fpA.signaturesChanged) {
      // Check if B adds code that might call this function with old signature
      if (fpB.symbolsAdded.size > 0 || fpB.symbolsModified.size > 0) {
        const conflict: SignatureConflictDetail = {
          level: 3,
          conflicts: [
            {
              qualifiedName: qn,
              changeBranch: branchA,
              dependentBranch: branchB,
              oldSignature: sigDiff.beforeParams.map((p) => p.name).join(", "),
              newSignature: sigDiff.afterParams.map((p) => p.name).join(", "),
              callers: [], // Would need call graph analysis to fill
            },
          ],
        };
        conflicts.push(
          this.buildConflict(repoId, branchA, branchB, 3, "high", conflict),
        );
      }
    }

    // Symmetric check: B changes signature, A depends on old
    for (const [qn, sigDiff] of fpB.signaturesChanged) {
      if (fpA.symbolsAdded.size > 0 || fpA.symbolsModified.size > 0) {
        const conflict: SignatureConflictDetail = {
          level: 3,
          conflicts: [
            {
              qualifiedName: qn,
              changeBranch: branchB,
              dependentBranch: branchA,
              oldSignature: sigDiff.beforeParams.map((p) => p.name).join(", "),
              newSignature: sigDiff.afterParams.map((p) => p.name).join(", "),
              callers: [],
            },
          ],
        };
        conflicts.push(
          this.buildConflict(repoId, branchA, branchB, 3, "high", conflict),
        );
      }
    }

    return conflicts;
  }

  // ─── Level 4: Semantic Conflict ─────────────────────────

  private detectSemanticConflicts(
    branchA: string,
    branchB: string,
    fpA: BranchFingerprint,
    fpB: BranchFingerprint,
    repoId: string,
  ): BranchConflict[] {
    const conflicts: BranchConflict[] = [];

    // Check if A changes behavior that B depends on
    for (const [qn, summaryDiff] of fpA.summariesChanged) {
      // If B references (calls or imports) the changed function
      if (fpB.symbolsModified.has(qn) || fpB.symbolsAdded.size > 0) {
        const details: string[] = [];
        if (
          summaryDiff.beforeCanReturnNull !== summaryDiff.afterCanReturnNull
        ) {
          details.push("null-return behavior changed");
        }
        if (summaryDiff.addedSideEffects.length > 0) {
          details.push(
            `new side effects: ${summaryDiff.addedSideEffects.join(", ")}`,
          );
        }
        if (summaryDiff.removedSideEffects.length > 0) {
          details.push(
            `removed side effects: ${summaryDiff.removedSideEffects.join(", ")}`,
          );
        }

        if (details.length > 0) {
          conflicts.push(
            this.buildConflict(repoId, branchA, branchB, 4, "critical", {
              level: 4,
              conflicts: [
                {
                  qualifiedName: qn,
                  changeBranch: branchA,
                  dependentBranch: branchB,
                  behaviorChange: details.join("; "),
                  dependentCode: "",
                },
              ],
            } as SemanticConflictDetail),
          );
        }
      }
    }

    return conflicts;
  }

  // ─── Level 5: Schema Conflict ───────────────────────────

  private detectSchemaConflicts(
    branchA: string,
    branchB: string,
    fpA: BranchFingerprint,
    fpB: BranchFingerprint,
    repoId: string,
  ): BranchConflict[] {
    const conflicts: BranchConflict[] = [];

    // Check if A's schema changes break B's field references
    for (const [fieldKey, fieldDiff] of fpA.schemasChanged) {
      // Check if B references the affected field
      for (const [bFieldKey] of fpB.schemasChanged) {
        if (fieldDiff.model === fpB.schemasChanged.get(bFieldKey)?.model) {
          conflicts.push(
            this.buildConflict(repoId, branchA, branchB, 5, "critical", {
              level: 5,
              conflicts: [
                {
                  model: fieldDiff.model,
                  field: fieldDiff.field,
                  changeBranch: branchA,
                  dependentBranch: branchB,
                  changeKind: fieldDiff.kind,
                  dependentUsage: `Branch B modifies same model field: ${bFieldKey}`,
                },
              ],
            } as SchemaConflictDetail),
          );
        }
      }
    }

    return conflicts;
  }

  // ─── Helpers ────────────────────────────────────────────

  private intersect<T>(a: Set<T>, b: Set<T>): Set<T> {
    const result = new Set<T>();
    for (const item of a) {
      if (b.has(item)) result.add(item);
    }
    return result;
  }

  private buildConflict(
    repoId: string,
    branchA: string,
    branchB: string,
    level: ConflictLevel,
    severity: ConflictSeverity,
    details: ConflictDetail,
  ): BranchConflict {
    return {
      id: uuid(),
      repoId,
      branchA,
      branchB,
      level,
      severity,
      details,
      detectedAt: new Date().toISOString(),
    };
  }
}
