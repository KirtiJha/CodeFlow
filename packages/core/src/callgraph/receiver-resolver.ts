import type { ExtractedCall } from "../graph/types.js";
import type { SymbolTable, SymbolEntry } from "../symbols/symbol-table.js";
import type { TypeEnvironment } from "../symbols/type-inference.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("callgraph:receiver");

/**
 * Resolves receiver types for method calls.
 * Uses DFG-informed type environment for narrowing rather than just constructor inference.
 */
export class ReceiverResolver {
  constructor(
    private readonly symbolTable: SymbolTable,
    private readonly typeEnv: TypeEnvironment,
  ) {}

  /**
   * Build a receiver type map for all method calls in a file.
   * Returns receiverName → typeName.
   */
  resolveReceivers(
    calls: ExtractedCall[],
    filePath: string,
  ): Map<string, string> {
    const result = new Map<string, string>();

    for (const call of calls) {
      if (!call.isMethodCall || !call.receiverName) continue;
      if (result.has(call.receiverName)) continue;

      const type = this.resolveReceiverType(call.receiverName, filePath);
      if (type) {
        result.set(call.receiverName, type);
      }
    }

    log.debug({ file: filePath, count: result.size }, "Resolved receivers");
    return result;
  }

  /**
   * Determine the type of a receiver variable using multiple strategies.
   */
  private resolveReceiverType(
    receiverName: string,
    filePath: string,
  ): string | null {
    // Strategy 1: Type environment (from DFG analysis)
    const envType = this.typeEnv.getType(receiverName);
    if (envType) return envType;

    // Strategy 2: Constructor inference — if the variable was assigned via `new X()`
    const constructorType = this.inferFromConstructor(receiverName, filePath);
    if (constructorType) return constructorType;

    // Strategy 3: Static method calls — receiver is the class name itself
    const staticType = this.resolveStaticReceiver(receiverName, filePath);
    if (staticType) return staticType;

    // Strategy 4: Parameter type annotation
    const paramType = this.resolveFromParamAnnotation(receiverName, filePath);
    if (paramType) return paramType;

    return null;
  }

  /**
   * Check if the receiver was assigned via `new ClassName()`.
   */
  private inferFromConstructor(name: string, filePath: string): string | null {
    const fileSymbols = this.symbolTable.getByFile(filePath);

    // Look for variable declarations that assign `new X()`
    // This is heuristic: we check if a class with this name exists
    for (const sym of fileSymbols) {
      if (sym.kind === "const" || sym.kind === "property") {
        // The variable's type annotation might give us the class
        if (sym.name === name && sym.returnType) {
          return sym.returnType;
        }
      }
    }
    return null;
  }

  /**
   * Check if the receiver is a known class name (static method call).
   */
  private resolveStaticReceiver(name: string, filePath: string): string | null {
    // Check same-file classes first
    const fileSymbols = this.symbolTable.getByFile(filePath);
    for (const sym of fileSymbols) {
      if (
        sym.name === name &&
        (sym.kind === "class" || sym.kind === "struct" || sym.kind === "enum")
      ) {
        return name;
      }
    }

    // Check global classes
    const globals = this.symbolTable.lookupByName(name);
    for (const sym of globals) {
      if (sym.kind === "class" || sym.kind === "struct") {
        return name;
      }
    }

    return null;
  }

  /**
   * Check function parameters for type annotations.
   */
  private resolveFromParamAnnotation(
    name: string,
    filePath: string,
  ): string | null {
    const fileSymbols = this.symbolTable.getByFile(filePath);

    for (const sym of fileSymbols) {
      if (sym.kind === "function" || sym.kind === "method") {
        // Check if a param with this name has a type annotation
        // Params would be stored in the symbol's signature
        if (sym.signature) {
          const paramMatch = sym.signature.match(
            new RegExp(`${name}\\s*:\\s*([A-Z][A-Za-z0-9_]+)`),
          );
          if (paramMatch) return paramMatch[1] ?? null;
        }
      }
    }

    return null;
  }
}
