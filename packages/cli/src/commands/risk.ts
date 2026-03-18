import { Command } from "commander";
import { resolve } from "node:path";
import { openDatabase } from "@codeflow/core/storage";
import { InMemoryGraph } from "@codeflow/core/graph/knowledge-graph";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import { RiskScorer } from "@codeflow/core/metrics";
import { formatTable } from "../formatters/table.js";
import { formatJson } from "../formatters/json.js";
import { colorize } from "../formatters/color.js";

export const riskCommand = new Command("risk")
  .description("Show code risk scores")
  .option("-t, --target <symbol>", "Specific symbol to score")
  .option("--top <n>", "Show top N riskiest", parseInt, 20)
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent!.opts();
    const repoPath = globalOpts.repo ?? process.cwd();
    const format = globalOpts.format ?? "text";
    const dbPath = resolve(repoPath, ".codeflow", "codeflow.db");

    try {
      const db = openDatabase({ path: dbPath });
      const nodeStore = new NodeStore(db);
      const edgeStore = new EdgeStore(db);

      const graph = new InMemoryGraph();
      for (const n of nodeStore.getAll()) graph.addNode(n);
      for (const e of edgeStore.getAll()) graph.addEdge(e);

      const scorer = new RiskScorer();

      if (opts.target) {
        const nodes = nodeStore.findByName(opts.target);
        if (nodes.length === 0) {
          console.error(colorize(`Symbol "${opts.target}" not found`, "red"));
          process.exitCode = 1;
          return;
        }
        const result = scorer.score(nodes[0]!.id, graph);
        if (format === "json") {
          console.log(formatJson(result));
        } else {
          console.log(colorize(`\n  Risk Score: ${opts.target}\n`, "cyan"));
          const levelColor =
            result.level === "critical"
              ? "red"
              : result.level === "high"
                ? "yellow"
                : "green";
          console.log(
            `  Score: ${colorize(String(result.score), levelColor)}/100 (${result.level})`,
          );
          console.log(`  ${result.recommendation}\n`);
          const factorRows = [...result.factors.values()].map((f) => [
            f.detail,
            String(Math.round(f.score)),
            String(f.weight),
          ]);
          console.log(formatTable(factorRows, ["Factor", "Value", "Impact"]));
        }
      } else {
        // Score all functions and show top N
        const functions = [...graph.nodes.values()].filter(
          (n) => n.kind === "function" || n.kind === "method",
        );

        const scored = functions
          .map((fn) => {
            try {
              const result = scorer.score(fn.id, graph);
              return { name: fn.qualifiedName ?? fn.name, ...result };
            } catch {
              return null;
            }
          })
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .sort((a, b) => b.score - a.score)
          .slice(0, opts.top);

        if (format === "json") {
          console.log(formatJson(scored));
        } else {
          console.log(
            colorize(`\n  Top ${opts.top} Riskiest Functions\n`, "cyan"),
          );
          const rows = scored.map((s) => {
            const levelColor =
              s.level === "critical"
                ? "red"
                : s.level === "high"
                  ? "yellow"
                  : "green";
            return [s.name, colorize(String(s.score), levelColor), s.level];
          });
          console.log(formatTable(rows, ["Function", "Score", "Level"]));
        }
      }
    } catch (err) {
      console.error(colorize("Risk analysis failed", "red"));
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });
