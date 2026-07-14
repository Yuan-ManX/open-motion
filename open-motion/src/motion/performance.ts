/**
 * Motion Performance Budget — analyzes animation cost metrics and estimates
 * frame budget impact. Tracks paint complexity, composite vs layout-triggering
 * properties, simultaneous animation count, and DOM impact.
 *
 * The goal is to help designers stay within a 16ms frame budget (60fps) by
 * flagging expensive properties and suggesting cheaper alternatives.
 */

import type { MotionComponent } from "@openmotion/shared";

export type PerformanceSeverity = "info" | "warning" | "critical";

export interface PerformanceIssue {
  severity: PerformanceSeverity;
  componentId: string | null;
  componentName: string | null;
  category: "paint" | "layout" | "composite" | "simultaneous" | "dom";
  message: string;
  suggestion: string;
}

export interface ComponentCost {
  componentId: string;
  componentName: string;
  paintCost: number;
  layoutCost: number;
  compositeCost: number;
  totalCost: number;
  animatedProperties: string[];
  expensiveStyles: string[];
}

export interface PerformanceReport {
  issues: PerformanceIssue[];
  componentCosts: ComponentCost[];
  stats: {
    totalComponents: number;
    maxSimultaneousAnimations: number;
    totalPaintCost: number;
    totalLayoutCost: number;
    totalCompositeCost: number;
    estimatedFrameMs: number;
    targetFrameMs: number;
    withinBudget: boolean;
    expensivePropertyCount: number;
    layoutTriggerCount: number;
  };
  summary: string;
}

/** Properties that trigger layout (expensive). */
const LAYOUT_PROPERTIES = new Set([
  "width", "height", "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
  "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "top", "left", "right", "bottom", "border", "borderWidth",
]);

/** Properties that are composited (cheap). */
const COMPOSITE_PROPERTIES = new Set([
  "transform", "translateX", "translateY", "translateZ",
  "rotate", "rotateX", "rotateY", "rotateZ",
  "scale", "scaleX", "scaleY", "scaleZ",
  "opacity", "filter",
]);

/** Style properties that are expensive to paint. */
const EXPENSIVE_STYLES = new Set([
  "backdropFilter", "filter", "boxShadow", "textShadow",
]);

/** Target frame time for 60fps in milliseconds. */
const TARGET_FRAME_MS = 16;

/** Extract numeric value from a style or keyframe value. */
function num(value: string | number | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const m = String(value).match(/-?\d+\.?\d*/);
  return m ? parseFloat(m[0]) : null;
}

/** Calculate paint cost from a component's style. */
function calculatePaintCost(comp: MotionComponent): { cost: number; expensive: string[] } {
  let cost = 0;
  const expensive: string[] = [];
  const style = comp.style ?? {};

  for (const key of EXPENSIVE_STYLES) {
    const val = style[key as keyof typeof style];
    if (val == null) continue;
    const str = String(val);
    expensive.push(key);

    if (key === "filter" || key === "backdropFilter") {
      if (/blur/i.test(str)) {
        const blurVal = num(str.match(/blur\(([^)]+)\)/)?.[1]);
        if (blurVal != null) {
          cost += blurVal > 10 ? 8 : blurVal > 5 ? 4 : 2;
        } else {
          cost += 3;
        }
      }
      if (/drop-shadow/i.test(str)) cost += 3;
      if (/hue-rotate|saturate|contrast/i.test(str)) cost += 2;
    }

    if (key === "boxShadow") {
      const blurVal = num(str.match(/(\d+\.?\d*)px\s+(?:\d+\.?\d*)px\s+(\d+\.?\d*)px/)?.[2]);
      if (blurVal != null) {
        cost += blurVal > 20 ? 5 : blurVal > 10 ? 3 : 1;
      } else {
        cost += 2;
      }
    }

    if (key === "textShadow") cost += 1;
  }

  if (style.background && /gradient/i.test(String(style.background))) cost += 2;
  if (style.backgroundImage && /gradient/i.test(String(style.backgroundImage))) cost += 2;

  return { cost, expensive };
}

/** Classify animated properties from keyframes. */
function classifyAnimatedProperties(comp: MotionComponent): {
  animated: string[];
  layout: string[];
  composite: string[];
  paint: string[];
} {
  const animated = new Set<string>();
  const layout: string[] = [];
  const composite: string[] = [];
  const paint: string[] = [];

  for (const kf of comp.keyframes) {
    for (const key of Object.keys(kf.properties)) {
      if (animated.has(key)) continue;
      animated.add(key);

      if (COMPOSITE_PROPERTIES.has(key)) {
        composite.push(key);
      } else if (LAYOUT_PROPERTIES.has(key)) {
        layout.push(key);
      } else {
        paint.push(key);
      }
    }
  }

  return { animated: [...animated], layout, composite, paint };
}

/** Calculate the maximum number of simultaneously active animations. */
function maxSimultaneousAnimations(components: MotionComponent[]): number {
  if (components.length === 0) return 0;
  const events: { time: number; delta: number }[] = [];
  for (const c of components) {
    const start = c.delayMs;
    const iterations = c.iterationCount === "infinite" ? 1 : (c.iterationCount as number) || 1;
    const end = c.delayMs + c.durationMs * iterations;
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
 * Analyze motion components for performance issues and frame budget impact.
 */
export function checkPerformance(components: MotionComponent[]): PerformanceReport {
  if (components.length === 0) {
    return {
      issues: [],
      componentCosts: [],
      stats: {
        totalComponents: 0,
        maxSimultaneousAnimations: 0,
        totalPaintCost: 0,
        totalLayoutCost: 0,
        totalCompositeCost: 0,
        estimatedFrameMs: 0,
        targetFrameMs: TARGET_FRAME_MS,
        withinBudget: true,
        expensivePropertyCount: 0,
        layoutTriggerCount: 0,
      },
      summary: "No components to analyze.",
    };
  }

  const issues: PerformanceIssue[] = [];
  const componentCosts: ComponentCost[] = [];
  let totalPaintCost = 0;
  let totalLayoutCost = 0;
  let totalCompositeCost = 0;
  let expensivePropertyCount = 0;
  let layoutTriggerCount = 0;

  for (const comp of components) {
    const { cost: paintCost, expensive } = calculatePaintCost(comp);
    const { animated, layout, composite, paint } = classifyAnimatedProperties(comp);

    const layoutCost = layout.length * 5;
    const compositeCost = composite.length * 0.5 + paint.length * 1;
    const totalCost = paintCost + layoutCost + compositeCost;

    totalPaintCost += paintCost;
    totalLayoutCost += layoutCost;
    totalCompositeCost += compositeCost;
    expensivePropertyCount += expensive.length;
    layoutTriggerCount += layout.length;

    componentCosts.push({
      componentId: comp.id,
      componentName: comp.name,
      paintCost,
      layoutCost,
      compositeCost,
      totalCost,
      animatedProperties: animated,
      expensiveStyles: expensive,
    });

    if (layout.length > 0) {
      issues.push({
        severity: "critical",
        componentId: comp.id,
        componentName: comp.name,
        category: "layout",
        message: `"${comp.name}" animates layout properties (${layout.join(", ")}) — triggers reflow every frame.`,
        suggestion: "Use transform (translateX/translateY/scale) instead of top/left/width/height for smoother animation.",
      });
    }

    if (paintCost >= 8) {
      issues.push({
        severity: "warning",
        componentId: comp.id,
        componentName: comp.name,
        category: "paint",
        message: `"${comp.name}" has expensive paint operations (${expensive.join(", ")}) — high GPU cost.`,
        suggestion: "Reduce blur radius, simplify shadows, or use will-change: transform to promote to a compositor layer.",
      });
    }

    if (comp.iterationCount === "infinite" && expensive.length > 0) {
      issues.push({
        severity: "warning",
        componentId: comp.id,
        componentName: comp.name,
        category: "paint",
        message: `"${comp.name}" loops infinitely with expensive styles — sustained GPU load.`,
        suggestion: "Remove the infinite loop, or simplify the animated styles to reduce continuous paint cost.",
      });
    }
  }

  const maxSim = maxSimultaneousAnimations(components);
  if (maxSim > 8) {
    issues.push({
      severity: maxSim > 15 ? "critical" : "warning",
      componentId: null,
      componentName: null,
      category: "simultaneous",
      message: `${maxSim} animations run simultaneously — high main-thread load.`,
      suggestion: "Stagger animations with delays, or reduce concurrent animation count to ≤8.",
    });
  }

  const estimatedFrameMs =
    totalPaintCost * 0.5 +
    totalLayoutCost * 1.0 +
    totalCompositeCost * 0.2 +
    maxSim * 0.3;

  const withinBudget = estimatedFrameMs <= TARGET_FRAME_MS;

  if (!withinBudget) {
    issues.push({
      severity: estimatedFrameMs > TARGET_FRAME_MS * 2 ? "critical" : "warning",
      componentId: null,
      componentName: null,
      category: "dom",
      message: `Estimated frame time ${estimatedFrameMs.toFixed(1)}ms exceeds ${TARGET_FRAME_MS}ms budget (60fps).`,
      suggestion: "Reduce paint cost, replace layout-triggering animations with transform/opacity, or stagger concurrent animations.",
    });
  }

  const stats = {
    totalComponents: components.length,
    maxSimultaneousAnimations: maxSim,
    totalPaintCost,
    totalLayoutCost,
    totalCompositeCost,
    estimatedFrameMs,
    targetFrameMs: TARGET_FRAME_MS,
    withinBudget,
    expensivePropertyCount,
    layoutTriggerCount,
  };

  const summary = withinBudget
    ? `Performance OK — estimated ${estimatedFrameMs.toFixed(1)}ms/frame (budget: ${TARGET_FRAME_MS}ms). ${issues.length} issue(s).`
    : `Performance warning — estimated ${estimatedFrameMs.toFixed(1)}ms/frame exceeds ${TARGET_FRAME_MS}ms budget. ${issues.length} issue(s).`;

  return { issues, componentCosts, stats, summary };
}
