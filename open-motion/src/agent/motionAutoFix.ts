/**
 * Motion Auto-Fix — automatically remediates accessibility, vestibular,
 * seizure, reduced-motion, and cognitive issues detected by the accessibility
 * checker. Returns a detailed fix report with before/after values for each
 * applied remediation.
 *
 * This is the sixth original AI-native module. Where the Critique module
 * diagnoses problems, Auto-Fix applies the cure — turning motion safety
 * from a manual review step into an instant, one-call remediation.
 *
 * Fix strategies:
 * 1. Vestibular — cap displacement, cap rotation, raise duration floor
 * 2. Seizure — stretch opacity oscillation period below 3 Hz threshold
 * 3. Reduced-motion — set fillMode so final state persists, cap infinite loops
 * 4. Cognitive — stagger simultaneous starts, normalize timing tiers, unify easings
 */

import type { MotionComponent, Easing } from "@openmotion/shared";
import { easingPreset } from "../shared/motion/easing.js";
import { checkAccessibility } from "../motion/accessibility.js";
import type { AccessibilityIssue } from "../motion/accessibility.js";

/** A single remediation action applied to one component. */
export interface AutoFixAction {
  componentId: string;
  componentName: string;
  category: string;
  issue: string;
  fix: string;
  field: string;
  before: string;
  after: string;
}

/** The full auto-fix result. */
export interface AutoFixResult {
  fixes: AutoFixAction[];
  fixedCount: number;
  skippedCount: number;
  beforeScore: number;
  afterScore: number;
  beforeIssueCount: number;
  afterIssueCount: number;
  summary: string;
}

/** Options for the auto-fix pass. */
export interface AutoFixOptions {
  /** Cap translation values to this many pixels (default 300). */
  maxDisplacementPx?: number;
  /** Cap rotation values to this many degrees (default 180). */
  maxRotationDeg?: number;
  /** Minimum animation duration in ms (default 300). */
  minDurationMs?: number;
  /** Maximum loop iterations when capping infinite loops (default 3). */
  maxLoopIterations?: number;
  /** Stagger step in ms when too many simultaneous animations (default 120). */
  staggerStepMs?: number;
}

/** Safe thresholds — mirror the accessibility checker defaults. */
const DEFAULTS = {
  maxDisplacementPx: 300,
  maxRotationDeg: 180,
  minDurationMs: 300,
  maxLoopIterations: 3,
  staggerStepMs: 120,
};

/** Timing tiers for normalization (ms). */
const TIMING_TIERS = [200, 400, 600, 800, 1200, 1600];

/** Easing families for normalization. */
const EASING_FAMILY_MAP: Record<string, string> = {
  linear: "linear",
  ease: "smooth",
  "ease-in": "snappy",
  "ease-out": "smooth",
  "ease-in-out": "smooth",
  "ease-in-quad": "snappy",
  "ease-out-quad": "smooth",
  "ease-in-out-quad": "smooth",
  "ease-in-cubic": "snappy",
  "ease-out-cubic": "smooth",
  "ease-in-out-cubic": "smooth",
  bounce: "bounce",
  back: "bounce",
  elastic: "bounce",
  snappy: "snappy",
  smooth: "smooth",
  soft: "smooth",
};

function familyOf(easing: Easing): string {
  if (easing.type === "preset") {
    return EASING_FAMILY_MAP[easing.name] ?? "smooth";
  }
  if (easing.type === "spring") return "bounce";
  return "smooth";
}

function easingToFamily(family: string): Easing {
  switch (family) {
    case "bounce":
      return easingPreset("bounce");
    case "snappy":
      return easingPreset("snappy");
    case "linear":
      return easingPreset("linear");
    default:
      return easingPreset("smooth");
  }
}

/** Extract the numeric portion of a transform value. */
function parseNumber(value: string | number | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const m = String(value).match(/-?\d+\.?\d*/);
  return m ? parseFloat(m[0]) : null;
}

/** Rebuild a transform value with a new numeric portion, preserving its unit. */
function rebuildValue(original: string | number | undefined, newNumber: number): string {
  if (typeof original === "number") return String(newNumber);
  const unit = String(original).replace(/-?\d+\.?\d*/, "");
  return `${newNumber}${unit}`;
}

/** Find the nearest timing tier for a given duration. */
function nearestTier(durationMs: number): number {
  let best = TIMING_TIERS[0];
  let bestDist = Math.abs(durationMs - best);
  for (const tier of TIMING_TIERS) {
    const dist = Math.abs(durationMs - tier);
    if (dist < bestDist) {
      best = tier;
      bestDist = dist;
    }
  }
  return best;
}

/** Deep clone a component so fixes don't mutate the original. */
function cloneComponent(comp: MotionComponent): MotionComponent {
  return {
    ...comp,
    keyframes: comp.keyframes.map((kf) => ({
      ...kf,
      properties: { ...kf.properties },
      easing: kf.easing ? { ...kf.easing } : undefined,
    })),
    easing: { ...comp.easing },
    style: { ...comp.style },
  };
}

/**
 * Run a full auto-fix pass on a set of motion components.
 * Returns the fixed components (deep clones) and a detailed report.
 * The original array is not mutated.
 */
export function autoFixAccessibility(
  components: MotionComponent[],
  options?: AutoFixOptions,
): { fixedComponents: MotionComponent[]; result: AutoFixResult } {
  const opts = { ...DEFAULTS, ...options };
  const beforeReport = checkAccessibility(components);
  const fixes: AutoFixAction[] = [];
  let skipped = 0;

  // Deep clone all components.
  const fixed = components.map(cloneComponent);

  // Track the most common easing family for later normalization.
  const familyCounts = new Map<string, number>();
  for (const c of fixed) {
    const fam = familyOf(c.easing);
    familyCounts.set(fam, (familyCounts.get(fam) ?? 0) + 1);
  }
  let dominantFamily = "smooth";
  let dominantCount = 0;
  for (const [fam, count] of familyCounts) {
    if (count > dominantCount) {
      dominantFamily = fam;
      dominantCount = count;
    }
  }

  // Apply per-component fixes.
  for (const comp of fixed) {
    const issues = beforeReport.issues.filter((iss) => iss.componentId === comp.id);
    for (const issue of issues) {
      const actions = applyFix(comp, issue, opts);
      if (actions.length > 0) {
        fixes.push(...actions);
      } else {
        skipped++;
      }
    }
  }

  // Cognitive: too many simultaneous animations — stagger delays.
  const cognitiveSimultaneous = beforeReport.issues.find(
    (iss) => iss.category === "cognitive" && iss.message.includes("simultaneously"),
  );
  if (cognitiveSimultaneous) {
    const sorted = [...fixed].sort((a, b) => a.orderIndex - b.orderIndex);
    for (let i = 0; i < sorted.length; i++) {
      const comp = sorted[i];
      const newDelay = i * opts.staggerStepMs;
      if (comp.delayMs !== newDelay) {
        fixes.push({
          componentId: comp.id,
          componentName: comp.name,
          category: "cognitive",
          issue: "Too many simultaneous animations",
          fix: `Staggered start by ${opts.staggerStepMs}ms steps`,
          field: "delayMs",
          before: String(comp.delayMs),
          after: String(newDelay),
        });
        comp.delayMs = newDelay;
      }
    }
  }

  // Cognitive: inconsistent timing — normalize to nearest tier.
  const cognitiveTiming = beforeReport.issues.find(
    (iss) => iss.category === "cognitive" && iss.message.includes("Timing scale varies"),
  );
  if (cognitiveTiming) {
    for (const comp of fixed) {
      const tier = nearestTier(comp.durationMs);
      if (tier !== comp.durationMs) {
        fixes.push({
          componentId: comp.id,
          componentName: comp.name,
          category: "cognitive",
          issue: "Inconsistent timing scale",
          fix: `Normalized duration to nearest tier (${tier}ms)`,
          field: "durationMs",
          before: String(comp.durationMs),
          after: String(tier),
        });
        comp.durationMs = tier;
      }
    }
  }

  // Cognitive: conflicting easings — unify to dominant family.
  const cognitiveEasing = beforeReport.issues.find(
    (iss) => iss.category === "cognitive" && iss.message.includes("easing families"),
  );
  if (cognitiveEasing) {
    const targetEasing = easingToFamily(dominantFamily);
    for (const comp of fixed) {
      if (familyOf(comp.easing) !== dominantFamily) {
        fixes.push({
          componentId: comp.id,
          componentName: comp.name,
          category: "cognitive",
          issue: "Conflicting easing families",
          fix: `Unified easing to ${dominantFamily} family`,
          field: "easing",
          before: JSON.stringify(comp.easing),
          after: JSON.stringify(targetEasing),
        });
        comp.easing = targetEasing;
      }
    }
  }

  // Re-check the fixed components.
  const afterReport = checkAccessibility(fixed);

  const result: AutoFixResult = {
    fixes,
    fixedCount: fixes.length,
    skippedCount: skipped,
    beforeScore: beforeReport.score,
    afterScore: afterReport.score,
    beforeIssueCount: beforeReport.issues.length,
    afterIssueCount: afterReport.issues.length,
    summary: `Applied ${fixes.length} fix(es) — score ${beforeReport.score}→${afterReport.score}, issues ${beforeReport.issues.length}→${afterReport.issues.length}.`,
  };

  return { fixedComponents: fixed, result };
}

/** Apply fixes to a component based on a single accessibility issue. Returns 0+ actions. */
function applyFix(
  comp: MotionComponent,
  issue: AccessibilityIssue,
  opts: typeof DEFAULTS,
): AutoFixAction[] {
  const actions: AutoFixAction[] = [];
  const cat = issue.category;

  // Vestibular: large displacement — cap translate values.
  if (cat === "vestibular" && issue.message.includes("moves")) {
    for (const kf of comp.keyframes) {
      for (const key of ["translateX", "translateY"] as const) {
        const val = parseNumber(kf.properties[key] as string | number | undefined);
        if (val != null && Math.abs(val) > opts.maxDisplacementPx) {
          const capped = Math.sign(val) * opts.maxDisplacementPx;
          const before = String(kf.properties[key]);
          kf.properties[key] = rebuildValue(kf.properties[key] as string | number | undefined, capped);
          actions.push({
            componentId: comp.id,
            componentName: comp.name,
            category: "vestibular",
            issue: issue.message.substring(0, 80),
            fix: `Capped ${key} to ${opts.maxDisplacementPx}px`,
            field: `keyframe.${key}`,
            before,
            after: String(kf.properties[key]),
          });
        }
      }
    }
    return actions;
  }

  // Vestibular: excessive rotation — cap rotate values.
  if (cat === "vestibular" && issue.message.includes("rotates")) {
    for (const kf of comp.keyframes) {
      const val = parseNumber(kf.properties.rotate as string | number | undefined);
      if (val != null && Math.abs(val) > opts.maxRotationDeg) {
        const capped = Math.sign(val) * opts.maxRotationDeg;
        const before = String(kf.properties.rotate);
        kf.properties.rotate = rebuildValue(kf.properties.rotate as string | number | undefined, capped);
        actions.push({
          componentId: comp.id,
          componentName: comp.name,
          category: "vestibular",
          issue: issue.message.substring(0, 80),
          fix: `Capped rotation to ${opts.maxRotationDeg}deg`,
          field: "keyframe.rotate",
          before,
          after: String(kf.properties.rotate),
        });
      }
    }
    return actions;
  }

  // Vestibular: very fast animation — raise duration floor.
  if (cat === "vestibular" && issue.message.includes("animates in")) {
    const before = String(comp.durationMs);
    comp.durationMs = opts.minDurationMs;
    actions.push({
      componentId: comp.id,
      componentName: comp.name,
      category: "vestibular",
      issue: `Duration too fast (${before}ms)`,
      fix: `Raised duration to ${opts.minDurationMs}ms`,
      field: "durationMs",
      before,
      after: String(comp.durationMs),
    });
    return actions;
  }

  // Seizure: flashing — stretch duration below 3 Hz threshold.
  if (cat === "seizure") {
    const opacityKfs = comp.keyframes.filter((kf) => kf.properties.opacity !== undefined);
    if (opacityKfs.length >= 3) {
      let oscillations = 0;
      for (let i = 1; i < opacityKfs.length - 1; i++) {
        const prev = parseNumber(opacityKfs[i - 1].properties.opacity) ?? 0;
        const curr = parseNumber(opacityKfs[i].properties.opacity) ?? 0;
        const next = parseNumber(opacityKfs[i + 1].properties.opacity) ?? 0;
        if ((curr > prev && curr > next) || (curr < prev && curr < next)) oscillations++;
      }
      const minDuration = Math.ceil((oscillations / 3) * 1000);
      if (minDuration > comp.durationMs) {
        const before = String(comp.durationMs);
        comp.durationMs = Math.max(minDuration, comp.durationMs * 2);
        actions.push({
          componentId: comp.id,
          componentName: comp.name,
          category: "seizure",
          issue: "Opacity oscillates above 3Hz",
          fix: `Stretched duration to ${comp.durationMs}ms (below 3Hz threshold)`,
          field: "durationMs",
          before,
          after: String(comp.durationMs),
        });
      }
    }
    return actions;
  }

  // Reduced-motion: infinite loops — cap iterations.
  if (cat === "reduced-motion" && issue.message.includes("loops infinitely")) {
    const before = String(comp.iterationCount);
    comp.iterationCount = opts.maxLoopIterations;
    actions.push({
      componentId: comp.id,
      componentName: comp.name,
      category: "reduced-motion",
      issue: "Infinite loop without opt-out",
      fix: `Capped iterations to ${opts.maxLoopIterations}`,
      field: "iterationCount",
      before,
      after: String(comp.iterationCount),
    });
    return actions;
  }

  // Reduced-motion: hidden content — set fillMode.
  if (cat === "reduced-motion" && issue.message.includes("starts hidden")) {
    const before = comp.fillMode;
    comp.fillMode = "forwards";
    actions.push({
      componentId: comp.id,
      componentName: comp.name,
      category: "reduced-motion",
      issue: "Content hidden without persistent fill",
      fix: 'Set fillMode to "forwards"',
      field: "fillMode",
      before,
      after: comp.fillMode,
    });
    return actions;
  }

  return actions;
}

/** Format the auto-fix result as a human-readable report. */
export function formatAutoFixReport(result: AutoFixResult): string {
  const lines: string[] = [];
  lines.push("=== Motion Auto-Fix Report ===");
  lines.push("");
  lines.push(`Score: ${result.beforeScore} -> ${result.afterScore}`);
  lines.push(`Issues: ${result.beforeIssueCount} -> ${result.afterIssueCount}`);
  lines.push(`Fixes applied: ${result.fixedCount}`);
  lines.push(`Fixes skipped: ${result.skippedCount}`);
  lines.push("");
  lines.push("--- Applied Fixes ---");
  for (const fix of result.fixes) {
    lines.push(`[${fix.category}] ${fix.componentName}`);
    lines.push(`  Issue: ${fix.issue}`);
    lines.push(`  Fix: ${fix.fix}`);
    lines.push(`  ${fix.field}: ${fix.before} -> ${fix.after}`);
    lines.push("");
  }
  lines.push(`Summary: ${result.summary}`);
  return lines.join("\n");
}
