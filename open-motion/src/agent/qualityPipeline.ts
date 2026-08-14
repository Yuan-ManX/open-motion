import type { MotionComponent, Easing } from "@openmotion/shared";
import { logger } from "../utils/logger.js";

export interface QualityDimension {
  key: "performance" | "a11y" | "cross_browser" | "brand" | "rhythm" | "physics";
  score: number; // 0..100
  passed: boolean;
  findings: Finding[];
}

export interface Finding {
  id: string;
  severity: "info" | "warn" | "error";
  title: string;
  detail: string;
  recommendation: string;
}

export interface QualityReport {
  overall: number; // 0..100
  grade: "S" | "A" | "B" | "C" | "D" | "F";
  timestamp: number;
  dimensions: QualityDimension[];
  pass: boolean;
  autofixCount: number;
  suggestedNext: string[];
}

const REDUCE_MOTION_THRESHOLD_MS = 4000;
const FLASH_HZ_LIMIT = 2.8;

function countKeyframes(comp: MotionComponent): number {
  return comp.keyframes?.length ?? 0;
}

function estimateTotalDurationMs(comp: MotionComponent): number {
  const base = comp.durationMs ?? 0;
  const iterations = typeof comp.iterationCount === "number" ? comp.iterationCount : comp.iterationCount === "infinite" ? 1 : 1;
  return base * iterations;
}

function detectFlashes(comp: MotionComponent): number {
  // Heuristic: count opacity transitions from <0.3 to >0.7 in a short timespan.
  let flashes = 0;
  const kfs = comp.keyframes ?? [];
  for (let i = 1; i < kfs.length; i += 1) {
    const a = kfs[i - 1].properties.opacity as number | undefined;
    const b = kfs[i].properties.opacity as number | undefined;
    if (a === undefined || b === undefined) continue;
    if (a < 0.3 && b > 0.7) flashes += 1;
  }
  return flashes;
}

function computeEasingEnergy(e: Easing | undefined): number {
  if (!e) return 0.5;
  if (e.type === "preset") {
    const name = e.name.toLowerCase();
    if (name.includes("bounce") || name.includes("elastic")) return 1.0;
    if (name.includes("ease-in") && name.includes("out")) return 0.6;
    if (name.includes("ease-out")) return 0.5;
    if (name.includes("snappy")) return 0.75;
    if (name.includes("smooth")) return 0.4;
    return 0.55;
  }
  if (e.type === "bezier") {
    const [, y1] = e.p1;
    const [, y2] = e.p2;
    return Math.min(1, Math.max(0, (y2 - y1 + 1) / 2));
  }
  if (e.type === "spring") {
    return Math.min(1, (e.stiffness ?? 100) / 300);
  }
  return 0.5;
}

export function performanceDimension(components: MotionComponent[]): QualityDimension {
  const findings: Finding[] = [];
  let score = 100;
  let totalKfs = 0;
  let heavyComp = 0;

  for (const c of components) {
    const kfCount = countKeyframes(c);
    totalKfs += kfCount;
    const totalMs = estimateTotalDurationMs(c);
    const transform = c.keyframes ?? [];
    const has3D = transform.some(
      (k) =>
        typeof k.properties.translateZ !== "undefined" ||
        typeof (k.properties as Record<string, unknown>).perspective !== "undefined",
    );
    const hasFilter = transform.some((k) => typeof k.properties.blur !== "undefined");
    if (hasFilter) heavyComp += 1;
    if (kfCount > 28) {
      findings.push({
        id: `perf-many-kfs-${c.id}`,
        severity: "warn",
        title: "Many keyframes in single component",
        detail: `"${c.name}" has ${kfCount} keyframes — may exceed frame budget on low-power GPUs.`,
        recommendation: "Split into multiple smaller components, or bake inflection points into easing curves.",
      });
      score -= 4;
    }
    if (c.iterationCount === "infinite" && (hasFilter || has3D)) {
      findings.push({
        id: `perf-infinite-costly-${c.id}`,
        severity: "error",
        title: "Infinite animation with heavy layer",
        detail: `"${c.name}" loops forever with expensive transforms — it will never idle.`,
        recommendation: "Cap iteration count, throttle on idle, or switch to static when out of viewport.",
      });
      score -= 10;
    }
    if (totalMs > REDUCE_MOTION_THRESHOLD_MS * 3) {
      findings.push({
        id: `perf-long-duration-${c.id}`,
        severity: "info",
        title: "Very long duration",
        detail: `"${c.name}" plays for ~${(totalMs / 1000).toFixed(1)}s and could exceed user patience.`,
        recommendation: "Offer a skip button or a reduce-motion variant with shorter timing.",
      });
      score -= 1;
    }
  }
  if (components.length > 0 && heavyComp / components.length > 0.5) {
    findings.push({
      id: "perf-many-filters",
      severity: "warn",
      title: "More than half of components use blur or heavy filters",
      detail: "Blur and filter-heavy components force per-frame compositing passes on mobile GPUs.",
      recommendation: "Pre-render static blur layers, or use opacity-only fallbacks for low-end devices.",
    });
    score -= 6;
  }

  findings.push({
    id: "perf-summary",
    severity: "info",
    title: "Performance profile summary",
    detail: `${components.length} components, ${totalKfs} total keyframes, ${heavyComp} filter-heavy.`,
    recommendation: "Test on a throttled mid-range mobile device before shipping.",
  });

  return {
    key: "performance",
    score: Math.max(0, score),
    passed: score >= 70,
    findings,
  };
}

export function a11yDimension(components: MotionComponent[]): QualityDimension {
  const findings: Finding[] = [];
  let score = 100;

  for (const c of components) {
    const flashes = detectFlashes(c);
    const totalMs = c.durationMs ?? 0;
    if (totalMs > 0) {
      const hz = (flashes / (totalMs / 1000));
      if (hz >= FLASH_HZ_LIMIT) {
        findings.push({
          id: `a11y-flash-${c.id}`,
          severity: "error",
          title: "Likely seizure-risk flash frequency",
          detail: `"${c.name}" alternates opacity at ~${hz.toFixed(1)} Hz which exceeds the ${FLASH_HZ_LIMIT} Hz threshold.`,
          recommendation: "Reduce contrast between flashing keyframes, or reduce the flash rate to below 2 Hz.",
        });
        score -= 18;
      }
    }
    if (c.iterationCount === "infinite" && totalMs > 2500) {
      findings.push({
        id: `a11y-infinite-loop-${c.id}`,
        severity: "warn",
        title: "Long-running infinite motion with no escape hatch",
        detail: `"${c.name}" loops for longer than 2.5s, violating WCAG 2.2.2 (Pause, Stop, Hide).`,
        recommendation: "Respect prefers-reduced-motion, and provide a visible pause control in the UI.",
      });
      score -= 8;
    }
    const styleColor = (c.style as Record<string, unknown>)?.color;
    if (typeof styleColor === "string" && styleColor.startsWith("#")) {
      // Heuristic: warn if component foreground color is white-ish on a possibly-white canvas.
      // We do not test real contrast — only flag risk for components declaring only their own color.
      if (styleColor === "#FFFFFF" || styleColor === "#FFF") {
        findings.push({
          id: `a11y-color-risk-${c.id}`,
          severity: "info",
          title: "Pure white foreground on unknown background",
          detail: `"${c.name}" uses pure white text without an explicit backing layer.`,
          recommendation: "Ensure container canvas provides at least 4.5:1 contrast, or add an explicit backdrop.",
        });
        score -= 1;
      }
    }
  }

  if (score === 100) {
    findings.push({
      id: "a11y-ok",
      severity: "info",
      title: "Accessibility heuristics passed",
      detail: "No seizure-risk flashes, no excessive infinite loops detected.",
      recommendation: "Still run an a11y QA pass with real assistive technology.",
    });
  }

  return {
    key: "a11y",
    score: Math.max(0, score),
    passed: score >= 75,
    findings,
  };
}

export function crossBrowserDimension(components: MotionComponent[]): QualityDimension {
  const findings: Finding[] = [];
  let score = 100;
  for (const c of components) {
    const hasClipPath = c.keyframes?.some((k) => typeof k.properties.clipPath !== "undefined");
    if (hasClipPath) {
      findings.push({
        id: `cb-clip-${c.id}`,
        severity: "info",
        title: "clipPath used in animation",
        detail: `"${c.name}" animates clipPath — verify behavior on Safari iOS <16 and older Chrome.`,
        recommendation: "Prefer translate/scale when possible; add a graceful clipPath-less fallback.",
      });
      score -= 2;
    }
    const hasBlur = c.keyframes?.some((k) => typeof k.properties.blur !== "undefined");
    if (hasBlur) {
      findings.push({
        id: `cb-blur-${c.id}`,
        severity: "info",
        title: "blur filter animated",
        detail: `"${c.name}" animates blur — performance varies widely across engines.`,
        recommendation: "Prefer backdrop-blur when the layer is stable, or pre-render blur states.",
      });
      score -= 2;
    }
  }
  if (score === 100) {
    findings.push({
      id: "cb-ok",
      severity: "info",
      title: "Cross-browser heuristics passed",
      detail: "No animated clipPath/blur detected; this project animates baseline features.",
      recommendation: "Do a smoke test on Safari, Chrome, and Firefox before production release.",
    });
  }
  return {
    key: "cross_browser",
    score: Math.max(0, score),
    passed: score >= 80,
    findings,
  };
}

export function rhythmDimension(components: MotionComponent[]): QualityDimension {
  const findings: Finding[] = [];
  let score = 100;
  const durations = components.map((c) => c.durationMs ?? 0).filter(Boolean);
  if (durations.length > 1) {
    // Detect if durations are multiples of a common base (120ms or 160ms typically).
    const candidates = [80, 100, 120, 160, 200, 240];
    const alignment = candidates.map((base) => ({
      base,
      score: durations.reduce((sum, d) => {
        const r = d % base;
        return sum + Math.min(r, base - r) / base;
      }, 0) / durations.length,
    }));
    alignment.sort((a, b) => a.score - b.score);
    const best = alignment[0];
    if (best.score > 0.18) {
      findings.push({
        id: "rhythm-bad-grid",
        severity: "warn",
        title: "Durations do not align to a rhythm grid",
        detail: `Best-fit base is ${best.base}ms but components wander off-grid (drift=${(best.score * 100).toFixed(0)}%).`,
        recommendation: "Round durations to a shared base (120ms, 160ms) so the motion reads as a cohesive score.",
      });
      score -= 8;
    } else {
      findings.push({
        id: "rhythm-ok",
        severity: "info",
        title: "Rhythm grid aligned",
        detail: `Durations naturally align to a ${best.base}ms grid.`,
        recommendation: "Keep this base consistent if adding new components.",
      });
    }
  }
  // Variance of easing energy — too similar = boring, too different = chaotic.
  const energies = components.map((c) => computeEasingEnergy(c.easing));
  if (energies.length > 1) {
    const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
    const variance = energies.reduce((a, b) => a + (b - mean) ** 2, 0) / energies.length;
    if (variance < 0.005) {
      findings.push({
        id: "rhythm-monotone",
        severity: "info",
        title: "All components share a similar easing energy",
        detail: "Low easing variance reads as monotonous; nothing pops.",
        recommendation: "Mix a snappy easing for the hero call-to-action with a soft easing for decor.",
      });
      score -= 2;
    }
    if (variance > 0.22) {
      findings.push({
        id: "rhythm-chaotic",
        severity: "warn",
        title: "Easing energies are very mixed",
        detail: "Components span a very broad range of bounciness — they likely feel unrelated.",
        recommendation: "Anchor the whole scene to one house style curve and vary by role, not by component.",
      });
      score -= 4;
    }
  }
  return {
    key: "rhythm",
    score: Math.max(0, score),
    passed: score >= 80,
    findings,
  };
}

export function brandDimension(components: MotionComponent[]): QualityDimension {
  const findings: Finding[] = [];
  let score = 100;
  const easingTypes = new Set(components.map((c) => c.easing?.type));
  if (easingTypes.size > 2) {
    findings.push({
      id: "brand-easing-mixed",
      severity: "warn",
      title: "Mixed easing families across the scene",
      detail: `Components use ${easingTypes.size} easing categories (preset / bezier / spring / steps).`,
      recommendation: "Standardize on one brand-curve family; small exceptions are acceptable for emphasis.",
    });
    score -= 6;
  }
  if (components.length > 0 && !components.some((c) => typeof (c.style as Record<string, unknown>)?.background === "string")) {
    findings.push({
      id: "brand-no-color",
      severity: "info",
      title: "No branded background surfaces found",
      detail: "Components are shape-only with no explicit brand surfaces.",
      recommendation: "Seed the scene with the brand palette so canvas output feels owned.",
    });
    score -= 1;
  }
  return {
    key: "brand",
    score: Math.max(0, score),
    passed: score >= 85,
    findings,
  };
}

export function physicsDimension(components: MotionComponent[]): QualityDimension {
  const findings: Finding[] = [];
  let score = 100;
  for (const c of components) {
    // If component declares spring easing, the mass/stiffness/damping ratio should be stable.
    if (c.easing?.type === "spring") {
      const { stiffness = 100, damping = 10, mass = 1 } = c.easing;
      const zeta = damping / (2 * Math.sqrt(stiffness * mass));
      if (zeta < 0.35) {
        findings.push({
          id: `physics-underdamped-${c.id}`,
          severity: "warn",
          title: "Underdamped spring will ring noticeably",
          detail: `"${c.name}" spring zeta ≈ ${zeta.toFixed(2)} (below 0.35) — users will see multiple oscillations.`,
          recommendation: "Increase damping or reduce stiffness so the motion settles in fewer than 2 visible bounces.",
        });
        score -= 4;
      }
      if (zeta > 1.1) {
        findings.push({
          id: `physics-overdamped-${c.id}`,
          severity: "info",
          title: "Overdamped spring — feels sluggish",
          detail: `"${c.name}" spring zeta ≈ ${zeta.toFixed(2)} (>1.0) — no overshoot at all.`,
          recommendation: "For snappy UI interactions, target zeta ~0.75 (critical-damped slightly below).",
        });
        score -= 1;
      }
    }
  }
  if (score === 100) {
    findings.push({
      id: "physics-ok",
      severity: "info",
      title: "Physics springs within stable ranges",
      detail: "No underdamped ringing springs detected.",
      recommendation: "Keep zeta between 0.6 and 0.9 for tactile-but-snappy motion.",
    });
  }
  return {
    key: "physics",
    score: Math.max(0, score),
    passed: score >= 80,
    findings,
  };
}

export function gradeFor(score: number): QualityReport["grade"] {
  if (score >= 94) return "S";
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

export function runQualityPipeline(components: MotionComponent[]): QualityReport {
  const dimensions = [
    performanceDimension(components),
    a11yDimension(components),
    crossBrowserDimension(components),
    rhythmDimension(components),
    brandDimension(components),
    physicsDimension(components),
  ];
  const overall = Math.round(
    dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length,
  );
  const pass = dimensions.every((d) => d.passed);
  const autofixCount = dimensions.reduce(
    (s, d) => s + d.findings.filter((f) => f.severity !== "info").length,
    0,
  );
  const suggested: string[] = [];
  const errorDim = dimensions.find((d) => !d.passed);
  if (errorDim) {
    suggested.push(`Run Agent autofix for failing dimension: ${errorDim.key}`);
  }
  suggested.push("Verify real rendering matches preview output with export smoke test.");
  if (components.length >= 5) suggested.push("Run the multi-agent debate module to validate style coherence.");

  logger.info("quality pipeline ran", { components: components.length, overall, pass });

  return {
    overall,
    grade: gradeFor(overall),
    timestamp: Date.now(),
    dimensions,
    pass,
    autofixCount,
    suggestedNext: suggested,
  };
}
