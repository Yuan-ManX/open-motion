import { useState, useCallback, useEffect } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { apiGet, ApiError } from "../../api/client.js";

interface PerceivedQuality {
  quality: string;
  strength: number;
  present: boolean;
  signals: string[];
}

interface CausalLink {
  cause: string;
  effect: string;
  confidence: number;
  necessity: number;
  sufficiency: number;
  evidence: string;
}

interface RootCause {
  cause: string;
  influence: number;
  affectedQualities: string[];
  breadth: number;
}

interface InterventionSuggestion {
  targetQuality: string;
  direction: "amplify" | "dampen";
  action: string;
  expectedDelta: number;
  risk: string;
}

interface CausalData {
  ok: boolean;
  componentCount: number;
  qualities: PerceivedQuality[];
  causalLinks: CausalLink[];
  rootCauses: RootCause[];
  interventions: InterventionSuggestion[];
  summary: string;
}

/**
 * Causal Inference panel — surfaces the counterfactual attribution of
 * perceived qualities. For each quality the composition exhibits, shows
 * which design decisions actually cause it (necessity / sufficiency), the
 * root causes that touch multiple qualities, and targeted interventions.
 */
export function CausalInferencePanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const [data, setData] = useState<CausalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<CausalData>(`/projects/${projectId}/causal`);
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
        Open a project to analyze causality.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto text-xs text-gray-300">
      <div className="px-3 py-2 border-b border-edge flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Causal Inference</h3>
        <button
          onClick={() => void run()}
          disabled={loading}
          className="px-1.5 py-0.5 text-[9px] bg-panel2 hover:bg-panel3 rounded text-gray-300 disabled:opacity-40"
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 border-b border-edge text-[10px] text-red-400">
          {error}
        </div>
      )}

      {!data && !error && (
        <div className="px-3 py-4 text-center text-[10px] text-gray-600">
          {loading ? "Analyzing causality..." : "Click Refresh to analyze."}
        </div>
      )}

      {data && (
        <>
          {/* Summary */}
          <div className="px-3 py-2 border-b border-edge">
            <div className="flex gap-2 text-[10px] mb-1">
              <span className="text-gray-500">Components:</span>
              <span className="text-gray-200">{data.componentCount}</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">{data.summary}</p>
          </div>

          {/* Perceived Qualities */}
          {data.qualities.length > 0 && (
            <div className="px-3 py-2 border-b border-edge">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Perceived Qualities
              </div>
              <div className="space-y-1">
                {data.qualities.map((q) => (
                  <div key={q.quality} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${q.present ? "bg-white" : "bg-gray-700"}`} />
                    <span className="text-[10px] text-gray-300 w-16 truncate">{q.quality}</span>
                    <div className="flex-1 h-1.5 bg-panel2 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-gray-300"
                        style={{ width: `${Math.round(q.strength * 100)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-600 font-mono w-7 text-right">
                      {Math.round(q.strength * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Causal Links */}
          {data.causalLinks.length > 0 && (
            <div className="px-3 py-2 border-b border-edge">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Causal Links
              </div>
              <div className="space-y-2">
                {data.causalLinks.slice(0, 8).map((l, i) => (
                  <div key={i} className="text-[10px]">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-300 truncate flex-1">{l.cause}</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-gray-200 truncate flex-1">{l.effect}</span>
                    </div>
                    <div className="flex gap-2 mt-0.5 text-[9px] text-gray-600">
                      <span>nec {l.necessity}</span>
                      <span>suf {l.sufficiency}</span>
                      <span>conf {l.confidence}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Root Causes */}
          {data.rootCauses.length > 0 && (
            <div className="px-3 py-2 border-b border-edge">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Root Causes
              </div>
              <div className="space-y-1">
                {data.rootCauses.slice(0, 5).map((r, i) => (
                  <div key={i} className="text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-300 truncate flex-1">{r.cause}</span>
                      <span className="text-[9px] text-gray-600 font-mono">
                        inf {r.influence} · breadth {r.breadth}
                      </span>
                    </div>
                    <div className="text-[9px] text-gray-600 truncate">
                      {r.affectedQualities.join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interventions */}
          {data.interventions.length > 0 && (
            <div className="px-3 py-2 border-b border-edge">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Interventions
              </div>
              <div className="space-y-2">
                {data.interventions.map((iv, i) => (
                  <div key={i} className="text-[10px]">
                    <div className="flex items-center gap-1">
                      <span
                        className={`px-1 rounded text-[9px] font-mono ${
                          iv.direction === "amplify"
                            ? "bg-gray-300 text-black"
                            : "bg-gray-700 text-gray-300"
                        }`}
                      >
                        {iv.direction === "amplify" ? "↑" : "↓"}
                      </span>
                      <span className="text-gray-200">{iv.targetQuality}</span>
                      <span className="text-[9px] text-gray-600 ml-auto">
                        Δ {iv.expectedDelta > 0 ? "+" : ""}{iv.expectedDelta}
                      </span>
                    </div>
                    <div className="text-[9px] text-gray-400 mt-0.5">{iv.action}</div>
                    <div className="text-[9px] text-gray-600 mt-0.5">risk: {iv.risk}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.causalLinks.length === 0 && data.rootCauses.length === 0 && (
            <div className="px-3 py-4 text-center text-[10px] text-gray-600">
              No causal links detected — try adding more varied motion.
            </div>
          )}
        </>
      )}
    </div>
  );
}
