import { useState, useCallback, useEffect } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { apiGet, ApiError } from "../../api/client.js";

interface ComponentDemand {
  componentId: string;
  label: string;
  demand: number;
  magnitudeFactor: number;
  durationFactor: number;
  loopFactor: number;
  weightFactor: number;
  priority: number;
  allocation: number;
  overBudget: boolean;
  strain: number;
}

interface ReallocationSuggestion {
  componentId: string;
  label: string;
  action: "dampen_magnitude" | "shorten_duration" | "remove_loop" | "reduce_weight";
  change: string;
  demandReduction: number;
  narrativeLoss: number;
}

interface BudgetData {
  ok: boolean;
  componentCount: number;
  components: ComponentDemand[];
  totalDemand: number;
  budget: number;
  utilization: number;
  overBudget: boolean;
  headroom: number;
  reallocations: ReallocationSuggestion[];
  summary: string;
}

const ACTION_LABEL: Record<ReallocationSuggestion["action"], string> = {
  dampen_magnitude: "dampen",
  shorten_duration: "shorten",
  remove_loop: "unloop",
  reduce_weight: "reduce",
};

/**
 * Budget panel — surfaces the attention-budget allocation for the
 * composition. Shows total demand vs budget, per-component strain, and
 * reallocation suggestions when the composition is over budget.
 */
export function BudgetPanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<BudgetData>(`/projects/${projectId}/attention-budget`);
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
        Open a project to audit its attention budget.
      </div>
    );
  }

  const utilPct = data ? Math.round(data.utilization * 100) : 0;

  return (
    <div className="h-full overflow-y-auto text-xs text-gray-300">
      <div className="px-3 py-2 border-b border-edge flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Attention Budget</h3>
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
          {loading ? "Computing budget..." : "Click Refresh to audit."}
        </div>
      )}

      {data && (
        <>
          {/* Summary + utilization meter */}
          <div className="px-3 py-2 border-b border-edge">
            <div className="flex gap-3 text-[10px] mb-2">
              <span className="text-gray-500">Demand</span>
              <span className="text-gray-200">{data.totalDemand}</span>
              <span className="text-gray-500 ml-2">Budget</span>
              <span className="text-gray-200">{data.budget}</span>
              <span className="text-gray-500 ml-2">Headroom</span>
              <span className={data.overBudget ? "text-red-400" : "text-gray-200"}>{data.headroom}</span>
            </div>
            <div className="h-2 bg-panel2 rounded-sm overflow-hidden">
              <div
                className={data.overBudget ? "h-full bg-red-500" : "h-full bg-gray-300"}
                style={{ width: `${Math.min(100, utilPct)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-gray-600">
              <span>{utilPct}% utilized</span>
              <span>{data.overBudget ? "over budget" : "within budget"}</span>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed mt-2">{data.summary}</p>
          </div>

          {/* Per-component demand */}
          {data.components.length > 0 && (
            <div className="px-3 py-2 border-b border-edge">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Per-Component Strain
              </div>
              <div className="space-y-1.5">
                {data.components.slice(0, 10).map((c) => {
                  const strainPct = Math.min(100, Math.round(c.strain * 50));
                  return (
                    <div key={c.componentId}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.overBudget ? "bg-red-400" : "bg-gray-500"}`}
                        />
                        <span className="text-[10px] text-gray-300 w-20 truncate">{c.label}</span>
                        <div className="flex-1 h-1.5 bg-panel2 rounded-sm overflow-hidden">
                          <div
                            className={c.overBudget ? "h-full bg-red-400" : "h-full bg-gray-400"}
                            style={{ width: `${strainPct}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-gray-600 font-mono w-12 text-right">
                          {c.demand}/{c.allocation}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reallocations */}
          {data.reallocations.length > 0 && (
            <div className="px-3 py-2 border-b border-edge">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Reallocations
              </div>
              <div className="space-y-2">
                {data.reallocations.map((r, i) => (
                  <div key={i} className="text-[10px]">
                    <div className="flex items-center gap-1">
                      <span className="px-1 rounded text-[9px] font-mono bg-gray-700 text-gray-300">
                        {ACTION_LABEL[r.action]}
                      </span>
                      <span className="text-gray-200 truncate flex-1">{r.label}</span>
                      <span className="text-[9px] text-gray-600">-{r.demandReduction}</span>
                    </div>
                    <div className="text-[9px] text-gray-500 mt-0.5">{r.change}</div>
                    <div className="text-[9px] text-gray-600 mt-0.5">narrative loss {r.narrativeLoss}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.components.length === 0 && (
            <div className="px-3 py-4 text-center text-[10px] text-gray-600">
              No components to budget.
            </div>
          )}
        </>
      )}
    </div>
  );
}
