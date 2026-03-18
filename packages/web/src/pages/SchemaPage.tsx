import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { SchemaGraph } from "@/components/schema/SchemaGraph";
import { FieldImpactList } from "@/components/schema/FieldImpactList";
import { MigrationPreview } from "@/components/schema/MigrationPreview";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { api } from "@/lib/api-client";
import { PAGE_VARIANTS } from "@/lib/constants";
import type { SchemaModel, SchemaReference } from "@/types/api";

export function SchemaPage() {
  const [models, setModels] = useState<SchemaModel[]>([]);
  const [references, setReferences] = useState<SchemaReference[]>([]);
  const [selectedModel, setSelectedModel] = useState<SchemaModel | null>(null);
  const [impactedFields, setImpactedFields] = useState<string[]>([]);
  const [migrationSteps, setMigrationSteps] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.getSchemaModels();
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

  const handleModelSelect = useCallback(async (model: SchemaModel) => {
    setSelectedModel(model);
    try {
      const impactRes = await api.schemaImpact(model.name, "*", "analyze");
      setImpactedFields((impactRes.data as { impactedFields?: string[] })?.impactedFields ?? []);
      setMigrationSteps((impactRes.data as { migrationSteps?: unknown[] })?.migrationSteps ?? []);
    } catch {
      setImpactedFields([]);
      setMigrationSteps([]);
    }
  }, []);

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
        <h2 className="text-sm font-semibold text-text-primary">
          Schema Models
          {models.length > 0 && (
            <span className="ml-2 text-text-muted">({models.length})</span>
          )}
        </h2>
        <button
          onClick={loadModels}
          disabled={isLoading}
          className="rounded-lg bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:bg-bg-elevated disabled:opacity-50"
        >
          Refresh
        </button>
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
              <SchemaGraph
                models={models}
                references={references}
                selectedModel={selectedModel?.name}
                onModelSelect={handleModelSelect}
              />
            </Allotment.Pane>

            {/* Detail panel */}
            <Allotment.Pane minSize={280} preferredSize={380}>
              <div className="flex h-full flex-col border-l border-border-default overflow-auto">
                {selectedModel ? (
                  <>
                    <div className="border-b border-border-default px-4 py-3">
                      <div className="text-sm font-semibold text-text-primary">
                        {selectedModel.name}
                      </div>
                      <div className="text-xs text-text-muted">
                        {selectedModel.fields.length} fields
                        {selectedModel.file && ` · ${selectedModel.file}`}
                      </div>
                    </div>

                    <div className="flex-1 overflow-auto p-4 space-y-6">
                      <FieldImpactList
                        fields={selectedModel.fields}
                        impactedFields={impactedFields}
                      />

                      {migrationSteps.length > 0 && (
                        <MigrationPreview steps={migrationSteps} />
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-text-muted">
                    Select a model to view details
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
    </motion.div>
  );
}
