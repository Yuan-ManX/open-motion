import type { MotionSpec, MotionComponent } from "@openmotion/shared";

/** Calibration Engine — self-tuning of motion parameters against canonical ranges. */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Which parameter a calibration finding concerns. */
export type CalibrationParameter =
  | "durationMs"
  | "delayMs"
  | "magnitude"
  | "iterationCount"
  | "keyframeCount";

/** A single calibration finding (one outlier parameter on one component). */
export interface CalibrationFinding {
  /** Component id. */
  componentId: string;
  /** Display label. */
  label: string;
  /** Parameter that is out of range. */
  parameter: CalibrationParameter;
  /** Current value. */
  value: number;
  /** Spec mean for this parameter. */
  mean: number;
  /** Spec standard deviation for this parameter. */
  stdDev: number;
  /** Signed z-score of the value. */
  zScore: number;
  /** Whether the value is an outlier (|z| > threshold). */
  outlier: boolean;
  /** "high" | "low" — direction of the deviation. */
  direction: "high" | "low";
  /** Calibrated replacement value. */
  calibratedValue: number;
  /** 0..1 — confidence in the calibration. */
  confidence: number;
  /** Human-readable explanation. */
  explanation: string;
}

/** Aggregate stats for one parameter across the spec. */
export interface ParameterStats {
  parameter: CalibrationParameter;
  count: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  /** Outlier threshold (|z| above this is flagged). */
  threshold: number;
  /** Number of components flagged as outliers. */
  outlierCount: number;
}

/** The full calibration report. */
export interface CalibrationReport {
  /** Per-parameter aggregate stats. */
  stats: ParameterStats[];
  /** Per-component outlier findings (sorted by |z| descending). */
  findings: CalibrationFinding[];
  /** Number of components analyzed. */
  componentCount: number;
  /** Number of outlier parameters found. */
  outlierCount: number;
  /** 0..1 — overall calibration score (1 = perfectly calibrated). */
  calibrationScore: number;
  /** Human-readable summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Parameter extraction
// ---------------------------------------------------------------------------

function maxMagnitude(c: MotionComponent): number {
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
  return Math.round(max * 100) / 100;
}

interface Sample {
  componentId: string;
  label: string;
  durationMs: number;
  delayMs: number;
  magnitude: number;
  iterationCount: number;
  keyframeCount: number;
}

function extractSamples(components: MotionComponent[]): Sample[] {
  return components.map((c) => ({
    componentId: c.id,
    label: c.name || c.id,
    durationMs: c.durationMs,
    delayMs: c.delayMs,
    magnitude: maxMagnitude(c),
    iterationCount: c.iterationCount === "infinite" ? 0 : c.iterationCount,
    keyframeCount: c.keyframes.length,
  }));
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], mu: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((s, v) => s + (v - mu) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Per-parameter outlier thresholds. Higher = more tolerant. */
const THRESHOLDS: Record<CalibrationParameter, number> = {
  durationMs: 1.5,
  delayMs: 1.8,
  magnitude: 1.6,
  iterationCount: 2.0,
  keyframeCount: 1.7,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Run calibration analysis on a project spec. */
export function analyzeCalibration(spec: MotionSpec): CalibrationReport {
  const components = spec.components;
  if (components.length === 0) {
    return {
      stats: [],
      findings: [],
      componentCount: 0,
      outlierCount: 0,
      calibrationScore: 1,
      summary: "Empty project — nothing to calibrate.",
    };
  }

  const samples = extractSamples(components);

  const parameters: CalibrationParameter[] = [
    "durationMs",
    "delayMs",
    "magnitude",
    "iterationCount",
    "keyframeCount",
  ];

  const stats: ParameterStats[] = [];
  const findings: CalibrationFinding[] = [];

  for (const param of parameters) {
    const values = samples.map((s) => s[param] as number);
    const mu = mean(values);
    const sigma = stdDev(values, mu);
    const threshold = THRESHOLDS[param];
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;

    let outlierCount = 0;
    for (const s of samples) {
      const value = s[param] as number;
      // When stdDev is 0, every value equals the mean — no outliers.
      if (sigma === 0) continue;
      const z = (value - mu) / sigma;
      const absZ = Math.abs(z);
      if (absZ <= threshold) continue;
      outlierCount++;

      const direction: "high" | "low" = z > 0 ? "high" : "low";
      // Calibrated target: pull back to the threshold boundary.
      const calibratedValue = Math.round((mu + Math.sign(z) * threshold * sigma) * 100) / 100;
      // Confidence: higher when the sample size is larger and the outlier
      // is further from the threshold. Capped at 0.95 — calibration is
      // statistical, never certain.
      const sampleConfidence = Math.min(0.5, samples.length / 20);
      const distanceConfidence = Math.min(0.45, (absZ - threshold) / 2);
      const confidence = Math.round((sampleConfidence + distanceConfidence) * 100) / 100;

      const unit = param === "durationMs" || param === "delayMs" ? "ms" : "";
      const explanation = `"${s.label}" ${param}=${value}${unit} is ${Math.round(absZ * 100) / 100}σ ${direction} of the spec mean (${Math.round(mu * 100) / 100}${unit}). Calibrating to ${calibratedValue}${unit} brings it within the ${threshold}σ band.`;

      findings.push({
        componentId: s.componentId,
        label: s.label,
        parameter: param,
        value,
        mean: Math.round(mu * 100) / 100,
        stdDev: Math.round(sigma * 100) / 100,
        zScore: Math.round(z * 100) / 100,
        outlier: true,
        direction,
        calibratedValue,
        confidence,
        explanation,
      });
    }

    stats.push({
      parameter: param,
      count: values.length,
      mean: Math.round(mu * 100) / 100,
      stdDev: Math.round(sigma * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      threshold,
      outlierCount,
    });
  }

  findings.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

  const totalParameters = components.length * parameters.length;
  const outlierCount = findings.length;
  // Calibration score: fraction of parameters within range.
  const calibrationScore = totalParameters > 0
    ? Math.round(((totalParameters - outlierCount) / totalParameters) * 100) / 100
    : 1;

  const summary = `${components.length} component(s), ${parameters.length} parameters each. ${outlierCount} outlier(s) detected. Calibration score ${calibrationScore}.`;

  return {
    stats,
    findings,
    componentCount: components.length,
    outlierCount,
    calibrationScore,
    summary,
  };
}

/** Format a calibration report as a human-readable string. */
export function formatCalibrationReport(report: CalibrationReport): string {
  const lines: string[] = [];
  lines.push("=== Motion Calibration ===");
  lines.push("");
  lines.push(`Components: ${report.componentCount}`);
  lines.push(`Outliers: ${report.outlierCount}`);
  lines.push(`Calibration score: ${report.calibrationScore}`);
  lines.push("");

  if (report.stats.length > 0) {
    lines.push("--- Parameter Stats ---");
    for (const s of report.stats) {
      lines.push(`• ${s.parameter.padEnd(14)} mean=${s.mean} σ=${s.stdDev} range=[${s.min}, ${s.max}] outliers=${s.outlierCount} (threshold ${s.threshold}σ)`);
    }
    lines.push("");
  }

  if (report.findings.length > 0) {
    lines.push("--- Outlier Findings (top 10) ---");
    for (const f of report.findings.slice(0, 10)) {
      lines.push(`• ${f.label} — ${f.parameter}=${f.value} (z=${f.zScore}, ${f.direction})`);
      lines.push(`    calibrated to ${f.calibratedValue} (confidence ${f.confidence})`);
    }
    lines.push("");
  }

  lines.push(`Summary: ${report.summary}`);
  return lines.join("\n");
}
