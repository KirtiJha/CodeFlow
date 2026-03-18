import type { KnowledgeGraph, GraphEdge } from "../graph/types.js";
import type { DetectedTest } from "./test-detector.js";
import { v4 as uuid } from "uuid";
import { createLogger } from "../utils/logger.js";

const log = createLogger("tests:linker");

export interface TestLink {
  testNodeId: string;
  productionNodeId: string;
  linkType: "direct" | "transitive";
  via?: string; // the intermediate function for transitive links
}

export interface TestImpactResult {
  testsToRun: Array<{
    testFile: string;
    testName: string;
    linkType: "direct" | "transitive";
    via?: string;
  }>;
  testsSkipped: number;
  testGaps: Array<{
    symbol: string;
    filePath: string;
    reason: string;
  }>;
  estimatedDuration?: number;
}

/**
 * Maps tests to production code by following CALLS edges in the knowledge graph.
 * Builds a reverse index: production_function → [tests].
 */
export class TestLinker {
  /**
   * Build the test-to-production mapping.
   */
  link(tests: DetectedTest[], graph: KnowledgeGraph): Map<string, TestLink[]> {
    const reverseIndex = new Map<string, TestLink[]>();
    const testNodeIds = new Set(tests.map((t) => t.nodeId));

    for (const test of tests) {
      // Direct calls from test → production
      const directCalls = graph.getOutgoingEdges(test.nodeId, "calls");

      for (const edge of directCalls) {
        if (testNodeIds.has(edge.targetId)) continue; // Skip test→test calls

        this.addLink(reverseIndex, edge.targetId, {
          testNodeId: test.nodeId,
          productionNodeId: edge.targetId,
          linkType: "direct",
        });

        // Transitive calls: follow the callee's call edges (1 level deep)
        const transitiveEdges = graph.getOutgoingEdges(edge.targetId, "calls");
        for (const tEdge of transitiveEdges) {
          if (testNodeIds.has(tEdge.targetId)) continue;

          const viaNode = graph.getNode(edge.targetId);
          this.addLink(reverseIndex, tEdge.targetId, {
            testNodeId: test.nodeId,
            productionNodeId: tEdge.targetId,
            linkType: "transitive",
            via: viaNode?.name,
          });
        }
      }
    }

    log.debug(
      { mappings: reverseIndex.size, tests: tests.length },
      "Test links built",
    );
    return reverseIndex;
  }

  /**
   * Compute test impact for a set of changed symbols.
   */
  computeImpact(
    changedNodeIds: string[],
    reverseIndex: Map<string, TestLink[]>,
    graph: KnowledgeGraph,
    totalTests: number,
  ): TestImpactResult {
    const testsToRun = new Map<string, TestImpactResult["testsToRun"][0]>();
    const gaps: TestImpactResult["testGaps"] = [];

    for (const nodeId of changedNodeIds) {
      const links = reverseIndex.get(nodeId);
      const node = graph.getNode(nodeId);

      if (!links || links.length === 0) {
        gaps.push({
          symbol: node?.name ?? nodeId,
          filePath: node?.filePath ?? "",
          reason: "no_test_coverage",
        });
        continue;
      }

      for (const link of links) {
        const testNode = graph.getNode(link.testNodeId);
        if (!testNode) continue;

        const key = link.testNodeId;
        if (!testsToRun.has(key)) {
          testsToRun.set(key, {
            testFile: testNode.filePath,
            testName: testNode.name,
            linkType: link.linkType,
            via: link.via,
          });
        }
      }

      // Also find transitive callers and check their test coverage
      const callerEdges = graph.getIncomingEdges(nodeId, "calls");
      for (const edge of callerEdges) {
        const callerLinks = reverseIndex.get(edge.sourceId);
        if (!callerLinks) continue;

        for (const link of callerLinks) {
          const testNode = graph.getNode(link.testNodeId);
          if (!testNode) continue;

          const key = link.testNodeId;
          if (!testsToRun.has(key)) {
            const callerNode = graph.getNode(edge.sourceId);
            testsToRun.set(key, {
              testFile: testNode.filePath,
              testName: testNode.name,
              linkType: "transitive",
              via: callerNode?.name,
            });
          }
        }
      }
    }

    return {
      testsToRun: Array.from(testsToRun.values()),
      testsSkipped: totalTests - testsToRun.size,
      testGaps: gaps,
    };
  }

  private addLink(
    index: Map<string, TestLink[]>,
    prodNodeId: string,
    link: TestLink,
  ): void {
    const existing = index.get(prodNodeId);
    if (existing) {
      // Avoid duplicate test→prod links
      if (
        !existing.some(
          (l) =>
            l.testNodeId === link.testNodeId && l.linkType === link.linkType,
        )
      ) {
        existing.push(link);
      }
    } else {
      index.set(prodNodeId, [link]);
    }
  }
}
