import type { KnowledgeGraph, GraphNode } from "../graph/types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("metrics:coupling");

export interface CouplingResult {
  afferentCoupling: number; // Ca: who depends on me (incoming)
  efferentCoupling: number; // Ce: who I depend on (outgoing)
  instability: number; // Ce / (Ca + Ce) — 0 = stable, 1 = unstable
  abstractness: number; // abstract members / total members
}

/**
 * Computes coupling metrics for files and modules.
 */
export class CouplingCalculator {
  /**
   * Compute coupling metrics for a node (function/class/module).
   */
  computeForNode(nodeId: string, graph: KnowledgeGraph): CouplingResult {
    const incomingCalls = graph.getIncomingEdges(nodeId, "calls").length;
    const incomingImports = graph.getIncomingEdges(nodeId, "imports").length;
    const ca = incomingCalls + incomingImports;

    const outgoingCalls = graph.getOutgoingEdges(nodeId, "calls").length;
    const outgoingImports = graph.getOutgoingEdges(nodeId, "imports").length;
    const ce = outgoingCalls + outgoingImports;

    const instability = ca + ce > 0 ? ce / (ca + ce) : 0;

    return {
      afferentCoupling: ca,
      efferentCoupling: ce,
      instability,
      abstractness: 0,
    };
  }

  /**
   * Compute coupling metrics for a file.
   */
  computeForFile(filePath: string, graph: KnowledgeGraph): CouplingResult {
    const fileNodes = graph.getNodesByFile(filePath);
    let totalCa = 0;
    let totalCe = 0;
    let abstractCount = 0;

    for (const node of fileNodes) {
      const metrics = this.computeForNode(node.id, graph);
      totalCa += metrics.afferentCoupling;
      totalCe += metrics.efferentCoupling;

      if (node.kind === "interface" || node.kind === "trait") {
        abstractCount++;
      }
    }

    const instability =
      totalCa + totalCe > 0 ? totalCe / (totalCa + totalCe) : 0;
    const abstractness =
      fileNodes.length > 0 ? abstractCount / fileNodes.length : 0;

    return {
      afferentCoupling: totalCa,
      efferentCoupling: totalCe,
      instability,
      abstractness,
    };
  }

  /**
   * Compute coupling for all files and return sorted by instability.
   */
  computeAll(graph: KnowledgeGraph): Map<string, CouplingResult> {
    const files = new Set<string>();
    for (const [, node] of graph.nodes) {
      files.add(node.filePath);
    }

    const results = new Map<string, CouplingResult>();
    for (const file of files) {
      results.set(file, this.computeForFile(file, graph));
    }

    return results;
  }
}
