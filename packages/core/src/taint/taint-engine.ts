import type { DataFlowGraph, DFGNode, DFGEdge } from "../dfg/dfg-types.js";
import type {
  TaintFlow,
  TaintPathStep,
  TaintSeverity,
  TaintCategory,
  SecurityScanResult,
} from "./taint-types.js";
import type { SourceRegistry } from "./source-registry.js";
import type { SinkRegistry } from "./sink-registry.js";
import type { SanitizerRegistry } from "./sanitizer-registry.js";
import { v4 as uuid } from "uuid";
import { createLogger } from "../utils/logger.js";

const log = createLogger("taint:engine");

/**
 * Taint propagation engine.
 * Forward-propagates taint from sources through data_dep and param_bind edges,
 * checking for sanitizers along the way, and recording flows that reach sinks.
 */
export class TaintEngine {
  constructor(
    private readonly sources: SourceRegistry,
    private readonly sinks: SinkRegistry,
    private readonly sanitizers: SanitizerRegistry,
  ) {}

  /**
   * Scan a set of DFGs for taint flows.
   */
  scan(dfgs: Map<string, DataFlowGraph>, repoId: string): SecurityScanResult {
    const allFlows: TaintFlow[] = [];
    let totalSources = 0;
    let totalSinks = 0;
    let sanitizedCount = 0;

    for (const [, dfg] of dfgs) {
      // Identify sources
      const sourceNodes = this.findSources(dfg);
      totalSources += sourceNodes.length;

      // Identify sinks
      const sinkNodes = this.findSinks(dfg);
      totalSinks += sinkNodes.length;

      // For each source, forward-propagate taint
      for (const sourceNode of sourceNodes) {
        const flows = this.propagate(sourceNode, dfg, sinkNodes, repoId);
        allFlows.push(...flows);
      }
    }

    sanitizedCount = allFlows.filter((f) => f.isSanitized).length;

    const summary = {
      critical: allFlows.filter((f) => f.severity === "critical").length,
      warning: allFlows.filter((f) => f.severity === "warning").length,
      info: allFlows.filter((f) => f.severity === "info").length,
      totalSources,
      totalSinks,
      sanitizedCount,
    };

    log.info(summary, "Taint scan complete");

    return { flows: allFlows, summary };
  }

  /**
   * Find source nodes in a DFG.
   */
  private findSources(dfg: DataFlowGraph): DFGNode[] {
    const sources: DFGNode[] = [];

    for (const [, node] of dfg.nodes) {
      if (node.isSource) {
        sources.push(node);
        continue;
      }
      // Check against source registry patterns
      if (this.sources.isSource(node.code)) {
        sources.push(node);
      }
    }

    return sources;
  }

  /**
   * Find sink nodes in a DFG.
   */
  private findSinks(dfg: DataFlowGraph): DFGNode[] {
    const sinks: DFGNode[] = [];

    for (const [, node] of dfg.nodes) {
      if (node.isSink) {
        sinks.push(node);
        continue;
      }
      if (this.sinks.isSink(node.code)) {
        sinks.push(node);
      }
    }

    return sinks;
  }

  /**
   * Forward-propagate taint from a source, recording flows that reach sinks.
   */
  private propagate(
    source: DFGNode,
    dfg: DataFlowGraph,
    sinkNodes: DFGNode[],
    repoId: string,
  ): TaintFlow[] {
    const flows: TaintFlow[] = [];
    const sinkSet = new Set(sinkNodes.map((s) => s.id));
    const sourceCategory = this.sources.getCategory(source.code);

    // BFS from source
    const visited = new Set<string>();
    const queue: Array<{
      nodeId: string;
      path: TaintPathStep[];
      sanitized: boolean;
    }> = [
      {
        nodeId: source.id,
        path: [this.buildStep(source, false)],
        sanitized: false,
      },
    ];

    while (queue.length > 0) {
      const { nodeId, path, sanitized } = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      // Check if current node is a sink
      if (sinkSet.has(nodeId)) {
        const sinkNode = dfg.nodes.get(nodeId)!;
        const sinkInfo = this.sinks.getSinkInfo(sinkNode.code);
        const category =
          sinkInfo?.category ?? sourceCategory ?? "sql_injection";
        const severity = this.determineSeverity(sanitized, path.length);

        flows.push({
          id: uuid(),
          repoId,
          severity,
          category,
          sourceDfgNodeId: source.id,
          sinkDfgNodeId: nodeId,
          path: [...path],
          isSanitized: sanitized,
          sanitizerLocation: sanitized
            ? path.find((s) => s.isSanitizer)?.filePath
            : undefined,
          fixSuggestion: this.suggestFix(category, sinkNode),
        });
        continue; // Don't propagate past sinks
      }

      // Follow outgoing edges
      const outEdges = dfg.edges.filter((e) => e.sourceId === nodeId);
      for (const edge of outEdges) {
        if (
          edge.kind !== "data_dep" &&
          edge.kind !== "param_bind" &&
          edge.kind !== "return_flow"
        ) {
          continue;
        }

        const targetNode = dfg.nodes.get(edge.targetId);
        if (!targetNode) continue;

        const isSanitizer =
          edge.isSanitizing ||
          targetNode.isSanitizer ||
          this.sanitizers.isSanitizer(targetNode.code, sourceCategory);

        queue.push({
          nodeId: edge.targetId,
          path: [...path, this.buildStep(targetNode, isSanitizer)],
          sanitized: sanitized || isSanitizer,
        });
      }
    }

    return flows;
  }

  private buildStep(node: DFGNode, isSanitizer: boolean): TaintPathStep {
    return {
      dfgNodeId: node.id,
      code: node.code,
      filePath: node.location?.filePath ?? node.filePath ?? "",
      line: node.location?.startLine ?? node.line ?? 0,
      isSanitizer,
    };
  }

  private determineSeverity(
    isSanitized: boolean,
    pathLength: number,
  ): TaintSeverity {
    if (!isSanitized) return "critical";
    if (pathLength > 5) return "warning"; // Long paths with sanitizers
    return "info";
  }

  private suggestFix(category: TaintCategory, sinkNode: DFGNode): string {
    switch (category) {
      case "sql_injection":
        return "Use parameterized queries instead of string concatenation";
      case "xss":
        return "Sanitize user input before rendering in HTML: use escapeHtml() or a template engine";
      case "command_injection":
        return "Use allowlist validation or avoid dynamic command construction";
      case "path_traversal":
        return 'Validate and normalize file paths; reject paths containing ".."';
      case "pii_leak":
        return "Mask or redact PII before logging; use structured logging with field-level control";
      case "ssrf":
        return "Validate and allowlist target URLs; avoid user-controlled URL construction";
      case "open_redirect":
        return "Validate redirect targets against an allowlist of safe domains";
      case "log_injection":
        return "Sanitize log input to prevent control character injection";
      case "prototype_pollution":
        return "Use Object.create(null) or validate property names before dynamic assignment";
      case "insecure_deserialization":
        return "Validate deserialized data structure; prefer JSON over binary serialization";
      default:
        return "Review and validate untrusted input before use";
    }
  }
}
