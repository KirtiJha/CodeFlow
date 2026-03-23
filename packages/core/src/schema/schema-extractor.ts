import { v4 as uuid } from "uuid";
import { detectOrmFramework } from "./schema-linker.js";
import type {
  SchemaModel,
  SchemaField,
  OrmFramework,
} from "./schema-types.js";
import type { KnowledgeGraph, GraphNode } from "../graph/types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("schema:extractor");

/**
 * Extracts schema models from the knowledge graph.
 *
 * Strategy:
 * 1. Find class/interface/struct/type_alias nodes whose names or file paths
 *    match ORM/schema patterns (e.g. Prisma models, TypeORM entities,
 *    Django models, Sequelize definitions).
 * 2. Collect their child property/method nodes (via "contains" edges) as fields.
 * 3. Fall back to heuristic detection for plain class/interface nodes that
 *    look like data models (>= 2 property children, no complex methods).
 */
export class SchemaExtractor {
  extract(
    graph: KnowledgeGraph,
    repoId: string,
    fileContents?: Map<string, string>,
  ): SchemaModel[] {
    const models: SchemaModel[] = [];
    const seen = new Set<string>();

    // 1. ORM-detected models (high confidence)
    if (fileContents) {
      for (const [filePath, content] of fileContents) {
        const orm = detectOrmFramework(filePath, content);
        if (!orm) continue;

        const fileNodes = graph.getNodesByFile(filePath);
        for (const node of fileNodes) {
          if (!isModelCandidate(node)) continue;
          if (seen.has(node.id)) continue;
          seen.add(node.id);

          const fields = this.extractFields(node, graph);
          if (fields.length === 0) continue;

          models.push(buildModel(node, orm, repoId, fields));
        }
      }
    }

    // 2. Graph-only heuristic: class/interface nodes with property children
    for (const kind of ["class", "interface", "struct"] as const) {
      for (const node of graph.getNodesByKind(kind)) {
        if (seen.has(node.id)) continue;

        const fields = this.extractFields(node, graph);
        if (fields.length < 2) continue;

        // Skip nodes that look like service/controller/util classes
        if (isServiceLike(node.name)) continue;

        seen.add(node.id);
        const orm = guessOrmFromNode(node);
        models.push(buildModel(node, orm, repoId, fields));
      }
    }

    log.debug({ count: models.length }, "Extracted schema models");
    return models;
  }

  private extractFields(
    modelNode: GraphNode,
    graph: KnowledgeGraph,
  ): SchemaField[] {
    const fields: SchemaField[] = [];
    const containsEdges = graph.getOutgoingEdges(modelNode.id, "contains");

    for (const edge of containsEdges) {
      const child = graph.nodes.get(edge.targetId);
      if (!child) continue;

      if (child.kind === "property" || child.kind === "const" || child.kind === "static") {
        fields.push(nodeToField(child, modelNode.id));
      }
    }

    // If no contains edges, try member_of edges (incoming)
    if (fields.length === 0) {
      const memberEdges = graph.getIncomingEdges(modelNode.id, "member_of");
      for (const edge of memberEdges) {
        const child = graph.nodes.get(edge.sourceId);
        if (!child) continue;
        if (child.kind === "property" || child.kind === "method") {
          fields.push(nodeToField(child, modelNode.id));
        }
      }
    }

    return fields;
  }
}

// ── Helpers ─────────────────────────────────────────────────────

function isModelCandidate(node: GraphNode): boolean {
  return (
    node.kind === "class" ||
    node.kind === "interface" ||
    node.kind === "struct" ||
    node.kind === "type_alias"
  );
}

const SERVICE_PATTERNS =
  /^(.*?(Service|Controller|Handler|Middleware|Router|Module|Factory|Provider|Guard|Interceptor|Pipe|Filter|Logger|Config|Manager|Util|Helper|Plugin|Extension|Adapter|Client|Worker|Queue|Cache|Store|Repository|Resolver))$/i;

function isServiceLike(name: string): boolean {
  return SERVICE_PATTERNS.test(name);
}

function guessOrmFromNode(node: GraphNode): OrmFramework {
  const fp = node.filePath.toLowerCase();
  if (fp.includes("prisma") || fp.endsWith(".prisma")) return "prisma";
  if (fp.includes("entity") || fp.includes("entities")) return "typeorm";
  if (fp.includes("model") || fp.includes("models")) return "raw_sql";
  if (fp.includes("schema")) return "raw_sql";
  return "raw_sql";
}

function nodeToField(node: GraphNode, modelId: string): SchemaField {
  const name = node.name;
  const sig = node.signature ?? "";
  const typeAnno = (node.metadata?.typeAnnotation as string) ?? "";
  const fieldType = extractType(sig, node.returnType, typeAnno);

  return {
    id: uuid(),
    modelId,
    name,
    fieldType,
    nullable: sig.includes("?") || sig.toLowerCase().includes("null") || typeAnno.includes("null"),
    isPrimary: /\b(id|_id|pk|primary)\b/i.test(name),
    isUnique: /\b(email|slug|username|unique)\b/i.test(name),
  };
}

function extractType(signature: string, returnType?: string, typeAnnotation?: string): string {
  if (typeAnnotation && typeAnnotation !== "void") return typeAnnotation;
  if (returnType && returnType !== "void") return returnType;
  // Try to parse "name: Type" from signature
  const match = signature.match(/:\s*([A-Za-z_][\w<>\[\]|&?,\s]*)/);
  if (match?.[1]) return match[1].trim();
  return "unknown";
}

function buildModel(
  node: GraphNode,
  orm: OrmFramework,
  repoId: string,
  fields: SchemaField[],
): SchemaModel {
  const modelId = uuid();
  // Rebind field modelId so it matches the actual schema_models PK
  for (const f of fields) f.modelId = modelId;
  return {
    id: modelId,
    repoId,
    name: node.qualifiedName ?? node.name,
    orm,
    filePath: node.filePath,
    line: node.startLine ?? 0,
    fields,
  };
}
