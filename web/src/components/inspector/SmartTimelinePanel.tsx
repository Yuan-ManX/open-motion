import React, { useMemo } from "react";
import type { MotionComponent } from "@openmotion/shared";

// Inference rules mapping common property inflections to AI-suggested
// easing archetypes. All heuristics are deterministic and simulation-safe.
type CurveHint =
  | { kind: "over-shoot"; easing: "snappy" | "ease-out-back" }
  | { kind: "settle"; easing: "gentle" | "smooth" }
  | { kind: "rebound"; easing: "bounce" | "elastic" }
  | { kind: "wind-up"; easing: "ease-in-out-expo" }
  | { kind: "linear-progress"; easing: "linear" };

function inferHints(c: MotionComponent): CurveHint[] {
  const hints: CurveHint[] = [];
  const kfs = c.keyframes ?? [];
  if (kfs.length < 2) return hints;
  const hasScaleGtOne = kfs.some(
    (k) => typeof k.properties.scale === "number" && k.properties.scale > 1,
  );
  const hasScaleLtOne = kfs.some(
    (k) => typeof k.properties.scale === "number" && k.properties.scale < 0.95,
  );
  if (hasScaleGtOne && !hasScaleLtOne) {
    hints.push({ kind: "over-shoot", easing: "snappy" });
  }
  if (kfs.length >= 4 && hasScaleLtOne && hasScaleGtOne) {
    hints.push({ kind: "rebound", easing: "bounce" });
  }
  const opacities = kfs
    .map((k) => k.properties.opacity)
    .filter((v): v is number => typeof v === "number");
  const monotone =
    opacities.length >= 2 &&
    opacities.every((v, i, arr) => (i === 0 ? true : v >= arr[i - 1])) ||
    opacities.every((v, i, arr) => (i === 0 ? true : v <= arr[i - 1]));
  if (monotone && !hasScaleGtOne) {
    hints.push({ kind: "settle", easing: "smooth" });
  }
  if (
    kfs.some((k) => typeof k.properties.rotate !== "undefined") &&
    kfs.some((k) => typeof k.properties.rotateZ !== "undefined")
  ) {
    hints.push({ kind: "wind-up", easing: "ease-in-out-expo" });
  }
  const durationMs = c.durationMs ?? 0;
  if (durationMs > 1500 && opacities.length >= 8) {
    hints.push({ kind: "linear-progress", easing: "linear" });
  }
  return hints;
}

interface BeatSuggester {
  baseMs: 120 | 160 | 200;
  rounded: number;
  driftMs: number;
  phase: string;
}

function suggestBeat(durationMs: number): BeatSuggester {
  const bases: Array<120 | 160 | 200> = [120, 160, 200];
  const fits = bases.map((base) => {
    const multi = Math.max(1, Math.round(durationMs / base));
    const rounded = multi * base;
    return { base, rounded, driftMs: Math.abs(durationMs - rounded) };
  });
  fits.sort((a, b) => a.driftMs - b.driftMs);
  const f = fits[0];
  const multi = f.rounded / f.base;
  let phase = `${multi} × ${f.base}ms`;
  if (multi === 2) phase += " (2 beats)";
  if (multi === 4) phase += " (bar of 4/4)";
  if (multi === 3) phase += " (3/4 triplet)";
  return { baseMs: f.base, rounded: f.rounded, driftMs: f.driftMs, phase };
}

interface KeyframeGap {
  fromIndex: number;
  toIndex: number;
  gapMs: number;
  suspicion: "missing_ease" | "long_pause" | "tight_jitter" | null;
}

function analyzeGaps(c: MotionComponent): KeyframeGap[] {
  const kfs = c.keyframes ?? [];
  const dur = c.durationMs ?? 1;
  const gaps: KeyframeGap[] = [];
  for (let i = 1; i < kfs.length; i += 1) {
    const gapMs = (kfs[i].offset - kfs[i - 1].offset) * dur;
    let suspicion: KeyframeGap["suspicion"] = null;
    if (gapMs < 25) suspicion = "tight_jitter";
    if (gapMs > dur * 0.4) suspicion = "long_pause";
    const prev = Object.keys(kfs[i - 1].properties).join(",");
    const next = Object.keys(kfs[i].properties).join(",");
    if (prev !== next && suspicion === null && gapMs < 100) suspicion = "missing_ease";
    gaps.push({ fromIndex: i - 1, toIndex: i, gapMs, suspicion });
  }
  return gaps;
}

interface Props {
  components: MotionComponent[];
  selectedId: string | null;
  onApplyDuration?: (componentId: string, durationMs: number) => void;
  onApplyEasing?: (componentId: string, easing: CurveHint["easing"]) => void;
}

// A timeline-aware smart panel that inspects components for rhythm drift,
// missing easing inflections and counter-intuitive keyframe spacing, then
// offers one-click corrections.
export const SmartTimelinePanel: React.FC<Props> = ({
  components,
  selectedId,
  onApplyDuration,
  onApplyEasing,
}) => {
  const analysis = useMemo(() => {
    return components.map((c) => {
      const hints = inferHints(c);
      const beat = suggestBeat(c.durationMs ?? 0);
      const gaps = analyzeGaps(c);
      return { component: c, hints, beat, gaps };
    });
  }, [components]);

  const focused = analysis.find((a) => a.component.id === selectedId);

  return (
    <div className="space-y-4 text-sm">
      <header className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-100">Smart Timeline</h3>
        <span className="text-xs text-slate-400">
          {components.length} tracks · AI inference active
        </span>
      </header>

      {!focused && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3 text-xs text-slate-400">
          Select a component to see AI-suggested curve tweaks and rhythm alignment.
        </div>
      )}

      {focused && (
        <section className="space-y-3">
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-slate-100">{focused.component.name}</span>
              <code className="text-[10px] text-slate-400">
                {focused.component.durationMs}ms · {focused.component.keyframes?.length ?? 0} kfs
              </code>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-slate-900/50 px-2 py-1.5">
                <div>
                  <p className="text-slate-300">Rhythm grid alignment</p>
                  <p className="text-slate-500">Suggests {focused.beat.phase}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onApplyDuration?.(focused.component.id, focused.beat.rounded)}
                  disabled={focused.beat.driftMs < 1}
                  className="rounded-md bg-sky-600/80 px-2 py-1 text-[11px] text-white disabled:opacity-40 hover:bg-sky-500"
                >
                  Snap to {focused.beat.rounded}ms
                </button>
              </div>

              {focused.hints.map((h, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg bg-slate-900/50 px-2 py-1.5"
                >
                  <div>
                    <p className="text-slate-300">Curve hint: {h.kind.replace("-", " ")}</p>
                    <p className="text-slate-500">Apply the <code className="text-sky-400">{h.easing}</code> archetype</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onApplyEasing?.(focused.component.id, h.easing)}
                    className="rounded-md bg-indigo-600/80 px-2 py-1 text-[11px] text-white hover:bg-indigo-500"
                  >
                    Apply
                  </button>
                </div>
              ))}

              {focused.gaps.filter((g) => g.suspicion).length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-amber-200/90">
                  <p className="font-medium text-amber-200">Keyframe spacing flags</p>
                  <ul className="mt-1 list-disc pl-4 text-[11px] text-amber-100/70">
                    {focused.gaps.filter((g) => g.suspicion).map((g) => (
                      <li key={`${g.fromIndex}-${g.toIndex}`}>
                        kf{g.fromIndex + 1}→kf{g.toIndex + 1}: {g.gapMs.toFixed(0)}ms gap — {g.suspicion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-3">
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Scene rhythm map
        </h4>
        <div className="flex flex-wrap items-end gap-1">
          {analysis.map((a) => (
            <div
              key={a.component.id}
              title={`${a.component.name} · ${a.component.durationMs}ms`}
              className={`rounded ${a.component.id === selectedId ? "bg-sky-400" : "bg-slate-600"}`}
              style={{
                width: `${Math.max(6, Math.min(48, (a.component.durationMs ?? 0) / 40))}px`,
                height: `${Math.max(10, Math.min(56, (a.component.keyframes?.length ?? 0) * 6 + 12))}px`,
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
};
