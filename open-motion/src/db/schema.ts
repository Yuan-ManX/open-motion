export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  scenes_json TEXT NOT NULL DEFAULT '[]',
  tokens_json TEXT NOT NULL DEFAULT '{}',
  global_timing_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  source_template_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS motion_components (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id TEXT,
  name TEXT NOT NULL,
  selector TEXT,
  template_id TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 800,
  delay_ms INTEGER NOT NULL DEFAULT 0,
  iteration_count TEXT NOT NULL DEFAULT '1',
  direction TEXT NOT NULL DEFAULT 'normal',
  fill_mode TEXT NOT NULL DEFAULT 'forwards',
  play_state TEXT NOT NULL DEFAULT 'running',
  trigger TEXT NOT NULL DEFAULT 'onLoad',
  easing_json TEXT NOT NULL,
  keyframes_json TEXT NOT NULL DEFAULT '[]',
  style_json TEXT NOT NULL DEFAULT '{}',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_components_project ON motion_components(project_id);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  spec_json TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  preview_html TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  source_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  source_component_id TEXT REFERENCES motion_components(id) ON DELETE SET NULL,
  manifest_json TEXT NOT NULL,
  motion_spec_json TEXT NOT NULL,
  code_html TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tool_calls_json TEXT,
  tool_call_id TEXT,
  tool_name TEXT,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id, created_at);

CREATE TABLE IF NOT EXISTS exports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  params_json TEXT NOT NULL DEFAULT '{}',
  file_path TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
`;
