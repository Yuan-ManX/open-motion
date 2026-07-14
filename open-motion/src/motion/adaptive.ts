import type { Easing, MotionComponent, MotionSpec } from "@openmotion/shared";
import { easingPreset } from "../shared/motion/easing.js";

/**
 * Adaptive Motion System — context-responsive motion adaptation. Adjusts
 * motion parameters based on viewport size, device capabilities, accessibility
 * preferences, and performance budgets. A motion designed for desktop should
 * gracefully degrade on mobile without losing its essence.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeviceType = "desktop" | "tablet" | "mobile" | "tv";
export type PerformanceTier = "high" | "medium" | "low";
export type AccessibilityMode = "full" | "reduced" | "minimal";

export interface ViewportProfile {
  device: DeviceType;
  width: number;
  height: number;
  pixelRatio: number;
}

export interface AdaptationContext {
  viewport: ViewportProfile;
  performance: PerformanceTier;
  accessibility: AccessibilityMode;
  connectionSpeed: "fast" | "slow" | "offline";
  batteryLevel: number; // 0..1, 1 = full
}

export interface AdaptationResult {
  adaptedSpec: MotionSpec;
  changes: AdaptationChange[];
  summary: string;
  reductionLevel: number; // 0..1 — how much was reduced
}

export interface AdaptationChange {
  componentId: string;
  componentName: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface ResponsiveBreakpoint {
  name: string;
  maxWidth: number;
  durationScale: number;
  delayScale: number;
  maxKeyframes: number;
  disableLoops: boolean;
  simplifyEasing: boolean;
}

// ---------------------------------------------------------------------------
// Breakpoints
// ---------------------------------------------------------------------------

export const RESPONSIVE_BREAKPOINTS: ResponsiveBreakpoint[] = [
  { name: "desktop", maxWidth: 99999, durationScale: 1.0, delayScale: 1.0, maxKeyframes: 99, disableLoops: false, simplifyEasing: false },
  { name: "tablet", maxWidth: 1024, durationScale: 0.85, delayScale: 0.8, maxKeyframes: 6, disableLoops: false, simplifyEasing: true },
  { name: "mobile", maxWidth: 640, durationScale: 0.7, delayScale: 0.6, maxKeyframes: 4, disableLoops: true, simplifyEasing: true },
  { name: "small", maxWidth: 400, durationScale: 0.5, delayScale: 0.4, maxKeyframes: 2, disableLoops: true, simplifyEasing: true },
];

function findBreakpoint(width: number): ResponsiveBreakpoint {
  return RESPONSIVE_BREAKPOINTS.find((b) => width <= b.maxWidth) || RESPONSIVE_BREAKPOINTS[0];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function easingFamily(e: Easing | undefined): string {
  if (!e) return "linear";
  if (e.type === "preset") {
    const n = e.name;
    if (/bounce|back|elastic|spring/.test(n)) return "bounce";
    if (/smooth|ease-in-out/.test(n)) return "smooth";
    if (/snappy|ease-in$/.test(n)) return "snappy";
    return n;
  }
  if (e.type === "spring") return "bounce";
  if (e.type === "bezier") return "bezier";
  return "linear";
}

function cloneSpec(spec: MotionSpec): MotionSpec {
  return JSON.parse(JSON.stringify(spec));
}

// ---------------------------------------------------------------------------
// Adaptation strategies
// ---------------------------------------------------------------------------

function adaptForViewport(spec: MotionSpec, bp: ResponsiveBreakpoint, changes: AdaptationChange[]): MotionSpec {
  const adapted = cloneSpec(spec);
  for (const comp of adapted.components) {
    const origDuration = comp.durationMs;
    const origDelay = comp.delayMs;

    comp.durationMs = Math.round(comp.durationMs * bp.durationScale);
    if (comp.durationMs < 100) comp.durationMs = 100;

    comp.delayMs = Math.round(comp.delayMs * bp.delayScale);

    if (origDuration !== comp.durationMs) {
      changes.push({
        componentId: comp.id, componentName: comp.name,
        field: "durationMs", oldValue: `${origDuration}ms`, newValue: `${comp.durationMs}ms`,
        reason: `${bp.name} viewport: duration scaled by ${bp.durationScale}`,
      });
    }
    if (origDelay !== comp.delayMs) {
      changes.push({
        componentId: comp.id, componentName: comp.name,
        field: "delayMs", oldValue: `${origDelay}ms`, newValue: `${comp.delayMs}ms`,
        reason: `${bp.name} viewport: delay scaled by ${bp.delayScale}`,
      });
    }

    // Simplify easing on smaller screens
    if (bp.simplifyEasing) {
      const family = easingFamily(comp.easing);
      if (family === "bounce" || family === "bezier" || family === "spring") {
        const oldEasing = JSON.stringify(comp.easing);
        comp.easing = easingPreset("ease-out");
        changes.push({
          componentId: comp.id, componentName: comp.name,
          field: "easing", oldValue: oldEasing, newValue: "ease-out",
          reason: `${bp.name} viewport: complex easing simplified to ease-out`,
        });
      }
    }

    // Disable loops on small screens to save battery
    if (bp.disableLoops && comp.iterationCount === "infinite") {
      const oldLoop = String(comp.iterationCount);
      comp.iterationCount = 1;
      changes.push({
        componentId: comp.id, componentName: comp.name,
        field: "iterationCount", oldValue: oldLoop, newValue: "1",
        reason: `${bp.name} viewport: infinite loops disabled to save battery`,
      });
    }

    // Reduce keyframes if exceeding max
    if (comp.keyframes.length > bp.maxKeyframes) {
      const oldCount = comp.keyframes.length;
      // Keep first, last, and evenly spaced middle keyframes
      const kept: typeof comp.keyframes = [comp.keyframes[0]];
      const step = (comp.keyframes.length - 1) / (bp.maxKeyframes - 1);
      for (let i = 1; i < bp.maxKeyframes - 1; i++) {
        kept.push(comp.keyframes[Math.round(i * step)]);
      }
      kept.push(comp.keyframes[comp.keyframes.length - 1]);
      comp.keyframes = kept;
      changes.push({
        componentId: comp.id, componentName: comp.name,
        field: "keyframes", oldValue: `${oldCount} keyframes`, newValue: `${comp.keyframes.length} keyframes`,
        reason: `${bp.name} viewport: keyframes reduced to ${bp.maxKeyframes} max`,
      });
    }
  }
  return adapted;
}

function adaptForAccessibility(spec: MotionSpec, mode: AccessibilityMode, changes: AdaptationChange[]): MotionSpec {
  if (mode === "full") return spec;

  const adapted = cloneSpec(spec);

  if (mode === "reduced") {
    // Reduce intensity: slower, no bounce, no loops
    for (const comp of adapted.components) {
      const family = easingFamily(comp.easing);
      if (family === "bounce" || family === "spring") {
        const oldEasing = JSON.stringify(comp.easing);
        comp.easing = easingPreset("ease-out");
        changes.push({
          componentId: comp.id, componentName: comp.name,
          field: "easing", oldValue: oldEasing, newValue: "ease-out",
          reason: "reduced-motion: bounce/spring replaced with ease-out",
        });
      }
      if (comp.iterationCount === "infinite") {
        const oldLoop = String(comp.iterationCount);
        comp.iterationCount = 1;
        changes.push({
          componentId: comp.id, componentName: comp.name,
          field: "iterationCount", oldValue: oldLoop, newValue: "1",
          reason: "reduced-motion: infinite loops disabled",
        });
      }
      // Reduce transform distance by 50%
      for (const kf of comp.keyframes) {
        for (const key of Object.keys(kf.properties)) {
          if (key === "translateX" || key === "translateY") {
            const v = kf.properties[key];
            if (typeof v === "number") {
              const oldVal = String(v);
              kf.properties[key] = v * 0.5;
              changes.push({
                componentId: comp.id, componentName: comp.name,
                field: `keyframe.${key}`, oldValue: oldVal, newValue: String(kf.properties[key]),
                reason: "reduced-motion: transform distance halved",
              });
            }
          }
        }
      }
    }
  }

  if (mode === "minimal") {
    // Remove all non-essential motion: only opacity fades, no transforms
    for (const comp of adapted.components) {
      const oldKeyframeCount = comp.keyframes.length;
      const filteredKeyframes = comp.keyframes.map((kf) => {
        const newProps: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(kf.properties)) {
          if (key === "opacity") newProps[key] = value;
        }
        return { ...kf, properties: newProps };
      }).filter((kf) => Object.keys(kf.properties).length > 0);

      if (filteredKeyframes.length !== oldKeyframeCount) {
        changes.push({
          componentId: comp.id, componentName: comp.name,
          field: "keyframes", oldValue: `${oldKeyframeCount} keyframes with transforms`, newValue: `${filteredKeyframes.length} keyframes (opacity only)`,
          reason: "minimal-motion: all transform animations removed, only opacity preserved",
        });
      }
      comp.keyframes = filteredKeyframes.length > 0 ? filteredKeyframes : comp.keyframes;
      comp.iterationCount = 1;
      comp.durationMs = Math.min(comp.durationMs, 200);
    }
  }

  return adapted;
}

function adaptForPerformance(spec: MotionSpec, tier: PerformanceTier, changes: AdaptationChange[]): MotionSpec {
  if (tier === "high") return spec;

  const adapted = cloneSpec(spec);

  if (tier === "medium") {
    // Reduce keyframe density by 30%, cap loops at 3
    for (const comp of adapted.components) {
      if (comp.iterationCount === "infinite") {
        const oldLoop = String(comp.iterationCount);
        comp.iterationCount = 3;
        changes.push({
          componentId: comp.id, componentName: comp.name,
          field: "iterationCount", oldValue: oldLoop, newValue: "3",
          reason: "medium performance: infinite loops capped at 3",
        });
      }
    }
  }

  if (tier === "low") {
    // Aggressive reduction: linear easing, no loops, minimal keyframes
    for (const comp of adapted.components) {
      const family = easingFamily(comp.easing);
      if (family !== "linear") {
        const oldEasing = JSON.stringify(comp.easing);
        comp.easing = easingPreset("linear");
        changes.push({
          componentId: comp.id, componentName: comp.name,
          field: "easing", oldValue: oldEasing, newValue: "linear",
          reason: "low performance: non-linear easing replaced with linear (cheaper to compute)",
        });
      }
      if (comp.iterationCount === "infinite") {
        const oldLoop = String(comp.iterationCount);
        comp.iterationCount = 1;
        changes.push({
          componentId: comp.id, componentName: comp.name,
          field: "iterationCount", oldValue: oldLoop, newValue: "1",
          reason: "low performance: loops disabled",
        });
      }
      // Reduce to 2 keyframes max
      if (comp.keyframes.length > 2) {
        const oldCount = comp.keyframes.length;
        comp.keyframes = [comp.keyframes[0], comp.keyframes[comp.keyframes.length - 1]];
        changes.push({
          componentId: comp.id, componentName: comp.name,
          field: "keyframes", oldValue: `${oldCount} keyframes`, newValue: "2 keyframes",
          reason: "low performance: keyframes reduced to 2 (start + end only)",
        });
      }
    }
  }

  return adapted;
}

// ---------------------------------------------------------------------------
// Main adaptation function
// ---------------------------------------------------------------------------

export function adaptMotion(spec: MotionSpec, ctx: AdaptationContext): AdaptationResult {
  const changes: AdaptationChange[] = [];
  let adapted = cloneSpec(spec);

  // 1. Viewport adaptation
  const bp = findBreakpoint(ctx.viewport.width);
  adapted = adaptForViewport(adapted, bp, changes);

  // 2. Accessibility adaptation
  adapted = adaptForAccessibility(adapted, ctx.accessibility, changes);

  // 3. Performance adaptation (also considers battery)
  const effectiveTier = ctx.batteryLevel < 0.2 ? "low" : ctx.performance;
  adapted = adaptForPerformance(adapted, effectiveTier as PerformanceTier, changes);

  // 4. Connection speed: reduce for slow connections
  if (ctx.connectionSpeed === "slow") {
    for (const comp of adapted.components) {
      if (comp.iterationCount === "infinite") {
        comp.iterationCount = 1;
        changes.push({
          componentId: comp.id, componentName: comp.name,
          field: "iterationCount", oldValue: "infinite", newValue: "1",
          reason: "slow connection: loops disabled to reduce CPU usage",
        });
      }
    }
  }

  // Calculate reduction level
  const totalComponents = spec.components.length;
  const changedComponents = new Set(changes.map((c) => c.componentId)).size;
  const reductionLevel = totalComponents > 0 ? changedComponents / totalComponents : 0;

  const summary = `Adapted for ${ctx.viewport.device} (${ctx.viewport.width}x${ctx.viewport.height}), ` +
    `${ctx.accessibility} motion, ${effectiveTier} performance, ${ctx.connectionSpeed} connection. ` +
    `${changes.length} change(s) across ${changedComponents}/${totalComponents} component(s). ` +
    `Reduction level: ${(reductionLevel * 100).toFixed(0)}%.`;

  return { adaptedSpec: adapted, changes, summary, reductionLevel };
}

// ---------------------------------------------------------------------------
// CSS generation for responsive motion
// ---------------------------------------------------------------------------

export function generateResponsiveCss(spec: MotionSpec): string {
  const lines: string[] = [];
  lines.push("/* OpenMotion Responsive Motion CSS */");
  lines.push("");

  // Base (desktop) styles
  lines.push("/* Desktop (default) */");
  for (const comp of spec.components) {
    lines.push(`@media (min-width: 1025px) {`);
    lines.push(`  [data-motion="${comp.id}"] { animation-duration: ${comp.durationMs}ms; animation-delay: ${comp.delayMs}ms; }`);
    lines.push(`}`);
  }
  lines.push("");

  // Tablet
  const tabletBp = RESPONSIVE_BREAKPOINTS[1];
  lines.push(`/* Tablet (max-width: ${tabletBp.maxWidth}px) */`);
  lines.push(`@media (max-width: ${tabletBp.maxWidth}px) {`);
  for (const comp of spec.components) {
    const dur = Math.round(comp.durationMs * tabletBp.durationScale);
    const delay = Math.round(comp.delayMs * tabletBp.delayScale);
    lines.push(`  [data-motion="${comp.id}"] { animation-duration: ${dur}ms; animation-delay: ${delay}ms; }`);
  }
  lines.push("}");
  lines.push("");

  // Mobile
  const mobileBp = RESPONSIVE_BREAKPOINTS[2];
  lines.push(`/* Mobile (max-width: ${mobileBp.maxWidth}px) */`);
  lines.push(`@media (max-width: ${mobileBp.maxWidth}px) {`);
  for (const comp of spec.components) {
    const dur = Math.round(comp.durationMs * mobileBp.durationScale);
    const delay = Math.round(comp.delayMs * mobileBp.delayScale);
    const loop = mobileBp.disableLoops && comp.iterationCount === "infinite" ? "1" : String(comp.iterationCount);
    lines.push(`  [data-motion="${comp.id}"] { animation-duration: ${dur}ms; animation-delay: ${delay}ms; animation-iteration-count: ${loop}; }`);
  }
  lines.push("}");
  lines.push("");

  // Reduced motion
  lines.push("/* Reduced motion preference */");
  lines.push("@media (prefers-reduced-motion: reduce) {");
  for (const comp of spec.components) {
    lines.push(`  [data-motion="${comp.id}"] { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }`);
  }
  lines.push("}");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Preview adaptation (what-if analysis)
// ---------------------------------------------------------------------------

export interface AdaptationPreview {
  breakpoint: ResponsiveBreakpoint;
  changeCount: number;
  estimatedLoadMs: number;
  description: string;
}

export function previewAdaptations(spec: MotionSpec): AdaptationPreview[] {
  return RESPONSIVE_BREAKPOINTS.map((bp) => {
    const changes: AdaptationChange[] = [];
    const adapted = adaptForViewport(spec, bp, changes);
    // Estimate load: duration * keyframe count * component count
    const totalKeyframes = adapted.components.reduce((s, c) => s + c.keyframes.length, 0);
    const estimatedLoadMs = adapted.components.reduce((s, c) => s + c.durationMs, 0) * Math.max(1, totalKeyframes / 10);
    return {
      breakpoint: bp,
      changeCount: changes.length,
      estimatedLoadMs: Math.round(estimatedLoadMs),
      description: `${bp.name}: ${changes.length} adaptations, estimated load ${Math.round(estimatedLoadMs)}ms`,
    };
  });
}
