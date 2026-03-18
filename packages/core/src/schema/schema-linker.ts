import type Parser from "tree-sitter";
import type {
  SchemaModel,
  SchemaField,
  SchemaRef,
  SchemaRefKind,
  OrmFramework,
} from "./schema-types.js";
import type { KnowledgeGraph, GraphNode } from "../graph/types.js";
import { v4 as uuid } from "uuid";
import { createLogger } from "../utils/logger.js";

const log = createLogger("schema:linker");

/**
 * Links schema fields to all code references (reads, writes, queries).
 * Tracks through the DFG to find all locations where a schema field is accessed.
 */
export class SchemaLinker {
  /**
   * Find all code references to schema fields.
   */
  linkFields(
    models: SchemaModel[],
    graph: KnowledgeGraph,
    repoId: string,
  ): SchemaRef[] {
    const refs: SchemaRef[] = [];

    for (const model of models) {
      for (const field of model.fields) {
        const fieldRefs = this.findFieldReferences(model, field, graph, repoId);
        refs.push(...fieldRefs);
      }
    }

    log.debug(
      { models: models.length, refs: refs.length },
      "Linked schema fields",
    );
    return refs;
  }

  /**
   * Find all references to a specific field in the codebase.
   */
  private findFieldReferences(
    model: SchemaModel,
    field: SchemaField,
    graph: KnowledgeGraph,
    repoId: string,
  ): SchemaRef[] {
    const refs: SchemaRef[] = [];

    // Search through all function/method nodes
    for (const [, node] of graph.nodes) {
      if (node.kind !== "function" && node.kind !== "method") continue;

      // Check for direct field access patterns
      const accessPatterns = this.buildAccessPatterns(model, field);

      // We check the node signature/metadata for field references
      // In production, this would check the actual AST/DFG nodes
      const ref = this.checkNodeForFieldAccess(
        node,
        model,
        field,
        accessPatterns,
        repoId,
      );
      if (ref) refs.push(ref);
    }

    return refs;
  }

  /**
   * Build regex patterns to detect field access.
   */
  private buildAccessPatterns(
    model: SchemaModel,
    field: SchemaField,
  ): RegExp[] {
    const modelName = model.name;
    const fieldName = field.name;
    const modelLower = modelName.toLowerCase();

    return [
      // Direct property access: user.email, User.email
      new RegExp(`\\b${modelLower}\\.${fieldName}\\b`, "i"),
      // Dictionary access: data['email'], data["email"]
      new RegExp(`\\[['"]${fieldName}['"]\\]`),
      // ORM queries: .where({email: ...}), .findBy({email: ...})
      new RegExp(`\\b${fieldName}\\s*[=:]`, "i"),
      // Column references in raw SQL
      new RegExp(`\\b${fieldName}\\b`, "i"),
    ];
  }

  private checkNodeForFieldAccess(
    node: GraphNode,
    model: SchemaModel,
    field: SchemaField,
    patterns: RegExp[],
    repoId: string,
  ): SchemaRef | null {
    // Check signature for field references
    const codeToCheck = node.signature ?? node.name;

    for (const pattern of patterns) {
      if (pattern.test(codeToCheck)) {
        const refKind = this.inferRefKind(node, field);
        return {
          id: uuid(),
          repoId,
          fieldId: field.id,
          nodeId: node.id,
          refKind,
          filePath: node.filePath,
          line: node.startLine ?? 0,
          code: codeToCheck,
        };
      }
    }

    return null;
  }

  private inferRefKind(node: GraphNode, field: SchemaField): SchemaRefKind {
    const name = node.name.toLowerCase();
    if (
      name.includes("test") ||
      name.includes("spec") ||
      name.includes("fixture")
    )
      return "fixture";
    if (name.includes("migrat")) return "migration";
    if (
      name.includes("create") ||
      name.includes("update") ||
      name.includes("insert") ||
      name.includes("save") ||
      name.includes("write") ||
      name.includes("set")
    ) {
      return "write";
    }
    if (
      name.includes("find") ||
      name.includes("query") ||
      name.includes("where") ||
      name.includes("select") ||
      name.includes("search")
    ) {
      return "query";
    }
    return "read";
  }
}

/**
 * Detects ORM framework in use based on file patterns and imports.
 */
export function detectOrmFramework(
  filePath: string,
  content: string,
): OrmFramework | null {
  if (filePath.endsWith(".prisma")) return "prisma";

  if (content.includes("@Entity") || content.includes("@Column"))
    return "typeorm";
  if (content.includes("Model.init") || content.includes("sequelize.define"))
    return "sequelize";
  if (
    content.includes("pgTable") ||
    content.includes("sqliteTable") ||
    content.includes("mysqlTable")
  )
    return "drizzle";
  if (content.includes("Column(") && content.includes("Base"))
    return "sqlalchemy";
  if (content.includes("models.Model") || content.includes("models.CharField"))
    return "django";

  return null;
}
