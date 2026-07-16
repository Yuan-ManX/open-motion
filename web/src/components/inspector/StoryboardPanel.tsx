import { useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";

interface StoryboardBeat {
  id: string;
  title: string;
  description: string;
  durationMs: number;
  sceneId: string | null;
  componentIds: string[];
  transition: "cut" | "fade" | "slide" | "zoom" | "dissolve" | "wipe";
  order: number;
  createdAt: string;
  updatedAt: string;
}

const STORYBOARD_KEY = "__storyboard";

const TRANSITION_ICON: Record<string, string> = {
  cut: "▷",
  fade: "◐",
  slide: "↔",
  zoom: "◎",
  dissolve: "◍",
  wipe: "⟿",
};

function parseBeats(tokens: Record<string, string | number> | undefined): StoryboardBeat[] {
  if (!tokens) return [];
  const raw = tokens[STORYBOARD_KEY];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StoryboardBeat[];
  } catch {
    return [];
  }
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString();
}

function sendAgentMessage(projectId: string, prompt: string) {
  useChatStore.getState().send(projectId, prompt);
}

export function StoryboardPanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const project = useProjectStore((s) => s.project);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const beats = useMemo(() => parseBeats(project?.tokens), [project?.tokens]);

  const stats = useMemo(() => {
    if (beats.length === 0) return null;
    const totalDuration = beats.reduce((sum, b) => sum + b.durationMs, 0);
    const transitions = new Set(beats.map((b) => b.transition));
    const componentRefs = new Set<string>();
    beats.forEach((b) => b.componentIds.forEach((id) => componentRefs.add(id)));
    const scenes = new Set(beats.map((b) => b.sceneId).filter(Boolean));
    return {
      total: beats.length,
      totalDuration,
      transitions: Array.from(transitions),
      componentRefs: componentRefs.size,
      scenes: scenes.size,
    };
  }, [beats]);

  const ordered = useMemo(() => {
    const sorted = beats.slice().sort((a, b) => a.order - b.order);
    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q),
    );
  }, [beats, query]);

  if (!projectId) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        No project loaded.
      </div>
    );
  }

  let cumulativeMs = 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-edge flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
            Storyboard
          </span>
          <span className="text-[9px] text-gray-600 font-mono">{beats.length}</span>
        </div>
        <div className="flex gap-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search beats..."
            className="flex-1 bg-bg px-2 py-1 text-[10px] text-gray-300 border border-edge focus:border-gray-500 focus:outline-none"
          />
          <button
            onClick={() => sendAgentMessage(projectId, "Create a new storyboard beat titled 'Opening moment' with a fade transition")}
            title="Create a new beat via the Agent"
            aria-label="Create beat"
            className="px-2 py-1 text-[10px] text-gray-400 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors"
          >
            + Beat
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="px-3 py-2 border-b border-edge flex-shrink-0">
          <div className="grid grid-cols-3 gap-1 text-center">
            <div>
              <div className="text-[14px] font-mono text-gray-200">{stats.total}</div>
              <div className="text-[7px] uppercase text-gray-600 tracking-wider">Beats</div>
            </div>
            <div>
              <div className="text-[14px] font-mono text-gray-300">{formatMs(stats.totalDuration)}</div>
              <div className="text-[7px] uppercase text-gray-600 tracking-wider">Runtime</div>
            </div>
            <div>
              <div className="text-[14px] font-mono text-gray-400">{stats.scenes}</div>
              <div className="text-[7px] uppercase text-gray-600 tracking-wider">Scenes</div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[8px] text-gray-600 font-mono">
            <span>{stats.componentRefs} component refs</span>
            <span>{stats.transitions.length} transitions</span>
          </div>
          <div className="flex gap-1 mt-2">
            <button
              onClick={() => sendAgentMessage(projectId, "List all storyboard beats with their cumulative timing")}
              className="flex-1 px-2 py-1 text-[9px] text-gray-400 border border-edge hover:text-gray-100 hover:border-gray-400 transition-colors"
              title="Refresh the storyboard summary via the Agent"
            >
              Refresh
            </button>
            <button
              onClick={() => sendAgentMessage(projectId, "Export the storyboard as Markdown")}
              className="flex-1 px-2 py-1 text-[9px] text-gray-400 border border-edge hover:text-gray-100 hover:border-gray-400 transition-colors"
              title="Export storyboard as Markdown via the Agent"
            >
              Export
            </button>
          </div>
        </div>
      )}

      {/* Beat list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {ordered.length === 0 ? (
          <div className="px-4 py-6 text-center text-[10px] text-gray-600">
            {beats.length === 0
              ? "No storyboard beats yet. Create a beat to start sequencing your narrative."
              : "No beats match your search."}
          </div>
        ) : (
          <div className="divide-y divide-edge">
            {ordered.map((beat) => {
              const isExpanded = expandedId === beat.id;
              const startMs = cumulativeMs;
              cumulativeMs += beat.durationMs;
              const endMs = cumulativeMs;
              return (
                <div key={beat.id} className="px-3 py-2 hover:bg-panel2 transition-colors">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-mono text-gray-600 mt-0.5 flex-shrink-0 w-5 text-right">
                      {beat.order}
                    </span>
                    <span className="text-[12px] text-gray-500 mt-0.5 flex-shrink-0" title={beat.transition}>
                      {TRANSITION_ICON[beat.transition] ?? "·"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-medium text-gray-200 truncate">
                          {beat.title}
                        </span>
                        <span className="text-[8px] font-mono text-gray-600 flex-shrink-0 uppercase">
                          {beat.transition}
                        </span>
                      </div>
                      {beat.description && (
                        <p className="text-[9px] text-gray-500 line-clamp-2 mt-0.5">
                          {beat.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-[8px] text-gray-600 font-mono">
                        <span title="duration">{formatMs(beat.durationMs)}</span>
                        <span title="start time">@ {formatMs(startMs)}</span>
                        <span title="end time">→ {formatMs(endMs)}</span>
                        {beat.componentIds.length > 0 && (
                          <span>{beat.componentIds.length} comps</span>
                        )}
                        <span>{formatDate(beat.updatedAt)}</span>
                      </div>

                      {isExpanded && (
                        <div className="mt-2 space-y-1 border-l border-edge pl-2">
                          <div className="text-[8px] text-gray-600 font-mono uppercase">Beat {beat.id}</div>
                          {beat.sceneId && (
                            <div className="text-[8px] text-gray-500">
                              Scene: <span className="font-mono">{beat.sceneId}</span>
                            </div>
                          )}
                          {beat.componentIds.length > 0 && (
                            <div className="text-[8px] text-gray-500">
                              Components: <span className="font-mono">{beat.componentIds.join(", ")}</span>
                            </div>
                          )}
                          <div className="text-[8px] text-gray-600">
                            Created {formatDate(beat.createdAt)} · Updated {formatDate(beat.updatedAt)}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-1 mt-1.5">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : beat.id)}
                          className="px-1.5 py-0.5 text-[8px] text-gray-500 border border-edge hover:text-gray-300 hover:border-gray-500 transition-colors"
                          title={isExpanded ? "Collapse details" : "Expand details"}
                        >
                          {isExpanded ? "−" : "+"}
                        </button>
                        <button
                          onClick={() =>
                            sendAgentMessage(projectId, `Update storyboard beat "${beat.title}" — adjust its timing and description`)
                          }
                          className="px-1.5 py-0.5 text-[8px] text-gray-500 border border-edge hover:text-gray-300 hover:border-gray-500 transition-colors"
                          title="Edit this beat via the Agent"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            sendAgentMessage(projectId, `Move beat "${beat.title}" to a different position in the storyboard`)
                          }
                          className="px-1.5 py-0.5 text-[8px] text-gray-500 border border-edge hover:text-gray-300 hover:border-gray-500 transition-colors"
                          title="Reorder this beat via the Agent"
                        >
                          Move
                        </button>
                        <button
                          onClick={() =>
                            sendAgentMessage(projectId, `Delete storyboard beat "${beat.title}"`)
                          }
                          className="px-1.5 py-0.5 text-[8px] text-red-700 border border-edge hover:text-red-500 hover:border-red-700 transition-colors"
                          title="Delete this beat"
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
