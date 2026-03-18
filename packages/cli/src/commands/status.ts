import { Command } from "commander";
import { resolve } from "node:path";
import { stat } from "node:fs/promises";
import { openDatabase } from "@codeflow/core/storage";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import { formatTable } from "../formatters/table.js";
import { formatJson } from "../formatters/json.js";
import { colorize } from "../formatters/color.js";

export const statusCommand = new Command("status")
  .description("Show CodeFlow index status and statistics")
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.parent!.opts();
    const repoPath = globalOpts.repo ?? process.cwd();
    const format = globalOpts.format ?? "text";
    const dbPath = resolve(repoPath, ".codeflow", "codeflow.db");

    try {
      await stat(dbPath);
    } catch {
      console.log(
        colorize(
          "\n  No CodeFlow index found. Run `codeflow analyze` first.\n",
          "yellow",
        ),
      );
      return;
    }

    try {
      const db = openDatabase({ path: dbPath });
      const nodeStore = new NodeStore(db);
      const edgeStore = new EdgeStore(db);

      const nodeCount = nodeStore.count();
      const edgeCount = edgeStore.count();
      const fileCount = nodeStore.countByKind("file");
      const functionCount =
        nodeStore.countByKind("function") + nodeStore.countByKind("method");
      const classCount = nodeStore.countByKind("class");
      const communityCount = nodeStore.countByKind("community");

      const dbStat = await stat(dbPath);
      const dbSizeMB = (dbStat.size / (1024 * 1024)).toFixed(1);

      if (format === "json") {
        console.log(
          formatJson({
            dbPath,
            dbSizeMB: parseFloat(dbSizeMB),
            nodeCount,
            edgeCount,
            fileCount,
            functionCount,
            classCount,
            communityCount,
          }),
        );
      } else {
        console.log(colorize("\n  CodeFlow Index Status\n", "cyan"));
        console.log(
          formatTable([
            ["Database", dbPath],
            ["Size", `${dbSizeMB} MB`],
            ["Nodes", String(nodeCount)],
            ["Edges", String(edgeCount)],
            ["Files", String(fileCount)],
            ["Functions", String(functionCount)],
            ["Classes", String(classCount)],
            ["Communities", String(communityCount)],
          ]),
        );
      }
    } catch (err) {
      console.error(colorize("Failed to read index", "red"));
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });
