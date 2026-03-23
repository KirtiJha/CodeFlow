import { Hono } from "hono";
import { openDatabase, initializeSchema } from "@codeflow/core/storage";
import { InMemoryGraph } from "@codeflow/core/graph/knowledge-graph";
import { NodeStore } from "@codeflow/core/storage/node-store";
import { EdgeStore } from "@codeflow/core/storage/edge-store";
import { SchemaStore } from "@codeflow/core/storage";
import { SchemaExtractor } from "@codeflow/core/schema";
import { SchemaLinker } from "@codeflow/core/schema";
import type { SchemaModel } from "@codeflow/core/schema";
import type { AppEnv } from "../types.js";

export const schemaRoutes = new Hono<AppEnv>();

/**
 * Detect model-to-model relationships by checking if a field's type
 * references another model's name (e.g. `userId` → `User`, `order: Order` → `Order`).
 */
function detectModelRelationships(
  models: { name: string; fields: Array<{ name: string; type: string }> }[],
): Array<{ from: string; to: string; field: string; type: string }> {
  const modelNames = new Set<string>();
  const nameToFull = new Map<string, string>();
  for (const m of models) {
    const parts = m.name.split("::");
    const short = parts[parts.length - 1] ?? m.name;
    modelNames.add(short);
    nameToFull.set(short, m.name);
  }

  const relationships: Array<{ from: string; to: string; field: string; type: string }> = [];
  const seen = new Set<string>();

  for (const model of models) {
    const shortName = model.name.split("::").pop()!;
    for (const field of model.fields) {
      const ft = field.type;
      if (!ft || ft === "unknown") continue;

      // Check if field type directly references another model
      for (const targetShort of modelNames) {
        if (targetShort === shortName) continue;
        const fullTarget = nameToFull.get(targetShort);
        if (!fullTarget) continue;

        // Match: exact type, array type, generic type, optional type
        const typePattern = new RegExp(
          `\\b${escapeRegex(targetShort)}\\b`,
          "i",
        );
        if (typePattern.test(ft)) {
          const key = `${model.name}|${fullTarget}|${field.name}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const isArray = /\[]|Array</.test(ft);
          relationships.push({
            from: model.name,
            to: fullTarget,
            field: field.name,
            type: isArray ? "has_many" : "belongs_to",
          });
        }
      }

      // Check naming convention: userId → User, orderId → Order
      const idMatch = field.name.match(/^(.+?)(?:Id|_id)$/);
      if (idMatch?.[1]) {
        const refName = idMatch[1].charAt(0).toUpperCase() + idMatch[1].slice(1);
        const fullRef = nameToFull.get(refName);
        if (fullRef && modelNames.has(refName) && refName !== shortName) {
          const key = `${model.name}|${fullRef}|${field.name}`;
          if (!seen.has(key)) {
            seen.add(key);
            relationships.push({
              from: model.name,
              to: fullRef,
              field: field.name,
              type: "foreign_key",
            });
          }
        }
      }
    }
  }

  return relationships;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

schemaRoutes.get("/schema/models", async (c) => {
  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  initializeSchema(db);
  const schemaStore = new SchemaStore(db);
  const forceRefresh = c.req.query("refresh") === "true";

  // Look up the actual repo ID from the repos table (pipeline uses UUIDs)
  const repoRow = db.prepare("SELECT id FROM repos LIMIT 1").get() as { id: string } | undefined;
  const repoId = repoRow?.id ?? "default";

  // Ensure a repos row exists so FK constraints on schema_models are satisfied
  if (!repoRow) {
    const repoPath = c.get("repoPath") ?? dbPath;
    db.prepare(
      "INSERT OR IGNORE INTO repos (id, name, path, branch) VALUES (?, ?, ?, ?)"
    ).run(repoId, "default", repoPath, "main");
  }

  let models: ReturnType<SchemaStore["getAllModels"]> = [];
  try {
    models = forceRefresh ? [] : schemaStore.getAllModels();
  } catch {
    // Tables may not exist yet
  }

  // Re-extract if no models or forced refresh (clears stale data first)
  if (models.length === 0) {
    if (forceRefresh) {
      try { schemaStore.clearRepo(repoId); } catch { /* table may not exist */ }
    }
    const nodeStore = new NodeStore(db);
    const edgeStore = new EdgeStore(db);

    const graph = new InMemoryGraph();
    for (const n of nodeStore.getAll()) graph.addNode(n);
    for (const e of edgeStore.getAll()) graph.addEdge(e);

    const extractor = new SchemaExtractor();
    models = extractor.extract(graph, repoId);

    if (models.length > 0) {
      try {
        schemaStore.insertModelBatch(models);

        const linker = new SchemaLinker();
        const refs = linker.linkFields(models, graph, repoId);
        if (refs.length > 0) {
          schemaStore.insertRefBatch(refs);
        }
      } catch {
        // Cache write failed — still return extracted models below
      }
    }
  }

  // Build references list from stored refs
  const allRefs = schemaStore.getAllRefs();

  // Map to frontend-expected format
  const frontendModels = models.map((m) => {
    const fieldRefs = new Map<string, number>();
    for (const ref of allRefs) {
      for (const f of m.fields) {
        if (ref.fieldId === f.id) {
          fieldRefs.set(f.id, (fieldRefs.get(f.id) ?? 0) + 1);
        }
      }
    }

    return {
      name: m.name,
      file: m.filePath,
      orm: m.orm,
      line: m.line,
      fields: m.fields.map((f) => ({
        name: f.name,
        type: f.fieldType,
        line: 0,
        referenceCount: fieldRefs.get(f.id) ?? 0,
        nullable: f.nullable,
        primaryKey: f.isPrimary,
        indexed: f.isUnique,
      })),
      references: allRefs
        .filter((r) => m.fields.some((f) => f.id === r.fieldId))
        .map((r) => ({
          file: r.filePath,
          line: r.line,
          kind: r.refKind,
          symbol: r.code,
          from: m.name,
          field: m.fields.find((f) => f.id === r.fieldId)?.name,
        })),
    };
  });

  // Build model-to-model relationships for the graph
  const relationships = detectModelRelationships(frontendModels);

  return c.json({ data: { models: frontendModels, references: relationships } });
});

schemaRoutes.post("/schema/impact", async (c) => {
  const body = await c.req.json();
  const { model, field, action } = body;

  if (!model || !field || !action) {
    return c.json({ error: "model, field, and action required" }, 400);
  }

  const dbPath = c.get("dbPath");
  const db = openDatabase({ path: dbPath });
  initializeSchema(db);
  const schemaStore = new SchemaStore(db);
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);

  const graph = new InMemoryGraph();
  for (const n of nodeStore.getAll()) graph.addNode(n);
  for (const e of edgeStore.getAll()) graph.addEdge(e);

  const models = schemaStore.getAllModels();
  const targetModel = models.find(
    (m) => m.name === model || m.name.endsWith(`.${model}`),
  );

  if (!targetModel) {
    return c.json({ data: { impactedFields: [], migrationSteps: [], references: [], summary: {} } });
  }

  const linker = new SchemaLinker();
  const repoRow = db.prepare("SELECT id FROM repos LIMIT 1").get() as { id: string } | undefined;
  const repoId = repoRow?.id ?? "default";
  const refs = linker.linkFields([targetModel], graph, repoId);

  // Group references by field
  const refsByField = new Map<string, typeof refs>();
  for (const r of refs) {
    const f = targetModel.fields.find((f) => f.id === r.fieldId);
    const fieldName = f?.name ?? r.fieldId;
    if (!refsByField.has(fieldName)) refsByField.set(fieldName, []);
    refsByField.get(fieldName)!.push(r);
  }

  const filteredRefs =
    field === "*"
      ? refs
      : refs.filter((r) => {
          const f = targetModel.fields.find((f) => f.id === r.fieldId);
          return f?.name === field;
        });

  // Only mark fields that actually have code references as impacted
  const impactedFields = [...refsByField.keys()];

  // Build per-field summary
  const fieldSummary: Record<string, { reads: number; writes: number; total: number }> = {};
  for (const [fieldName, fieldRefs] of refsByField) {
    fieldSummary[fieldName] = {
      reads: fieldRefs.filter((r) => r.refKind === "read" || r.refKind === "query").length,
      writes: fieldRefs.filter((r) => r.refKind === "write" || r.refKind === "migration").length,
      total: fieldRefs.length,
    };
  }

  // Find model-to-model relationships for this model
  const allModels = models.map((m) => ({
    name: m.name,
    fields: m.fields.map((f) => ({ name: f.name, type: f.fieldType })),
  }));
  const relationships = detectModelRelationships(allModels)
    .filter((r) => r.from === targetModel.name || r.to === targetModel.name);

  const migrationSteps = buildMigrationSteps(model, field, action, {
    totalRefs: filteredRefs.length,
    writeRefs: filteredRefs.filter((r) => r.refKind === "write").length,
    relationships: relationships.length,
  });

  return c.json({
    data: {
      impactedFields,
      migrationSteps,
      fieldSummary,
      relationships,
      references: filteredRefs.map((r) => ({
        file: r.filePath,
        line: r.line,
        kind: r.refKind,
        symbol: r.code,
      })),
      summary: {
        totalReferences: filteredRefs.length,
        readCount: filteredRefs.filter((r) => r.refKind === "read" || r.refKind === "query").length,
        writeCount: filteredRefs.filter((r) => r.refKind === "write").length,
        migrationCount: filteredRefs.filter((r) => r.refKind === "migration").length,
        connectedModels: relationships.length,
      },
    },
  });
});

function buildMigrationSteps(
  model: string,
  field: string,
  action: string,
  context: { totalRefs: number; writeRefs: number; relationships: number },
): Array<{ type: string; description: string; breaking: boolean }> {
  switch (action) {
    case "remove":
    case "drop":
      return [
        {
          type: "drop_column",
          description: `Remove column '${field}' from '${model}' table`,
          breaking: true,
        },
        {
          type: "update_code",
          description: `Update ${context.totalRefs} code references to '${model}.${field}'`,
          breaking: context.writeRefs > 0,
        },
        ...(context.relationships > 0
          ? [{
              type: "update_references",
              description: `Update ${context.relationships} related model(s) referencing this field`,
              breaking: true,
            }]
          : []),
      ];
    case "rename":
      return [
        {
          type: "rename_column",
          description: `Rename column '${field}' in '${model}' table`,
          breaking: false,
        },
        {
          type: "update_code",
          description: `Update ${context.totalRefs} code references from old to new name`,
          breaking: false,
        },
      ];
    case "analyze":
    default: {
      const steps: Array<{ type: string; description: string; breaking: boolean }> = [];

      if (context.totalRefs > 0) {
        steps.push({
          type: "review_references",
          description: `${context.totalRefs} code locations reference this model's fields`,
          breaking: false,
        });
      }

      if (context.writeRefs > 0) {
        steps.push({
          type: "review_writes",
          description: `${context.writeRefs} locations write to fields (changes here have higher risk)`,
          breaking: false,
        });
      }

      if (context.relationships > 0) {
        steps.push({
          type: "review_relationships",
          description: `${context.relationships} model-to-model relationship(s) detected`,
          breaking: false,
        });
      }

      if (steps.length === 0) {
        steps.push({
          type: "analysis",
          description: `No direct code references found for '${model}'`,
          breaking: false,
        });
      }

      return steps;
    }
  }
}
