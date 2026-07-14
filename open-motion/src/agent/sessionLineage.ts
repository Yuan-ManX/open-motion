/**
 * Session Lineage — tracks conversation ancestry and cross-session context.
 *
 * Each SessionSnapshot captures a conversation's intent, tools used, key
 * outcomes, and parent relationship. This builds a conversation tree (like a
 * git history for design sessions) that the Agent can traverse to recall
 * past decisions, fork from earlier points, and carry context forward.
 *
 * Stored in project tokens as JSON — no DB migration required.
 */

export type SessionStatus = "active" | "archived" | "forked";

export interface SessionInsight {
  /** Category: decision, preference, pattern, outcome, constraint. */
  category: string;
  /** The insight text — a compact, actionable statement. */
  text: string;
  /** Confidence 0..1. */
  confidence: number;
}

export interface SessionSnapshot {
  id: string;
  name: string;
  /** Parent session id (null for root sessions). */
  parentId: string | null;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last activity. */
  updatedAt: string;
  /** Human-readable summary of what was accomplished. */
  summary: string;
  /** Number of messages in the conversation. */
  messageCount: number;
  /** List of tool names invoked during the session. */
  toolsUsed: string[];
  /** Components created or modified during the session. */
  componentIds: string[];
  /** Auto-extracted insights from the conversation. */
  insights: SessionInsight[];
  /** Tags for categorization. */
  tags: string[];
  /** Current status. */
  status: SessionStatus;
  /** Depth in the lineage tree (0 for root). */
  depth: number;
}

export interface SessionLineageNode {
  session: SessionSnapshot;
  children: SessionLineageNode[];
}

export interface SessionLineageSummary {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  summary: string;
  messageCount: number;
  toolCount: number;
  insightCount: number;
  status: SessionStatus;
  depth: number;
  tags: string[];
}

const SESSIONS_KEY = "__sessionLineage";

function genId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Read all session snapshots from project tokens. */
export function readSessions(tokens: Record<string, string | number>): SessionSnapshot[] {
  const raw = tokens[SESSIONS_KEY];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SessionSnapshot[];
  } catch {
    return [];
  }
}

/** Write session snapshots to project tokens. */
export function writeSessions(
  tokens: Record<string, string | number>,
  sessions: SessionSnapshot[],
): Record<string, string | number> {
  return { ...tokens, [SESSIONS_KEY]: JSON.stringify(sessions) };
}

/** Find a session by id. */
export function findSession(
  tokens: Record<string, string | number>,
  sessionId: string,
): SessionSnapshot | undefined {
  return readSessions(tokens).find((s) => s.id === sessionId);
}

/** Delete a session by id. */
export function deleteSession(
  tokens: Record<string, string | number>,
  sessionId: string,
): Record<string, string | number> {
  const remaining = readSessions(tokens).filter((s) => s.id !== sessionId);
  return writeSessions(tokens, remaining);
}

/** Summarize sessions for compact listing. */
export function summarizeSessions(tokens: Record<string, string | number>): SessionLineageSummary[] {
  return readSessions(tokens).map((s) => ({
    id: s.id,
    name: s.name,
    parentId: s.parentId,
    createdAt: s.createdAt,
    summary: s.summary,
    messageCount: s.messageCount,
    toolCount: s.toolsUsed.length,
    insightCount: s.insights.length,
    status: s.status,
    depth: s.depth,
    tags: s.tags,
  }));
}

/**
 * Save a new session snapshot. If parentId is provided, the new session is a
 * child of that session (a fork or continuation). Returns the new snapshot
 * and updated tokens.
 */
export function saveSessionSnapshot(
  tokens: Record<string, string | number>,
  options: {
    name: string;
    parentId?: string | null;
    summary?: string;
    messageCount?: number;
    toolsUsed?: string[];
    componentIds?: string[];
    insights?: SessionInsight[];
    tags?: string[];
  },
): { session: SessionSnapshot; tokens: Record<string, string | number> } {
  const existing = readSessions(tokens);
  const parentId = options.parentId ?? null;
  const parent = parentId ? existing.find((s) => s.id === parentId) : undefined;
  const depth = parent ? parent.depth + 1 : 0;

  // If forking from a parent, mark the parent as "forked".
  let updated = existing;
  if (parent) {
    updated = existing.map((s) =>
      s.id === parentId ? { ...s, status: "forked" as SessionStatus } : s,
    );
  }

  const now = new Date().toISOString();
  const session: SessionSnapshot = {
    id: genId(),
    name: options.name,
    parentId,
    createdAt: now,
    updatedAt: now,
    summary: options.summary ?? "",
    messageCount: options.messageCount ?? 0,
    toolsUsed: options.toolsUsed ?? [],
    componentIds: options.componentIds ?? [],
    insights: options.insights ?? [],
    tags: options.tags ?? [],
    status: "active",
    depth,
  };

  return { session, tokens: writeSessions(tokens, [...updated, session]) };
}

/**
 * Update an existing session snapshot with new information.
 */
export function updateSession(
  tokens: Record<string, string | number>,
  sessionId: string,
  patch: Partial<Pick<SessionSnapshot, "name" | "summary" | "messageCount" | "toolsUsed" | "componentIds" | "insights" | "tags" | "status">>,
): { session: SessionSnapshot | undefined; tokens: Record<string, string | number> } {
  const sessions = readSessions(tokens);
  let updated: SessionSnapshot | undefined;
  const next = sessions.map((s) => {
    if (s.id !== sessionId) return s;
    updated = {
      ...s,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });
  return { session: updated, tokens: writeSessions(tokens, next) };
}

/**
 * Build a lineage tree from flat session records. Root sessions (parentId =
 * null) become top-level nodes; children are nested recursively.
 */
export function buildLineageTree(
  tokens: Record<string, string | number>,
): SessionLineageNode[] {
  const sessions = readSessions(tokens);
  const byParent = new Map<string | null, SessionSnapshot[]>();
  for (const s of sessions) {
    const key = s.parentId;
    const list = byParent.get(key) ?? [];
    list.push(s);
    byParent.set(key, list);
  }

  function buildChildren(parentId: string | null): SessionLineageNode[] {
    const children = byParent.get(parentId) ?? [];
    return children
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((session) => ({
        session,
        children: buildChildren(session.id),
      }));
  }

  return buildChildren(null);
}

/**
 * Get the full ancestry chain for a session (from root to the session itself).
 */
export function getAncestry(
  tokens: Record<string, string | number>,
  sessionId: string,
): SessionSnapshot[] {
  const sessions = readSessions(tokens);
  const chain: SessionSnapshot[] = [];
  let current = sessions.find((s) => s.id === sessionId);
  while (current) {
    chain.unshift(current);
    current = current.parentId ? sessions.find((s) => s.id === current!.parentId) : undefined;
  }
  return chain;
}

/**
 * Get all descendants of a session (children, grandchildren, etc.).
 */
export function getDescendants(
  tokens: Record<string, string | number>,
  sessionId: string,
): SessionSnapshot[] {
  const sessions = readSessions(tokens);
  const byParent = new Map<string, SessionSnapshot[]>();
  for (const s of sessions) {
    if (s.parentId) {
      const list = byParent.get(s.parentId) ?? [];
      list.push(s);
      byParent.set(s.parentId, list);
    }
  }
  const descendants: SessionSnapshot[] = [];
  function collect(parentId: string) {
    const children = byParent.get(parentId) ?? [];
    for (const child of children) {
      descendants.push(child);
      collect(child.id);
    }
  }
  collect(sessionId);
  return descendants;
}

/**
 * Auto-extract insights from a list of tool calls. Analyzes the tool patterns
 * and generates compact insight statements about the session's focus.
 */
export function extractInsightsFromTools(toolsUsed: string[]): SessionInsight[] {
  const insights: SessionInsight[] = [];
  const toolSet = new Set(toolsUsed);

  // Detect design focus
  if (toolSet.has("set_easing") || toolSet.has("set_duration") || toolSet.has("set_spring")) {
    insights.push({
      category: "pattern",
      text: "Session focused on motion timing and easing refinement",
      confidence: 0.85,
    });
  }
  if (toolSet.has("set_color") || toolSet.has("harmonize_colors") || toolSet.has("apply_style")) {
    insights.push({
      category: "pattern",
      text: "Color and visual styling was a key focus",
      confidence: 0.8,
    });
  }
  if (toolSet.has("stagger_components") || toolSet.has("choreograph")) {
    insights.push({
      category: "pattern",
      text: "Multi-component choreography was orchestrated",
      confidence: 0.9,
    });
  }
  if (toolSet.has("add_layer") || toolSet.has("add_shape")) {
    insights.push({
      category: "outcome",
      text: "New components were created during this session",
      confidence: 0.95,
    });
  }
  if (toolSet.has("save_version")) {
    insights.push({
      category: "decision",
      text: "Version snapshots were taken — indicates checkpoint-worthy progress",
      confidence: 0.75,
    });
  }
  if (toolSet.has("apply_brand_pack")) {
    insights.push({
      category: "decision",
      text: "A brand identity was applied — motion now follows a cohesive identity",
      confidence: 0.9,
    });
  }
  if (toolSet.has("set_motion_profile")) {
    insights.push({
      category: "preference",
      text: "Component personality profiles were assigned — indicates role-driven design",
      confidence: 0.8,
    });
  }
  if (toolSet.has("export_html") || toolSet.has("export_code") || toolSet.has("apply_export_preset")) {
    insights.push({
      category: "outcome",
      text: "Project was exported — indicates completion of a deliverable",
      confidence: 0.85,
    });
  }
  if (toolSet.has("analyze_restraint") || toolSet.has("analyze_motion")) {
    insights.push({
      category: "pattern",
      text: "Quality analysis was performed — indicates a review phase",
      confidence: 0.7,
    });
  }

  return insights;
}

/**
 * Generate a human-readable summary from the session's tool usage and
 * component interactions.
 */
export function generateSessionSummary(
  toolsUsed: string[],
  componentCount: number,
  messageCount: number,
): string {
  const parts: string[] = [];
  const toolSet = new Set(toolsUsed);

  if (componentCount > 0) {
    parts.push(`worked on ${componentCount} component${componentCount > 1 ? "s" : ""}`);
  }
  if (toolSet.has("add_layer") || toolSet.has("add_shape")) {
    parts.push("created new elements");
  }
  if (toolSet.has("set_easing") || toolSet.has("set_spring")) {
    parts.push("tuned motion timing");
  }
  if (toolSet.has("stagger_components") || toolSet.has("choreograph")) {
    parts.push("orchestrated choreography");
  }
  if (toolSet.has("apply_brand_pack")) {
    parts.push("applied brand identity");
  }
  if (toolSet.has("export_html") || toolSet.has("apply_export_preset")) {
    parts.push("exported the project");
  }
  if (toolSet.has("analyze_restraint")) {
    parts.push("reviewed motion quality");
  }

  if (parts.length === 0) {
    return `${messageCount} message session with ${toolsUsed.length} tool call${toolsUsed.length !== 1 ? "s" : ""}`;
  }
  return `${messageCount} messages — ${parts.join(", ")}`;
}

/** Get lineage statistics for a project. */
export function getLineageStats(tokens: Record<string, string | number>): {
  totalSessions: number;
  activeSessions: number;
  archivedSessions: number;
  forkedSessions: number;
  maxDepth: number;
  totalInsights: number;
  uniqueTools: string[];
} {
  const sessions = readSessions(tokens);
  const allTools = new Set<string>();
  let totalInsights = 0;
  let maxDepth = 0;
  let active = 0;
  let archived = 0;
  let forked = 0;

  for (const s of sessions) {
    s.toolsUsed.forEach((t) => allTools.add(t));
    totalInsights += s.insights.length;
    if (s.depth > maxDepth) maxDepth = s.depth;
    if (s.status === "active") active++;
    else if (s.status === "archived") archived++;
    else if (s.status === "forked") forked++;
  }

  return {
    totalSessions: sessions.length,
    activeSessions: active,
    archivedSessions: archived,
    forkedSessions: forked,
    maxDepth,
    totalInsights,
    uniqueTools: Array.from(allTools).sort(),
  };
}
