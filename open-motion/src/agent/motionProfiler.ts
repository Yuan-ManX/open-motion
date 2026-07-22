/**
 * Motion Profiler — quantitative performance cost estimation.
 *
 * This is the fourteenth original AI-native module. Where Critique evaluates
 * aesthetic and consistency qualitatively, the Profiler estimates the concrete
 * runtime cost of a motion spec before it reaches the browser. It models GPU
 * composite layers, paint complexity, layout thrash risk, animation overlap,
 * and frame-budget consumption to produce a numerical cost score and targeted
 * optimization recommendations.
 *
 * Six core analytics:
 * 1. Per-component cost breakdown — each component receives a cost estimate
 *    across five axes (composite, paint, layout, loop, overlap).
 * 2. Project-level frame budget — sums concurrent animation cost and compares
 *    against a 16.6ms frame budget (60fps target).
 * 3. Jank risk assessment — flags components likely to cause dropped frames
 *    based on animated properties and duration.
 * 4. Overlap penalty — detects time windows where too many animations run
 *    concurrently, exceeding the compositor's parallel capacity.
 * 5. GPU memory estimate — approximates the number of promoted layers and
 *    their memory footprint.
 * 6. Optimization recommendations — concrete, ranked suggestions to reduce
 *    cost without changing the visual intent.
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionComponent, MotionSpec } from "@openmotion/shared";

/** Cost axes for a single component. */
export interface ComponentCost {
  componentId: string;
  componentName: string;
  /** Composite cost (0..10) — GPU layer promotion + transform/opacity ops. */
  composite: number;
  /** Paint cost (0..10) — repaint triggered by color/shadow/filter changes. */
  paint: number;
  /** Layout cost (0..10) — reflow triggered by size/margin/padding changes. */
  layout: number;
  /** Loop cost (0..10) — continuous GPU wake from infinite or long loops. */
  loop: number;
  /** Overlap cost (0..10) — penalty for running during a congested window. */
  overlap: number;
  /** Total cost (sum of all axes). */
  total: number;
  /** Which animated properties drive the cost. */
  costlyProperties: string[];
  /** Whether this component is likely to cause jank. */
  jankRisk: "none" | "low" | "medium" | "high";
}

/** A time window where animations overlap. */
export interface OverlapWindow {
  /** Start time of the overlap in ms from project start. */
  startMs: number;
  /** End time of the overlap in ms from project start. */
  endMs: number;
  /** Number of concurrent animations in this window. */
  concurrentCount: number;
  /** Component IDs active in this window. */
  componentIds: string[];
  /** Severity of the overlap. */
  severity: "ok" | "moderate" | "heavy" | "critical";
}

/** GPU layer estimate for the project. */
export interface GpuLayerEstimate {
  /** Estimated number of promoted composite layers. */
  promotedLayers: number;
  /** Estimated GPU memory in KB. */
  estimatedMemoryKb: number;
  /** Whether will-change is recommended. */
  recommendWillChange: boolean;
  /** Components that would benefit from will-change hints. */
  willChangeCandidates: string[];
}

/** A ranked optimization recommendation. */
export interface ProfilerRecommendation {
  rank: number;
  componentId: string;
  componentName: string;
  title: string;
  description: string;
  /** Estimated cost reduction if applied. */
  estimatedSaving: number;
  /** The specific property to change. */
  targetProperty: string;
  /** The suggested new value. */
  suggestedValue: string;
}

/** The complete profiler report. */
export interface ProfilerReport {
  componentCount: number;
  /** Total project cost (sum of all component totals). */
  totalCost: number;
  /** Average cost per component. */
  averageCost: number;
  /** Estimated frame budget consumption percentage (0..100+). */
  frameBudgetPercent: number;
  /** Whether the project fits within a 60fps frame budget. */
  fitsFrameBudget: boolean;
  /** Per-component cost breakdown. */
  components: ComponentCost[];
  /** Detected overlap windows. */
  overlaps: OverlapWindow[];
  /** GPU layer estimate. */
  gpu: GpuLayerEstimate;
  /** Ranked optimization recommendations. */
  recommendations: ProfilerRecommendation[];
  /** Overall performance grade (A..F). */
  grade: "A" | "B" | "C" | "D" | "F";
  /** Human-readable summary. */
  summary: string;
}

/** Property cost weights. Higher = more expensive to animate. */
const PROPERTY_COSTS: Record<string, { composite: number; paint: number; layout: number }> = {
  transform: { composite: 2, paint: 0, layout: 0 },
  translate: { composite: 2, paint: 0, layout: 0 },
  rotate: { composite: 2, paint: 0, layout: 0 },
  scale: { composite: 2, paint: 0, layout: 0 },
  opacity: { composite: 1, paint: 0, layout: 0 },
  color: { composite: 0, paint: 3, layout: 0 },
  backgroundColor: { composite: 0, paint: 3, layout: 0 },
  borderColor: { composite: 0, paint: 3, layout: 0 },
  boxShadow: { composite: 0, paint: 6, layout: 0 },
  textShadow: { composite: 0, paint: 5, layout: 0 },
  filter: { composite: 1, paint: 8, layout: 0 },
  backdropFilter: { composite: 1, paint: 9, layout: 0 },
  width: { composite: 0, paint: 2, layout: 8 },
  height: { composite: 0, paint: 2, layout: 8 },
  margin: { composite: 0, paint: 1, layout: 7 },
  padding: { composite: 0, paint: 1, layout: 7 },
  top: { composite: 0, paint: 1, layout: 7 },
  left: { composite: 0, paint: 1, layout: 7 },
  fontSize: { composite: 0, paint: 4, layout: 6 },
  letterSpacing: { composite: 0, paint: 3, layout: 5 },
  lineHeight: { composite: 0, paint: 2, layout: 6 },
};

/** Default cost for unrecognized properties. */
const DEFAULT_PROPERTY_COST = { composite: 1, paint: 2, layout: 2 };

/**
 * Extract animated property names from a component's keyframes and style.
 */
function extractAnimatedProperties(component: MotionComponent): string[] {
  const props = new Set<string>();

  // Collect from keyframes
  for (const kf of component.keyframes) {
    for (const key of Object.keys(kf.properties)) {
      props.add(key);
    }
  }

  // Collect from style (any CSS property present might be animated)
  for (const key of Object.keys(component.style)) {
    // Normalize camelCase to kebab-case for matching
    const normalized = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    props.add(normalized);
  }

  return Array.from(props);
}

/**
 * Estimate the composite, paint, and layout cost for a single property.
 */
function estimatePropertyCost(prop: string): { composite: number; paint: number; layout: number } {
  const normalized = prop.replace(/-[a-z]/g, (m) => m.charAt(1).toUpperCase());
  const key = normalized.charAt(0).toLowerCase() + normalized.slice(1);

  // Check exact match
  if (key in PROPERTY_COSTS) return PROPERTY_COSTS[key];

  // Check if it's a transform sub-property
  if (["translateX", "translateY", "translateZ", "rotateX", "rotateY", "rotateZ", "scaleX", "scaleY", "scaleZ", "skew", "skewX", "skewY"].includes(key)) {
    return PROPERTY_COSTS.transform;
  }

  // Check if it's a color property
  if (key.toLowerCase().includes("color")) {
    return PROPERTY_COSTS.color;
  }

  return DEFAULT_PROPERTY_COST;
}

/**
 * Compute the loop cost for a component.
 */
function estimateLoopCost(component: MotionComponent): number {
  if (component.iterationCount === "infinite") return 4;
  if (typeof component.iterationCount === "number" && component.iterationCount > 3) return 2;
  if (typeof component.iterationCount === "number" && component.iterationCount > 1) return 1;
  return 0;
}

/**
 * Determine jank risk from cost and duration.
 */
function computeJankRisk(total: number, durationMs: number): "none" | "low" | "medium" | "high" {
  // Short durations with high cost = jank
  if (total > 15 && durationMs < 400) return "high";
  if (total > 10 && durationMs < 300) return "high";
  if (total > 12) return "medium";
  if (total > 7) return "low";
  return "none";
}

/**
 * Compute the active time window for a component.
 */
function computeTimeWindow(component: MotionComponent): { start: number; end: number } {
  const start = component.delayMs;
  let duration: number;
  if (component.iterationCount === "infinite") {
    duration = component.durationMs * 100; // Treat as very long
  } else if (typeof component.iterationCount === "number") {
    duration = component.durationMs * component.iterationCount;
  } else {
    duration = component.durationMs;
  }
  return { start, end: start + duration };
}

/**
 * Detect overlap windows across all components.
 */
function detectOverlaps(components: MotionComponent[]): OverlapWindow[] {
  if (components.length === 0) return [];

  // Build event timeline
  type Event = { time: number; type: "start" | "end"; componentId: string };
  const events: Event[] = [];
  for (const c of components) {
    const window = computeTimeWindow(c);
    events.push({ time: window.start, type: "start", componentId: c.id });
    events.push({ time: window.end, type: "end", componentId: c.id });
  }
  events.sort((a, b) => a.time - b.time);

  // Sweep to find windows with concurrent > threshold
  const windows: OverlapWindow[] = [];
  let active = new Set<string>();
  let windowStart: number | null = null;
  let windowCount = 0;

  for (const ev of events) {
    if (ev.type === "start") {
      active.add(ev.componentId);
      if (active.size > 3 && windowStart === null) {
        windowStart = ev.time;
        windowCount = active.size;
      } else if (windowStart !== null) {
        windowCount = Math.max(windowCount, active.size);
      }
    } else {
      active.delete(ev.componentId);
      if (active.size <= 3 && windowStart !== null) {
        const severity: OverlapWindow["severity"] =
          windowCount > 10 ? "critical" : windowCount > 7 ? "heavy" : "moderate";
        windows.push({
          startMs: windowStart,
          endMs: ev.time,
          concurrentCount: windowCount,
          componentIds: Array.from(active),
          severity,
        });
        windowStart = null;
        windowCount = 0;
      }
    }
  }

  return windows;
}

/**
 * Compute the overlap cost for a component based on detected overlap windows.
 */
function computeOverlapCost(
  component: MotionComponent,
  overlaps: OverlapWindow[],
): number {
  const window = computeTimeWindow(component);
  let maxOverlap = 0;
  for (const ow of overlaps) {
    // Check if this component's window intersects the overlap window
    if (window.start < ow.endMs && window.end > ow.startMs) {
      maxOverlap = Math.max(maxOverlap, ow.concurrentCount);
    }
  }
  if (maxOverlap > 10) return 4;
  if (maxOverlap > 7) return 3;
  if (maxOverlap > 5) return 2;
  if (maxOverlap > 3) return 1;
  return 0;
}

/**
 * Estimate GPU layers and memory for the project.
 */
function estimateGpuLayers(components: ComponentCost[]): GpuLayerEstimate {
  let promotedLayers = 0;
  const willChangeCandidates: string[] = [];

  for (const c of components) {
    // Components with composite cost > 3 will likely get a layer
    if (c.composite > 3) {
      promotedLayers++;
      // Components with high composite + loop are strong will-change candidates
      if (c.loop > 0 && c.composite > 4) {
        willChangeCandidates.push(c.componentName);
      }
    }
    // Components with high paint cost may get a layer to avoid repaint
    if (c.paint > 5) {
      promotedLayers++;
    }
  }

  // Rough estimate: each layer ~250KB for a medium element
  const estimatedMemoryKb = promotedLayers * 250;

  return {
    promotedLayers,
    estimatedMemoryKb,
    recommendWillChange: willChangeCandidates.length > 0,
    willChangeCandidates,
  };
}

/**
 * Generate optimization recommendations ranked by estimated saving.
 */
function generateRecommendations(
  components: ComponentCost[],
): ProfilerRecommendation[] {
  const recs: ProfilerRecommendation[] = [];

  for (const c of components) {
    // High paint cost → suggest replacing with transform/opacity
    if (c.paint > 5) {
      recs.push({
        rank: 0,
        componentId: c.componentId,
        componentName: c.componentName,
        title: "Replace paint-heavy property with transform",
        description: `Animating paint-triggering properties (${c.costlyProperties.join(", ")}) forces the browser to repaint each frame. Replace with transform or opacity for GPU compositing.`,
        estimatedSaving: c.paint,
        targetProperty: c.costlyProperties[0] || "boxShadow",
        suggestedValue: "transform: scale() or opacity",
      });
    }

    // High layout cost → suggest replacing with transform
    if (c.layout > 5) {
      recs.push({
        rank: 0,
        componentId: c.componentId,
        componentName: c.componentName,
        title: "Replace layout-triggering property with transform",
        description: `Animating layout properties (${c.costlyProperties.join(", ")}) triggers reflow on every frame. Use transform: translate() instead of top/left, or transform: scale() instead of width/height.`,
        estimatedSaving: c.layout,
        targetProperty: c.costlyProperties[0] || "width",
        suggestedValue: "transform: translate() or scale()",
      });
    }

    // Infinite loop with high cost → suggest finite iterations
    if (c.loop > 2 && c.total > 10) {
      recs.push({
        rank: 0,
        componentId: c.componentId,
        componentName: c.componentName,
        title: "Reduce loop count or duration",
        description: `This component runs infinitely with a high per-frame cost (${c.total}). Consider reducing iteration count or using a shorter duration to lower continuous GPU wake time.`,
        estimatedSaving: c.loop,
        targetProperty: "iterationCount",
        suggestedValue: "3 (finite)",
      });
    }

    // Short duration + high cost → suggest extending duration
    if (c.jankRisk === "high") {
      recs.push({
        rank: 0,
        componentId: c.componentId,
        componentName: c.componentName,
        title: "Extend duration to reduce per-frame cost",
        description: `This component has high jank risk due to short duration combined with expensive properties. Extending the duration spreads the cost across more frames, reducing jank.`,
        estimatedSaving: 3,
        targetProperty: "durationMs",
        suggestedValue: ">= 600ms",
      });
    }
  }

  // Sort by estimated saving descending and assign ranks
  recs.sort((a, b) => b.estimatedSaving - a.estimatedSaving);
  recs.forEach((r, i) => (r.rank = i + 1));

  return recs.slice(0, 10); // Top 10 recommendations
}

/**
 * Compute the overall performance grade.
 */
function computeGrade(frameBudgetPercent: number, jankHighCount: number): ProfilerReport["grade"] {
  if (frameBudgetPercent > 150 || jankHighCount > 3) return "F";
  if (frameBudgetPercent > 120 || jankHighCount > 1) return "D";
  if (frameBudgetPercent > 100 || jankHighCount > 0) return "C";
  if (frameBudgetPercent > 80) return "B";
  return "A";
}

/**
 * Profile a motion spec and return a quantitative cost report.
 */
export function profileMotion(spec: MotionSpec): ProfilerReport {
  const components = spec.components;
  if (components.length === 0) {
    return {
      componentCount: 0,
      totalCost: 0,
      averageCost: 0,
      frameBudgetPercent: 0,
      fitsFrameBudget: true,
      components: [],
      overlaps: [],
      gpu: { promotedLayers: 0, estimatedMemoryKb: 0, recommendWillChange: false, willChangeCandidates: [] },
      recommendations: [],
      grade: "A",
      summary: "Empty project — no components to profile.",
    };
  }

  // Detect overlap windows first (needed for per-component overlap cost)
  const overlaps = detectOverlaps(components);

  // Compute per-component costs
  const componentCosts: ComponentCost[] = components.map((c) => {
    const props = extractAnimatedProperties(c);
    let composite = 0;
    let paint = 0;
    let layout = 0;
    const costlyProps: string[] = [];

    for (const prop of props) {
      const cost = estimatePropertyCost(prop);
      composite += cost.composite;
      paint += cost.paint;
      layout += cost.layout;
      if (cost.paint > 3 || cost.layout > 3) {
        costlyProps.push(prop);
      }
    }

    const loop = estimateLoopCost(c);
    const overlap = computeOverlapCost(c, overlaps);
    const total = composite + paint + layout + loop + overlap;
    const jankRisk = computeJankRisk(total, c.durationMs);

    return {
      componentId: c.id,
      componentName: c.name,
      composite,
      paint,
      layout,
      loop,
      overlap,
      total,
      costlyProperties: costlyProps,
      jankRisk,
    };
  });

  // Project-level metrics
  const totalCost = componentCosts.reduce((sum, c) => sum + c.total, 0);
  const averageCost = totalCost / componentCosts.length;
  const maxConcurrent = overlaps.length > 0 ? Math.max(...overlaps.map((o) => o.concurrentCount)) : 1;
  const frameBudgetPercent = Math.round(maxConcurrent * 8.3); // ~8.3% per concurrent animation
  const fitsFrameBudget = frameBudgetPercent <= 100;

  // GPU estimate
  const gpu = estimateGpuLayers(componentCosts);

  // Recommendations
  const recommendations = generateRecommendations(componentCosts);

  // Grade
  const jankHighCount = componentCosts.filter((c) => c.jankRisk === "high").length;
  const grade = computeGrade(frameBudgetPercent, jankHighCount);

  // Summary
  const jankSummary = jankHighCount > 0
    ? `${jankHighCount} component(s) at high jank risk.`
    : "No high-risk jank components detected.";
  const overlapSummary = overlaps.length > 0
    ? `${overlaps.length} overlap window(s) detected (peak: ${maxConcurrent} concurrent).`
    : "No significant overlap windows detected.";
  const summary = `Grade ${grade}. Total cost ${totalCost} across ${components.length} components (avg ${averageCost.toFixed(1)}). Frame budget: ${frameBudgetPercent}%. ${jankSummary} ${overlapSummary} ${gpu.promotedLayers} GPU layer(s) (~${gpu.estimatedMemoryKb}KB). ${recommendations.length} optimization(s) available.`;

  return {
    componentCount: components.length,
    totalCost,
    averageCost,
    frameBudgetPercent,
    fitsFrameBudget,
    components: componentCosts,
    overlaps,
    gpu,
    recommendations,
    grade,
    summary,
  };
}

/**
 * Format the profiler report as a human-readable string.
 */
export function formatProfilerReport(report: ProfilerReport): string {
  const lines: string[] = [];
  lines.push(`# Motion Profiler Report`);
  lines.push("");
  lines.push(`**Grade: ${report.grade}** | Frame budget: ${report.frameBudgetPercent}% | Total cost: ${report.totalCost}`);
  lines.push(report.summary);
  lines.push("");

  if (report.components.length > 0) {
    lines.push(`## Component Costs`);
    for (const c of report.components) {
      lines.push(`- **${c.componentName}**: total ${c.total} (composite ${c.composite}, paint ${c.paint}, layout ${c.layout}, loop ${c.loop}, overlap ${c.overlap}) — jank: ${c.jankRisk}`);
    }
    lines.push("");
  }

  if (report.overlaps.length > 0) {
    lines.push(`## Overlap Windows`);
    for (const o of report.overlaps) {
      lines.push(`- ${o.startMs}ms–${o.endMs}ms: ${o.concurrentCount} concurrent (${o.severity})`);
    }
    lines.push("");
  }

  lines.push(`## GPU Estimate`);
  lines.push(`- Promoted layers: ${report.gpu.promotedLayers}`);
  lines.push(`- Estimated memory: ${report.gpu.estimatedMemoryKb}KB`);
  if (report.gpu.recommendWillChange) {
    lines.push(`- will-change candidates: ${report.gpu.willChangeCandidates.join(", ")}`);
  }
  lines.push("");

  if (report.recommendations.length > 0) {
    lines.push(`## Recommendations`);
    for (const r of report.recommendations) {
      lines.push(`${r.rank}. **${r.componentName}** — ${r.title} (saves ~${r.estimatedSaving})`);
      lines.push(`   ${r.description}`);
    }
  }

  return lines.join("\n");
}
