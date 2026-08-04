import { useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";
import { buildMotionDna } from "../../motion/dna.js";
import * as api from "../../api/endpoints.js";
import type { AgentSelfTestResult } from "../../api/endpoints.js";

interface ScoreRing {
  label: string;
  value: number;
  hint: string;
  trigger: string;
  icon: string;
}

/**
 * Aggregate motion quality dashboard. Computes live DNA diversity from the
 * current components and offers one-click Agent checks for accessibility,
 * performance, animation principles, and restraint budget.
 */
export function HealthDashboard() {
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);

  const stats = useMemo(() => {
    if (components.length === 0) return null;
    const easingCounts: Record<string, number> = {};
    const durationBuckets = { fast: 0, normal: 0, slow: 0 };
    const loopCounts = { once: 0, finite: 0, infinite: 0 };
    const propSet = new Set<string>();
    let totalKeyframes = 0;

    for (const c of components) {
      const dna = buildMotionDna(c);
      const parts = dna.split("|");
      const easingToken = parts[0] ?? "LINEAR";
      easingCounts[easingToken] = (easingCounts[easingToken] ?? 0) + 1;

      if (c.durationMs < 500) durationBuckets.fast++;
      else if (c.durationMs <= 1500) durationBuckets.normal++;
      else durationBuckets.slow++;

      if (c.iterationCount === "infinite") loopCounts.infinite++;
      else if (c.iterationCount === 1) loopCounts.once++;
      else loopCounts.finite++;

      for (const kf of c.keyframes) {
        totalKeyframes++;
        for (const key of Object.keys(kf.properties)) propSet.add(key);
      }
    }

    const easingEntries = Object.entries(easingCounts).sort((a, b) => b[1] - a[1]);
    const maxEasing = easingEntries[0]?.[1] ?? 0;
    const diversity = Math.round((easingEntries.length / Math.max(1, components.length)) * 100);
    const monotony = maxEasing > 1 && easingEntries.length === 1 ? 100 : Math.round((maxEasing / components.length) * 100);

    return {
      easingEntries,
      durationBuckets,
      loopCounts,
      propSet: Array.from(propSet),
      totalKeyframes,
      diversity,
      monotony,
      componentCount: components.length,
    };
  }, [components]);

  // Agent stack self-test result — a canned round-trip that verifies the
  // orchestration pipeline (thinking -> plan -> tool calls -> done) without
  // depending on the current project's content.
  const [selfTest, setSelfTest] = useState<AgentSelfTestResult | null>(null);
  const [selfTestBusy, setSelfTestBusy] = useState(false);

  if (!projectId) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        No project loaded.
      </div>
    );
  }

  const send = useChatStore.getState().send;

  const runSelfTest = async () => {
    setSelfTestBusy(true);
    try {
      const result = await api.selfTestAgent();
      setSelfTest(result);
    } catch (e) {
      setSelfTest({
        ok: false,
        prompt: "",
        durationMs: 0,
        events: [],
        toolCalls: 0,
        sawSpecUpdate: false,
        sawDone: false,
        sawError: true,
        errors: [e instanceof Error ? e.message : String(e)],
      });
    } finally {
      setSelfTestBusy(false);
    }
  };

  const rings: ScoreRing[] = [
    { label: "Accessibility", value: 0, hint: "Vestibular, seizure, reduced-motion, cognitive", trigger: "Check the accessibility and safety of all motion in this project", icon: "⊘" },
    { label: "Performance", value: 0, hint: "Paint, layout, composite, frame budget", trigger: "Check the performance and frame budget of all motion in this project", icon: "⚡" },
    { label: "Principles", value: 0, hint: "The 12 fundamental principles of animation", trigger: "Analyze the animation principles of all components in this project", icon: "✦" },
    { label: "Restraint", value: 0, hint: "Motion density, loop competition, timing", trigger: "Analyze the restraint budget of this project", icon: "◐" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-edge flex-shrink-0">
        <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
          Motion Health
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {!stats ? (
          <div className="px-4 py-6 text-center text-[10px] text-gray-600">
            Add components to see motion health metrics.
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-1.5">
              <StatCell label="Components" value={String(stats.componentCount)} />
              <StatCell label="Keyframes" value={String(stats.totalKeyframes)} />
              <StatCell label="Properties" value={String(stats.propSet.length)} />
            </div>

            {/* DNA diversity */}
            <div className="border border-edge p-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[8px] font-mono uppercase text-gray-600">DNA Diversity</span>
                <span className="text-[9px] font-mono text-gray-400">{stats.diversity}%</span>
              </div>
              <div className="h-1 bg-panel2 mb-2">
                <div className="h-full bg-accent" style={{ width: `${stats.diversity}%` }} />
              </div>
              <div className="space-y-1">
                {stats.easingEntries.map(([easing, count]) => (
                  <div key={easing} className="flex items-center gap-1.5">
                    <span className="text-[8px] font-mono text-gray-500 w-14 truncate">{easing}</span>
                    <div className="flex-1 h-1.5 bg-panel2">
                      <div
                        className="h-full bg-gray-400"
                        style={{ width: `${(count / stats.componentCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-mono text-gray-600 w-4 text-right">{count}</span>
                  </div>
                ))}
              </div>
              {stats.monotony >= 80 && stats.componentCount > 2 && (
                <div className="mt-1.5 text-[8px] text-gray-500">
                  ⚠ Easing monotony detected — consider varying easing families.
                </div>
              )}
            </div>

            {/* Duration distribution */}
            <div className="border border-edge p-2">
              <div className="text-[8px] font-mono uppercase text-gray-600 mb-1.5">Duration Spread</div>
              <div className="grid grid-cols-3 gap-1.5">
                <DurationCell label="Fast" count={stats.durationBuckets.fast} total={stats.componentCount} color="bg-gray-300" />
                <DurationCell label="Normal" count={stats.durationBuckets.normal} total={stats.componentCount} color="bg-gray-400" />
                <DurationCell label="Slow" count={stats.durationBuckets.slow} total={stats.componentCount} color="bg-gray-500" />
              </div>
            </div>

            {/* Loop distribution */}
            <div className="border border-edge p-2">
              <div className="text-[8px] font-mono uppercase text-gray-600 mb-1.5">Loop Behavior</div>
              <div className="flex gap-1.5">
                <LoopChip label="Once" count={stats.loopCounts.once} />
                <LoopChip label="Finite" count={stats.loopCounts.finite} />
                <LoopChip label="∞" count={stats.loopCounts.infinite} />
              </div>
              {stats.loopCounts.infinite > 2 && (
                <div className="mt-1.5 text-[8px] text-gray-500">
                  ⚠ Multiple infinite loops compete for attention.
                </div>
              )}
            </div>

            {/* Animated properties */}
            <div className="border border-edge p-2">
              <div className="text-[8px] font-mono uppercase text-gray-600 mb-1.5">Animated Properties</div>
              <div className="flex flex-wrap gap-1">
                {stats.propSet.length === 0 ? (
                  <span className="text-[8px] text-gray-600">No animated properties yet.</span>
                ) : (
                  stats.propSet.map((p) => (
                    <span key={p} className="px-1.5 py-0.5 text-[8px] font-mono text-gray-400 border border-edge">
                      {p}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Quality checks */}
            <div className="space-y-1.5">
              <div className="text-[8px] font-mono uppercase text-gray-600 px-1">Quality Checks</div>
              {rings.map((r) => (
                <button
                  key={r.label}
                  onClick={() => send(projectId, r.trigger)}
                  className="w-full border border-edge p-2 hover:border-gray-500 transition-colors text-left group"
                  title={`Run ${r.label.toLowerCase()} check via the Agent`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400 group-hover:text-gray-200">{r.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-gray-300 group-hover:text-gray-100">{r.label}</div>
                      <div className="text-[8px] text-gray-600 truncate">{r.hint}</div>
                    </div>
                    <span className="text-[9px] text-gray-600 group-hover:text-gray-400">→</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Full report */}
            <button
              onClick={() => send(projectId, "Generate comprehensive motion documentation for this project including accessibility, performance, and storyboard sections")}
              className="w-full px-2 py-2 text-[10px] text-gray-200 bg-panel2 border border-edge hover:border-gray-500 transition-colors"
              title="Generate a full motion documentation report via the Agent"
            >
              Generate Full Report
            </button>

            {/* Agent stack self-test */}
            <div className="border border-edge p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-mono uppercase text-gray-600">Agent Stack</span>
                {selfTest && (
                  <span className={`text-[8px] font-mono ${selfTest.ok ? "text-gray-400" : "text-red-400"}`}>
                    {selfTest.ok ? "OK" : "FAIL"}
                  </span>
                )}
              </div>
              <button
                onClick={runSelfTest}
                disabled={selfTestBusy}
                className="w-full px-2 py-1.5 text-[9px] text-gray-200 bg-panel2 border border-edge hover:border-gray-500 transition-colors disabled:opacity-50"
                title="Run a canned agent round-trip to verify the orchestration stack is healthy"
              >
                {selfTestBusy ? "Running…" : "Run Self-Test"}
              </button>
              {selfTest && (
                <div className="space-y-1 text-[8px] font-mono text-gray-500">
                  <div className="flex justify-between">
                    <span>Duration</span>
                    <span className="text-gray-300">{selfTest.durationMs}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tool Calls</span>
                    <span className="text-gray-300">{selfTest.toolCalls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Events</span>
                    <span className="text-gray-300">{selfTest.events.length}</span>
                  </div>
                  {selfTest.events.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 pt-0.5">
                      {selfTest.events.map((ev, i) => (
                        <span key={i} className="px-1 py-0.5 text-[7px] text-gray-400 border border-edge">
                          {ev}
                        </span>
                      ))}
                    </div>
                  )}
                  {selfTest.errors.length > 0 && (
                    <div className="pt-0.5 text-red-400 break-words">
                      {selfTest.errors.join("; ")}
                    </div>
                  )}
                  {selfTest.scenarios && selfTest.scenarios.length > 0 && (
                    <div className="pt-1 space-y-0.5 border-t border-edge">
                      <div className="text-[7px] uppercase text-gray-600 pt-0.5">
                        {selfTest.scenarios.filter((s) => s.ok).length}/{selfTest.scenarios.length} scenarios
                      </div>
                      {selfTest.scenarios.map((s) => (
                        <div key={s.name} className="flex items-center justify-between gap-1">
                          <span className={s.ok ? "text-gray-400" : "text-red-400"}>{s.name}</span>
                          <span className="flex items-center gap-1">
                            <span className="text-gray-600">{s.durationMs}ms</span>
                            <span className={s.ok ? "text-gray-300" : "text-red-400"}>
                              {s.ok ? "OK" : "FAIL"}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-edge p-1.5 text-center">
      <div className="text-sm font-mono text-gray-200">{value}</div>
      <div className="text-[7px] font-mono uppercase text-gray-600">{label}</div>
    </div>
  );
}

function DurationCell({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="text-center">
      <div className="text-[8px] font-mono text-gray-500 mb-0.5">{label}</div>
      <div className="h-8 bg-panel2 relative flex items-end">
        <div className={`w-full ${color}`} style={{ height: `${pct}%` }} />
      </div>
      <div className="text-[8px] font-mono text-gray-600 mt-0.5">{count}</div>
    </div>
  );
}

function LoopChip({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex-1 border border-edge p-1 text-center">
      <div className="text-[9px] font-mono text-gray-300">{count}</div>
      <div className="text-[7px] font-mono uppercase text-gray-600">{label}</div>
    </div>
  );
}
