import { useState, useCallback, useEffect } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { apiGet, ApiError } from "../../api/client.js";

type EntryKind = "auto" | "interactive" | "deferred";

interface StateNode {
  componentId: string;
  label: string;
  trigger: string;
  entryKind: EntryKind;
  outDegree: number;
  inDegree: number;
  reachable: boolean;
  deadEnd: boolean;
}

interface StateEdge {
  from: string;
  to: string;
  kind: "temporal" | "sibling";
  lagMs?: number;
}

interface StateGraphIssue {
  kind: "unreachable" | "dead_end" | "orphan_trigger" | "complex_entry";
  subject: string;
  detail: string;
  severity: number;
}

interface TriggerCoverage {
  trigger: string;
  count: number;
  share: number;
}

interface StateGraphData {
  ok: boolean;
  componentCount: number;
  nodes: StateNode[];
  edges: StateEdge[];
  issues: StateGraphIssue[];
  triggerCoverage: TriggerCoverage[];
  reachabilityRatio: number;
  density: number;
  complexity: number;
  connectedComponents: number;
  summary: string;
}

const ENTRY_LABEL: Record<EntryKind, string> = {
  auto: "auto",
  interactive: "interact",
  deferred: "delay",
};

/**
 * State-Graph panel — visualizes the composition as a finite-state machine.
 * Shows per-state reachability, trigger coverage, structural issues, and
 * graph complexity metrics so orchestration defects become legible.
 */
export function StateGraphPanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const [data, setData] = useState<StateGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<StateGraphData>(`/projects/${projectId}/state-graph`);
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
        Open a project to analyze its state graph.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto text-xs text-gray-300">
      <div className="px-3 py-2 border-b border-edge flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">State Graph</h3>
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
          {loading ? "Building state graph..." : "Click Refresh to analyze."}
        </div>
      )}

      {data && (
        <>
          {/* Metrics */}
          <div className="px-3 py-2 border-b border-edge">
            <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
              <div>
                <span className="text-gray-500">Reachability </span>
                <span className="text-gray-200">{data.reachabilityRatio}</span>
              </div>
              <div>
                <span className="text-gray-500">Density </span>
                <span className="text-gray-200">{data.density}</span>
              </div>
              <div>
                <span className="text-gray-500">Complexity </span>
                <span className="text-gray-200">{data.complexity}</span>
              </div>
              <div>
                <span className="text-gray-500">Components </span>
                <span className="text-gray-200">{data.connectedComponents}</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">{data.summary}</p>
          </div>

          {/* Trigger coverage */}
          {data.triggerCoverage.length > 0 && (
            <div className="px-3 py-2 border-b border-edge">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Trigger Coverage
              </div>
              <div className="space-y-1">
                {data.triggerCoverage.map((cov) => (
                  <div key={cov.trigger} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-20 truncate">{cov.trigger}</span>
                    <div className="flex-1 h-1.5 bg-panel2 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-gray-400"
                        style={{ width: `${Math.round(cov.share * 100)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-600 font-mono w-6 text-right">{cov.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* States */}
          {data.nodes.length > 0 && (
            <div className="px-3 py-2 border-b border-edge">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                States
              </div>
              <div className="space-y-1">
                {data.nodes.slice(0, 10).map((n) => {
                  const flag = n.reachable ? (n.deadEnd ? "·" : "+") : "!";
                  return (
                    <div key={n.componentId} className="flex items-center gap-2 text-[10px]">
                      <span
                        className={
                          n.reachable
                            ? n.deadEnd ? "text-gray-500" : "text-gray-200"
                            : "text-red-400"
                        }
                      >
                        {flag}
                      </span>
                      <span className="text-gray-300 truncate flex-1">{n.label}</span>
                      <span className="text-[9px] text-gray-600">{ENTRY_LABEL[n.entryKind]}</span>
                      <span className="text-[9px] text-gray-600 font-mono">
                        in:{n.inDegree} out:{n.outDegree}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Issues */}
          {data.issues.length > 0 && (
            <div className="px-3 py-2 border-b border-edge">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                Issues
              </div>
              <div className="space-y-2">
                {data.issues.slice(0, 6).map((iss, i) => (
                  <div key={i} className="text-[10px]">
                    <div className="flex items-center gap-1">
                      <span
                        className="px-1 rounded text-[9px] font-mono"
                        style={{ backgroundColor: "var(--panel3)", color: "var(--text)" }}
                      >
                        {iss.kind}
                      </span>
                      <span className="text-gray-300 truncate flex-1">{iss.subject}</span>
                      <span className="text-[9px] text-gray-600">sev {iss.severity}</span>
                    </div>
                    <div className="text-[9px] text-gray-500 mt-0.5 leading-snug">{iss.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.nodes.length === 0 && (
            <div className="px-3 py-4 text-center text-[10px] text-gray-600">
              No states to analyze.
            </div>
          )}
        </>
      )}
    </div>
  );
}
