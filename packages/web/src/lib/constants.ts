// Navigation routes
export const ROUTES = {
  onboarding: "/",
  dashboard: "/dashboard",
  trace: "/trace",
  branches: "/branches",
  tests: "/tests",
  security: "/security",
  schema: "/schema",
  risk: "/risk",
  graph: "/graph",
  settings: "/settings",
} as const;

// Animation durations (ms)
export const ANIMATION = {
  pageTransition: 0.3,
  cardStagger: 0.1,
  riskGauge: 1.2,
  counterAnimation: 0.8,
  sidebarCollapse: 0.2,
  panelResize: 0.4,
} as const;

// Spring configs for framer-motion
export const SPRINGS = {
  gentle: { type: "spring" as const, stiffness: 200, damping: 20 },
  snappy: { type: "spring" as const, stiffness: 400, damping: 30 },
  wobbly: { type: "spring" as const, stiffness: 180, damping: 12 },
} as const;

// Page transition variants
export const PAGE_VARIANTS = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
} as const;

// Phase names
export const PHASE_NAMES: Record<string, string> = {
  parsing: "Parsing Files",
  symbols: "Resolving Symbols",
  cfg: "Building CFG",
  dfg: "Building DFG",
  callgraph: "Resolving Calls",
  summaries: "Building Summaries",
  communities: "Detecting Communities",
  processes: "Tracing Processes",
  tests: "Mapping Tests",
  schema: "Linking Schemas",
  taint: "Taint Analysis",
  metrics: "Computing Metrics",
};

// Keyboard shortcuts
export const SHORTCUTS = {
  commandPalette: { key: "k", meta: true },
  search: { key: "/", meta: false },
  toggleSidebar: { key: "b", meta: true },
  goToDashboard: { key: "1", meta: true },
  goToTrace: { key: "2", meta: true },
  goToBranches: { key: "3", meta: true },
  goToTests: { key: "4", meta: true },
  goToSecurity: { key: "5", meta: true },
  goToGraph: { key: "6", meta: true },
} as const;

// Node kind labels
export const NODE_KIND_LABELS: Record<string, string> = {
  file: "File",
  class: "Class",
  interface: "Interface",
  enum: "Enum",
  function: "Function",
  method: "Method",
  arrow_function: "Arrow Function",
  variable: "Variable",
  constant: "Constant",
  property: "Property",
  parameter: "Parameter",
  type_alias: "Type Alias",
  import: "Import",
  export: "Export",
  module: "Module",
  namespace: "Namespace",
  constructor: "Constructor",
  getter: "Getter",
  setter: "Setter",
  decorator: "Decorator",
  test: "Test",
  schema: "Schema",
  route: "Route",
};

// SSE reconnect config
export const SSE_CONFIG = {
  reconnectInterval: 3000,
  maxRetries: 10,
} as const;
