import { Command } from "commander";

export const serveCommand = new Command("serve")
  .description("Start the CodeFlow HTTP API server")
  .option("-p, --port <number>", "Port to listen on", parseInt, 3100)
  .option("-H, --host <host>", "Host to bind", "127.0.0.1")
  .action(async (opts, cmd) => {
    const globalOpts = cmd.parent!.opts();
    const repoPath = globalOpts.repo ?? process.cwd();

    // Dynamic import to avoid loading server deps at CLI startup
    const { startServer } = await import("@codeflow/server");
    await startServer({ port: opts.port, host: opts.host, repoPath });
  });
