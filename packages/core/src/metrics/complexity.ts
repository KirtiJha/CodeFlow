import type {
  ControlFlowGraph,
  BasicBlock,
  CFGEdge,
} from "../cfg/cfg-types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("metrics:complexity");

export interface ComplexityResult {
  cyclomatic: number;
  cognitive: number;
  halsteadVolume: number;
  linesOfCode: number;
}

/**
 * Computes cyclomatic and cognitive complexity from a CFG.
 */
export class ComplexityCalculator {
  /**
   * Compute cyclomatic complexity: E - N + 2P
   * Where E = edges, N = nodes, P = connected components (usually 1).
   */
  cyclomatic(cfg: ControlFlowGraph): number {
    const E = cfg.edges.length;
    const N = cfg.blocks.size;
    return Math.max(1, E - N + 2);
  }

  /**
   * Compute cognitive complexity.
   * Increments for:
   *   +1 for each control structure (if, for, while, switch, catch)
   *   +1 for each nesting level deep
   *   +1 for sequences of logical operators
   */
  cognitive(cfg: ControlFlowGraph): number {
    let complexity = 0;
    const blockDepths = this.computeBlockDepths(cfg);

    for (const [blockId, block] of cfg.blocks) {
      const depth = blockDepths.get(blockId) ?? 0;

      switch (block.kind) {
        case "branch":
        case "loop_header":
          complexity += 1 + depth;
          break;
        case "catch":
          complexity += 1 + depth;
          break;
        case "switch_case":
          complexity += 1;
          break;
        default:
          break;
      }

      // Check for logical operators in statements
      for (const stmt of block.statements) {
        const logicalOps = (stmt.text.match(/&&|\|\||\?\?/g) ?? []).length;
        complexity += logicalOps;
      }
    }

    return complexity;
  }

  /**
   * Compute Halstead volume (approximate from statement count).
   */
  halsteadVolume(cfg: ControlFlowGraph): number {
    let totalStatements = 0;
    const operators = new Set<string>();
    const operands = new Set<string>();

    for (const [, block] of cfg.blocks) {
      for (const stmt of block.statements) {
        totalStatements++;
        // Simple token counting as approximation
        const tokens = stmt.text.split(/\s+|[(){}[\],;]/);
        for (const token of tokens) {
          if (/^[+\-*/=<>!&|^~%?:]/.test(token)) {
            operators.add(token);
          } else if (token.length > 0) {
            operands.add(token);
          }
        }
      }
    }

    const n1 = operators.size || 1;
    const n2 = operands.size || 1;
    const N = totalStatements || 1;
    return N * Math.log2(n1 + n2);
  }

  /**
   * Count total lines of code in the CFG.
   */
  linesOfCode(cfg: ControlFlowGraph): number {
    let minLine = Infinity;
    let maxLine = 0;

    for (const [, block] of cfg.blocks) {
      if (block.startLine !== undefined && block.startLine < minLine)
        minLine = block.startLine;
      if (block.endLine !== undefined && block.endLine > maxLine)
        maxLine = block.endLine;
    }

    return maxLine > minLine ? maxLine - minLine + 1 : 0;
  }

  computeAll(cfg: ControlFlowGraph): ComplexityResult {
    return {
      cyclomatic: this.cyclomatic(cfg),
      cognitive: this.cognitive(cfg),
      halsteadVolume: this.halsteadVolume(cfg),
      linesOfCode: this.linesOfCode(cfg),
    };
  }

  /**
   * Stub method for pipeline integration: returns default complexity values
   * since we don't have the CFG here.
   */
  calculate(_signature: string, _language: string): ComplexityResult {
    return { cyclomatic: 1, cognitive: 1, halsteadVolume: 0, linesOfCode: 1 };
  }

  private computeBlockDepths(cfg: ControlFlowGraph): Map<string, number> {
    const depths = new Map<string, number>();
    const visited = new Set<string>();
    const queue: Array<[string, number]> = [[cfg.entryBlockId, 0]];

    while (queue.length > 0) {
      const [blockId, depth] = queue.shift()!;
      if (visited.has(blockId)) continue;
      visited.add(blockId);

      const block = cfg.blocks.get(blockId);
      if (!block) continue;

      const effectiveDepth =
        block.kind === "branch" ||
        block.kind === "loop_header" ||
        block.kind === "catch"
          ? depth + 1
          : depth;

      depths.set(blockId, depth);

      const outEdges = cfg.edges.filter((e) => e.sourceBlockId === blockId);
      for (const edge of outEdges) {
        if (!visited.has(edge.targetBlockId)) {
          queue.push([edge.targetBlockId, effectiveDepth]);
        }
      }
    }

    return depths;
  }
}
