import { Command } from "commander";
import { openDatabase } from "@codeflow/core/storage";
import { InMemoryGraph } from "@codeflow/core/graph/knowledge-graph";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import { formatTable } from "../formatters/table.js";
import { formatJson } from "../formatters/json.js";
import { formatTree } from "../formatters/tree.js";
import { colorize } from "../formatters/color.js";
import { resolve } from "node:path";

export const traceCommand = new Command("trace")
  .description("Trace data flow from a source symbol to its sinks")
  .requiredOption("-f, --file <path>", "Source file path")
  .option("-s, --symbol <name>", "Symbol name to trace from")
  .option("-l, --line <number>", "Line number", parseInt)
  .option("-d, --depth <number>", "Max trace depth", parseInt, 5)
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent!.opts();
    const repoPath = globalOpts.repo ?? process.cwd();
    const format = globalOpts.format ?? "text";
    const dbPath = resolve(repoPath, ".codeflow", "codeflow.db");

    try {
      const db = openDatabase({ path: dbPath });
      const nodeStore = new NodeStore(db);
      const edgeStore = new EdgeStore(db);

      // Find the source node
      let sourceNodes;
      if (opts.symbol) {
        sourceNodes = nodeStore.findByName(opts.symbol);
      } else if (opts.line) {
        sourceNodes = nodeStore.findByFileAndLine(opts.file, opts.line);
      } else {
        sourceNodes = nodeStore.findByFile(opts.file);
      }

      if (!sourceNodes || sourceNodes.length === 0) {
        console.error(colorize("No matching symbol found", "red"));
        process.exitCode = 1;
        return;
      }

      // BFS trace through data_flow edges
      const traces: Array<{ path: string[]; depth: number }> = [];
      const visited = new Set<string>();

      const queue: Array<{ nodeId: string; path: string[]; depth: number }> =
        [];
      for (const node of sourceNodes.slice(0, 1)) {
        queue.push({
          nodeId: node.id,
          path: [node.qualifiedName ?? node.name],
          depth: 0,
        });
      }

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.nodeId) || current.depth > opts.depth) continue;
        visited.add(current.nodeId);

        const outgoing = edgeStore.getOutgoing(current.nodeId, "data_flow");
        if (outgoing.length === 0) {
          traces.push({ path: current.path, depth: current.depth });
        }

        for (const edge of outgoing) {
          const target = nodeStore.getById(edge.targetId);
          if (target) {
            queue.push({
              nodeId: target.id,
              path: [...current.path, target.qualifiedName ?? target.name],
              depth: current.depth + 1,
            });
          }
        }
      }

      if (format === "json") {
        console.log(formatJson(traces));
      } else if (format === "text") {
        console.log(
          colorize(`\n  Data Flow Traces (${traces.length} paths):\n`, "cyan"),
        );
        for (const trace of traces) {
          console.log(formatTree(trace.path));
        }
      }
    } catch (err) {
      console.error(colorize("Trace failed", "red"));
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });
