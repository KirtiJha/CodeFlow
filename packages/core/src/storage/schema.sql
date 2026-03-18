-- CodeFlow SQLite Schema
-- All tables for the analysis pipeline

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

-- Core tables
CREATE TABLE IF NOT EXISTS repos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  analyzed_at TEXT,
  commit_hash TEXT,
  stats_json TEXT
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  qualified_name TEXT,
  file_path TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  language TEXT,
  signature TEXT,
  param_count INTEGER,
  return_type TEXT,
  owner_id TEXT,
  community_id TEXT,
  complexity_cyclomatic INTEGER,
  complexity_cognitive INTEGER,
  risk_score REAL,
  is_test INTEGER DEFAULT 0,
  is_entry_point INTEGER DEFAULT 0,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  metadata_json TEXT
);

-- Data Flow Graph (statement-level)
CREATE TABLE IF NOT EXISTS dfg_nodes (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  function_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  code TEXT,
  file_path TEXT NOT NULL,
  line INTEGER,
  col INTEGER,
  data_type TEXT,
  is_source INTEGER DEFAULT 0,
  is_sink INTEGER DEFAULT 0,
  is_sanitizer INTEGER DEFAULT 0,
  source_kind TEXT,
  sink_kind TEXT
);

CREATE TABLE IF NOT EXISTS dfg_edges (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES dfg_nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES dfg_nodes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  transform TEXT,
  is_sanitizing INTEGER DEFAULT 0
);

-- Function summaries
CREATE TABLE IF NOT EXISTS summaries (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  param_flows_json TEXT,
  side_effects_json TEXT,
  throws_json TEXT,
  can_return_null INTEGER DEFAULT 0,
  can_return_undefined INTEGER DEFAULT 0
);

-- Control Flow Graph blocks
CREATE TABLE IF NOT EXISTS cfg_blocks (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  function_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  statement_count INTEGER
);

CREATE TABLE IF NOT EXISTS cfg_edges (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  source_block_id TEXT NOT NULL REFERENCES cfg_blocks(id) ON DELETE CASCADE,
  target_block_id TEXT NOT NULL REFERENCES cfg_blocks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  condition TEXT
);

-- Communities (functional clusters)
CREATE TABLE IF NOT EXISTS communities (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  label TEXT,
  cohesion REAL,
  symbol_count INTEGER,
  keywords_json TEXT
);

-- Processes (execution flows)
CREATE TABLE IF NOT EXISTS processes (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  name TEXT,
  entry_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
  kind TEXT,
  step_count INTEGER,
  crosses_communities INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS process_steps (
  id TEXT PRIMARY KEY,
  process_id TEXT NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  community_id TEXT
);

-- Test mapping
CREATE TABLE IF NOT EXISTS test_mappings (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  test_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  production_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL,
  via TEXT
);

-- Schema models
CREATE TABLE IF NOT EXISTS schema_models (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  orm TEXT,
  file_path TEXT,
  line INTEGER
);

CREATE TABLE IF NOT EXISTS schema_fields (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES schema_models(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT,
  nullable INTEGER DEFAULT 0,
  is_primary INTEGER DEFAULT 0,
  is_unique INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS schema_refs (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL REFERENCES schema_fields(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  ref_kind TEXT NOT NULL,
  file_path TEXT,
  line INTEGER,
  code TEXT
);

-- API endpoints
CREATE TABLE IF NOT EXISTS api_endpoints (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  handler_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
  file_path TEXT,
  line INTEGER,
  request_schema_json TEXT,
  response_schema_json TEXT
);

-- Taint flows (security)
CREATE TABLE IF NOT EXISTS taint_flows (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  source_dfg_node_id TEXT NOT NULL REFERENCES dfg_nodes(id) ON DELETE CASCADE,
  sink_dfg_node_id TEXT NOT NULL REFERENCES dfg_nodes(id) ON DELETE CASCADE,
  path_json TEXT,
  is_sanitized INTEGER DEFAULT 0,
  sanitizer_location TEXT,
  fix_suggestion TEXT
);

-- Branch analysis
CREATE TABLE IF NOT EXISTS branch_snapshots (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  branch_name TEXT NOT NULL,
  author TEXT,
  last_commit_hash TEXT,
  last_commit_date TEXT,
  commit_count INTEGER,
  files_changed_json TEXT,
  fingerprint_json TEXT,
  scanned_at TEXT
);

CREATE TABLE IF NOT EXISTS branch_conflicts (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  branch_a TEXT NOT NULL,
  branch_b TEXT NOT NULL,
  level INTEGER NOT NULL,
  severity TEXT NOT NULL,
  details_json TEXT,
  detected_at TEXT
);

-- Metrics history
CREATE TABLE IF NOT EXISTS metrics_history (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  commit_hash TEXT,
  measured_at TEXT,
  risk_score REAL,
  complexity_cyclomatic INTEGER,
  complexity_cognitive INTEGER,
  test_count INTEGER,
  change_count_30d INTEGER
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nodes_repo ON nodes(repo_id);
CREATE INDEX IF NOT EXISTS idx_nodes_kind ON nodes(repo_id, kind);
CREATE INDEX IF NOT EXISTS idx_nodes_file ON nodes(repo_id, file_path);
CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes(repo_id, name);
CREATE INDEX IF NOT EXISTS idx_nodes_qualified ON nodes(repo_id, qualified_name);
CREATE INDEX IF NOT EXISTS idx_edges_repo ON edges(repo_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_kind ON edges(repo_id, kind);
CREATE INDEX IF NOT EXISTS idx_dfg_function ON dfg_nodes(function_id);
CREATE INDEX IF NOT EXISTS idx_dfg_edges_source ON dfg_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_dfg_edges_target ON dfg_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_test_mappings_prod ON test_mappings(production_node_id);
CREATE INDEX IF NOT EXISTS idx_test_mappings_test ON test_mappings(test_node_id);
CREATE INDEX IF NOT EXISTS idx_schema_refs_field ON schema_refs(field_id);
CREATE INDEX IF NOT EXISTS idx_schema_refs_node ON schema_refs(node_id);
CREATE INDEX IF NOT EXISTS idx_taint_severity ON taint_flows(repo_id, severity);
CREATE INDEX IF NOT EXISTS idx_branch_snapshots ON branch_snapshots(repo_id, branch_name);
CREATE INDEX IF NOT EXISTS idx_branch_conflicts ON branch_conflicts(repo_id, severity);

-- Full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
  name, qualified_name, file_path,
  content=nodes, content_rowid=rowid
);

-- FTS triggers for automatic sync
CREATE TRIGGER IF NOT EXISTS nodes_fts_insert AFTER INSERT ON nodes BEGIN
  INSERT INTO nodes_fts(rowid, name, qualified_name, file_path)
  VALUES (NEW.rowid, NEW.name, NEW.qualified_name, NEW.file_path);
END;

CREATE TRIGGER IF NOT EXISTS nodes_fts_delete AFTER DELETE ON nodes BEGIN
  INSERT INTO nodes_fts(nodes_fts, rowid, name, qualified_name, file_path)
  VALUES ('delete', OLD.rowid, OLD.name, OLD.qualified_name, OLD.file_path);
END;

CREATE TRIGGER IF NOT EXISTS nodes_fts_update AFTER UPDATE ON nodes BEGIN
  INSERT INTO nodes_fts(nodes_fts, rowid, name, qualified_name, file_path)
  VALUES ('delete', OLD.rowid, OLD.name, OLD.qualified_name, OLD.file_path);
  INSERT INTO nodes_fts(rowid, name, qualified_name, file_path)
  VALUES (NEW.rowid, NEW.name, NEW.qualified_name, NEW.file_path);
END;
