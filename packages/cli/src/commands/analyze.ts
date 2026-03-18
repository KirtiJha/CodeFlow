import { Command } from "commander";
import ora from "ora";
import { Pipeline } from "@codeflow/core/pipeline";
import type { PipelinePhase, Language } from "@codeflow/core/graph/types";
import { formatTable } from "../formatters/table.js";
import { formatJson } from "../formatters/json.js";
import { colorize } from "../formatters/color.js";

export const analyzeCommand = new Command("analyze")
  .description("Index a repository — run the full 12-phase analysis pipeline")
  .option("-l, --languages <langs...>", "Languages to analyze")
  .option("--no-cfg", "Skip CFG construction")
  .option("--no-dfg", "Skip DFG construction")
  .option("--no-taint", "Skip taint analysis")
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent!.opts();
    const repoPath = globalOpts.repo ?? process.cwd();
    const format = globalOpts.format ?? "text";

    const spinner = ora("Analyzing repository...").start();

    const pipeline = new Pipeline({
      repoPath,
      languages: opts.languages as Language[] | undefined,
      enableCfg: opts.cfg !== false,
      enableDfg: opts.dfg !== false,
      enableTaint: opts.taint !== false,
      onProgress: (phase: PipelinePhase, pct: number, message: string) => {
        spinner.text = `[${phase}] ${Math.round(pct)}% — ${message}`;
      },
    });

    try {
      const result = await pipeline.run();
      spinner.succeed(colorize("Analysis complete!", "green"));

      if (format === "json") {
        console.log(formatJson(result.stats));
      } else {
        console.log(
          formatTable([
            ["Files", String(result.stats.files)],
            ["Symbols", String(result.stats.symbols)],
            ["Functions", String(result.stats.functions)],
            ["Edges", String(result.stats.edges)],
            ["Communities", String(result.stats.communities)],
            ["Processes", String(result.stats.processes)],
            ["Data Flows", String(result.stats.dataFlows)],
            ["Test Mappings", String(result.stats.testMappings)],
            ["Schema Models", String(result.stats.schemaModels)],
            ["Taint Flows", String(result.stats.taintFlows)],
            ["Duration", `${(result.stats.durationMs / 1000).toFixed(1)}s`],
          ]),
        );
        console.log(`\n  DB: ${result.dbPath}`);
      }
    } catch (err) {
      spinner.fail(colorize("Analysis failed", "red"));
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });
