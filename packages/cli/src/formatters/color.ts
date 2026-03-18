import chalk from "chalk";

type Color =
  | "red"
  | "green"
  | "yellow"
  | "cyan"
  | "magenta"
  | "gray"
  | "white"
  | "blue";

/**
 * Apply color to text using chalk.
 */
export function colorize(text: string, color: Color): string {
  return chalk[color](text);
}

/**
 * Bold + color.
 */
export function bold(text: string, color?: Color): string {
  if (color) {
    return chalk.bold[color](text);
  }
  return chalk.bold(text);
}

/**
 * Dim text.
 */
export function dim(text: string): string {
  return chalk.dim(text);
}

/**
 * Severity-colored badge.
 */
export function severityBadge(severity: string): string {
  const upper = severity.toUpperCase();
  switch (severity) {
    case "critical":
      return chalk.bgRed.white(` ${upper} `);
    case "high":
      return chalk.bgYellow.black(` ${upper} `);
    case "medium":
      return chalk.bgCyan.black(` ${upper} `);
    case "low":
      return chalk.bgGreen.black(` ${upper} `);
    default:
      return chalk.bgGray.white(` ${upper} `);
  }
}
