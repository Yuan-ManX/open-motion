import { useState, useCallback, useEffect } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { apiGet, ApiError } from "../../api/client.js";

type NarrativeBeat = "setup" | "rising" | "climax" | "resolution";

interface NarrativeNode {
  componentId: string;
  label: string;
  beat: NarrativeBeat;
  startMs: number;
  endMs: number;
  magnitude: number;
  magnitudeProfile: number;
  durationShare: number;
}

interface BeatPacing {
  beat: NarrativeBeat;
  count: number;
  durationShare: number;
}

interface NarrativeFinding {
  kind: "missing_beat" | "weak_climax" | "pacing_imbalance" | "no_resolution";
  subject: string;
  detail: string;
  severity: number;
}

interface NarrativeData {
  ok: boolean;
  componentCount: number;
  nodes: NarrativeNode[];
  pacing: BeatPacing[];
  findings: NarrativeFinding[];
  totalDurationMs: number;
  beatsPresent: NarrativeBeat[];
  beatsMissing: NarrativeBeat[];
  climaxMagnitude: number;
  complete: boolean;
  summary: string;
}

const BEAT_COLORS: Record<NarrativeBeat, string> = {
  setup: "bg-gray-700",
  rising: "bg-gray-500",
  climax: "bg-white",
  resolution: "bg-gray-400",
};

const BEAT_LABEL: Record<NarrativeBeat, string> = {
  setup: "Setup",
  rising: "Rising",
  climax: "Climax",
  resolution: "Resolution",
};

const ALL_BEATS: NarrativeBeat[] = ["setup", "rising", "climax", "resolution"];

/**
 * Narrative panel — surfaces the story-arc analysis of the composition.
 * Each component is mapped to a beat (setup / rising / climax / resolution)
 * by timing and magnitude; the panel flags missing beats, weak climaxes,
 * pacing imbalances, and compositions that climax without resolving.
 */
export function NarrativePanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const [data, setData] = useState<NarrativeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<NarrativeData>(`/projects/${projectId}/narrative`);
      setData(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      void run();
    } else {
      setData(null);
    }
  }, [projectId, run]);

  if (!projectId) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        Open a project to analyze its narrative arc.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto text-xs text-gray-300">
      <div className="px-3 py-2 border-b border-edge flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Narrative Arc</h3>
        <button
          onClick={() => void run()}
          disabled={loading}
          className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 border-b border-edge text-[10px] text-red-400">{error}</div>
      )}

      {!data && !error && (
        <div className="px-3 py-4 text-center text-[10px] text-gray-600">
          {loading ? "Analyzing narrative arc..." : "Click Refresh to analyze."}
        </div>
      )}

      {data && (
        <>
          {/* Summary */}
          <div className="px-3 py-2 border-b border-edge">
            <div className="flex flex-wrap gap-2 text-[10px] mb-1">
              <span className="text-gray-500">Components:</span>
              <span className="text-gray-200">{data.componentCount}</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-500">Duration:</span>
              <span className="text-gray-200 font-mono">{data.totalDurationMs}ms</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-500">Climax mag:</span>
              <span className="text-gray-200 font-mono">{Math.round(data.climaxMagnitude)}</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">{data.summary}</p>
          </div>

          {/* Beat coverage strip */}
          <div className="px-3 py-2 border-b border-edge">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Beat Coverage
            </div>
            <div className="flex gap-1">
              {ALL_BEATS.map((beat) => {
                const present = data.beatsPresent.includes(beat);
                return (
                  <div
                    key={beat}
                    className={`flex-1 px-1 py-1 border border-edge text-center ${
                      present ? "bg-panel2" : "bg-bg"
                    }`}
                    title={present ? `${BEAT_LABEL[beat]} present` : `${BEAT_LABEL[beat]} missing`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full mx-auto mb-1 ${
                        present ? BEAT_COLORS[beat] : "bg-transparent border border-gray-700"
                      }`}
                    />
                    <div className={`text-[9px] ${present ? "text-gray-300" : "text-gray-700"}`}>
                      {BEAT_LABEL[beat]}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 text-[9px] text-gray-500">
              Arc {data.complete ? "complete" : "incomplete"} ·{" "}
              {data.beatsMissing.length > 0
                ? `missing: ${data.beatsMissing.join(", ")}`
                : "all beats present"}
            </div>
          </div>

          {/* Pacing balance */}
          {data.pacing.length > 0 && (
            <div className="px-3 py-2 border-b border-edge">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Pacing Balance
              </div>
              <div className="space-y-1">
                {data.pacing.map((p) => (
                  <div key={p.beat} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-16 truncate">{BEAT_LABEL[p.beat]}</span>
                    <div className="flex-1 h-1.5 bg-panel2 rounded-sm overflow-hidden">
                      <div
                        className={`h-full ${BEAT_COLORS[p.beat]}`}
                        style={{ width: `${Math.round(p.durationShare * 100)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-600 font-mono w-10 text-right">
                      {p.count}c · {Math.round(p.durationShare * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Findings */}
          {data.findings.length > 0 && (
            <div className="px-3 py-2 border-b border-edge">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Findings
              </div>
              <div className="space-y-2">
                {data.findings.map((f, i) => (
                  <div key={i} className="text-[10px]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1 rounded text-[9px] font-mono ${
                          f.severity >= 0.7
                            ? "bg-gray-300 text-black"
                            : f.severity >= 0.5
                              ? "bg-gray-500 text-black"
                              : "bg-gray-700 text-gray-300"
                        }`}
                      >
                        {f.severity.toFixed(2)}
                      </span>
                      <span className="text-gray-300 truncate flex-1">{f.kind}</span>
                      <span className="text-[9px] text-gray-600 font-mono">{f.subject}</span>
                    </div>
                    <div className="text-[9px] text-gray-500 mt-0.5 leading-relaxed">{f.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Beat map (chronological) */}
          {data.nodes.length > 0 && (
            <div className="px-3 py-2 border-b border-edge">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Beats (chronological)
              </div>
              <div className="space-y-1">
                {[...data.nodes]
                  .sort((a, b) => a.startMs - b.startMs)
                  .slice(0, 12)
                  .map((n) => (
                    <div key={n.componentId} className="flex items-center gap-2 text-[10px]">
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${BEAT_COLORS[n.beat]}`}
                        title={BEAT_LABEL[n.beat]}
                      />
                      <span className="text-gray-300 truncate flex-1">{n.label}</span>
                      <span className="text-[9px] text-gray-600 font-mono">
                        {n.startMs}-{n.endMs}ms
                      </span>
                      <span className="text-[9px] text-gray-700 font-mono w-8 text-right">
                        m{n.magnitude}
                      </span>
                    </div>
                  ))}
              </div>
              {data.nodes.length > 12 && (
                <div className="text-[9px] text-gray-700 mt-1 text-center">
                  +{data.nodes.length - 12} more
                </div>
              )}
            </div>
          )}

          {data.nodes.length === 0 && (
            <div className="px-3 py-4 text-center text-[10px] text-gray-600">
              No components to map — add motion to see the narrative arc.
            </div>
          )}
        </>
      )}
    </div>
  );
}
