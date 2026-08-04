import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { EmptyState } from "../common/EmptyState.js";

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

/**
 * Reduce a capture to roughly N points by picking evenly spaced samples.
 * Keeps the trajectory shape while shrinking storage and smoothing
 * micro-jitter from hand movement. Used by the Simplify refinement.
 */
function simplifySamples(samples: CaptureSample[], targetCount: number): CaptureSample[] {
  if (samples.length <= targetCount) return samples;
  const step = (samples.length - 1) / (targetCount - 1);
  const out: CaptureSample[] = [];
  for (let i = 0; i < targetCount; i++) {
    out.push(samples[Math.round(i * step)]);
  }
  return out;
}

/**
 * Normalize a capture so its bounding box fits in a 0..1 range on both
 * axes. Lets the same trajectory drive components of any size without
 * manual rescaling. Returns new samples with x/y in 0..1.
 */
function normalizeSamples(samples: CaptureSample[]): CaptureSample[] {
  if (samples.length === 0) return samples;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of samples) {
    if (s.x < minX) minX = s.x;
    if (s.x > maxX) maxX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.y > maxY) maxY = s.y;
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  return samples.map((s) => ({ t: s.t, x: (s.x - minX) / spanX, y: (s.y - minY) / spanY }));
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

/**
 * Playback scrubber — renders the capture trajectory at full width with
 * a draggable playhead. Lets the user scrub through the captured motion
 * to inspect timing and shape before applying it to a component. The
 * playhead position doubles as a "preview here" indicator.
 */
function PlaybackScrubber({ samples, normalized }: { samples: CaptureSample[]; normalized: boolean }) {
  const [playhead, setPlayhead] = useState(0);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const geometry = useMemo(() => {
    if (samples.length < 2) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of samples) {
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y;
    }
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const W = 200;
    const H = 48;
    const pad = 4;
    const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
    const offsetX = pad + (W - pad * 2 - spanX * scale) / 2;
    const offsetY = pad + (H - pad * 2 - spanY * scale) / 2;
    const pts = samples.map((s) => ({
      x: offsetX + (s.x - minX) * scale,
      y: offsetY + (s.y - minY) * scale,
    }));
    return { pts, W, H };
  }, [samples]);

  const handlePointer = useCallback((e: React.PointerEvent) => {
    if (!svgRef.current || !geometry) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setPlayhead(ratio);
  }, [geometry]);

  if (!geometry) {
    return (
      <div className="text-[9px] text-gray-700 font-mono py-1 text-center">
        Not enough samples to preview
      </div>
    );
  }

  const polyPoints = geometry.pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const headIdx = Math.min(geometry.pts.length - 1, Math.floor(playhead * (geometry.pts.length - 1)));
  const head = geometry.pts[headIdx];

  return (
    <div className="mt-1.5">
      <svg
        ref={svgRef}
        width="100%"
        height={geometry.H}
        className="border border-edge bg-bg cursor-pointer touch-none"
        viewBox={`0 0 ${geometry.W} ${geometry.H}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handlePointer(e); }}
        onPointerMove={(e) => { if (e.buttons > 0) handlePointer(e); }}
      >
        <polyline
          points={polyPoints}
          fill="none"
          stroke={normalized ? "#e8e8e8" : "#666"}
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={head.x} cy={head.y} r="2.5" fill="#fff" />
      </svg>
      <div className="flex items-center justify-between text-[8px] text-gray-600 font-mono mt-0.5">
        <span>{(playhead * 100).toFixed(0)}%</span>
        <span>{samples.length} pts</span>
      </div>
    </div>
  );
}

export function MotionCapturePanel() {
  const project = useProjectStore((s) => s.project);
  const projectId = useProjectStore((s) => s.projectId);
  const selectedComponentId = useUiStore((s) => s.selectedComponentId);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Live cursor recorder state. While recording, we attach a window-level
  // pointermove listener and collect {t,x,y} samples relative to the
  // canvas element. The recording stops on pointerup or after a 10s cap.
  const [recording, setRecording] = useState(false);
  const [liveSamples, setLiveSamples] = useState<CaptureSample[]>([]);
  const recordStartRef = useRef<number>(0);
  const liveSamplesRef = useRef<CaptureSample[]>([]);

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

  // Live recorder effect — listens to global pointermove while recording
  // and accumulates samples. Stops on pointerup. Samples are stored in a
  // ref to avoid re-rendering on every move; the visible count is flushed
  // via a throttled setState.
  useEffect(() => {
    if (!recording) return;
    let flushHandle: number | null = null;
    const flush = () => {
      setLiveSamples([...liveSamplesRef.current]);
      flushHandle = null;
    };
    const scheduleFlush = () => {
      if (flushHandle === null) {
        flushHandle = window.setTimeout(flush, 80);
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      const canvasEl = document.querySelector("[data-om-canvas]") as HTMLElement | null;
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      const x = (e.clientX - rect.left) / Math.max(1, rect.width);
      const y = (e.clientY - rect.top) / Math.max(1, rect.height);
      liveSamplesRef.current.push({ t: performance.now() - recordStartRef.current, x, y });
      scheduleFlush();
    };
    const onPointerUp = () => {
      setRecording(false);
      flush();
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (flushHandle !== null) window.clearTimeout(flushHandle);
    };
  }, [recording]);

  const startLiveRecord = useCallback(() => {
    liveSamplesRef.current = [];
    setLiveSamples([]);
    recordStartRef.current = performance.now();
    setRecording(true);
  }, []);

  const stopAndCommitLive = useCallback(() => {
    setRecording(false);
    const samples = [...liveSamplesRef.current];
    setLiveSamples([]);
    if (!projectId || samples.length < 2) return;
    // Send the captured trajectory to the agent so it can persist it as a
    // motion capture and offer to apply it to a component. The payload is
    // a compact JSON so the agent can parse it without truncation.
    const payload = JSON.stringify(samples);
    sendAgentMessage(
      projectId,
      `Save this cursor trajectory as a motion capture named "Live Capture" and apply it to ${selectedComponentId ? "the selected component" : "the first component"}. Samples (t ms, x 0..1, y 0..1): ${payload}`,
    );
  }, [projectId, selectedComponentId]);

  if (!projectId) {
    return (
      <EmptyState
        icon="◇"
        title="No project loaded"
        hint="Open or create a project to start capturing motion."
      />
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

      {/* Record cursor — live client-side recorder with agent fallback */}
      <div className="px-3 py-2 border-b border-edge flex-shrink-0">
        {!recording ? (
          <button
            onClick={startLiveRecord}
            className="w-full px-2 py-1.5 text-[10px] text-gray-300 border border-edge hover:text-gray-100 hover:border-gray-400 transition-colors flex items-center justify-center gap-1.5"
            title="Move your cursor over the canvas; click to stop and save"
            aria-label="Start live cursor recording"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Record Live Cursor
          </button>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-200">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono">REC</span>
              <span className="text-gray-600">·</span>
              <span className="font-mono text-gray-400">{liveSamples.length} pts</span>
              <button
                onClick={stopAndCommitLive}
                className="ml-auto text-[10px] px-2 py-0.5 bg-white text-black rounded font-medium hover:bg-gray-200 transition-colors"
                title="Stop and save the recording"
                aria-label="Stop recording"
              >
                Stop
              </button>
            </div>
            {liveSamples.length > 1 && (
              <TrajectoryPreview samples={liveSamples} normalized={false} />
            )}
            <p className="text-[8px] text-gray-600 font-mono">
              Move over the canvas, then click Stop to send to the agent.
            </p>
          </div>
        )}
        {selectedComponentId && !recording && (
          <p className="text-[8px] text-gray-600 mt-1.5 font-mono">
            Select a component, then apply a capture to trace its motion.
          </p>
        )}
      </div>

      {/* Capture list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          captures.length === 0 ? (
            <EmptyState
              icon="∿"
              title="No motion captures yet"
              hint="Record a live cursor path, or seed built-in examples to get started."
              actionLabel="Seed examples"
              onAction={() => sendAgentMessage(projectId, "Seed motion captures")}
            />
          ) : (
            <EmptyState icon="?" title="No matches" hint="No captures match your search." />
          )
        ) : (
          <div className="divide-y divide-edge">
            {filtered.map((capture) => {
              const isExpanded = expandedId === capture.id;
              return (
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
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : capture.id)}
                    className="ml-auto text-[9px] text-gray-500 hover:text-gray-200 underline"
                    aria-expanded={isExpanded}
                    aria-label={`Toggle scrubber for ${capture.name}`}
                  >
                    {isExpanded ? "hide" : "scrub"}
                  </button>
                </div>
                {isExpanded && (
                  <PlaybackScrubber samples={capture.samples} normalized={capture.normalized} />
                )}
                <div className="flex gap-1 mt-1.5">
                  <button
                    onClick={() => {
                      const simplified = simplifySamples(capture.samples, 32);
                      sendAgentMessage(
                        projectId,
                        `Replace the motion capture "${capture.name}" with this simplified version (32 points): ${JSON.stringify(simplified)}`,
                      );
                    }}
                    className="flex-1 px-1.5 py-0.5 text-[9px] text-gray-500 border border-edge hover:text-gray-200 hover:border-gray-500 transition-colors"
                    title="Reduce to 32 evenly spaced points"
                    aria-label={`Simplify capture ${capture.name}`}
                  >
                    Simplify
                  </button>
                  <button
                    onClick={() => {
                      const normalized = normalizeSamples(capture.samples);
                      sendAgentMessage(
                        projectId,
                        `Replace the motion capture "${capture.name}" with this normalized version (0..1 range): ${JSON.stringify(normalized)}`,
                      );
                    }}
                    className="flex-1 px-1.5 py-0.5 text-[9px] text-gray-500 border border-edge hover:text-gray-200 hover:border-gray-500 transition-colors"
                    title="Scale coordinates to 0..1 range"
                    aria-label={`Normalize capture ${capture.name}`}
                  >
                    Normalize
                  </button>
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
                  className="w-full mt-1.5 px-2 py-1 text-[9px] text-gray-400 border border-edge hover:text-gray-100 hover:border-gray-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Apply this capture to the selected component"
                >
                  Apply to Selected
                </button>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
