import { resolve, relative, normalize, sep, posix } from "node:path";

/**
 * Normalize a file path to use forward slashes and resolve relative segments.
 */
export function normalizePath(filePath: string): string {
  return normalize(filePath).split(sep).join(posix.sep);
}

/**
 * Get a workspace-relative path using forward slashes.
 */
export function toRelative(filePath: string, root: string): string {
  const rel = relative(root, filePath);
  return rel.split(sep).join(posix.sep);
}

/**
 * Resolve a relative path against a root to get an absolute path.
 */
export function toAbsolute(relativePath: string, root: string): string {
  return resolve(root, relativePath);
}

/**
 * Check if a path is inside a given root directory.
 */
export function isInsideRoot(filePath: string, root: string): boolean {
  const abs = resolve(filePath);
  const absRoot = resolve(root);
  return abs.startsWith(absRoot + posix.sep) || abs === absRoot;
}

/**
 * Get the directory component of a path.
 */
export function dirName(filePath: string): string {
  const parts = normalizePath(filePath).split("/");
  parts.pop();
  return parts.join("/") || ".";
}

/**
 * Get the file name without extension.
 */
export function baseName(filePath: string): string {
  const name = filePath.split("/").pop() ?? filePath;
  const dotIdx = name.lastIndexOf(".");
  return dotIdx > 0 ? name.substring(0, dotIdx) : name;
}

/**
 * Build a qualified name from file path and symbol (e.g., "src/auth/validate::validateUser").
 */
export function qualifiedName(
  relativePath: string,
  symbolName: string,
): string {
  return `${normalizePath(relativePath)}::${symbolName}`;
}
