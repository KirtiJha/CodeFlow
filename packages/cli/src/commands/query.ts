import { Command } from "commander";
import { resolve } from "node:path";
import { openDatabase } from "@codeflow/core/storage";
import { HybridSearch } from "@codeflow/core/search";
import { formatTable } from "../formatters/table.js";
import { formatJson } from "../formatters/json.js";
import { colorize } from "../formatters/color.js";

export const queryCommand = new Command("query")
  .description("Search the code graph (hybrid keyword + semantic)")
  .argument("<query>", "Search query")
  .option("-n, --limit <n>", "Max results", parseInt, 20)
  .option("--keyword-only", "Use keyword search only")
  .option("--semantic-only", "Use semantic search only")
  .action(async (query, opts, cmd) => {
    const globalOpts = cmd.parent!.opts();
    const repoPath = globalOpts.repo ?? process.cwd();
    const format = globalOpts.format ?? "text";
    const dbPath = resolve(repoPath, ".codeflow", "codeflow.db");

    try {
      const db = openDatabase({ path: dbPath });
      const search = new HybridSearch(db);
      await search.initialize();

      let results;
      if (opts.keywordOnly) {
        results = search.keywordSearch(query, opts.limit).map((r) => ({
          ...r,
          bm25Rank: null,
          semanticRank: null,
        }));
      } else if (opts.semanticOnly) {
        results = search.semanticSearch(query, opts.limit).map((r) => ({
          nodeId: r.nodeId,
          name: r.name,
          qualifiedName: r.qualifiedName,
          filePath: r.filePath,
          score: r.similarity,
          bm25Rank: null,
          semanticRank: null,
        }));
      } else {
        results = search.search(query, opts.limit);
      }

      if (format === "json") {
        console.log(formatJson(results));
      } else {
        if (results.length === 0) {
          console.log(colorize("\n  No results found.\n", "yellow"));
          return;
        }

        console.log(
          colorize(
            `\n  Search: "${query}" (${results.length} results)\n`,
            "cyan",
          ),
        );
        const rows = results.map((r, i) => [
          String(i + 1),
          r.name,
          r.filePath,
          r.score.toFixed(4),
        ]);
        console.log(formatTable(rows, ["#", "Symbol", "File", "Score"]));
      }
    } catch (err) {
      console.error(colorize("Search failed", "red"));
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });
