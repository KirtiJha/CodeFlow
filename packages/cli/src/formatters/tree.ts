/**
 * Format a path array as a tree structure.
 */
export function formatTree(items: string[], indent: string = "  "): string {
  const lines: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const isLast = i === items.length - 1;
    const prefix = i === 0 ? "" : indent.repeat(i);
    const connector = i === 0 ? "  " : isLast ? "└─ " : "├─ ";
    lines.push(`${prefix}${connector}${items[i]}`);
  }

  return lines.join("\n");
}

/**
 * Format a hierarchical object as a tree.
 */
export function formatObjectTree(
  obj: Record<string, unknown>,
  indent: string = "",
  isLast: boolean = true,
): string {
  const lines: string[] = [];
  const entries = Object.entries(obj);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const [key, value] = entry;
    const last = i === entries.length - 1;
    const connector = last ? "└─ " : "├─ ";
    const childIndent = indent + (last ? "   " : "│  ");

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      lines.push(`${indent}${connector}${key}/`);
      lines.push(
        formatObjectTree(value as Record<string, unknown>, childIndent, last),
      );
    } else {
      lines.push(`${indent}${connector}${key}: ${String(value)}`);
    }
  }

  return lines.join("\n");
}
