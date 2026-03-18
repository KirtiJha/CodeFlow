import type Parser from "tree-sitter";
import type { SimpleGit } from "simple-git";
import type {
  BranchFingerprint,
  BranchSnapshot,
  SymbolDiff,
  SignatureDiff,
} from "./conflict-types.js";
import type { CodeParser } from "../parsing/parser.js";
import type { Language } from "../graph/types.js";
import { detectLanguage } from "../utils/language-detect.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("branches:diff-analyzer");

/**
 * Creates BranchFingerprints by comparing branch versions with tree-sitter AST diffing.
 */
export class DiffAnalyzer {
  constructor(
    private readonly git: SimpleGit,
    private readonly parser: CodeParser,
  ) {}

  /**
   * Build a fingerprint for a branch by comparing each changed file
   * against the base branch version.
   */
  async fingerprint(
    snapshot: BranchSnapshot,
    baseBranch: string,
  ): Promise<BranchFingerprint> {
    const fp: BranchFingerprint = {
      filesChanged: new Set(snapshot.filesChanged),
      symbolsAdded: new Set(),
      symbolsRemoved: new Set(),
      symbolsModified: new Map(),
      signaturesChanged: new Map(),
      summariesChanged: new Map(),
      schemasChanged: new Map(),
    };

    for (const filePath of snapshot.filesChanged) {
      const lang = detectLanguage(filePath);
      if (!lang) continue;

      try {
        const baseContent = await this.getFileContent(baseBranch, filePath);
        const branchContent = await this.getFileContent(
          snapshot.branchName,
          filePath,
        );

        if (baseContent === null && branchContent !== null) {
          // New file — all symbols are added
          const symbols = this.extractSymbolNames(branchContent, lang);
          for (const sym of symbols) {
            fp.symbolsAdded.add(`${filePath}::${sym}`);
          }
        } else if (baseContent !== null && branchContent === null) {
          // Deleted file — all symbols are removed
          const symbols = this.extractSymbolNames(baseContent, lang);
          for (const sym of symbols) {
            fp.symbolsRemoved.add(`${filePath}::${sym}`);
          }
        } else if (baseContent !== null && branchContent !== null) {
          // Modified file — diff symbols
          this.diffFileSymbols(filePath, baseContent, branchContent, lang, fp);
        }
      } catch (err) {
        log.warn({ file: filePath, err }, "Failed to fingerprint file");
      }
    }

    log.debug(
      {
        branch: snapshot.branchName,
        added: fp.symbolsAdded.size,
        removed: fp.symbolsRemoved.size,
        modified: fp.symbolsModified.size,
      },
      "Branch fingerprinted",
    );

    return fp;
  }

  /**
   * Get file content from a specific git ref.
   */
  private async getFileContent(
    ref: string,
    filePath: string,
  ): Promise<string | null> {
    try {
      return await this.git.show([`origin/${ref}:${filePath}`]);
    } catch {
      return null;
    }
  }

  /**
   * Extract symbol names from a file using tree-sitter.
   */
  private extractSymbolNames(content: string, language: Language): string[] {
    const tree = this.parser.parseContent(content, language);
    if (!tree) return [];

    const symbols: string[] = [];
    this.walkForSymbols(tree.rootNode, symbols);
    return symbols;
  }

  /**
   * Walk the AST to find function/class/method declarations.
   */
  private walkForSymbols(node: Parser.SyntaxNode, symbols: string[]): void {
    const declarationTypes = new Set([
      "function_declaration",
      "function_definition",
      "method_definition",
      "method_declaration",
      "class_declaration",
      "class_definition",
      "interface_declaration",
      "type_alias_declaration",
      "enum_declaration",
      "struct_item",
      "impl_item",
    ]);

    if (declarationTypes.has(node.type)) {
      const nameNode = node.childForFieldName("name");
      if (nameNode) {
        symbols.push(nameNode.text);
      }
    }

    for (const child of node.namedChildren) {
      this.walkForSymbols(child, symbols);
    }
  }

  /**
   * Diff symbols between base and branch versions of a file.
   */
  private diffFileSymbols(
    filePath: string,
    baseContent: string,
    branchContent: string,
    language: Language,
    fp: BranchFingerprint,
  ): void {
    const baseSymbols = new Set(this.extractSymbolNames(baseContent, language));
    const branchSymbols = new Set(
      this.extractSymbolNames(branchContent, language),
    );

    // Added symbols
    for (const sym of branchSymbols) {
      if (!baseSymbols.has(sym)) {
        fp.symbolsAdded.add(`${filePath}::${sym}`);
      }
    }

    // Removed symbols
    for (const sym of baseSymbols) {
      if (!branchSymbols.has(sym)) {
        fp.symbolsRemoved.add(`${filePath}::${sym}`);
      }
    }

    // Modified symbols (exist in both — compare content)
    for (const sym of baseSymbols) {
      if (!branchSymbols.has(sym)) continue;

      const qn = `${filePath}::${sym}`;

      const baseSrc = this.extractSymbolSource(baseContent, language, sym);
      const branchSrc = this.extractSymbolSource(branchContent, language, sym);

      if (baseSrc && branchSrc && baseSrc !== branchSrc) {
        const baseLines = baseSrc.split("\n").length;
        const branchLines = branchSrc.split("\n").length;

        fp.symbolsModified.set(qn, {
          qualifiedName: qn,
          kind: "modified",
          linesAdded: Math.max(0, branchLines - baseLines),
          linesRemoved: Math.max(0, baseLines - branchLines),
        });

        // Check for signature changes
        const baseSig = this.extractSignature(baseSrc);
        const branchSig = this.extractSignature(branchSrc);

        if (baseSig && branchSig && baseSig !== branchSig) {
          fp.signaturesChanged.set(qn, {
            qualifiedName: qn,
            beforeParams: this.parseParams(baseSig),
            afterParams: this.parseParams(branchSig),
          });
        }
      }
    }
  }

  /**
   * Extract the source text of a specific symbol from file content.
   */
  private extractSymbolSource(
    content: string,
    language: Language,
    symbolName: string,
  ): string | null {
    const tree = this.parser.parseContent(content, language);
    if (!tree) return null;

    const node = this.findSymbolNode(tree.rootNode, symbolName);
    return node?.text ?? null;
  }

  private findSymbolNode(
    node: Parser.SyntaxNode,
    name: string,
  ): Parser.SyntaxNode | null {
    const nameNode = node.childForFieldName("name");
    if (nameNode?.text === name) return node;

    for (const child of node.namedChildren) {
      const found = this.findSymbolNode(child, name);
      if (found) return found;
    }
    return null;
  }

  /**
   * Extract function signature string (params portion).
   */
  private extractSignature(source: string): string | null {
    const match = source.match(/\(([^)]*)\)/);
    return match ? (match[1] ?? null) : null;
  }

  /**
   * Parse a signature string into param info.
   */
  private parseParams(
    sig: string,
  ): Array<{
    name: string;
    type?: string;
    optional: boolean;
    defaultValue?: string;
  }> {
    if (!sig.trim()) return [];

    return sig.split(",").map((p) => {
      const trimmed = p.trim();
      const hasDefault = trimmed.includes("=");
      const hasOptional = trimmed.includes("?");
      const parts = trimmed.split(/[:=?]/);

      return {
        name: parts[0]?.trim() ?? "",
        type: parts.length > 1 ? parts[1]?.trim() : undefined,
        optional: hasOptional || hasDefault,
        defaultValue: hasDefault ? trimmed.split("=")[1]?.trim() : undefined,
      };
    });
  }
}
