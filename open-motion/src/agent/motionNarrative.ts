import type { MotionSpec, MotionComponent } from "@openmotion/shared";

/**
 * Narrative Engine — story-arc analysis of motion compositions.
 *
 * A motion composition tells a story: elements enter (setup), build
 * tension (rising action), peak (climax), and resolve (falling action).
 * This engine maps each component to a narrative beat based on its
 * timing (delay/duration) and magnitude (displacement/scale), then
 * detects missing beats — a composition that peaks but never resolves,
 * or that sets up but never climaxes, leaves the viewer unsatisfied
 * without any single element being obviously wrong.
 *
 * Core concepts:
 * - Beat: one of {setup, rising, climax, resolution}. Assigned by
 *   quartile of the composition's total timeline + magnitude profile.
 *   Early+low-magnitude = setup; mid+high-magnitude = climax; etc.
 * - MagnitudeProfile: the peak displacement a component produces,
 *   normalized 0..1 against the composition's max. Higher magnitude =
 *   more narrative weight.
 * - ArcCoverage: which beats are present. A complete arc has all four;
 *   missing beats are flagged with severity proportional to how
 *   structurally important the missing beat is (climax missing is
 *   severe; resolution missing is moderate).
 * - PacingBalance: the share of total duration devoted to each beat.
 *   A composition that spends 90% of its time in setup drags.
 *
 * Rule-based — no LLM round-trip required, so mock mode stays functional.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NarrativeBeat = "setup" | "rising" | "climax" | "resolution";

/** A component mapped to a narrative beat. */
export interface NarrativeNode {
  /** Component id. */
  componentId: string;
  /** Display label. */
  label: string;
  /** Assigned beat. */
  beat: NarrativeBeat;
  /** Start time in ms (delay). */
  startMs: number;
  /** End time in ms (delay + duration). */
  endMs: number;
  /** Peak displacement (translate/rotate/scale magnitude). */
  magnitude: number;
  /** Normalized magnitude 0..1 against composition max. */
  magnitudeProfile: number;
  /** Share of total duration 0..1. */
  durationShare: number;
}

/** Pacing balance per beat. */
export interface BeatPacing {
  beat: NarrativeBeat;
  /** Number of components in this beat. */
  count: number;
  /** Share of total duration devoted to this beat. */
  durationShare: number;
}

/** A missing-beat finding. */
export interface NarrativeFinding {
  /** "missing_beat" | "weak_climax" | "pacing_imbalance" | "no_resolution". */
  kind: "missing_beat" | "weak_climax" | "pacing_imbalance" | "no_resolution";
  /** Beat name or "arc". */
  subject: string;
  /** Human-readable description. */
  detail: string;
  /** Severity 0..1. */
  severity: number;
}

/** The full narrative report. */
export interface NarrativeReport {
  /** All components mapped to beats. */
  nodes: NarrativeNode[];
  /** Pacing balance per beat. */
  pacing: BeatPacing[];
  /** Findings. */
  findings: NarrativeFinding[];
  /** Total timeline duration in ms. */
  totalDurationMs: number;
  /** Beats present. */
  beatsPresent: NarrativeBeat[];
  /** Beats missing. */
  beatsMissing: NarrativeBeat[];
  /** Climax magnitude (peak across composition). */
  climaxMagnitude: number;
  /** Whether the arc is complete (all four beats present). */
  complete: boolean;
  /** Component count the analysis ran against. */
  componentCount: number;
  /** Human-readable summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Magnitude + timing
// ---------------------------------------------------------------------------

function componentMagnitude(c: MotionComponent): number {
  let max = 0;
  for (const kf of c.keyframes) {
    for (const prop of ["translateX", "translateY", "rotate", "scale"] as const) {
      const v = kf.properties[prop];
      if (typeof v === "number") {
        max = Math.max(max, prop === "scale" ? Math.abs(v - 1) * 100 : Math.abs(v));
      } else if (typeof v === "string") {
        const m = v.match(/-?\d+\.?\d*/);
        if (m) max = Math.max(max, Math.abs(parseFloat(m[0])));
      }
    }
  }
  return max;
}

function componentEndMs(c: MotionComponent): number {
  const iterations = c.iterationCount === "infinite" ? 1 : (c.iterationCount as number);
  return c.delayMs + c.durationMs * iterations;
}

// ---------------------------------------------------------------------------
// Beat assignment
// ---------------------------------------------------------------------------

function assignBeat(
  startMs: number,
  endMs: number,
  totalDuration: number,
  magnitudeProfile: number,
): NarrativeBeat {
  // Mid-point of the component's active window, normalized 0..1 across
  // the composition timeline.
  const mid = totalDuration > 0 ? (startMs + endMs) / 2 / totalDuration : 0.5;
  // Climax is high-magnitude regardless of timing. Resolution is late +
  // low-magnitude. Setup is early + low-magnitude. Rising is everything
  // else (mid timing, building magnitude).
  if (magnitudeProfile >= 0.75) return "climax";
  if (mid >= 0.7 && magnitudeProfile < 0.5) return "resolution";
  if (mid < 0.35 && magnitudeProfile < 0.4) return "setup";
  return "rising";
}

// ---------------------------------------------------------------------------
// Finding detection
// ---------------------------------------------------------------------------

function detectFindings(
  nodes: NarrativeNode[],
  beatsPresent: NarrativeBeat[],
  beatsMissing: NarrativeBeat[],
  pacing: BeatPacing[],
  climaxMagnitude: number,
): NarrativeFinding[] {
  const findings: NarrativeFinding[] = [];

  // Missing beats — severity depends on which beat.
  const severityByBeat: Record<NarrativeBeat, number> = {
    setup: 0.4,
    rising: 0.5,
    climax: 0.85,
    resolution: 0.6,
  };
  for (const beat of beatsMissing) {
    findings.push({
      kind: "missing_beat",
      subject: beat,
      detail: `No component maps to the "${beat}" beat — the story arc is missing this stage.`,
      severity: severityByBeat[beat],
    });
  }

  // Weak climax — climax present but its magnitude is below half the
  // composition's peak. The "climax" then does not read as one.
  const climaxNodes = nodes.filter((n) => n.beat === "climax");
  if (climaxNodes.length > 0 && climaxMagnitude > 0) {
    const avgClimaxMag = climaxNodes.reduce((s, n) => s + n.magnitude, 0) / climaxNodes.length;
    if (avgClimaxMag < climaxMagnitude * 0.5) {
      findings.push({
        kind: "weak_climax",
        subject: "climax",
        detail: `Climax components average magnitude ${Math.round(avgClimaxMag)} vs composition peak ${Math.round(climaxMagnitude)} — the climax does not read as the peak.`,
        severity: 0.55,
      });
    }
  }

  // No resolution — if setup/rising/climax present but resolution missing,
  // the composition ends abruptly. (Already covered by missing_beat, but
  // we add a more specific finding so the UI can call it out.)
  if (
    beatsPresent.includes("climax") &&
    !beatsPresent.includes("resolution") &&
    nodes.length >= 3
  ) {
    findings.push({
      kind: "no_resolution",
      subject: "arc",
      detail: `Composition climaxes but never resolves — the viewer is left without a release beat.`,
      severity: 0.65,
    });
  }

  // Pacing imbalance — any single beat consuming >60% of total duration.
  for (const p of pacing) {
    if (p.durationShare > 0.6) {
      findings.push({
        kind: "pacing_imbalance",
        subject: p.beat,
        detail: `"${p.beat}" consumes ${Math.round(p.durationShare * 100)}% of total duration — pacing is imbalanced.`,
        severity: Math.min(1, 0.35 + (p.durationShare - 0.6) * 0.5),
      });
    }
  }

  findings.sort((a, b) => b.severity - a.severity);
  return findings;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Build a narrative report for a project spec. */
export function analyzeNarrative(spec: MotionSpec): NarrativeReport {
  const components = spec.components;
  if (components.length === 0) {
    return {
      nodes: [],
      pacing: [],
      findings: [],
      totalDurationMs: 0,
      beatsPresent: [],
      beatsMissing: ["setup", "rising", "climax", "resolution"],
      climaxMagnitude: 0,
      complete: false,
      componentCount: 0,
      summary: "Empty project — no narrative to analyze.",
    };
  }

  // Compute total timeline + per-component magnitude.
  const magnitudes = components.map(componentMagnitude);
  const maxMagnitude = Math.max(1, ...magnitudes);
  const ends = components.map(componentEndMs);
  const totalDurationMs = Math.max(1, ...ends);

  // Assign beats.
  const nodes: NarrativeNode[] = components.map((c, i) => {
    const startMs = c.delayMs;
    const endMs = componentEndMs(c);
    const magnitude = magnitudes[i];
    const magnitudeProfile = Math.round((magnitude / maxMagnitude) * 100) / 100;
    const beat = assignBeat(startMs, endMs, totalDurationMs, magnitudeProfile);
    return {
      componentId: c.id,
      label: c.name || c.id,
      beat,
      startMs,
      endMs,
      magnitude,
      magnitudeProfile,
      durationShare: Math.round(((endMs - startMs) / totalDurationMs) * 100) / 100,
    };
  });

  // Pacing per beat.
  const allBeats: NarrativeBeat[] = ["setup", "rising", "climax", "resolution"];
  const pacing: BeatPacing[] = allBeats.map((beat) => {
    const beatNodes = nodes.filter((n) => n.beat === beat);
    const durationShare = beatNodes.reduce((s, n) => s + n.durationShare, 0);
    return {
      beat,
      count: beatNodes.length,
      durationShare: Math.round(durationShare * 100) / 100,
    };
  });

  const beatsPresent = allBeats.filter((b) => nodes.some((n) => n.beat === b));
  const beatsMissing = allBeats.filter((b) => !beatsPresent.includes(b));
  const climaxMagnitude = maxMagnitude;
  const complete = beatsMissing.length === 0;
  const findings = detectFindings(nodes, beatsPresent, beatsMissing, pacing, climaxMagnitude);

  const summary = `${nodes.length} component(s) mapped; beats present: ${beatsPresent.join(", ") || "none"}; missing: ${beatsMissing.join(", ") || "none"}; climax magnitude ${Math.round(climaxMagnitude)}; ${findings.length} finding(s).`;

  return {
    nodes,
    pacing,
    findings,
    totalDurationMs,
    beatsPresent,
    beatsMissing,
    climaxMagnitude,
    complete,
    componentCount: components.length,
    summary,
  };
}

/** Format a narrative report as a human-readable string. */
export function formatNarrativeReport(report: NarrativeReport): string {
  const lines: string[] = [];
  lines.push("=== Motion Narrative ===");
  lines.push("");
  lines.push(`Components: ${report.componentCount}`);
  lines.push(`Total duration: ${report.totalDurationMs}ms`);
  lines.push(`Climax magnitude: ${Math.round(report.climaxMagnitude)}`);
  lines.push(`Beats present: ${report.beatsPresent.join(", ") || "none"}`);
  lines.push(`Beats missing: ${report.beatsMissing.join(", ") || "none"}`);
  lines.push(`Arc complete: ${report.complete}`);
  lines.push("");

  if (report.pacing.length > 0) {
    lines.push("--- Pacing ---");
    for (const p of report.pacing) {
      lines.push(`• ${p.beat.padEnd(12)} ${p.count} component(s), ${Math.round(p.durationShare * 100)}% of duration`);
    }
    lines.push("");
  }

  if (report.nodes.length > 0) {
    lines.push("--- Beats (chronological) ---");
    const sorted = [...report.nodes].sort((a, b) => a.startMs - b.startMs);
    for (const n of sorted.slice(0, 12)) {
      lines.push(`[${n.beat[0].toUpperCase()}] ${n.label.padEnd(16)} t=${n.startMs}-${n.endMs}ms mag=${n.magnitude} (${n.magnitudeProfile})`);
    }
    lines.push("");
  }

  if (report.findings.length > 0) {
    lines.push("--- Findings ---");
    for (const f of report.findings) {
      lines.push(`• [${f.kind}] ${f.subject} — severity ${f.severity}`);
      lines.push(`    ${f.detail}`);
    }
    lines.push("");
  }

  lines.push(`Summary: ${report.summary}`);
  return lines.join("\n");
}
