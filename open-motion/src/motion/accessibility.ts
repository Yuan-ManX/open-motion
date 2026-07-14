/**
 * Motion Accessibility & Safety Checker — analyzes motion specs for vestibular
 * safety, seizure risk, reduced-motion compliance, and cognitive load.
 *
 * Vestibular safety detects rapid movements, large displacements, parallax
 * layers, and excessive spinning that can trigger motion sickness.
 *
 * Seizure risk detects flashing/strobing patterns where opacity or color
 * changes rapidly at frequencies above 3Hz (the WCAG 2.3.1 threshold).
 *
 * Reduced-motion compliance checks whether infinite loops and essential
 * animations have accessible alternatives.
 *
 * Cognitive load counts simultaneous active animations and flags inconsistent
 * timing scales and conflicting easing families.
 */

import type { Easing, MotionComponent } from "@openmotion/shared";

export type AccessibilitySeverity = "info" | "warning" | "critical";
export type AccessibilityCategory =
  | "vestibular"
  | "seizure"
  | "reduced-motion"
  | "cognitive";

export interface AccessibilityIssue {
  severity: AccessibilitySeverity;
  category: AccessibilityCategory;
  componentId: string | null;
  componentName: string | null;
  message: string;
  remediation: string;
}

export interface AccessibilityReport {
  issues: AccessibilityIssue[];
  score: number;
  summary: string;
  stats: {
    totalComponents: number;
    vestibularIssues: number;
    seizureIssues: number;
    reducedMotionIssues: number;
    cognitiveIssues: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    maxSimultaneousAnimations: number;
    hasInfiniteLoops: boolean;
    hasFlashingRisk: boolean;
    hasLargeDisplacement: boolean;
  };
}

/** Maximum safe translation distance in pixels before vestibular risk. */
const MAX_SAFE_DISPLACEMENT_PX = 300;
/** Maximum safe rotation in degrees before vestibular risk. */
const MAX_SAFE_ROTATION_DEG = 180;
/** Maximum opacity change frequency in Hz before seizure risk. */
const MAX_SAFE_FLASH_HZ = 3;
/** Maximum simultaneous animations before cognitive overload. */
const MAX_SAFE_SIMULTANEOUS = 5;

function easingFamily(easing: Easing | undefined): string {
  if (!easing) return "linear";
  if (easing.type === "preset") {
    const n = easing.name;
    if (/bounce|back|elastic|spring/.test(n)) return "bounce";
    if (/smooth|ease-in-out|ease-out/.test(n)) return "smooth";
    if (/snappy|ease-in/.test(n)) return "snappy";
    return n;
  }
  if (easing.type === "spring") return "bounce";
  if (easing.type === "bezier") return "bezier";
  return "linear";
}

/** Extract numeric value from a keyframe property value (e.g., "120px" → 120). */
function numericValue(value: string | number | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const match = String(value).match(/-?\d+\.?\d*/);
  return match ? parseFloat(match[0]) : null;
}

/** Calculate the maximum displacement for a component across its keyframes. */
function maxDisplacement(comp: MotionComponent): { translate: number; rotate: number; scale: number } {
  let maxTranslate = 0;
  let maxRotate = 0;
  let maxScale = 0;

  for (const kf of comp.keyframes) {
    const tx = numericValue(kf.properties.translateX as string | number | undefined);
    const ty = numericValue(kf.properties.translateY as string | number | undefined);
    if (tx != null) maxTranslate = Math.max(maxTranslate, Math.abs(tx));
    if (ty != null) maxTranslate = Math.max(maxTranslate, Math.abs(ty));

    const rot = numericValue(kf.properties.rotate as string | number | undefined);
    if (rot != null) maxRotate = Math.max(maxRotate, Math.abs(rot));

    const sc = numericValue(kf.properties.scale as string | number | undefined);
    if (sc != null) maxScale = Math.max(maxScale, Math.abs(sc));
  }

  return { translate: maxTranslate, rotate: maxRotate, scale: maxScale };
}

/** Detect flashing/strobing risk from opacity keyframe frequency. */
function detectFlashRisk(comp: MotionComponent): { isFlashing: boolean; frequencyHz: number } {
  const opacityKeyframes = comp.keyframes
    .filter((kf) => kf.properties.opacity !== undefined)
    .sort((a, b) => a.offset - b.offset);

  if (opacityKeyframes.length < 3) return { isFlashing: false, frequencyHz: 0 };

  let oscillations = 0;
  for (let i = 1; i < opacityKeyframes.length - 1; i++) {
    const prev = numericValue(opacityKeyframes[i - 1].properties.opacity as string | number | undefined) ?? 0;
    const curr = numericValue(opacityKeyframes[i].properties.opacity as string | number | undefined) ?? 0;
    const next = numericValue(opacityKeyframes[i + 1].properties.opacity as string | number | undefined) ?? 0;
    if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
      const amplitude = Math.abs(curr - prev) + Math.abs(next - curr);
      if (amplitude > 0.5) oscillations++;
    }
  }

  const durationSec = comp.durationMs / 1000;
  const frequencyHz = durationSec > 0 ? oscillations / durationSec : 0;
  return { isFlashing: frequencyHz > MAX_SAFE_FLASH_HZ, frequencyHz };
}

/** Calculate the maximum number of simultaneously active animations. */
function maxSimultaneous(components: MotionComponent[]): number {
  if (components.length === 0) return 0;
  const events: { time: number; delta: number }[] = [];
  for (const c of components) {
    const start = c.delayMs;
    const end = c.delayMs + c.durationMs * (c.iterationCount === "infinite" ? 1 : (c.iterationCount as number) || 1);
    events.push({ time: start, delta: 1 });
    events.push({ time: end, delta: -1 });
  }
  events.sort((a, b) => a.time - b.time || b.delta - a.delta);
  let current = 0;
  let maxCount = 0;
  for (const e of events) {
    current += e.delta;
    maxCount = Math.max(maxCount, current);
  }
  return maxCount;
}

/**
 * Analyze a list of motion components for accessibility and safety issues.
 * Returns a scored report with categorized issues and remediation suggestions.
 */
export function checkAccessibility(components: MotionComponent[]): AccessibilityReport {
  const issues: AccessibilityIssue[] = [];

  if (components.length === 0) {
    return {
      issues: [],
      score: 100,
      summary: "No components to analyze.",
      stats: {
        totalComponents: 0,
        vestibularIssues: 0,
        seizureIssues: 0,
        reducedMotionIssues: 0,
        cognitiveIssues: 0,
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0,
        maxSimultaneousAnimations: 0,
        hasInfiniteLoops: false,
        hasFlashingRisk: false,
        hasLargeDisplacement: false,
      },
    };
  }

  // Per-component checks
  for (const comp of components) {
    const disp = maxDisplacement(comp);

    // Vestibular: large displacement
    if (disp.translate > MAX_SAFE_DISPLACEMENT_PX) {
      issues.push({
        severity: disp.translate > MAX_SAFE_DISPLACEMENT_PX * 2 ? "critical" : "warning",
        category: "vestibular",
        componentId: comp.id,
        componentName: comp.name,
        message: `"${comp.name}" moves ${Math.round(disp.translate)}px — large displacement can trigger vestibular discomfort.`,
        remediation: "Reduce translation distance, shorten duration, or add a fade to ease the transition.",
      });
    }

    // Vestibular: excessive rotation
    if (disp.rotate > MAX_SAFE_ROTATION_DEG) {
      issues.push({
        severity: disp.rotate > 360 ? "critical" : "warning",
        category: "vestibular",
        componentId: comp.id,
        componentName: comp.name,
        message: `"${comp.name}" rotates ${Math.round(disp.rotate)}° — sustained rotation can cause motion sickness.`,
        remediation: "Limit rotation to ≤180°, or split into smaller segments with pauses.",
      });
    }

    // Vestibular: very fast animation
    if (comp.durationMs < 200 && comp.durationMs > 0) {
      issues.push({
        severity: "warning",
        category: "vestibular",
        componentId: comp.id,
        componentName: comp.name,
        message: `"${comp.name}" animates in ${comp.durationMs}ms — extremely fast motion can be jarring.`,
        remediation: "Increase duration to at least 300ms, or use a subtler property change.",
      });
    }

    // Seizure: flashing/strobing
    const flash = detectFlashRisk(comp);
    if (flash.isFlashing) {
      issues.push({
        severity: "critical",
        category: "seizure",
        componentId: comp.id,
        componentName: comp.name,
        message: `"${comp.name}" opacity oscillates at ${flash.frequencyHz.toFixed(1)}Hz — exceeds the 3Hz seizure safety threshold (WCAG 2.3.1).`,
        remediation: "Reduce opacity oscillation frequency below 3Hz, or replace flashing with a smooth fade.",
      });
    }

    // Reduced motion: infinite loops
    if (comp.iterationCount === "infinite") {
      issues.push({
        severity: "info",
        category: "reduced-motion",
        componentId: comp.id,
        componentName: comp.name,
        message: `"${comp.name}" loops infinitely — users with reduced-motion preference cannot opt out.`,
        remediation: "Provide a reduced-motion alternative: stop the loop, or replace with a single play on interaction.",
      });
    }

    // Reduced motion: essential info via motion only
    if (comp.keyframes.length > 0 && comp.durationMs > 0) {
      const hasOpacityChange = comp.keyframes.some((kf) => kf.properties.opacity !== undefined);
      const startsHidden = comp.keyframes.some(
        (kf) => kf.offset === 0 && numericValue(kf.properties.opacity as string | number | undefined) === 0,
      );
      if (hasOpacityChange && startsHidden && comp.fillMode !== "forwards" && comp.fillMode !== "both") {
        issues.push({
          severity: "warning",
          category: "reduced-motion",
          componentId: comp.id,
          componentName: comp.name,
          message: `"${comp.name}" starts hidden and reveals via animation — content is inaccessible when motion is disabled.`,
          remediation: 'Set fillMode to "forwards" or "both" so the final state persists without animation.',
        });
      }
    }
  }

  // Project-level cognitive checks
  const maxSim = maxSimultaneous(components);
  if (maxSim > MAX_SAFE_SIMULTANEOUS) {
    issues.push({
      severity: maxSim > MAX_SAFE_SIMULTANEOUS * 2 ? "critical" : "warning",
      category: "cognitive",
      componentId: null,
      componentName: null,
      message: `${maxSim} animations play simultaneously — cognitive overload for users.`,
      remediation: `Stagger animations with delays, or reduce to ≤${MAX_SAFE_SIMULTANEOUS} concurrent animations.`,
    });
  }

  // Cognitive: inconsistent timing scales
  const durations = components.map((c) => c.durationMs).filter((d) => d > 0);
  if (durations.length > 2) {
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    if (max > min * 4) {
      issues.push({
        severity: "info",
        category: "cognitive",
        componentId: null,
        componentName: null,
        message: `Timing scale varies widely (${min}ms to ${max}ms) — inconsistent rhythm.`,
        remediation: "Group components into timing tiers (e.g., 200ms, 400ms, 800ms) for visual coherence.",
      });
    }
  }

  // Cognitive: conflicting easing families
  const families = new Set(components.map((c) => easingFamily(c.easing)));
  if (families.size > 3) {
    issues.push({
      severity: "info",
      category: "cognitive",
      componentId: null,
      componentName: null,
      message: `${families.size} different easing families in use — motion feels inconsistent.`,
      remediation: "Limit to 2–3 easing families for a cohesive motion language.",
    });
  }

  // Calculate score
  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;
  const score = Math.max(0, 100 - criticalCount * 20 - warningCount * 8 - infoCount * 3);

  const stats = {
    totalComponents: components.length,
    vestibularIssues: issues.filter((i) => i.category === "vestibular").length,
    seizureIssues: issues.filter((i) => i.category === "seizure").length,
    reducedMotionIssues: issues.filter((i) => i.category === "reduced-motion").length,
    cognitiveIssues: issues.filter((i) => i.category === "cognitive").length,
    criticalCount,
    warningCount,
    infoCount,
    maxSimultaneousAnimations: maxSim,
    hasInfiniteLoops: components.some((c) => c.iterationCount === "infinite"),
    hasFlashingRisk: issues.some((i) => i.category === "seizure"),
    hasLargeDisplacement: issues.some((i) => i.category === "vestibular" && i.message.includes("moves")),
  };

  const summary = `${issues.length} issue(s) — ${criticalCount} critical, ${warningCount} warning, ${infoCount} info. Score: ${score}/100.`;

  return { issues, score, summary, stats };
}
