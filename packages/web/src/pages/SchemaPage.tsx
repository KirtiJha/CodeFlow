import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import {
  Database, FileCode, GitBranch, Search, X,
} from "lucide-react";
import { SchemaGraph } from "@/components/schema/SchemaGraph";
import { FieldImpactList } from "@/components/schema/FieldImpactList";
import { MigrationPreview } from "@/components/schema/MigrationPreview";
import { SchemaDetailModal } from "@/components/schema/SchemaDetailModal";
import type { ModalView, CodeRef, Relationship } from "@/components/schema/SchemaDetailModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { api } from "@/lib/api-client";
import { PAGE_VARIANTS } from "@/lib/constants";
import type { SchemaModel, SchemaReference } from "@/types/api";

interface ImpactSummary {
  totalReferences: number;
  readCount: number;
  writeCount: number;
  migrationCount: number;
  connectedModels: number;
}

interface FieldSummaryEntry {
  reads: number;
  writes: number;
  total: number;
}

export function SchemaPage() {
  const [models, setModels] = useState<SchemaModel[]>([]);
  const [references, setReferences] = useState<SchemaReference[]>([]);
  const [selectedModel, setSelectedModel] = useState<SchemaModel | null>(null);
  const [impactedFields, setImpactedFields] = useState<string[]>([]);
  const [migrationSteps, setMigrationSteps] = useState<any[]>([]);
  const [impactSummary, setImpactSummary] = useState<ImpactSummary | null>(null);
  const [fieldSummary, setFieldSummary] = useState<Record<string, FieldSummaryEntry>>({});
  const [impactRefs, setImpactRefs] = useState<CodeRef[]>([]);
  const [impactRelationships, setImpactRelationships] = useState<Relationship[]>([]);
  const [modalView, setModalView] = useState<ModalView | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadModels = useCallback(async (refresh = false) => {
    setIsLoading(true);
    try {
      const res = await api.getSchemaModels(refresh);
      setModels((res.data as { models?: SchemaModel[] })?.models ?? []);
      setReferences((res.data as { references?: SchemaReference[] })?.references ?? []);
    } catch {
      // handled by api-client
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleModelSelect = useCallback(async (model: SchemaModel | null) => {
    setSelectedModel(model);
    if (!model) {
      setImpactedFields([]);
      setMigrationSteps([]);
      setImpactSummary(null);
      setFieldSummary({});
      setImpactRefs([]);
      setImpactRelationships([]);
      return;
    }
    try {
      const impactRes = await api.schemaImpact(model.name, "*", "analyze");
      const d = impactRes.data as Record<string, unknown>;
      setImpactedFields((d?.impactedFields as string[]) ?? []);
      setMigrationSteps((d?.migrationSteps as unknown[]) ?? []);
      setImpactSummary((d?.summary as ImpactSummary) ?? null);
      setFieldSummary((d?.fieldSummary as Record<string, FieldSummaryEntry>) ?? {});
      setImpactRefs((d?.references as CodeRef[]) ?? []);
      setImpactRelationships((d?.relationships as Relationship[]) ?? []);
    } catch {
      setImpactedFields([]);
      setMigrationSteps([]);
      setImpactSummary(null);
      setFieldSummary({});
      setImpactRefs([]);
      setImpactRelationships([]);
    }
  }, []);

  /** Extract short name from qualified "path::Name" */
  const shortName = (full: string) => {
    const parts = full.split("::");
    return parts[parts.length - 1];
  };

  const filteredModels = searchQuery
    ? models.filter((m) =>
        shortName(m.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.file?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : models;

  return (
    <motion.div
      variants={PAGE_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex h-full flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-text-primary">
            Schema Impact
          </h2>
          {models.length > 0 && (
            <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs text-text-muted">
              {models.length} models
            </span>
          )}
          {references.length > 0 && (
            <span className="rounded-full bg-accent-purple/10 px-2 py-0.5 text-xs text-accent-purple">
              {references.length} relationships
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-48 rounded-lg border border-border-default bg-bg-surface pl-7 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
            />
          </div>
          <button
            onClick={() => loadModels(true)}
            disabled={isLoading}
            className="rounded-lg bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:bg-bg-elevated disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : models.length > 0 ? (
          <Allotment>
            {/* Schema graph */}
            <Allotment.Pane minSize={400}>
              <div className="h-full w-full">
                <SchemaGraph
                  models={filteredModels}
                  references={references}
                  selectedModel={selectedModel?.name}
                  onModelSelect={handleModelSelect}
                />
              </div>
            </Allotment.Pane>

            {/* Detail panel */}
            <Allotment.Pane minSize={300} preferredSize={400}>
              <div className="flex h-full flex-col border-l border-border-default overflow-auto">
                {selectedModel ? (
                  <>
                    {/* Model header */}
                    <div className="border-b border-border-default px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-accent-purple" />
                        <div className="flex-1 text-sm font-semibold text-text-primary truncate">
                          {shortName(selectedModel.name)}
                        </div>
                        <button
                          onClick={() => handleModelSelect(null)}
                          className="rounded-lg p-1 text-text-muted transition hover:bg-bg-elevated hover:text-text-primary"
                          title="Close panel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                        <FileCode className="h-3 w-3" />
                        <span className="truncate">{selectedModel.file}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <span className="text-text-secondary">
                          {selectedModel.fields.length} fields
                        </span>
                        {impactSummary && impactSummary.totalReferences > 0 && (
                          <span className="text-accent-amber">
                            {impactSummary.totalReferences} refs
                          </span>
                        )}
                        {impactSummary && impactSummary.connectedModels > 0 && (
                          <span className="flex items-center gap-1 text-accent-purple">
                            <GitBranch className="h-3 w-3" />
                            {impactSummary.connectedModels} linked
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Impact summary bar */}
                    {impactSummary && impactSummary.totalReferences > 0 && (
                      <div className="border-b border-border-default px-4 py-2 bg-bg-elevated/50">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <button
                            onClick={() => setModalView({ kind: "reads", refs: impactRefs })}
                            className="rounded-lg py-1 transition hover:bg-accent-blue/10 cursor-pointer"
                          >
                            <div className="text-sm font-semibold text-accent-blue">
                              {impactSummary.readCount}
                            </div>
                            <div className="text-[10px] text-text-muted">Reads</div>
                          </button>
                          <button
                            onClick={() => setModalView({ kind: "writes", refs: impactRefs })}
                            className="rounded-lg py-1 transition hover:bg-accent-amber/10 cursor-pointer"
                          >
                            <div className="text-sm font-semibold text-accent-amber">
                              {impactSummary.writeCount}
                            </div>
                            <div className="text-[10px] text-text-muted">Writes</div>
                          </button>
                          <button
                            onClick={() => setModalView({ kind: "relations", relationships: impactRelationships, modelName: selectedModel.name })}
                            className="rounded-lg py-1 transition hover:bg-accent-purple/10 cursor-pointer"
                          >
                            <div className="text-sm font-semibold text-accent-purple">
                              {impactSummary.connectedModels}
                            </div>
                            <div className="text-[10px] text-text-muted">Relations</div>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex-1 overflow-auto p-4 space-y-6">
                      <FieldImpactList
                        fields={selectedModel.fields}
                        impactedFields={impactedFields}
                        fieldSummary={fieldSummary}
                        onFieldClick={(field) =>
                          setModalView({
                            kind: "field",
                            fieldName: field.name,
                            type: field.type,
                            refs: impactRefs.filter((r) => r.symbol.includes(field.name)),
                            summary: fieldSummary[field.name] ?? null,
                            isPK: field.primaryKey,
                            isIndexed: field.indexed,
                            nullable: field.nullable,
                          })
                        }
                      />

                      {migrationSteps.length > 0 && (
                        <MigrationPreview
                          steps={migrationSteps}
                          onStepClick={(step) =>
                            setModalView({
                              kind: "finding",
                              step: {
                                type: step.type,
                                description: step.details ?? step.description ?? "",
                                breaking: step.breaking === true,
                              },
                              refs: impactRefs,
                              relationships: impactRelationships,
                              modelName: selectedModel?.name,
                            })
                          }
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-text-muted">
                    <Database className="h-8 w-8 opacity-30" />
                    <span className="text-sm">Select a model to view details</span>
                    <span className="text-xs">Click any node in the graph</span>
                  </div>
                )}
              </div>
            </Allotment.Pane>
          </Allotment>
        ) : (
          <EmptyState
            icon="database"
            title="Schema Analysis"
            description="No schema models found. Analyze a repository with ORM models or database schemas."
          />
        )}
      </div>

      {/* Detail modal */}
      <SchemaDetailModal view={modalView} onClose={() => setModalView(null)} />
    </motion.div>
  );
}
