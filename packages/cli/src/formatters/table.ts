import Table from "cli-table3";

/**
 * Format data as a terminal table.
 */
export function formatTable(rows: string[][], headers?: string[]): string {
  const table = new Table({
    head: headers ?? [],
    style: {
      head: ["cyan"],
      border: ["gray"],
    },
    chars: {
      top: "─",
      "top-mid": "┬",
      "top-left": "┌",
      "top-right": "┐",
      bottom: "─",
      "bottom-mid": "┴",
      "bottom-left": "└",
      "bottom-right": "┘",
      left: "│",
      "left-mid": "├",
      mid: "─",
      "mid-mid": "┼",
      right: "│",
      "right-mid": "┤",
      middle: "│",
    },
  });

  for (const row of rows) {
    table.push(row);
  }

  return table.toString();
}
