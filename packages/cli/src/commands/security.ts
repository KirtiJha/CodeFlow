import { Command } from "commander";
import { resolve } from "node:path";
import ora from "ora";
import { openDatabase } from "@codeflow/core/storage";
import { InMemoryGraph } from "@codeflow/core/graph/knowledge-graph";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import {
  TaintEngine,
  SourceRegistry,
  SinkRegistry,
  SanitizerRegistry,
} from "@codeflow/core/taint";
import type { TaintFlow, SecurityScanResult } from "@codeflow/core/taint";
import { formatTable } from "../formatters/table.js";
import { formatJson } from "../formatters/json.js";
import { colorize } from "../formatters/color.js";

export const securityCommand = new Command("security")
  .description("Run security vulnerability scan (taint analysis)")
  .option("-p, --path <path>", "Limit scan to a specific path")
  .option(
    "-s, --severity <level>",
    "Min severity: critical|warning|info",
    "warning",
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent!.opts();
    const repoPath = globalOpts.repo ?? process.cwd();
    const format = globalOpts.format ?? "text";
    const dbPath = resolve(repoPath, ".codeflow", "codeflow.db");

    const spinner = ora("Running security scan...").start();

    try {
      const db = openDatabase({ path: dbPath });
      const nodeStore = new NodeStore(db);
      const edgeStore = new EdgeStore(db);

      const graph = new InMemoryGraph();
      const nodes = nodeStore.getAll();
      const edges = edgeStore.getAll();
      for (const n of nodes) graph.addNode(n);
      for (const e of edges) graph.addEdge(e);

      const engine = new TaintEngine(
        new SourceRegistry(),
        new SinkRegistry(),
        new SanitizerRegistry(),
      );
      const result: SecurityScanResult = engine.scan(new Map(), "default");

      // Filter by severity
      const severityOrder = ["info", "warning", "critical"];
      const minIdx = severityOrder.indexOf(opts.severity);
      const filtered = result.flows.filter(
        (f: TaintFlow) => severityOrder.indexOf(f.severity) >= minIdx,
      );

      // Filter by path
      const flows = opts.path
        ? filtered.filter((f: TaintFlow) =>
            f.path?.[0]?.filePath?.startsWith(opts.path),
          )
        : filtered;

      spinner.succeed(`Found ${flows.length} security issues`);

      if (format === "json" || format === "sarif") {
        console.log(formatJson(flows));
      } else {
        if (flows.length === 0) {
          console.log(colorize("\n  No security issues found.\n", "green"));
          return;
        }

        const critical = flows.filter(
          (f: TaintFlow) => f.severity === "critical",
        );
        const warning = flows.filter(
          (f: TaintFlow) => f.severity === "warning",
        );
        const info = flows.filter((f: TaintFlow) => f.severity === "info");

        console.log(
          `\n  ${colorize(`${critical.length} critical`, "red")} | ${colorize(`${warning.length} warning`, "yellow")} | ${colorize(`${info.length} info`, "cyan")}\n`,
        );

        for (const flow of flows.slice(0, 30)) {
          const color =
            flow.severity === "critical"
              ? "red"
              : flow.severity === "warning"
                ? "yellow"
                : "cyan";
          const srcFile = flow.path?.[0]?.filePath ?? "?";
          const srcLine = flow.path?.[0]?.line ?? "?";
          console.log(
            `  ${colorize(`[${flow.severity.toUpperCase()}]`, color)} ${flow.category}: ${srcFile}:${srcLine}`,
          );
          console.log(
            `    Source → Sink: ${flow.sourceDfgNodeId} → ${flow.sinkDfgNodeId}`,
          );
          if (flow.fixSuggestion) console.log(`    Fix: ${flow.fixSuggestion}`);
          console.log();
        }

        if (flows.length > 30) {
          console.log(`  ... and ${flows.length - 30} more issues`);
        }
      }
    } catch (err) {
      spinner.fail(colorize("Security scan failed", "red"));
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });
