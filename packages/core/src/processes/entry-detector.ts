import type { KnowledgeGraph, GraphNode } from "../graph/types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("processes:entry-detector");

export type EntryPointType =
  | "http_handler"
  | "event_listener"
  | "cron_job"
  | "cli_command"
  | "main_function"
  | "test_function"
  | "export_public"
  | "graphql_resolver"
  | "websocket_handler"
  | "queue_consumer";

export interface EntryPoint {
  nodeId: string;
  type: EntryPointType;
  label: string;
  metadata?: Record<string, string>;
}

/**
 * Detects entry points in the codebase — functions/methods that
 * serve as the starting point for business processes.
 */
export class EntryDetector {
  private static readonly PATTERNS: Array<{
    type: EntryPointType;
    namePatterns: RegExp[];
    decoratorPatterns: RegExp[];
    signaturePatterns: RegExp[];
  }> = [
    {
      type: "http_handler",
      namePatterns: [/handler$/i, /controller$/i, /route$/i],
      decoratorPatterns: [
        /@(Get|Post|Put|Patch|Delete|Head|Options)\(/i,
        /@app\.(get|post|put|patch|delete)\(/i,
        /@router\.(get|post|put|patch|delete)\(/i,
        /@RequestMapping/i,
      ],
      signaturePatterns: [
        /\(req\w*[:,]?\s*\w*,?\s*res\w*[:,]?\s*\w*/,
        /\(request[:,]?\s*\w*,?\s*response[:,]?\s*\w*/,
        /\(ctx[:,]?\s*\w*/,
        /app\.(get|post|put|delete|patch)\s*\(/,
        /router\.(get|post|put|delete|patch)\s*\(/,
      ],
    },
    {
      type: "event_listener",
      namePatterns: [/^on[A-Z]/, /^handle[A-Z]/, /Listener$/],
      decoratorPatterns: [/@EventHandler/, /@OnEvent/, /@Subscribe/],
      signaturePatterns: [/\.on\(/, /\.addEventListener\(/, /\.subscribe\(/],
    },
    {
      type: "cron_job",
      namePatterns: [/cron/i, /scheduler/i, /job$/i, /task$/i],
      decoratorPatterns: [/@Cron\(/, /@Scheduled\(/, /@celery_app\.task/],
      signaturePatterns: [],
    },
    {
      type: "cli_command",
      namePatterns: [/^command_/, /Command$/, /^cmd_/],
      decoratorPatterns: [/@click\.command/, /@app\.command/],
      signaturePatterns: [/\.command\(/, /program\.command\(/],
    },
    {
      type: "main_function",
      namePatterns: [/^main$/, /^Main$/, /^__main__$/],
      decoratorPatterns: [],
      signaturePatterns: [/func\s+main\s*\(/],
    },
    {
      type: "test_function",
      namePatterns: [/^test_/, /^Test/, /\.test\./, /\.spec\./],
      decoratorPatterns: [/@Test/, /@pytest\.mark/],
      signaturePatterns: [/\b(describe|it|test)\s*\(/],
    },
    {
      type: "graphql_resolver",
      namePatterns: [/Resolver$/, /^resolve[A-Z]/],
      decoratorPatterns: [/@Query\(/, /@Mutation\(/, /@Resolver/],
      signaturePatterns: [],
    },
    {
      type: "websocket_handler",
      namePatterns: [/^ws_/, /WebSocket/, /Socket/],
      decoratorPatterns: [/@WebSocketGateway/, /@SubscribeMessage/],
      signaturePatterns: [/\.on\(\s*['"]message/i, /ws\.on\(/],
    },
    {
      type: "queue_consumer",
      namePatterns: [/consumer/i, /worker/i, /processor/i],
      decoratorPatterns: [/@Process\(/, /@Consume/],
      signaturePatterns: [/\.process\(/, /\.consume\(/],
    },
  ];

  /**
   * Detect all entry points in the knowledge graph.
   */
  detect(graph: KnowledgeGraph): EntryPoint[] {
    const entries: EntryPoint[] = [];
    const callableKinds = new Set(["function", "method", "constructor"]);

    for (const [, node] of graph.nodes) {
      if (!callableKinds.has(node.kind)) continue;

      const isEntry = this.isEntryPoint(node, graph);
      if (isEntry) {
        entries.push(isEntry);
      }
    }

    // Also detect exported public functions with no callers (potential entry points)
    const callTargets = new Set<string>();
    for (const edge of graph.getEdgesByKind("calls")) {
      callTargets.add(edge.targetId);
    }

    for (const [, node] of graph.nodes) {
      if (!callableKinds.has(node.kind)) continue;
      if (entries.some((e) => e.nodeId === node.id)) continue;

      // If the function is exported and has no callers, it's likely an entry point
      if (node.isEntryPoint && !callTargets.has(node.id)) {
        entries.push({
          nodeId: node.id,
          type: "export_public",
          label: `Exported: ${node.name}`,
        });
      }
    }

    log.debug({ count: entries.length }, "Detected entry points");
    return entries;
  }

  private isEntryPoint(
    node: GraphNode,
    graph: KnowledgeGraph,
  ): EntryPoint | null {
    for (const pattern of EntryDetector.PATTERNS) {
      // Check name patterns
      for (const np of pattern.namePatterns) {
        if (np.test(node.name)) {
          return {
            nodeId: node.id,
            type: pattern.type,
            label: `${pattern.type}: ${node.name}`,
          };
        }
      }

      // Check signature patterns
      if (node.signature) {
        for (const sp of pattern.signaturePatterns) {
          if (sp.test(node.signature)) {
            return {
              nodeId: node.id,
              type: pattern.type,
              label: `${pattern.type}: ${node.name}`,
            };
          }
        }
      }

      // Check decorators (stored in metadata)
      const decorators = node.metadata?.decorators as string[] | undefined;
      if (decorators) {
        for (const dec of decorators) {
          for (const dp of pattern.decoratorPatterns) {
            if (dp.test(dec)) {
              return {
                nodeId: node.id,
                type: pattern.type,
                label: `${pattern.type}: ${node.name}`,
              };
            }
          }
        }
      }
    }

    return null;
  }
}
