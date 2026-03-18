import { Command } from "commander";
import { resolve } from "node:path";
import { openDatabase } from "@codeflow/core/storage";
import { InMemoryGraph } from "@codeflow/core/graph/knowledge-graph";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import { SchemaLinker } from "@codeflow/core/schema";
import { formatTable } from "../formatters/table.js";
import { formatJson } from "../formatters/json.js";
import { colorize } from "../formatters/color.js";

export const schemaImpactCommand = new Command("schema-impact")
  .description("Analyze the impact of a schema change")
  .requiredOption("-m, --model <name>", "Schema model name")
  .requiredOption("-f, --field <name>", "Field to change")
  .requiredOption("-a, --action <type>", "Action: rename|remove|add")
  .option("--new-name <name>", "New name for rename action")
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

      const linker = new SchemaLinker();
      const references = linker
        .linkFields([], graph, "default")
        .filter(
          (r) => r.code.includes(opts.model) && r.code.includes(opts.field),
        );

      if (format === "json") {
        console.log(
          formatJson({
            model: opts.model,
            field: opts.field,
            action: opts.action,
            references,
          }),
        );
      } else {
        console.log(
          colorize(
            `\n  Schema Impact: ${opts.model}.${opts.field} (${opts.action})\n`,
            "cyan",
          ),
        );

        if (references.length === 0) {
          console.log(colorize("  No references found.\n", "green"));
          return;
        }

        const rows = references.map((ref) => [
          ref.filePath,
          String(ref.line),
          ref.code,
        ]);

        console.log(formatTable(rows, ["File", "Line", "Context"]));
        console.log(
          colorize(
            `\n  ${references.length} references would be affected.\n`,
            "yellow",
          ),
        );
      }
    } catch (err) {
      console.error(colorize("Schema impact analysis failed", "red"));
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });
