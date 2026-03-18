import { Command } from "commander";
import { resolve } from "node:path";
import ora from "ora";
import { openDatabase } from "@codeflow/core/storage";
import { BranchStore } from "@codeflow/core/storage/branch-store";
import { GitClient } from "@codeflow/core/git";
import { BranchScanner } from "@codeflow/core/branches";
import { ConflictDetector } from "@codeflow/core/branches";
import { formatTable } from "../formatters/table.js";
import { formatJson } from "../formatters/json.js";
import { colorize } from "../formatters/color.js";

const SEVERITY_COLORS: Record<string, "green" | "yellow" | "red" | "magenta"> =
  {
    low: "green",
    medium: "yellow",
    high: "red",
    critical: "magenta",
  };

export const branchesCommand = new Command("branches")
  .description("Analyze branch conflicts across all active branches")
  .option(
    "--min-severity <level>",
    "Minimum severity: low|medium|high|critical",
    "low",
  )
  .option("--max-age <days>", "Max branch age in days", parseInt, 30)
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent!.opts();
    const repoPath = globalOpts.repo ?? process.cwd();
    const format = globalOpts.format ?? "text";
    const dbPath = resolve(repoPath, ".codeflow", "codeflow.db");

    const spinner = ora("Scanning branches...").start();

    try {
      const gitClient = new GitClient(repoPath);
      const scanner = new BranchScanner(gitClient.raw(), "default");

      const branches = await scanner.scan({ maxAgeDays: opts.maxAge });
      spinner.text = `Found ${branches.length} branches`;

      spinner.succeed(`Found ${branches.length} branches`);

      // Filter by min severity — conflict detection requires fingerprints not yet built
      const severityOrder = ["low", "medium", "high", "critical"];

      if (format === "json") {
        console.log(formatJson(branches));
      } else {
        if (branches.length === 0) {
          console.log(colorize("\n  No active branches found.\n", "green"));
          return;
        }

        const rows = branches.map((b) => [
          b.branchName,
          b.author,
          b.lastCommitDate,
          String(b.filesChanged.length) + " files",
        ]);

        console.log(
          `\n${formatTable(rows, ["Branch", "Author", "Last Commit", "Changes"])}`,
        );
      }
    } catch (err) {
      spinner.fail(colorize("Branch analysis failed", "red"));
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });
