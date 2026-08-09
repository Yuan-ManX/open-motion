import type { MotionSpec, MotionComponent } from "@openmotion/shared";

/** Attention-Budget Engine — quantitative allocation of perceptual capacity. */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-component demand breakdown. */
export interface ComponentDemand {
  /** Component id. */
  componentId: string;
  /** Display label. */
  label: string;
  /** Raw demand score (unbounded). */
  demand: number;
  /** Magnitude contribution 0..1. */
  magnitudeFactor: number;
  /** Duration contribution 0..1. */
  durationFactor: number;
  /** Loop contribution (>=1, 1 = no loop). */
  loopFactor: number;
  /** Visual-weight contribution 0..1. */
  weightFactor: number;
  /** Priority 0..1 — narrative importance. */
  priority: number;
  /** Allocated share of the budget 0..1. */
  allocation: number;
  /** Whether the component's demand exceeds its allocation. */
  overBudget: boolean;
  /** Demand-to-allocation ratio. >1 means under-served. */
  strain: number;
}

/** A concrete reallocation suggestion. */
export interface ReallocationSuggestion {
  /** Component id to adjust. */
  componentId: string;
  /** Display label. */
  label: string;
  /** "dampen_magnitude" | "shorten_duration" | "remove_loop" | "reduce_weight". */
  action: "dampen_magnitude" | "shorten_duration" | "remove_loop" | "reduce_weight";
  /** Concrete parameter change. */
  change: string;
  /** Estimated demand reduction. */
  demandReduction: number;
  /** Narrative loss 0..1 if the change is applied. */
  narrativeLoss: number;
}

/** The full budget report. */
export interface BudgetReport {
  /** Per-component demand + allocation. */
  components: ComponentDemand[];
  /** Total demand across all components. */
  totalDemand: number;
  /** Composition attention budget. */
  budget: number;
  /** 0..1 — fraction of budget consumed. */
  utilization: number;
  /** Whether total demand exceeds the budget. */
  overBudget: boolean;
  /** Headroom (budget - totalDemand). Negative when over budget. */
  headroom: number;
  /** Reallocation suggestions to bring demand within budget. */
  reallocations: ReallocationSuggestion[];
  /** Component count the analysis ran against. */
  componentCount: number;
  /** Human-readable summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Demand factors
// ---------------------------------------------------------------------------

/** Maximum motion magnitude across keyframes (translate/rotate/scale). */
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
  return max;
}

/** Visual weight: color + 3D + shader richness 0..1. */
function visualWeight(c: MotionComponent): number {
  const s = c.style ?? {};
  let w = 0;
  if (typeof s.color === "string" || typeof s.background === "string" || typeof s.backgroundColor === "string") w += 0.3;
  if (Object.keys(s).some((k) => /perspective|rotateX|rotateY|translateZ/i.test(k))) w += 0.4;
  if (Object.keys(s).some((k) => /shader|filter/i.test(k)) || (c.templateId ?? "").startsWith("tpl-shader")) w += 0.3;
  return Math.min(1, w);
}

function magnitudeFactor(mag: number): number {
  // 0..200+ maps to 0..1 with a soft saturation curve.
  return Math.min(1, mag / 150);
}

function durationFactor(durationMs: number): number {
  // 0..1200ms maps to 0..1; longer durations monopolize attention.
  return Math.min(1, durationMs / 1200);
}

function loopFactor(iterationCount: number | "infinite"): number {
  if (iterationCount === "infinite") return 2.0;
  return Math.min(1.8, 1 + (iterationCount - 1) * 0.2);
}

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

function computePriority(c: MotionComponent, index: number, total: number): number {
  // Earlier components (lower orderIndex / earlier in array) carry more
  // narrative weight — they set the viewer's first impression. Magnitude
  // also lifts priority because high-magnitude motion is usually the
  // focal element. Named components edge out unnamed ones.
  const positionWeight = total > 1 ? 1 - (index / (total - 1)) * 0.5 : 0.8;
  const mag = maxMagnitude(c);
  const magnitudeWeight = Math.min(0.3, mag / 500);
  const nameWeight = c.name && c.name.length > 0 ? 0.1 : 0;
  return Math.min(1, Math.round((positionWeight + magnitudeWeight + nameWeight) * 100) / 100);
}

// ---------------------------------------------------------------------------
// Budget + allocation
// ---------------------------------------------------------------------------

/** Composition budget: more components means more capacity, but with
 *  diminishing returns so a 20-component composition is not 20x capacity. */
function compositionBudget(componentCount: number): number {
  if (componentCount === 0) return 0;
  // Base capacity per component is 1.0; total grows sub-linearly.
  return Math.round((1 + Math.log2(1 + componentCount)) * componentCount * 10) / 10;
}

// ---------------------------------------------------------------------------
// Reallocation
// ---------------------------------------------------------------------------

function suggestReallocations(
  components: ComponentDemand[],
  overshoot: number,
): ReallocationSuggestion[] {
  // Sort over-budget components by strain descending — the most strained
  // components are the best reallocation targets.
  const targets = components
    .filter((c) => c.overBudget)
    .sort((a, b) => b.strain - a.strain);

  const suggestions: ReallocationSuggestion[] = [];
  let remaining = overshoot;
  for (const c of targets) {
    if (remaining <= 0.05) break;
    // Propose the action with the best demand-reduction-to-narrative-loss
    // ratio for this component.
    const options: ReallocationSuggestion[] = [
      {
        componentId: c.componentId,
        label: c.label,
        action: "dampen_magnitude",
        change: "reduce translate/rotate magnitude by ~40%",
        demandReduction: Math.round(c.demand * 0.3 * 100) / 100,
        narrativeLoss: Math.round(c.priority * 0.3 * 100) / 100,
      },
      {
        componentId: c.componentId,
        label: c.label,
        action: "shorten_duration",
        change: "cut duration by ~30%",
        demandReduction: Math.round(c.demand * 0.2 * 100) / 100,
        narrativeLoss: Math.round(c.priority * 0.15 * 100) / 100,
      },
      {
        componentId: c.componentId,
        label: c.label,
        action: "remove_loop",
        change: "set iterationCount to 1",
        demandReduction: Math.round((c.loopFactor - 1) * c.demand * 0.5 * 100) / 100,
        narrativeLoss: Math.round(c.priority * 0.1 * 100) / 100,
      },
      {
        componentId: c.componentId,
        label: c.label,
        action: "reduce_weight",
        change: "drop 3D / shader / color richness",
        demandReduction: Math.round(c.demand * c.weightFactor * 0.4 * 100) / 100,
        narrativeLoss: Math.round(c.priority * 0.2 * 100) / 100,
      },
    ];
    // Pick the option with the best reduction/loss ratio that contributes
    // meaningfully to closing the overshoot.
    options.sort(
      (a, b) =>
        b.demandReduction / Math.max(0.05, b.narrativeLoss) -
        a.demandReduction / Math.max(0.05, a.narrativeLoss),
    );
    const best = options[0];
    if (best && best.demandReduction > 0.05) {
      suggestions.push(best);
      remaining -= best.demandReduction;
    }
  }
  return suggestions;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Run attention-budget analysis on a project spec. */
export function analyzeBudget(spec: MotionSpec): BudgetReport {
  const components = spec.components;
  if (components.length === 0) {
    return {
      components: [],
      totalDemand: 0,
      budget: 0,
      utilization: 0,
      overBudget: false,
      headroom: 0,
      reallocations: [],
      componentCount: 0,
      summary: "Empty project — no demand to budget.",
    };
  }

  const total = components.length;
  const rawDemands = components.map((c, i) => {
    const mag = maxMagnitude(c);
    const magF = magnitudeFactor(mag);
    const durF = durationFactor(c.durationMs);
    const loopF = loopFactor(c.iterationCount);
    const weightF = visualWeight(c);
    // Demand = base 0.5 + magnitude + duration + weight, multiplied by loop factor.
    const demand = Math.round((0.5 + magF + durF + weightF) * loopF * 100) / 100;
    const priority = computePriority(c, i, total);
    return {
      componentId: c.id,
      label: c.name || c.id,
      demand,
      magnitudeFactor: Math.round(magF * 100) / 100,
      durationFactor: Math.round(durF * 100) / 100,
      loopFactor: loopF,
      weightFactor: Math.round(weightF * 100) / 100,
      priority,
    };
  });

  const totalDemand = Math.round(rawDemands.reduce((s, d) => s + d.demand, 0) * 100) / 100;
  const budget = compositionBudget(total);
  const utilization = budget > 0 ? Math.round((totalDemand / budget) * 100) / 100 : 0;
  const overBudget = totalDemand > budget;
  const headroom = Math.round((budget - totalDemand) * 100) / 100;

  // Priority-weighted proportional allocation: each component gets a share
  // of the budget proportional to (priority * demand). This protects
  // high-priority narrative motion when the budget is tight.
  const weightedTotal = rawDemands.reduce((s, d) => s + d.priority * d.demand, 0);
  const componentDemands: ComponentDemand[] = rawDemands.map((d) => {
    const allocation = weightedTotal > 0 ? Math.round(((d.priority * d.demand) / weightedTotal) * budget * 100) / 100 : 0;
    const strain = allocation > 0 ? Math.round((d.demand / allocation) * 100) / 100 : d.demand > 0 ? 2 : 0;
    return {
      ...d,
      allocation,
      overBudget: d.demand > allocation * 1.25,
      strain: Math.min(3, strain),
    };
  });

  const reallocations = overBudget
    ? suggestReallocations(componentDemands, Math.round((totalDemand - budget) * 100) / 100)
    : [];

  const summary = `Demand ${totalDemand} / budget ${budget} (${Math.round(utilization * 100)}% utilized). ${
    overBudget
      ? `Over budget by ${Math.round((totalDemand - budget) * 100) / 100}; ${reallocations.length} reallocation(s) proposed.`
      : `Within budget with ${headroom} headroom.`
  }`;

  return {
    components: componentDemands,
    totalDemand,
    budget,
    utilization,
    overBudget,
    headroom,
    reallocations,
    componentCount: total,
    summary,
  };
}

/** Format a budget report as a human-readable string. */
export function formatAttentionBudgetReport(report: BudgetReport): string {
  const lines: string[] = [];
  lines.push("=== Motion Attention Budget ===");
  lines.push("");
  lines.push(`Components: ${report.componentCount}`);
  lines.push(`Total demand: ${report.totalDemand}`);
  lines.push(`Budget: ${report.budget}`);
  lines.push(`Utilization: ${report.utilization} (${Math.round(report.utilization * 100)}%)`);
  lines.push(`Headroom: ${report.headroom}`);
  lines.push("");

  if (report.components.length > 0) {
    lines.push("--- Per-Component Demand (top 8) ---");
    for (const c of report.components.slice(0, 8)) {
      const flag = c.overBudget ? "!" : " ";
      lines.push(`[${flag}] ${c.label.padEnd(16)} demand=${c.demand} alloc=${c.allocation} strain=${c.strain} pri=${c.priority}`);
    }
    lines.push("");
  }

  if (report.reallocations.length > 0) {
    lines.push("--- Reallocations ---");
    for (const r of report.reallocations) {
      lines.push(`• ${r.label}: ${r.action} — ${r.change}`);
      lines.push(`    demand -${r.demandReduction}, narrative loss ${r.narrativeLoss}`);
    }
    lines.push("");
  }

  lines.push(`Summary: ${report.summary}`);
  return lines.join("\n");
}
