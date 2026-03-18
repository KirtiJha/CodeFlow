import { Command } from "commander";
import { analyzeCommand } from "./commands/analyze.js";
import { traceCommand } from "./commands/trace.js";
import { branchesCommand } from "./commands/branches.js";
import { testImpactCommand } from "./commands/test-impact.js";
import { securityCommand } from "./commands/security.js";
import { schemaImpactCommand } from "./commands/schema-impact.js";
import { riskCommand } from "./commands/risk.js";
import { queryCommand } from "./commands/query.js";
import { serveCommand } from "./commands/serve.js";
import { mcpCommand } from "./commands/mcp.js";
import { statusCommand } from "./commands/status.js";

const program = new Command();

program
  .name("codeflow")
  .description("CodeFlow — data-aware code intelligence platform")
  .version("0.1.0")
  .option("--repo <path>", "Repository path", process.cwd())
  .option("--format <fmt>", "Output format: text | json | sarif", "text")
  .option("--verbose", "Show detailed progress", false)
  .option("--no-color", "Disable color output");

program.addCommand(analyzeCommand);
program.addCommand(traceCommand);
program.addCommand(branchesCommand);
program.addCommand(testImpactCommand);
program.addCommand(securityCommand);
program.addCommand(schemaImpactCommand);
program.addCommand(riskCommand);
program.addCommand(queryCommand);
program.addCommand(serveCommand);
program.addCommand(mcpCommand);
program.addCommand(statusCommand);

program.parse();
