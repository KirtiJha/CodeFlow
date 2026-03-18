import type { DataFlowGraph, DFGNode, DFGEdge } from "../dfg/dfg-types.js";
import type {
  ParamFlow,
  ParamFlowTarget,
  FlowTargetKind,
} from "./summary-types.js";

/**
 * Tracks how function parameters flow through the DFG to their final destinations.
 * Determines which outputs/side-effects each parameter influences.
 */
export class ParamFlowTracker {
  /**
   * Trace all parameter flows for a function's DFG.
   */
  trackAll(dfg: DataFlowGraph): ParamFlow[] {
    const flows: ParamFlow[] = [];

    for (let i = 0; i < dfg.params.length; i++) {
      const paramId = dfg.params[i];
      if (!paramId) continue;
      const paramNode = dfg.nodes.get(paramId);
      if (!paramNode) continue;

      const targets = this.traceParam(paramId, dfg);

      flows.push({
        paramIndex: i,
        paramName: paramNode.code ?? "",
        flowsTo: targets,
      });
    }

    return flows;
  }

  /**
   * Trace a single parameter forward through the DFG.
   */
  private traceParam(paramId: string, dfg: DataFlowGraph): ParamFlowTarget[] {
    const targets: ParamFlowTarget[] = [];
    const visited = new Set<string>();
    const transforms: string[] = [];

    this.dfs(paramId, dfg, visited, transforms, targets);
    return this.deduplicateTargets(targets);
  }

  private dfs(
    nodeId: string,
    dfg: DataFlowGraph,
    visited: Set<string>,
    transforms: string[],
    targets: ParamFlowTarget[],
  ): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = dfg.nodes.get(nodeId);
    if (!node) return;

    // Check if this node is a terminal target
    const target = this.classifyTarget(node, transforms);
    if (target) {
      targets.push(target);
    }

    // Follow outgoing edges
    const outEdges = dfg.edges.filter((e) => e.sourceId === nodeId);
    for (const edge of outEdges) {
      const newTransforms = edge.transform
        ? [...transforms, edge.transform]
        : transforms;

      this.dfs(edge.targetId, dfg, visited, newTransforms, targets);
    }
  }

  private classifyTarget(
    node: DFGNode,
    transforms: string[],
  ): ParamFlowTarget | null {
    const isSanitized = transforms.some(
      (t) =>
        t.includes("validate") ||
        t.includes("sanitize") ||
        t.includes("escape") ||
        t.includes("encode"),
    );

    if (node.kind === "return") {
      return {
        kind: "return",
        target: "return",
        transforms: [...transforms],
        isSanitized,
      };
    }

    if (node.kind === "field_write") {
      return {
        kind: this.inferFieldWriteKind(node),
        target: node.code,
        transforms: [...transforms],
        isSanitized,
      };
    }

    if (node.isSink) {
      return {
        kind: this.inferSinkKind(node),
        target: node.code,
        transforms: [...transforms],
        isSanitized,
      };
    }

    if (node.kind === "call_result") {
      // Check if this is a callee parameter binding
      const code = node.code.toLowerCase();
      if (
        code.includes("log") ||
        code.includes("console") ||
        code.includes("print")
      ) {
        return {
          kind: "log",
          target: node.code,
          transforms: [...transforms],
          isSanitized,
        };
      }
      if (
        code.includes("exec") ||
        code.includes("spawn") ||
        code.includes("eval")
      ) {
        return {
          kind: "exec",
          target: node.code,
          transforms: [...transforms],
          isSanitized,
        };
      }
    }

    return null;
  }

  private inferFieldWriteKind(node: DFGNode): FlowTargetKind {
    const code = node.code.toLowerCase();
    if (code.includes("db") || code.includes("model") || code.includes("query"))
      return "db_write";
    if (code.includes("log")) return "log";
    if (code.includes("file") || code.includes("fs.")) return "file_write";
    return "field_write";
  }

  private inferSinkKind(node: DFGNode): FlowTargetKind {
    if (!node.sinkKind) return "api_call";
    switch (node.sinkKind) {
      case "database":
      case "sql_execution":
        return "db_write";
      case "log":
        return "log";
      case "file_write":
        return "file_write";
      case "exec":
      case "eval":
        return "exec";
      default:
        return "api_call";
    }
  }

  private deduplicateTargets(targets: ParamFlowTarget[]): ParamFlowTarget[] {
    const seen = new Set<string>();
    return targets.filter((t) => {
      const key = `${t.kind}:${t.target}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
