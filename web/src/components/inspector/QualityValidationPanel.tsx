import React from "react";
import type { MotionComponent } from "@openmotion/shared";

export interface QualityFindingLite {
  id: string;
  severity: "info" | "warn" | "error";
  title: string;
  detail: string;
  recommendation: string;
}
export interface QualityDimensionLite {
  key: string;
  score: number;
  passed: boolean;
  findings: QualityFindingLite[];
}
export interface QualityReportLite {
  overall: number;
  grade: "S" | "A" | "B" | "C" | "D" | "F";
  timestamp: number;
  dimensions: QualityDimensionLite[];
  pass: boolean;
  autofixCount: number;
  suggestedNext: string[];
}

// Heuristic replica of the backend quality pipeline, computed client-side so
// the UI is informative even before the backend finishes a full run. Produces
// the same dimensional keys (perf / a11y / rhythm / brand) so the server
// report can substitute in without UI changes.
export function computeLocalQuality(components: MotionComponent[]): QualityReportLite {
  const dims: QualityDimensionLite[] = [];
  const totalKfs = components.reduce((s, c) => s + (c.keyframes?.length ?? 0), 0);
  const perfFindings: QualityFindingLite[] = [];
  let perf = 100;
  if (components.length > 0 && totalKfs / components.length > 18) {
    perfFindings.push({
      id: "perf-many",
      severity: "warn",
      title: "High average keyframe count",
      detail: `Average ${(totalKfs / components.length).toFixed(0)} keyframes per component.`,
      recommendation: "Consolidate keyframes into richer easing curves.",
    });
    perf -= 8;
  }
  if (components.some((c) => c.iterationCount === "infinite")) {
    perfFindings.push({
      id: "perf-infinite",
      severity: "warn",
      title: "Infinite loops will never idle",
      detail: "GPU and CPU must keep painting these components as long as they are visible.",
      recommendation: "Cap loops, or pause when the canvas leaves the viewport.",
    });
    perf -= 6;
  }
  if (perfFindings.length === 0) {
    perfFindings.push({ id: "perf-ok", severity: "info", title: "Performance baseline looks healthy", detail: "", recommendation: "" });
  }
  dims.push({ key: "performance", score: Math.max(0, perf), passed: perf >= 70, findings: perfFindings });

  let a11y = 100;
  const a11yFindings: QualityFindingLite[] = [];
  for (const c of components) {
    const kfs = c.keyframes ?? [];
    let flashes = 0;
    for (let i = 1; i < kfs.length; i += 1) {
      const a = kfs[i - 1].properties.opacity as number | undefined;
      const b = kfs[i].properties.opacity as number | undefined;
      if (typeof a === "number" && typeof b === "number" && a < 0.3 && b > 0.7) flashes += 1;
    }
    if (c.durationMs && (flashes / (c.durationMs / 1000)) >= 2.8) {
      a11y -= 18;
      a11yFindings.push({
        id: `a11y-${c.id}`,
        severity: "error",
        title: "Seizure-risk flash rate",
        detail: `"${c.name}" alternates opacity above the 2.8 Hz threshold.`,
        recommendation: "Reduce contrast between flashes, or lower rate to <2 Hz.",
      });
    }
    if (c.iterationCount === "infinite" && (c.durationMs ?? 0) > 2500) {
      a11y -= 8;
      a11yFindings.push({
        id: `a11y-wcag-${c.id}`,
        severity: "warn",
        title: "Violates WCAG 2.2.2 Pause/Stop/Hide",
        detail: `"${c.name}" runs forever with a long period.`,
        recommendation: "Honor prefers-reduced-motion and add a visible pause control.",
      });
    }
  }
  if (a11yFindings.length === 0) {
    a11yFindings.push({ id: "a11y-ok", severity: "info", title: "Accessibility heuristics passed", detail: "", recommendation: "" });
  }
  dims.push({ key: "a11y", score: Math.max(0, a11y), passed: a11y >= 75, findings: a11yFindings });

  // Rhythm
  let rhythm = 100;
  const rhythmFindings: QualityFindingLite[] = [];
  const durations = components.map((c) => c.durationMs ?? 0).filter(Boolean);
  if (durations.length > 1) {
    const bases = [80, 120, 160, 200, 240];
    const aligned = bases
      .map((base) => ({
        base,
        score: durations.reduce((s, d) => {
          const r = d % base;
          return s + Math.min(r, base - r) / base;
        }, 0) / durations.length,
      }))
      .sort((a, b) => a.score - b.score)[0];
    if (aligned.score > 0.2) {
      rhythm -= 8;
      rhythmFindings.push({
        id: "rhythm-grid",
        severity: "warn",
        title: "Durations don't snap to a rhythm grid",
        detail: `Best-fit base ${aligned.base}ms with drift ${(aligned.score * 100).toFixed(0)}%.`,
        recommendation: "Round durations to a shared rhythm base.",
      });
    }
  }
  if (rhythmFindings.length === 0) {
    rhythmFindings.push({ id: "rhythm-ok", severity: "info", title: "Rhythm grid is aligned", detail: "", recommendation: "" });
  }
  dims.push({ key: "rhythm", score: Math.max(0, rhythm), passed: rhythm >= 80, findings: rhythmFindings });

  // Brand
  let brand = 95;
  const brandFindings: QualityFindingLite[] = [];
  const fams = new Set(components.map((c) => c.easing?.type));
  if (fams.size > 2) {
    brand -= 6;
    brandFindings.push({
      id: "brand-easing-fam",
      severity: "warn",
      title: "Mixed easing families",
      detail: `${fams.size} different easing categories in use.`,
      recommendation: "Standardize on one house-style curve family.",
    });
  }
  if (brandFindings.length === 0) {
    brandFindings.push({ id: "brand-ok", severity: "info", title: "Brand consistency looks good", detail: "", recommendation: "" });
  }
  dims.push({ key: "brand", score: Math.max(0, brand), passed: brand >= 85, findings: brandFindings });

  const overall = Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length);
  const grades: Array<[number, QualityReportLite["grade"]]> = [
    [94, "S"],
    [85, "A"],
    [75, "B"],
    [65, "C"],
    [50, "D"],
  ];
  let grade: QualityReportLite["grade"] = "F";
  for (const [t, g] of grades) if (overall >= t) { grade = g; break; }
  const autofixCount = dims.reduce((s, d) => s + d.findings.filter((f) => f.severity !== "info").length, 0);
  return {
    overall,
    grade,
    timestamp: Date.now(),
    dimensions: dims,
    pass: dims.every((d) => d.passed),
    autofixCount,
    suggestedNext: [
      autofixCount > 0 ? `Ask the Agent to autofix ${autofixCount} flagged findings.` : "No autofixes required.",
      "Run the full backend quality pipeline with cross-browser checks.",
    ],
  };
}

interface Props {
  components: MotionComponent[];
  report?: QualityReportLite | null;
  onRequestFullPipeline?: () => void;
  onRequestAutofix?: () => void;
}

const gradeStyle: Record<QualityReportLite["grade"], string> = {
  S: "from-emerald-500 to-teal-400 text-emerald-950",
  A: "from-emerald-500 to-sky-400 text-emerald-950",
  B: "from-sky-500 to-indigo-400 text-sky-50",
  C: "from-amber-500 to-orange-400 text-amber-950",
  D: "from-orange-500 to-rose-400 text-orange-950",
  F: "from-rose-600 to-red-500 text-rose-50",
};

export const QualityValidationPanel: React.FC<Props> = ({
  components,
  report,
  onRequestFullPipeline,
  onRequestAutofix,
}) => {
  const local = computeLocalQuality(components);
  const view = report ?? local;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <header className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-100">Quality Validation</h3>
        {!report && (
          <span className="rounded-full bg-slate-700/70 px-2 py-0.5 text-[10px] text-slate-300">
            local heuristics
          </span>
        )}
      </header>

      <section className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Overall</p>
            <p className="mt-0.5 text-3xl font-bold text-slate-50">{view.overall}</p>
            <p className={`mt-1 inline-block rounded-md bg-gradient-to-br px-2 py-0.5 text-xs font-bold ${gradeStyle[view.grade]}`}>
              Grade {view.grade}
            </p>
            {!view.pass && (
              <p className="mt-1 text-xs text-rose-300">Pipeline not passing — autofix recommended.</p>
            )}
          </div>
          <div className="h-24 w-24 shrink-0">
            <svg viewBox="0 0 40 40" className="h-full w-full">
              <circle cx="20" cy="20" r="16" fill="none" stroke="#1e293b" strokeWidth="4" />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke={view.overall >= 85 ? "#34d399" : view.overall >= 70 ? "#38bdf8" : view.overall >= 50 ? "#fbbf24" : "#fb7185"}
                strokeWidth="4"
                strokeDasharray={`${(view.overall / 100) * 100.5} 100.5`}
                strokeLinecap="round"
                transform="rotate(-90 20 20)"
              />
            </svg>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onRequestAutofix}
            disabled={view.autofixCount === 0}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            Agent autofix ({view.autofixCount})
          </button>
          <button
            type="button"
            onClick={onRequestFullPipeline}
            className="rounded-md border border-slate-600 bg-slate-800/40 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700/60"
          >
            Full pipeline run
          </button>
        </div>
      </section>

      <section className="space-y-2">
        {view.dimensions.map((d) => (
          <details
            key={d.key}
            className="group rounded-xl border border-slate-700/60 bg-slate-800/40 p-3 open:bg-slate-800/70"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${d.passed ? "bg-emerald-400" : "bg-rose-400"}`} />
                <span className="font-medium capitalize text-slate-200">{d.key.replace("_", " ")}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="tabular-nums text-slate-300">{d.score}</span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-700">
                  <div
                    className={`h-full ${d.passed ? "bg-emerald-400" : "bg-rose-400"}`}
                    style={{ width: `${d.score}%` }}
                  />
                </div>
              </div>
            </summary>
            <ul className="mt-2 space-y-1.5 text-xs">
              {d.findings.map((f) => (
                <li
                  key={f.id}
                  className={`rounded-md border px-2 py-1.5 ${
                    f.severity === "error"
                      ? "border-rose-500/40 bg-rose-500/10"
                      : f.severity === "warn"
                        ? "border-amber-500/40 bg-amber-500/10"
                        : "border-slate-600/60 bg-slate-900/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-200">{f.title}</span>
                    <span className="text-[10px] uppercase text-slate-400">{f.severity}</span>
                  </div>
                  {f.detail && <p className="mt-0.5 text-[11px] text-slate-400">{f.detail}</p>}
                  {f.recommendation && (
                    <p className="mt-0.5 text-[11px] text-sky-300/90">→ {f.recommendation}</p>
                  )}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>

      <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-3 text-xs text-slate-300">
        <h4 className="mb-1 font-semibold text-slate-200">Suggested next steps</h4>
        <ul className="list-disc space-y-0.5 pl-4 text-slate-400">
          {view.suggestedNext.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </section>
    </div>
  );
};
