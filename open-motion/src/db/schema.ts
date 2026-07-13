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
  parent_id TEXT,
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

CREATE TABLE IF NOT EXISTS agent_memory (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  layer TEXT NOT NULL DEFAULT 'project',
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  relevance REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_memory_project ON agent_memory(project_id, layer);
CREATE INDEX IF NOT EXISTS idx_agent_memory_tags ON agent_memory(tags_json);

CREATE TABLE IF NOT EXISTS generated_skills (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  trigger_pattern TEXT NOT NULL DEFAULT '',
  tool_sequence TEXT NOT NULL DEFAULT '[]',
  skill_markdown TEXT NOT NULL DEFAULT '',
  usage_count INTEGER NOT NULL DEFAULT 0,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_generated_skills_tags ON generated_skills(tags_json);

CREATE TABLE IF NOT EXISTS motion_recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT NOT NULL DEFAULT '',
  avoid_when TEXT NOT NULL DEFAULT '[]',
  restraint_cost INTEGER NOT NULL DEFAULT 1,
  recipe_json TEXT NOT NULL DEFAULT '{}',
  skill_markdown TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_motion_recipes_category ON motion_recipes(category);

CREATE TABLE IF NOT EXISTS project_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  spec_json TEXT NOT NULL,
  component_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_project_versions_project ON project_versions(project_id, created_at);

CREATE TABLE IF NOT EXISTS motion_tokens (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'duration',
  value TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(project_id, name)
);
CREATE INDEX IF NOT EXISTS idx_motion_tokens_project ON motion_tokens(project_id, category);

CREATE TABLE IF NOT EXISTS tool_pipelines (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  steps_json TEXT NOT NULL DEFAULT '[]',
  tags_json TEXT NOT NULL DEFAULT '[]',
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tool_pipelines_project ON tool_pipelines(project_id);
`;
