import { Command } from "commander";

export const mcpCommand = new Command("mcp")
  .description("Start the CodeFlow MCP server (stdio transport)")
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.parent!.opts();
    const repoPath = globalOpts.repo ?? process.cwd();

    // Dynamic import to avoid loading MCP deps at CLI startup
    const { startMcpServer } = await import("@codeflow/mcp");
    await startMcpServer({ repoPath });
  });
