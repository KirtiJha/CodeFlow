import type { DataFlowGraph, DFGNode } from "../dfg/dfg-types.js";
import type { SideEffect, SideEffectKind } from "./summary-types.js";

/**
 * Detects side effects within a function's DFG.
 * Identifies operations that affect external state: DB, file I/O, network, logging, etc.
 */
export class SideEffectDetector {
  private static readonly PATTERNS: Array<{
    kind: SideEffectKind;
    patterns: RegExp[];
  }> = [
    {
      kind: "db_read",
      patterns: [
        /\.find\w*\(/,
        /\.select\(/,
        /\.query\(/,
        /\.get\w*\(/,
        /SELECT\s/i,
        /\.aggregate\(/,
        /\.count\(/,
      ],
    },
    {
      kind: "db_write",
      patterns: [
        /\.save\(/,
        /\.insert\(/,
        /\.update\(/,
        /\.delete\(/,
        /\.create\(/,
        /\.remove\(/,
        /INSERT\s/i,
        /UPDATE\s/i,
        /DELETE\s/i,
        /\.upsert\(/,
      ],
    },
    {
      kind: "api_call",
      patterns: [
        /fetch\(/,
        /axios\.\w+\(/,
        /\.request\(/,
        /http\.\w+\(/,
        /\.send\(/,
        /res\.json\(/,
        /res\.send\(/,
        /res\.status\(/,
      ],
    },
    {
      kind: "file_io",
      patterns: [
        /fs\.\w+/,
        /readFile/,
        /writeFile/,
        /createReadStream/,
        /createWriteStream/,
        /open\(/,
        /\.read\(/,
        /\.write\(/,
      ],
    },
    {
      kind: "log",
      patterns: [
        /console\.\w+\(/,
        /logger\.\w+\(/,
        /log\.\w+\(/,
        /logging\.\w+\(/,
        /print\(/,
      ],
    },
    {
      kind: "env_read",
      patterns: [/process\.env/, /os\.environ/, /getenv\(/, /Env\.\w+/],
    },
    {
      kind: "cache_access",
      patterns: [
        /cache\.\w+\(/,
        /redis\.\w+\(/,
        /memcache\.\w+\(/,
        /\.setex\(/,
        /\.getdel\(/,
      ],
    },
    {
      kind: "event_emit",
      patterns: [
        /\.emit\(/,
        /\.dispatch\(/,
        /\.publish\(/,
        /EventEmitter/,
        /\.trigger\(/,
      ],
    },
  ];

  /**
   * Detect all side effects in a DFG.
   */
  detect(dfg: DataFlowGraph): SideEffect[] {
    const effects: SideEffect[] = [];
    const seen = new Set<string>();

    for (const [, node] of dfg.nodes) {
      // Check explicit sink annotations
      if (node.isSink && node.sinkKind) {
        const effect = this.fromSinkAnnotation(node);
        if (effect) {
          const key = `${effect.kind}:${effect.target}`;
          if (!seen.has(key)) {
            seen.add(key);
            effects.push(effect);
          }
        }
      }

      // Check code patterns for unannotated side effects
      if (node.kind === "call_result" || node.kind === "field_write") {
        const patternEffects = this.fromCodePatterns(node);
        for (const effect of patternEffects) {
          const key = `${effect.kind}:${effect.target}`;
          if (!seen.has(key)) {
            seen.add(key);
            effects.push(effect);
          }
        }
      }
    }

    return effects;
  }

  private fromSinkAnnotation(node: DFGNode): SideEffect | null {
    if (!node.sinkKind) return null;

    const kindMap: Record<string, SideEffectKind> = {
      database: "db_write",
      sql_execution: "db_write",
      log: "log",
      file_write: "file_io",
      external_api: "api_call",
      http_response: "api_call",
      exec: "file_io",
      eval: "file_io",
    };

    const kind = kindMap[node.sinkKind];
    if (!kind) return null;

    return {
      kind,
      target: node.code,
      description: `${kind}: ${node.code}`,
    };
  }

  private fromCodePatterns(node: DFGNode): SideEffect[] {
    const effects: SideEffect[] = [];

    for (const entry of SideEffectDetector.PATTERNS) {
      for (const pattern of entry.patterns) {
        if (pattern.test(node.code)) {
          effects.push({
            kind: entry.kind,
            target: node.code,
            description: `${entry.kind}: ${node.code}`,
          });
          break; // One match per kind per node
        }
      }
    }

    return effects;
  }
}
