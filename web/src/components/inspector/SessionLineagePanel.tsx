import { useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";

interface SessionInsight {
  category: string;
  text: string;
  confidence: number;
}

interface SessionSnapshot {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  summary: string;
  messageCount: number;
  toolsUsed: string[];
  componentIds: string[];
  insights: SessionInsight[];
  tags: string[];
  status: "active" | "archived" | "forked";
  depth: number;
}

const SESSIONS_KEY = "__sessionLineage";

const STATUS_COLORS: Record<string, string> = {
  active: "text-gray-300",
  archived: "text-gray-600",
  forked: "text-gray-500",
};

const STATUS_DOTS: Record<string, string> = {
  active: "bg-gray-100",
  archived: "bg-gray-700",
  forked: "bg-gray-500",
};

const INSIGHT_ICONS: Record<string, string> = {
  pattern: "◌",
  outcome: "✓",
  decision: "◆",
  preference: "★",
  constraint: "▲",
};

function parseSessions(tokens: Record<string, string | number>): SessionSnapshot[] {
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

function sendAgentMessage(projectId: string, prompt: string) {
  useChatStore.getState().send(projectId, prompt);
}

export function SessionLineagePanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const project = useProjectStore((s) => s.project);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sessions = useMemo(() => {
    if (!project?.tokens) return [];
    return parseSessions(project.tokens);
  }, [project?.tokens]);

  const stats = useMemo(() => {
    if (sessions.length === 0) return null;
    let active = 0, archived = 0, forked = 0, maxDepth = 0, totalInsights = 0;
    const allTools = new Set<string>();
    for (const s of sessions) {
      if (s.status === "active") active++;
      else if (s.status === "archived") archived++;
      else if (s.status === "forked") forked++;
      if (s.depth > maxDepth) maxDepth = s.depth;
      totalInsights += s.insights.length;
      s.toolsUsed.forEach((t) => allTools.add(t));
    }
    return { total: sessions.length, active, archived, forked, maxDepth, totalInsights, uniqueTools: allTools.size };
  }, [sessions]);

  const filtered = query.trim()
    ? sessions.filter(
        (s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.summary.toLowerCase().includes(query.toLowerCase()) ||
          s.tags.some((t) => t.toLowerCase().includes(query.toLowerCase())),
      )
    : sessions;

  if (!projectId) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        No project loaded.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-edge flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
            Session Lineage
          </span>
          <span className="text-[9px] text-gray-600 font-mono">{sessions.length}</span>
        </div>
        <div className="flex gap-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions..."
            className="flex-1 bg-bg px-2 py-1 text-[10px] text-gray-300 border border-edge focus:border-gray-500 focus:outline-none"
          />
          <button
            onClick={() => sendAgentMessage(projectId, "Save this conversation as a session snapshot")}
            title="Save current conversation as a session snapshot"
            aria-label="Save session snapshot"
            className="px-2 py-1 text-[10px] text-gray-400 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="px-3 py-2 border-b border-edge flex-shrink-0">
          <div className="grid grid-cols-4 gap-1 text-center">
            <div>
              <div className="text-[14px] font-mono text-gray-200">{stats.total}</div>
              <div className="text-[7px] uppercase text-gray-600 tracking-wider">Total</div>
            </div>
            <div>
              <div className="text-[14px] font-mono text-gray-300">{stats.active}</div>
              <div className="text-[7px] uppercase text-gray-600 tracking-wider">Active</div>
            </div>
            <div>
              <div className="text-[14px] font-mono text-gray-500">{stats.forked}</div>
              <div className="text-[7px] uppercase text-gray-600 tracking-wider">Forked</div>
            </div>
            <div>
              <div className="text-[14px] font-mono text-gray-400">{stats.totalInsights}</div>
              <div className="text-[7px] uppercase text-gray-600 tracking-wider">Insights</div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[8px] text-gray-600 font-mono">
            <span>max depth: {stats.maxDepth}</span>
            <span>{stats.uniqueTools} unique tools</span>
          </div>
          <button
            onClick={() => sendAgentMessage(projectId, "Show the full session lineage tree with ancestry and statistics")}
            className="w-full mt-2 px-2 py-1 text-[9px] text-gray-400 border border-edge hover:text-gray-100 hover:border-gray-400 transition-colors"
            title="View the full lineage tree via the Agent"
          >
            View Lineage Tree
          </button>
        </div>
      )}

      {/* Session list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-center text-[10px] text-gray-600">
            {sessions.length === 0
              ? "No session snapshots yet. Save your current conversation to start a lineage."
              : "No sessions match your search."}
          </div>
        ) : (
          <div className="divide-y divide-edge">
            {filtered
              .slice()
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((session) => {
                const isExpanded = expandedId === session.id;
                const indent = session.depth * 12;
                return (
                  <div
                    key={session.id}
                    className="px-3 py-2 hover:bg-panel2 transition-colors"
                    style={{ paddingLeft: `${12 + indent}px` }}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${STATUS_DOTS[session.status] ?? "bg-gray-700"}`}
                        title={session.status}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-medium text-gray-200 truncate">
                            {session.name}
                          </span>
                          <span className={`text-[8px] font-mono uppercase flex-shrink-0 ${STATUS_COLORS[session.status] ?? "text-gray-600"}`}>
                            {session.status}
                          </span>
                        </div>
                        {session.summary && (
                          <p className="text-[9px] text-gray-500 line-clamp-2 mt-0.5">
                            {session.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-[8px] text-gray-600 font-mono">
                          <span>{session.messageCount} msg</span>
                          <span>{session.toolsUsed.length} tools</span>
                          <span>{session.insights.length} insights</span>
                          <span>depth {session.depth}</span>
                          <span>{formatDate(session.updatedAt)}</span>
                        </div>
                        {session.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {session.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="text-[7px] px-1 py-0.5 bg-bg text-gray-600 border border-edge font-mono"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {isExpanded && session.insights.length > 0 && (
                          <div className="mt-2 space-y-1 border-l border-edge pl-2">
                            {session.insights.map((insight, i) => (
                              <div key={i} className="flex items-start gap-1">
                                <span className="text-[8px] text-gray-600 flex-shrink-0 mt-0.5">
                                  {INSIGHT_ICONS[insight.category] ?? "·"}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[8px] text-gray-400 leading-tight">{insight.text}</p>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[7px] text-gray-700 font-mono uppercase">{insight.category}</span>
                                    <span className="text-[7px] text-gray-700 font-mono">
                                      {Math.round(insight.confidence * 100)}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-1 mt-1.5">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : session.id)}
                            className="px-1.5 py-0.5 text-[8px] text-gray-500 border border-edge hover:text-gray-300 hover:border-gray-500 transition-colors"
                            title={isExpanded ? "Collapse insights" : "Expand insights"}
                          >
                            {isExpanded ? "−" : "+"} {session.insights.length}
                          </button>
                          <button
                            onClick={() =>
                              sendAgentMessage(projectId, `Resume session "${session.name}" and continue from where we left off`)
                            }
                            className="px-1.5 py-0.5 text-[8px] text-gray-500 border border-edge hover:text-gray-300 hover:border-gray-500 transition-colors"
                            title="Resume this session via the Agent"
                          >
                            Resume
                          </button>
                          <button
                            onClick={() =>
                              sendAgentMessage(projectId, `Fork from session "${session.name}" to start a new branch`)
                            }
                            className="px-1.5 py-0.5 text-[8px] text-gray-500 border border-edge hover:text-gray-300 hover:border-gray-500 transition-colors"
                            title="Fork from this session via the Agent"
                          >
                            Fork
                          </button>
                          <button
                            onClick={() =>
                              sendAgentMessage(projectId, `Delete session snapshot "${session.name}" from the lineage`)
                            }
                            className="px-1.5 py-0.5 text-[8px] text-red-700 border border-edge hover:text-red-500 hover:border-red-700 transition-colors"
                            title="Delete this session snapshot"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
