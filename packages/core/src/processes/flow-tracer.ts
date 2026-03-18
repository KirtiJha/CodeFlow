import type { KnowledgeGraph, GraphNode, GraphEdge } from "../graph/types.js";
import type { EntryPoint } from "./entry-detector.js";
import { v4 as uuid } from "uuid";
import { createLogger } from "../utils/logger.js";

const log = createLogger("processes:flow-tracer");

export interface BusinessProcess {
  id: string;
  name: string;
  entryPoint: EntryPoint;
  steps: ProcessStep[];
  hasBranch: boolean;
  hasErrorPath: boolean;
  totalDepth: number;
}

export interface ProcessStep {
  nodeId: string;
  name: string;
  kind: string;
  order: number;
  depth: number;
  isBranch: boolean;
  isErrorHandler: boolean;
  dataTransforms?: string[];
}

export interface FlowTracerOptions {
  maxDepth: number;
  maxSteps: number;
  followDataFlow: boolean;
  followErrorPaths: boolean;
}

const DEFAULT_OPTIONS: FlowTracerOptions = {
  maxDepth: 20,
  maxSteps: 100,
  followDataFlow: true,
  followErrorPaths: true,
};

/**
 * BFS-based flow tracer that discovers business processes
 * starting from entry points, following call + data_flow edges.
 */
export class FlowTracer {
  private readonly options: FlowTracerOptions;

  constructor(options: Partial<FlowTracerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Trace all business processes from detected entry points.
   */
  traceAll(entries: EntryPoint[], graph: KnowledgeGraph): BusinessProcess[] {
    const processes: BusinessProcess[] = [];

    for (const entry of entries) {
      const process = this.traceProcess(entry, graph);
      if (process.steps.length > 1) {
        processes.push(process);
      }
    }

    log.debug({ count: processes.length }, "Traced business processes");
    return processes;
  }

  /**
   * Trace a single business process via BFS from an entry point.
   */
  traceProcess(entry: EntryPoint, graph: KnowledgeGraph): BusinessProcess {
    const entryNode = graph.getNode(entry.nodeId);
    if (!entryNode) {
      return {
        id: uuid(),
        name: entry.label,
        entryPoint: entry,
        steps: [],
        hasBranch: false,
        hasErrorPath: false,
        totalDepth: 0,
      };
    }

    const steps: ProcessStep[] = [];
    const visited = new Set<string>();
    let hasBranch = false;
    let hasErrorPath = false;

    // BFS queue: [nodeId, depth]
    const queue: Array<[string, number]> = [[entry.nodeId, 0]];
    visited.add(entry.nodeId);

    while (queue.length > 0 && steps.length < this.options.maxSteps) {
      const [nodeId, depth] = queue.shift()!;
      if (depth > this.options.maxDepth) continue;

      const node = graph.getNode(nodeId);
      if (!node) continue;

      // Record step
      const outEdges = graph.getOutgoingEdges(nodeId);
      const callEdges = outEdges.filter((e) => e.kind === "calls");
      const isBranch = callEdges.length > 1;
      const isErrorHandler = this.isErrorHandler(node);

      if (isBranch) hasBranch = true;
      if (isErrorHandler) hasErrorPath = true;

      steps.push({
        nodeId,
        name: node.name,
        kind: node.kind,
        order: steps.length,
        depth,
        isBranch,
        isErrorHandler,
        dataTransforms: this.getDataTransforms(node, outEdges),
      });

      // Follow call edges
      for (const edge of callEdges) {
        if (!visited.has(edge.targetId)) {
          visited.add(edge.targetId);
          queue.push([edge.targetId, depth + 1]);
        }
      }

      // Follow data_flow edges if enabled
      if (this.options.followDataFlow) {
        const dataEdges = outEdges.filter((e) => e.kind === "data_flow");
        for (const edge of dataEdges) {
          if (!visited.has(edge.targetId)) {
            visited.add(edge.targetId);
            queue.push([edge.targetId, depth + 1]);
          }
        }
      }
    }

    const totalDepth = steps.reduce((max, s) => Math.max(max, s.depth), 0);

    return {
      id: uuid(),
      name: this.generateProcessName(entryNode, entry),
      entryPoint: entry,
      steps,
      hasBranch,
      hasErrorPath,
      totalDepth,
    };
  }

  private isErrorHandler(node: GraphNode): boolean {
    const name = node.name.toLowerCase();
    return (
      name.includes("error") ||
      name.includes("catch") ||
      name.includes("exception") ||
      name.includes("fallback") ||
      name.includes("recover")
    );
  }

  private getDataTransforms(node: GraphNode, outEdges: GraphEdge[]): string[] {
    const transforms: string[] = [];
    const dataFlowEdges = outEdges.filter((e) => e.kind === "data_flow");

    for (const edge of dataFlowEdges) {
      const transform = edge.metadata?.transform;
      if (typeof transform === "string") {
        transforms.push(transform);
      }
    }

    return transforms;
  }

  private generateProcessName(node: GraphNode, entry: EntryPoint): string {
    switch (entry.type) {
      case "http_handler":
        return `HTTP: ${node.name}`;
      case "event_listener":
        return `Event: ${node.name}`;
      case "cron_job":
        return `Cron: ${node.name}`;
      case "cli_command":
        return `CLI: ${node.name}`;
      case "graphql_resolver":
        return `GraphQL: ${node.name}`;
      case "websocket_handler":
        return `WebSocket: ${node.name}`;
      case "queue_consumer":
        return `Queue: ${node.name}`;
      default:
        return node.name;
    }
  }
}
