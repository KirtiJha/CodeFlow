import type { ControlFlowGraph } from "./cfg-types.js";

/**
 * Analyzes branches within a CFG to compute branch conditions,
 * dominance relationships, and branch coverage metrics.
 */
export class BranchAnalyzer {
  /**
   * Compute the cyclomatic complexity from a CFG.
   * M = E - N + 2P where E=edges, N=nodes, P=connected components (1 for a single function)
   */
  cyclomaticComplexity(cfg: ControlFlowGraph): number {
    const E = cfg.edges.length;
    const N = cfg.blocks.size;
    const P = 1; // Single function = single connected component
    return E - N + 2 * P;
  }

  /**
   * Find all branch points (blocks with >1 outgoing edge).
   */
  getBranchPoints(cfg: ControlFlowGraph): string[] {
    const outDegree = new Map<string, number>();
    for (const edge of cfg.edges) {
      outDegree.set(
        edge.sourceBlockId,
        (outDegree.get(edge.sourceBlockId) ?? 0) + 1,
      );
    }
    return [...outDegree.entries()]
      .filter(([, deg]) => deg > 1)
      .map(([id]) => id);
  }

  /**
   * Find all paths from entry to exit (up to maxPaths to prevent explosion).
   */
  findPaths(cfg: ControlFlowGraph, maxPaths = 100): string[][] {
    const paths: string[][] = [];
    const stack: Array<{ blockId: string; path: string[] }> = [
      { blockId: cfg.entryBlockId, path: [cfg.entryBlockId] },
    ];

    while (stack.length > 0 && paths.length < maxPaths) {
      const { blockId, path } = stack.pop()!;

      if (blockId === cfg.exitBlockId) {
        paths.push(path);
        continue;
      }

      const outEdges = cfg.edges.filter((e) => e.sourceBlockId === blockId);
      for (const edge of outEdges) {
        if (!path.includes(edge.targetBlockId)) {
          stack.push({
            blockId: edge.targetBlockId,
            path: [...path, edge.targetBlockId],
          });
        }
      }
    }

    return paths;
  }

  /**
   * Identify loop-back edges in the CFG.
   */
  getBackEdges(cfg: ControlFlowGraph): Array<{ from: string; to: string }> {
    return cfg.edges
      .filter((e) => e.kind === "back_edge")
      .map((e) => ({ from: e.sourceBlockId, to: e.targetBlockId }));
  }

  /**
   * Count the nesting depth of a block (number of enclosing loops/branches).
   */
  getNestingDepth(cfg: ControlFlowGraph, blockId: string): number {
    // Simple heuristic: count loop headers on any path from entry to this block
    const visited = new Set<string>();
    let maxDepth = 0;

    const dfs = (current: string, depth: number): void => {
      if (current === blockId) {
        maxDepth = Math.max(maxDepth, depth);
        return;
      }
      if (visited.has(current)) return;
      visited.add(current);

      const block = cfg.blocks.get(current);
      const newDepth = block?.kind === "loop_header" ? depth + 1 : depth;

      const outEdges = cfg.edges.filter(
        (e) => e.sourceBlockId === current && e.kind !== "back_edge",
      );
      for (const edge of outEdges) {
        dfs(edge.targetBlockId, newDepth);
      }

      visited.delete(current);
    };

    dfs(cfg.entryBlockId, 0);
    return maxDepth;
  }
}
