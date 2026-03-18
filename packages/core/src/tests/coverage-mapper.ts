import type { KnowledgeGraph } from "../graph/types.js";
import type { TestLink } from "./test-linker.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("tests:coverage");

export interface CoverageReport {
  totalProduction: number;
  coveredByTests: number;
  coveragePercent: number;
  uncoveredNodes: Array<{
    nodeId: string;
    name: string;
    filePath: string;
    kind: string;
  }>;
  fileCoverage: Map<
    string,
    { total: number; covered: number; percent: number }
  >;
}

/**
 * Infers code coverage from the test-to-production mapping.
 * Not actual runtime coverage — static inference based on call graph.
 */
export class CoverageMapper {
  compute(
    reverseIndex: Map<string, TestLink[]>,
    graph: KnowledgeGraph,
  ): CoverageReport {
    const callableKinds = new Set(["function", "method", "constructor"]);
    const productionNodes: Array<{
      nodeId: string;
      name: string;
      filePath: string;
      kind: string;
    }> = [];

    for (const [, node] of graph.nodes) {
      if (!callableKinds.has(node.kind)) continue;
      if (node.isTest) continue;

      productionNodes.push({
        nodeId: node.id,
        name: node.name,
        filePath: node.filePath,
        kind: node.kind,
      });
    }

    const coveredIds = new Set(reverseIndex.keys());
    const uncoveredNodes = productionNodes.filter(
      (n) => !coveredIds.has(n.nodeId),
    );
    const coveredCount = productionNodes.length - uncoveredNodes.length;

    // Compute per-file coverage
    const fileCoverage = new Map<
      string,
      { total: number; covered: number; percent: number }
    >();

    for (const node of productionNodes) {
      const entry = fileCoverage.get(node.filePath) ?? {
        total: 0,
        covered: 0,
        percent: 0,
      };
      entry.total++;
      if (coveredIds.has(node.nodeId)) {
        entry.covered++;
      }
      entry.percent = entry.total > 0 ? (entry.covered / entry.total) * 100 : 0;
      fileCoverage.set(node.filePath, entry);
    }

    log.debug(
      {
        total: productionNodes.length,
        covered: coveredCount,
        percent: ((coveredCount / productionNodes.length) * 100).toFixed(1),
      },
      "Coverage computed",
    );

    return {
      totalProduction: productionNodes.length,
      coveredByTests: coveredCount,
      coveragePercent:
        productionNodes.length > 0
          ? (coveredCount / productionNodes.length) * 100
          : 0,
      uncoveredNodes,
      fileCoverage,
    };
  }
}
