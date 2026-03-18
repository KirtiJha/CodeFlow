/**
 * Simple type environment for basic type inference.
 * Tracks variable types within a function scope for DFG construction.
 */
export class TypeEnvironment {
  private readonly scopes: Map<string, string>[] = [new Map()];

  pushScope(): void {
    this.scopes.push(new Map());
  }

  popScope(): void {
    if (this.scopes.length > 1) {
      this.scopes.pop();
    }
  }

  setType(name: string, type: string): void {
    this.currentScope().set(name, type);
  }

  getType(name: string): string | null {
    // Search from innermost scope outward
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const scope = this.scopes[i];
      if (!scope) continue;
      const type = scope.get(name);
      if (type) return type;
    }
    return null;
  }

  /**
   * Infer type from a literal or expression hint.
   */
  inferLiteralType(nodeType: string): string | null {
    switch (nodeType) {
      case "string":
      case "template_string":
        return "string";
      case "number":
      case "integer":
      case "float":
        return "number";
      case "true":
      case "false":
        return "boolean";
      case "null":
        return "null";
      case "undefined":
        return "undefined";
      case "array":
      case "list":
        return "array";
      case "object":
      case "dictionary":
        return "object";
      default:
        return null;
    }
  }

  private currentScope(): Map<string, string> {
    const scope = this.scopes[this.scopes.length - 1];
    if (!scope) {
      const newScope = new Map<string, string>();
      this.scopes.push(newScope);
      return newScope;
    }
    return scope;
  }

  clear(): void {
    this.scopes.length = 1;
    this.scopes[0]?.clear();
  }
}
