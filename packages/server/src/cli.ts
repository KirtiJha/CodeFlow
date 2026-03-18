import { startServer } from "./index.js";

const repoPath = process.argv[2] || process.cwd();
const port = Number(process.env.PORT) || 3100;
const host = process.env.HOST || "127.0.0.1";

startServer({ repoPath, port, host });
