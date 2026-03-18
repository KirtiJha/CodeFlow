import { Command } from "commander";
import { resolve } from "node:path";
import { openDatabase } from "@codeflow/core/storage";
import { InMemoryGraph } from "@codeflow/core/graph/knowledge-graph";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import { TestLinker } from "@codeflow/core/tests";
import { formatTable } from "../formatters/table.js";
import { formatJson } from "../formatters/json.js";
import { colorize } from "../formatters/color.js";

export const testImpactCommand = new Command("test-impact")
  .description("Determine which tests to run for a code change")
  .option("-b, --branch <name>", "Branch to compare against main")
  .option("--diff", "Analyze uncommitted changes")
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent!.opts();
    const repoPath = globalOpts.repo ?? process.cwd();
    const format = globalOpts.format ?? "text";
    const dbPath = resolve(repoPath, ".codeflow", "codeflow.db");

    try {
      const db = openDatabase({ path: dbPath });
      const nodeStore = new NodeStore(db);
      const edgeStore = new EdgeStore(db);

      // Build in-memory graph from DB
      const graph = new InMemoryGraph();
      const nodes = nodeStore.getAll();
      const edges = edgeStore.getAll();
      for (const n of nodes) graph.addNode(n);
      for (const e of edges) graph.addEdge(e);

      const linker = new TestLinker();
      const reverseIndex = linker.link([], graph);
      const totalTests = [...graph.nodes.values()].filter(
        (n) => n.metadata?.isTest,
      ).length;
      const impact = linker.computeImpact([], reverseIndex, graph, totalTests);

      if (format === "json") {
        console.log(formatJson(impact));
      } else {
        console.log(colorize(`\n  Test Impact Analysis\n`, "cyan"));
        console.log(
          formatTable([
            ["Tests to Run", String(impact.testsToRun.length)],
            ["Tests Skipped", String(impact.testsSkipped)],
            ["Test Gaps", String(impact.testGaps.length)],
          ]),
        );

        if (impact.testGaps.length > 0) {
          console.log(colorize("\n  Untested functions:", "yellow"));
          for (const gap of impact.testGaps.slice(0, 20)) {
            console.log(`    • ${gap.symbol} (${gap.filePath})`);
          }
          if (impact.testGaps.length > 20) {
            console.log(`    ... and ${impact.testGaps.length - 20} more`);
          }
        }
      }
    } catch (err) {
      console.error(colorize("Test impact analysis failed", "red"));
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });
