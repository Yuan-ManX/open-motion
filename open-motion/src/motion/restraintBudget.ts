/**
 * Restraint Budget — per-project ceiling on cumulative motion "loudness".
 *
 * The restraint engine (restraint.ts) analyzes the current composition and
 * reports issues. The budget system goes one step further: it tracks a
 * running spend across all spec mutations and blocks new effects when the
 * project would exceed its allocated ceiling.
 *
 * Each motion recipe and effect carries a `restraintCost` (0-5). When the
 * Agent applies an effect, the cost is deducted from the project's budget.
 * When the budget is exhausted, new loud effects are blocked and the Agent
 * is told to either remove existing effects or switch to a higher tier.
 *
 * Tiers:
 *   minimalist  — 8 cost points  (1-2 hero animations, everything else subtle)
 *   balanced    — 20 cost points (default; mix of hero and supporting motion)
 *   expressive  — 40 cost points (rich motion design, marketing pages)
 *   maximalist  — 80 cost points (showcase / demo reels, no restraint)
 *
 * The budget is persisted in project tokens under `__restraintBudget` so it
 * survives across sessions.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

export type RestraintTier = "minimalist" | "balanced" | "expressive" | "maximalist";

export interface RestraintBudget {
  tier: RestraintTier;
  ceiling: number;
  spent: number;
  /** Log of recent spend entries (most recent first). */
  history: BudgetEntry[];
}

export interface BudgetEntry {
  componentId: string;
  componentLabel: string;
  cost: number;
  reason: string;
  timestamp: string;
}

const TIER_CEILINGS: Record<RestraintTier, number> = {
  minimalist: 8,
  balanced: 20,
  expressive: 40,
  maximalist: 80,
};

const BUDGET_KEY = "__restraintBudget";

/** Resolve a tier name to its numeric ceiling. */
export function tierCeiling(tier: RestraintTier): number {
  return TIER_CEILINGS[tier];
}

/** Default budget for new projects — balanced tier. */
export function defaultBudget(): RestraintBudget {
  return {
    tier: "balanced",
    ceiling: TIER_CEILINGS.balanced,
    spent: 0,
    history: [],
  };
}

/** Read the budget from project tokens. */
export function readBudget(tokens: Record<string, string | number>): RestraintBudget {
  const raw = tokens[BUDGET_KEY];
  if (typeof raw !== "string") return defaultBudget();
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return defaultBudget();
    const budget = parsed as Partial<RestraintBudget>;
    return {
      tier: budget.tier ?? "balanced",
      ceiling: budget.ceiling ?? TIER_CEILINGS.balanced,
      spent: budget.spent ?? 0,
      history: Array.isArray(budget.history) ? budget.history : [],
    };
  } catch {
    return defaultBudget();
  }
}

/** Write the budget to project tokens. Returns the updated tokens map. */
export function writeBudget(
  tokens: Record<string, string | number>,
  budget: RestraintBudget,
): Record<string, string | number> {
  return { ...tokens, [BUDGET_KEY]: JSON.stringify(budget) };
}

/** Change the project's restraint tier. Does not alter spend history. */
export function setTier(
  tier: RestraintTier,
  tokens: Record<string, string | number>,
): { budget: RestraintBudget; tokens: Record<string, string | number> } {
  const current = readBudget(tokens);
  const updated: RestraintBudget = {
    ...current,
    tier,
    ceiling: TIER_CEILINGS[tier],
  };
  return { budget: updated, tokens: writeBudget(tokens, updated) };
}

/** Estimate the restraint cost of a single component based on its properties. */
export function estimateComponentCost(c: MotionComponent): number {
  let cost = 1; // Base cost for any animated component

  // Loops cost more — they continuously draw attention.
  if (c.iterationCount === "infinite") cost += 2;
  else if (typeof c.iterationCount === "number" && c.iterationCount > 3) cost += 1;

  // Long durations cost more — they hold attention longer.
  if (c.durationMs > 3000) cost += 2;
  else if (c.durationMs > 1500) cost += 1;

  // Dramatic easings (bounce, elastic, back) cost more than smooth ones.
  if (c.easing?.type === "preset") {
    const dramatic = ["bounce", "elastic", "back"];
    if (dramatic.includes(c.easing.name ?? "")) cost += 2;
  } else if (c.easing?.type === "spring") {
    // Stiff springs with low damping are more attention-grabbing.
    const stiffness = c.easing.stiffness ?? 170;
    const damping = c.easing.damping ?? 12;
    if (stiffness > 200 && damping < 15) cost += 2;
  }

  // Many keyframes imply complexity.
  if (Array.isArray(c.keyframes) && c.keyframes.length > 6) cost += 1;

  return Math.min(5, cost);
}

/** Recompute the spent total from the current spec (used after deletions). */
export function recomputeSpend(spec: MotionSpec): number {
  return spec.components.reduce((sum, c) => sum + estimateComponentCost(c), 0);
}

/** Check whether a new cost would fit within the remaining budget. */
export function canAfford(
  cost: number,
  tokens: Record<string, string | number>,
): { affordable: boolean; remaining: number; shortfall: number } {
  const budget = readBudget(tokens);
  const remaining = budget.ceiling - budget.spent;
  return {
    affordable: remaining >= cost,
    remaining,
    shortfall: Math.max(0, cost - remaining),
  };
}

/** Record a spend entry against the budget. */
export function recordSpend(
  componentId: string,
  componentLabel: string,
  cost: number,
  reason: string,
  tokens: Record<string, string | number>,
): { budget: RestraintBudget; tokens: Record<string, string | number>; affordable: boolean } {
  const budget = readBudget(tokens);
  const remaining = budget.ceiling - budget.spent;
  const affordable = remaining >= cost;
  if (!affordable) {
    return { budget, tokens, affordable: false };
  }
  const entry: BudgetEntry = {
    componentId,
    componentLabel,
    cost,
    reason,
    timestamp: new Date().toISOString(),
  };
  const updated: RestraintBudget = {
    ...budget,
    spent: budget.spent + cost,
    history: [entry, ...budget.history].slice(0, 50), // Keep last 50 entries.
  };
  return { budget: updated, tokens: writeBudget(tokens, updated), affordable: true };
}

/** Refund a previous spend (used when a component is removed). */
export function refundSpend(
  componentId: string,
  cost: number,
  tokens: Record<string, string | number>,
): { budget: RestraintBudget; tokens: Record<string, string | number> } {
  const budget = readBudget(tokens);
  const updated: RestraintBudget = {
    ...budget,
    spent: Math.max(0, budget.spent - cost),
  };
  return { budget: updated, tokens: writeBudget(tokens, updated) };
}

/** Produce a human-readable budget report. */
export function formatBudgetReport(budget: RestraintBudget): string {
  const remaining = budget.ceiling - budget.spent;
  const pct = budget.ceiling > 0 ? Math.round((budget.spent / budget.ceiling) * 100) : 0;
  const lines: string[] = [
    `Restraint Budget: ${budget.tier} (${budget.spent}/${budget.ceiling} spent, ${remaining} remaining, ${pct}% used)`,
  ];
  if (budget.history.length > 0) {
    lines.push("Recent spend:");
    for (const entry of budget.history.slice(0, 5)) {
      lines.push(`  - ${entry.componentLabel} +${entry.cost} — ${entry.reason}`);
    }
    if (budget.history.length > 5) {
      lines.push(`  ... and ${budget.history.length - 5} more entry/entries`);
    }
  }
  if (remaining <= 0) {
    lines.push("WARNING: Budget exhausted. Remove existing effects or raise the tier to add more.");
  } else if (remaining <= budget.ceiling * 0.2) {
    lines.push("NOTE: Budget running low. Consider prioritizing remaining spend on hero elements.");
  }
  return lines.join("\n");
}

/**
 * Recommend a tier upgrade based on the current spend pattern. Returns null
 * if the current tier is appropriate.
 */
export function recommendTierUpgrade(budget: RestraintBudget): RestraintTier | null {
  if (budget.spent >= budget.ceiling) {
    // Exhausted — recommend the next tier up.
    if (budget.tier === "minimalist") return "balanced";
    if (budget.tier === "balanced") return "expressive";
    if (budget.tier === "expressive") return "maximalist";
    return null; // Already at max.
  }
  return null;
}
