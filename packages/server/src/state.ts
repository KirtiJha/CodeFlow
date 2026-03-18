import { resolve } from "node:path";

/** Mutable global state for the currently-active repo */
const activeRepo = {
  repoPath: "",
  dbPath: "",
};

export function setActiveRepo(repoPath: string): void {
  activeRepo.repoPath = repoPath;
  activeRepo.dbPath = resolve(repoPath, ".codeflow", "codeflow.db");
}

export function getActiveRepo(): { repoPath: string; dbPath: string } {
  return activeRepo;
}
