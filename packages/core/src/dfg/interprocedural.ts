import type { DataFlowGraph, DFGNode, DFGEdge } from "./dfg-types.js";
import { v4 as uuid } from "uuid";
import type { FunctionSummary } from "../summaries/summary-types.js";

/**
 * Interprocedural data flow analysis.
 * Connects caller → callee DFGs using function summaries.
 */
export class InterproceduralDFG {
  /**
   * Link two DFGs at a call site using the callee's summary.
   * Creates cross-function DFG edges:
   *   - caller argument → callee parameter
   *   - callee return → caller result
   */
  linkCallSite(
    callerDfg: DataFlowGraph,
    calleeDfg: DataFlowGraph,
    callSiteNodeId: string,
    argNodeIds: string[],
    calleeSummary: FunctionSummary | null,
    repoId: string,
  ): DFGEdge[] {
    const newEdges: DFGEdge[] = [];

    // Link arguments to parameters
    const calleeParams = calleeDfg.params;
    for (let i = 0; i < Math.min(argNodeIds.length, calleeParams.length); i++) {
      newEdges.push({
        id: uuid(),
        repoId,
        sourceId: argNodeIds[i] ?? "",
        targetId: calleeParams[i] ?? "",
        kind: "param_bind",
        isSanitizing: false,
      });
    }

    // Link callee returns to the call result node in the caller
    for (const returnId of calleeDfg.returns) {
      newEdges.push({
        id: uuid(),
        repoId,
        sourceId: returnId,
        targetId: callSiteNodeId,
        kind: "return_flow",
        isSanitizing: false,
      });
    }

    return newEdges;
  }

  /**
   * Trace a value from a source DFG node across function boundaries.
   * Uses summaries to skip inlining callee DFGs.
   */
  traceValue(
    startNodeId: string,
    dfgMap: Map<string, DataFlowGraph>,
    summaryMap: Map<string, FunctionSummary>,
    maxDepth = 10,
  ): TracePath {
    const path: TraceStep[] = [];
    const visited = new Set<string>();

    const trace = (nodeId: string, functionId: string, depth: number): void => {
      if (depth >= maxDepth || visited.has(nodeId)) return;
      visited.add(nodeId);

      const dfg = dfgMap.get(functionId);
      if (!dfg) return;

      const node = dfg.nodes.get(nodeId);
      if (!node) return;

      path.push({
        nodeId,
        functionId,
        code: node.code ?? "",
        filePath: node.filePath ?? "",
        line: node.line ?? 0,
        kind: node.kind,
      });

      // Follow outgoing edges
      const outEdges = dfg.edges.filter((e) => e.sourceId === nodeId);
      for (const edge of outEdges) {
        trace(edge.targetId, functionId, depth + 1);
      }
    };

    const initialDfg = [...dfgMap.values()].find((d) =>
      d.nodes.has(startNodeId),
    );
    if (initialDfg) {
      trace(startNodeId, initialDfg.functionId, 0);
    }

    return { steps: path };
  }
}

export interface TraceStep {
  nodeId: string;
  functionId: string;
  code: string;
  filePath: string;
  line: number;
  kind: string;
}

export interface TracePath {
  steps: TraceStep[];
}
