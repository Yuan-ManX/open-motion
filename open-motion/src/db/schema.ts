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

-- FTS5 full-text search indexes. One virtual table per searchable entity,
-- kept in sync via triggers so inserts/updates/deletes propagate automatically.
-- The external-content pattern is avoided in favor of simple shadow tables
-- so node:sqlite's FTS5 bundle handles all MATCH queries natively.

CREATE VIRTUAL TABLE IF NOT EXISTS projects_fts USING fts5(
  id UNINDEXED, name, description,
  tokenize = 'porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS projects_ai AFTER INSERT ON projects BEGIN
  INSERT INTO projects_fts(id, name, description) VALUES (new.id, new.name, new.description);
END;
CREATE TRIGGER IF NOT EXISTS projects_ad AFTER DELETE ON projects BEGIN
  DELETE FROM projects_fts WHERE id = old.id;
END;
CREATE TRIGGER IF NOT EXISTS projects_au AFTER UPDATE ON projects BEGIN
  DELETE FROM projects_fts WHERE id = old.id;
  INSERT INTO projects_fts(id, name, description) VALUES (new.id, new.name, new.description);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS components_fts USING fts5(
  id UNINDEXED, project_id UNINDEXED, name, selector,
  tokenize = 'porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS components_ai AFTER INSERT ON motion_components BEGIN
  INSERT INTO components_fts(id, project_id, name, selector) VALUES (new.id, new.project_id, new.name, COALESCE(new.selector, ''));
END;
CREATE TRIGGER IF NOT EXISTS components_ad AFTER DELETE ON motion_components BEGIN
  DELETE FROM components_fts WHERE id = old.id;
END;
CREATE TRIGGER IF NOT EXISTS components_au AFTER UPDATE ON motion_components BEGIN
  DELETE FROM components_fts WHERE id = old.id;
  INSERT INTO components_fts(id, project_id, name, selector) VALUES (new.id, new.project_id, new.name, COALESCE(new.selector, ''));
END;

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  id UNINDEXED, project_id UNINDEXED, role UNINDEXED, content,
  tokenize = 'porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(id, project_id, role, content) VALUES (new.id, new.project_id, new.role, new.content);
END;
CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  DELETE FROM messages_fts WHERE id = old.id;
END;
CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
  DELETE FROM messages_fts WHERE id = old.id;
  INSERT INTO messages_fts(id, project_id, role, content) VALUES (new.id, new.project_id, new.role, new.content);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS agent_memory_fts USING fts5(
  id UNINDEXED, project_id UNINDEXED, layer UNINDEXED, key, value, tags_json,
  tokenize = 'porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS agent_memory_ai AFTER INSERT ON agent_memory BEGIN
  INSERT INTO agent_memory_fts(id, project_id, layer, key, value, tags_json) VALUES (new.id, new.project_id, new.layer, new.key, new.value, new.tags_json);
END;
CREATE TRIGGER IF NOT EXISTS agent_memory_ad AFTER DELETE ON agent_memory BEGIN
  DELETE FROM agent_memory_fts WHERE id = old.id;
END;
CREATE TRIGGER IF NOT EXISTS agent_memory_au AFTER UPDATE ON agent_memory BEGIN
  DELETE FROM agent_memory_fts WHERE id = old.id;
  INSERT INTO agent_memory_fts(id, project_id, layer, key, value, tags_json) VALUES (new.id, new.project_id, new.layer, new.key, new.value, new.tags_json);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
  id UNINDEXED, name, description,
  tokenize = 'porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS skills_ai AFTER INSERT ON skills BEGIN
  INSERT INTO skills_fts(id, name, description) VALUES (new.id, new.name, new.description);
END;
CREATE TRIGGER IF NOT EXISTS skills_ad AFTER DELETE ON skills BEGIN
  DELETE FROM skills_fts WHERE id = old.id;
END;
CREATE TRIGGER IF NOT EXISTS skills_au AFTER UPDATE ON skills BEGIN
  DELETE FROM skills_fts WHERE id = old.id;
  INSERT INTO skills_fts(id, name, description) VALUES (new.id, new.name, new.description);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS generated_skills_fts USING fts5(
  id UNINDEXED, project_id UNINDEXED, name, description, trigger_pattern, skill_markdown,
  tokenize = 'porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS generated_skills_ai AFTER INSERT ON generated_skills BEGIN
  INSERT INTO generated_skills_fts(id, project_id, name, description, trigger_pattern, skill_markdown) VALUES (new.id, new.project_id, new.name, new.description, new.trigger_pattern, new.skill_markdown);
END;
CREATE TRIGGER IF NOT EXISTS generated_skills_ad AFTER DELETE ON generated_skills BEGIN
  DELETE FROM generated_skills_fts WHERE id = old.id;
END;
CREATE TRIGGER IF NOT EXISTS generated_skills_au AFTER UPDATE ON generated_skills BEGIN
  DELETE FROM generated_skills_fts WHERE id = old.id;
  INSERT INTO generated_skills_fts(id, project_id, name, description, trigger_pattern, skill_markdown) VALUES (new.id, new.project_id, new.name, new.description, new.trigger_pattern, new.skill_markdown);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS recipes_fts USING fts5(
  id UNINDEXED, name, category UNINDEXED, description, skill_markdown,
  tokenize = 'porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS recipes_ai AFTER INSERT ON motion_recipes BEGIN
  INSERT INTO recipes_fts(id, name, category, description, skill_markdown) VALUES (new.id, new.name, new.category, new.description, new.skill_markdown);
END;
CREATE TRIGGER IF NOT EXISTS recipes_ad AFTER DELETE ON motion_recipes BEGIN
  DELETE FROM recipes_fts WHERE id = old.id;
END;
CREATE TRIGGER IF NOT EXISTS recipes_au AFTER UPDATE ON motion_recipes BEGIN
  DELETE FROM recipes_fts WHERE id = old.id;
  INSERT INTO recipes_fts(id, name, category, description, skill_markdown) VALUES (new.id, new.name, new.category, new.description, new.skill_markdown);
END;
`;
