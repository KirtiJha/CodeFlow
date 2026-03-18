// ─── Schema & API Impact Types ────────────────────────────────

export interface SchemaModel {
  id: string;
  repoId: string;
  name: string;
  orm: OrmFramework;
  filePath: string;
  line: number;
  fields: SchemaField[];
}

export type OrmFramework =
  | "prisma"
  | "typeorm"
  | "sequelize"
  | "drizzle"
  | "sqlalchemy"
  | "django"
  | "raw_sql";

export interface SchemaField {
  id: string;
  modelId: string;
  name: string;
  fieldType: string;
  nullable: boolean;
  isPrimary: boolean;
  isUnique: boolean;
}

export interface SchemaRef {
  id: string;
  repoId: string;
  fieldId: string;
  nodeId: string;
  refKind: SchemaRefKind;
  filePath: string;
  line: number;
  code: string;
}

export type SchemaRefKind =
  | "read"
  | "write"
  | "query"
  | "migration"
  | "fixture";

export interface APIEndpoint {
  id: string;
  repoId: string;
  method: HttpMethod;
  path: string;
  handlerId: string;
  filePath: string;
  line: number;
  requestSchema?: Record<string, FieldSchema>;
  responseSchema?: Record<string, FieldSchema>;
}

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export interface FieldSchema {
  type: string;
  required: boolean;
  nested?: Record<string, FieldSchema>;
}

export interface SchemaImpactResult {
  affectedLocations: AffectedLocation[];
  affectedTests: AffectedTest[];
  affectedEndpoints: AffectedEndpoint[];
  migrationSteps: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
}

export interface AffectedLocation {
  file: string;
  line: number;
  code: string;
  impactKind: "will_break" | "needs_update" | "check_manually";
}

export interface AffectedTest {
  testFile: string;
  testName: string;
}

export interface AffectedEndpoint {
  method: HttpMethod;
  path: string;
  field: string;
  location: "request_body" | "response_body" | "query_param" | "path_param";
}
