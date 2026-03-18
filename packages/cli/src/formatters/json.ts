/**
 * Format data as pretty-printed JSON.
 */
export function formatJson(data: unknown): string {
  return JSON.stringify(data, replacer, 2);
}

/**
 * JSON replacer that handles Sets and Maps.
 */
function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Set) {
    return [...value];
  }
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  return value;
}
