import { useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";
import { useUiStore } from "../../store/uiStore.js";

interface CaptureSample {
  t: number;
  x: number;
  y: number;
}

interface MotionCaptureSummary {
  id: string;
  name: string;
  description: string;
  samples: CaptureSample[];
  sampleCount: number;
  durationMs: number;
  normalized: boolean;
}

const CAPTURES_KEY = "__motionCaptures";

function readCapturesFromTokens(tokens: Record<string, string | number> | undefined): MotionCaptureSummary[] {
  if (!tokens) return [];
  const raw = tokens[CAPTURES_KEY];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c: MotionCaptureSummary & { samples?: CaptureSample[] }) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      samples: Array.isArray(c.samples) ? c.samples : [],
      sampleCount: c.samples ? c.samples.length : 0,
      durationMs: c.durationMs,
      normalized: c.normalized,
    }));
  } catch {
    return [];
  }
}

function sendAgentMessage(projectId: string, prompt: string) {
  useChatStore.getState().send(projectId, prompt);
}

/** Render a tiny SVG preview of the capture trajectory. */
function TrajectoryPreview({ samples, normalized }: { samples: CaptureSample[]; normalized: boolean }) {
  const path = useMemo(() => {
    if (samples.length < 2) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const s of samples) {
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y;
    }
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const W = 64;
    const H = 32;
    const pad = 3;
    const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
    const offsetX = pad + (W - pad * 2 - spanX * scale) / 2;
    const offsetY = pad + (H - pad * 2 - spanY * scale) / 2;
    const pts = samples.map((s) => {
      const px = offsetX + (s.x - minX) * scale;
      const py = offsetY + (s.y - minY) * scale;
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    });
    return pts.join(" ");
  }, [samples]);

  if (!path) {
    return (
      <div className="w-16 h-8 bg-bg border border-edge flex items-center justify-center">
        <span className="text-[7px] text-gray-700 font-mono">—</span>
      </div>
    );
  }

  return (
    <svg width="64" height="32" className="border border-edge bg-bg flex-shrink-0">
      <polyline
        points={path}
        fill="none"
        stroke={normalized ? "#e8e8e8" : "#888"}
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {samples.length > 0 && (
        <>
          <circle cx={path.split(" ")[0].split(",")[0]} cy={path.split(" ")[0].split(",")[1]} r="1.5" fill="#fff" />
          <circle
            cx={path.split(" ").slice(-1)[0].split(",")[0]}
            cy={path.split(" ").slice(-1)[0].split(",")[1]}
            r="1.5"
            fill="#666"
          />
        </>
      )}
    </svg>
  );
}

export function MotionCapturePanel() {
  const project = useProjectStore((s) => s.project);
  const projectId = useProjectStore((s) => s.projectId);
  const selectedComponentId = useUiStore((s) => s.selectedComponentId);
  const [query, setQuery] = useState("");

  const captures = useMemo(() => readCapturesFromTokens(project?.tokens), [project?.tokens]);

  const filtered = useMemo(() => {
    if (!query.trim()) return captures;
    const lower = query.toLowerCase();
    return captures.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.description.toLowerCase().includes(lower),
    );
  }, [captures, query]);

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
            Motion Captures
          </span>
          <span className="text-[9px] text-gray-600 font-mono">{captures.length}</span>
        </div>
        <div className="flex gap-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search captures..."
            className="flex-1 bg-bg px-2 py-1 text-[10px] text-gray-300 border border-edge focus:border-gray-500 focus:outline-none"
          />
          <button
            onClick={() => sendAgentMessage(projectId, "Seed motion captures")}
            title="Load built-in capture examples"
            aria-label="Seed capture examples"
            className="px-2 py-1 text-[10px] text-gray-400 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors"
          >
            Seed
          </button>
        </div>
      </div>

      {/* Record cursor */}
      <div className="px-3 py-2 border-b border-edge flex-shrink-0">
        <button
          onClick={() =>
            sendAgentMessage(
              projectId,
              "Record my cursor path as a motion capture called \"Drawn Path\"",
            )
          }
          className="w-full px-2 py-1.5 text-[10px] text-gray-300 border border-edge hover:text-gray-100 hover:border-gray-400 transition-colors"
          title="Record a cursor trajectory as a reusable motion capture"
        >
          ● Record Cursor Path
        </button>
        {selectedComponentId && (
          <p className="text-[8px] text-gray-600 mt-1.5 font-mono">
            Select a component, then apply a capture to trace its motion.
          </p>
        )}
      </div>

      {/* Capture list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-center text-[10px] text-gray-600">
            {captures.length === 0
              ? "No motion captures yet. Click Seed to load examples, or record a cursor path."
              : "No captures match your search."}
          </div>
        ) : (
          <div className="divide-y divide-edge">
            {filtered.map((capture) => (
              <div key={capture.id} className="px-3 py-2 hover:bg-panel2 transition-colors group">
                <div className="flex items-start gap-2 mb-1.5">
                  <TrajectoryPreview samples={capture.samples} normalized={capture.normalized} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-[11px] font-medium text-gray-200 truncate flex-1">
                        {capture.name}
                      </span>
                      <button
                        onClick={() =>
                          sendAgentMessage(
                            projectId,
                            `Delete the motion capture "${capture.name}"`,
                          )
                        }
                        title="Delete capture"
                        aria-label={`Delete capture ${capture.name}`}
                        className="text-[10px] text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                    {capture.description && (
                      <p className="text-[9px] text-gray-500 line-clamp-2 mt-0.5">
                        {capture.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-gray-600 font-mono mb-2">
                  <span>{capture.sampleCount} pts</span>
                  <span>·</span>
                  <span>{capture.durationMs}ms</span>
                  <span>·</span>
                  <span>{capture.normalized ? "normalized" : "absolute"}</span>
                </div>
                <button
                  onClick={() => {
                    if (selectedComponentId) {
                      sendAgentMessage(
                        projectId,
                        `Apply the motion capture "${capture.name}" to the selected component`,
                      );
                    } else {
                      sendAgentMessage(
                        projectId,
                        `Apply the motion capture "${capture.name}" to the first component`,
                      );
                    }
                  }}
                  disabled={!project}
                  className="w-full px-2 py-1 text-[9px] text-gray-400 border border-edge hover:text-gray-100 hover:border-gray-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Apply this capture to the selected component"
                >
                  Apply to Selected
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
