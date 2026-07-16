import { useState, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";
import * as api from "../../api/endpoints.js";
import type { PerformanceReport, PerformanceIssue } from "../../api/endpoints.js";

const SEVERITY_COLORS: Record<PerformanceIssue["severity"], string> = {
  critical: "text-red-400 border-red-500/50",
  warning: "text-yellow-400 border-yellow-500/50",
  info: "text-gray-400 border-gray-500/50",
};

const SEVERITY_ICONS: Record<PerformanceIssue["severity"], string> = {
  critical: "✕",
  warning: "▲",
  info: "i",
};

/** Performance Budget panel — fetches a direct report from the backend
 *  and displays frame-time estimates, per-component costs, and optimization
 *  suggestions. */
export function PerformancePanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.getPerformanceReport(projectId);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run performance check");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        No project loaded.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with run button */}
      <div className="px-3 py-2 border-b border-edge flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
            Performance Budget
          </span>
          {report && (
            <span className={`text-[10px] font-mono font-bold ${
              report.achieves60fps ? "text-gray-200" : "text-red-400"
            }`}>
              {report.frameTimeMs.toFixed(1)}ms
            </span>
          )}
        </div>
        <button
          onClick={runCheck}
          disabled={loading}
          className="w-full px-2 py-1.5 text-[10px] text-gray-300 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors disabled:opacity-50"
          title="Run performance check directly"
        >
          {loading ? "Profiling…" : "Run Performance Check"}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="px-3 py-2 text-[10px] text-red-400 border-b border-edge">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-4 h-4 border border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Results */}
      {report && !loading && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Frame budget summary */}
          <div className="px-3 py-2 border-b border-edge bg-panel2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-gray-500">Frame Budget</span>
              <span className={`text-[9px] font-mono font-bold ${
                report.achieves60fps ? "text-gray-200" : "text-red-400"
              }`}>
                {report.achieves60fps ? "✓ 60fps" : "✕ Drops"}
              </span>
            </div>
            {/* Frame time bar */}
            <div className="h-2 bg-edge rounded-full overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all ${
                  report.achieves60fps ? "bg-gray-300" : "bg-red-500"
                }`}
                style={{ width: `${Math.min(100, (report.frameTimeMs / report.targetFrameMs) * 100)}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-px bg-yellow-400"
                style={{ left: "100%" }}
                title={`${report.targetFrameMs}ms target`}
              />
            </div>
            <div className="flex justify-between text-[8px] text-gray-600 mt-1">
              <span>{report.frameTimeMs.toFixed(1)}ms estimated</span>
              <span>{report.targetFrameMs}ms target (60fps)</span>
            </div>
          </div>

          {/* Per-component costs */}
          {report.componentCosts && report.componentCosts.length > 0 && (
            <div className="px-3 py-2 border-b border-edge">
              <div className="text-[8px] font-mono uppercase text-gray-600 mb-2">Component Costs</div>
              <div className="space-y-1">
                {report.componentCosts
                  .sort((a, b) => b.cost - a.cost)
                  .slice(0, 8)
                  .map((cc) => (
                    <div key={cc.componentId} className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-400 truncate flex-1">{cc.componentName}</span>
                      <div className="w-16 h-1.5 bg-edge rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            cc.cost > 8 ? "bg-red-500" : cc.cost > 4 ? "bg-yellow-500" : "bg-gray-300"
                          }`}
                          style={{ width: `${Math.min(100, cc.cost * 10)}%` }}
                        />
                      </div>
                      <span className="text-[8px] font-mono text-gray-500 w-8 text-right">{cc.cost.toFixed(1)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Issues list */}
          <div className="px-3 py-2 space-y-1.5">
            {report.issues.length === 0 ? (
              <div className="text-center text-[10px] text-gray-500 py-4">
                No performance issues detected.
              </div>
            ) : (
              report.issues.map((issue, i) => (
                <div
                  key={i}
                  className={`border ${SEVERITY_COLORS[issue.severity]} p-2 rounded`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[9px] font-bold">{SEVERITY_ICONS[issue.severity]}</span>
                    <span className="text-[8px] font-mono uppercase tracking-wider text-gray-500">
                      {issue.category}
                    </span>
                    {issue.componentName && (
                      <span className="text-[8px] text-gray-600 ml-auto truncate max-w-[80px]">
                        {issue.componentName}
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] text-gray-400 leading-relaxed mb-1">
                    {issue.message}
                  </div>
                  <div className="text-[9px] text-gray-600 leading-relaxed">
                    <span className="text-gray-500">Fix: </span>{issue.suggestion}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Empty state — before first check */}
      {!report && !loading && !error && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-4 py-6 text-center text-[10px] text-gray-600">
            Click "Run Performance Check" to analyze paint complexity, layout
            triggers, simultaneous animations, and estimated frame time.
          </div>
          <div className="px-3 pb-3 space-y-2">
            <div className="border border-edge p-2">
              <div className="text-[8px] font-mono uppercase text-gray-600 mb-1">What it tracks</div>
              <ul className="text-[9px] text-gray-500 space-y-1">
                <li><span className="text-gray-400">▣</span> Paint — blur, shadow, gradient cost</li>
                <li><span className="text-gray-400">↔</span> Layout — reflow-triggering properties</li>
                <li><span className="text-gray-400">◈</span> Composite — transform/opacity (cheap)</li>
                <li><span className="text-gray-400">◑</span> Simultaneous — concurrent animation count</li>
                <li><span className="text-gray-400">⏱</span> Frame time — estimated ms vs 16ms budget</li>
              </ul>
            </div>
            <button
              onClick={() => useChatStore.getState().send(projectId, "Check the performance and frame budget of all motion in this project")}
              className="w-full text-[9px] text-gray-600 hover:text-gray-400 transition-colors py-1"
            >
              Or run via Agent chat →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
