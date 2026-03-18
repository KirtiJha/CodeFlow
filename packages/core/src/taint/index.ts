export { TaintEngine } from "./taint-engine.js";
export { SourceRegistry } from "./source-registry.js";
export { SinkRegistry } from "./sink-registry.js";
export { SanitizerRegistry } from "./sanitizer-registry.js";
export type {
  TaintSeverity,
  TaintCategory,
  TaintFlow,
  TaintPathStep,
  SourcePattern,
  SinkPattern,
  SanitizerPattern,
  SecurityScanResult,
} from "./taint-types.js";
