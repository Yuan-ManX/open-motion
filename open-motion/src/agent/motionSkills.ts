import type { MotionSpec, MotionComponent } from "@openmotion/shared";

/** Procedural-Skill Engine — tracks parameter drift across skill invocations. */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillOutcome = "met" | "overshot" | "undershot" | "failed";

/** A single tunable parameter on a skill. */
export interface SkillParameter {
  /** Parameter name (e.g. "durationMs", "magnitude"). */
  name: string;
  /** Current recommended value. */
  value: number;
  /** Minimum bound. */
  min: number;
  /** Maximum bound. */
  max: number;
  /** Signed fractional drift across invocations (-inf..+inf, ~0 when stable). */
  drift: number;
  /** How many invocations contributed to the current value. */
  samples: number;
}

/** A single recorded invocation of a skill. */
export interface SkillInvocation {
  /** Monotonic index. */
  index: number;
  /** Parameter values used in this invocation. */
  parameters: Record<string, number>;
  /** Whether the invocation met its target. */
  outcome: SkillOutcome;
  /** Timestamp (ms since epoch). */
  atMs: number;
}

/** A procedural skill in the registry. */
export interface ProceduralSkill {
  /** Stable identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Short description of what the skill does. */
  intent: string;
  /** Tunable parameters. */
  parameters: SkillParameter[];
  /** Recorded invocations, oldest first. */
  invocations: SkillInvocation[];
  /** Number of invocations that met their target. */
  metCount: number;
  /** Number of invocations that overshot. */
  overshotCount: number;
  /** Number of invocations that undershot. */
  undershotCount: number;
  /** Number of invocations that failed outright. */
  failedCount: number;
}

/** A skill recommendation surfaced by the engine. */
export interface SkillRecommendation {
  /** Skill id. */
  skillId: string;
  /** Skill name. */
  skillName: string;
  /** Parameter name to adjust. */
  parameter: string;
  /** Recommended value for the next invocation. */
  recommendedValue: number;
  /** Why this value is recommended. */
  reason: string;
  /** Confidence in the recommendation 0..1 — higher when more samples back it. */
  confidence: number;
}

/** The full skills report. */
export interface SkillsReport {
  /** All skills in the registry. */
  skills: ProceduralSkill[];
  /** Total invocations across all skills. */
  totalInvocations: number;
  /** Aggregate met-rate across all skills (0..1). */
  metRate: number;
  /** Skills whose parameters are stable (low drift, narrow band). */
  stableSkillCount: number;
  /** Skills still converging (high drift or wide band). */
  convergingSkillCount: number;
  /** Recommendations for the next invocation of each skill. */
  recommendations: SkillRecommendation[];
  /** Registry size. */
  skillCount: number;
  /** Human-readable summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Registry — process-local, in-memory
// ---------------------------------------------------------------------------

interface SkillSeed {
  id: string;
  name: string;
  intent: string;
  parameters: Array<{ name: string; value: number; min: number; max: number }>;
}

const SKILL_SEEDS: readonly SkillSeed[] = [
  {
    id: "fade_in",
    name: "Fade In",
    intent: "Raise opacity from 0 to 1 over a short duration.",
    parameters: [
      { name: "durationMs", value: 400, min: 150, max: 800 },
      { name: "startOpacity", value: 0, min: 0, max: 0.3 },
      { name: "endOpacity", value: 1, min: 0.7, max: 1 },
    ],
  },
  {
    id: "spring_bounce",
    name: "Spring Bounce",
    intent: "Vertical translation with overshoot using spring easing.",
    parameters: [
      { name: "durationMs", value: 700, min: 400, max: 1000 },
      { name: "magnitude", value: 40, min: 10, max: 120 },
      { name: "stiffness", value: 180, min: 80, max: 320 },
      { name: "damping", value: 12, min: 4, max: 28 },
    ],
  },
  {
    id: "stagger_entrance",
    name: "Stagger Entrance",
    intent: "Sequence sibling entrances with a small inter-element delay.",
    parameters: [
      { name: "staggerMs", value: 80, min: 30, max: 200 },
      { name: "durationMs", value: 500, min: 250, max: 800 },
      { name: "overlap", value: 0.3, min: 0, max: 0.6 },
    ],
  },
  {
    id: "pulse_emphasis",
    name: "Pulse Emphasis",
    intent: "Subtle scale oscillation to signal liveliness.",
    parameters: [
      { name: "durationMs", value: 600, min: 300, max: 1000 },
      { name: "scaleDelta", value: 0.06, min: 0.02, max: 0.15 },
      { name: "iterations", value: 2, min: 1, max: 4 },
    ],
  },
  {
    id: "slide_exit",
    name: "Slide Exit",
    intent: "Translate an element out of view for dismissal.",
    parameters: [
      { name: "durationMs", value: 350, min: 200, max: 600 },
      { name: "magnitude", value: 60, min: 20, max: 160 },
      { name: "endOpacity", value: 0, min: 0, max: 0.2 },
    ],
  },
];

// In-memory registry keyed by skill id. Each server run starts fresh.
const registry = new Map<string, ProceduralSkill>();
let invocationCounter = 0;

function ensureRegistry(): Map<string, ProceduralSkill> {
  if (registry.size === 0) {
    for (const seed of SKILL_SEEDS) {
      registry.set(seed.id, {
        id: seed.id,
        name: seed.name,
        intent: seed.intent,
        parameters: seed.parameters.map((p) => ({
          name: p.name,
          value: p.value,
          min: p.min,
          max: p.max,
          drift: 0,
          samples: 0,
        })),
        invocations: [],
        metCount: 0,
        overshotCount: 0,
        undershotCount: 0,
        failedCount: 0,
      });
    }
  }
  return registry;
}

// ---------------------------------------------------------------------------
// Invocation + tightening
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function applyOutcome(
  skill: ProceduralSkill,
  parameters: Record<string, number>,
  outcome: SkillOutcome,
  atMs: number,
): void {
  const index = invocationCounter++;
  skill.invocations.push({ index, parameters: { ...parameters }, outcome, atMs });

  // Update parameter drift + recommended value based on outcome.
  for (const param of skill.parameters) {
    const used = parameters[param.name];
    if (typeof used !== "number") continue;
    const prevValue = param.value;
    const delta = used - prevValue;
    const fractional = prevValue !== 0 ? delta / prevValue : 0;

    // Exponential moving average of drift so recent runs weigh more.
    const alpha = 0.4;
    param.drift = Math.round((param.drift * (1 - alpha) + fractional * alpha) * 1000) / 1000;
    param.samples += 1;

    // Tighten the recommended value toward the used value, weighted by
    // whether the outcome was met. Met outcomes move the value toward
    // the used value; overshot outcomes back the value off; undershot
    // outcomes push it further.
    let next = prevValue;
    switch (outcome) {
      case "met": next = used; break;
      case "overshot": next = prevValue + (prevValue - used) * 0.5; break;
      case "undershot": next = prevValue + (used - prevValue) * 0.5; break;
      case "failed": next = prevValue; break;
    }
    param.value = Math.round(clamp(next, param.min, param.max) * 1000) / 1000;
  }

  switch (outcome) {
    case "met": skill.metCount += 1; break;
    case "overshot": skill.overshotCount += 1; break;
    case "undershot": skill.undershotCount += 1; break;
    case "failed": skill.failedCount += 1; break;
  }
}

// ---------------------------------------------------------------------------
// Component→skill invocation inference
// ---------------------------------------------------------------------------

interface InferredInvocation {
  skillId: string;
  parameters: Record<string, number>;
  outcome: SkillOutcome;
}

function inferFromComponent(c: MotionComponent): InferredInvocation | null {
  const props = new Set<string>();
  for (const kf of c.keyframes) {
    for (const key of Object.keys(kf.properties)) props.add(key);
  }
  const style = c.style ?? {};

  // fade_in: opacity-only entrance.
  if (props.has("opacity") && props.size === 1 && c.trigger !== "onClick") {
    const endOpacity = typeof style.opacity === "number" ? style.opacity : 1;
    return {
      skillId: "fade_in",
      parameters: {
        durationMs: c.durationMs,
        startOpacity: 0,
        endOpacity: typeof endOpacity === "number" ? endOpacity : 1,
      },
      outcome: c.durationMs > 600 ? "undershot" : c.durationMs < 200 ? "overshot" : "met",
    };
  }

  // spring_bounce: translateY with overshoot easing or spring.
  if (props.has("translateY") && (c.easing.type === "spring" || isBouncyEasingLocal(c))) {
    let magnitude = 0;
    for (const kf of c.keyframes) {
      const v = kf.properties.translateY;
      if (typeof v === "number") magnitude = Math.max(magnitude, Math.abs(v));
    }
    const stiffness = c.easing.type === "spring" ? c.easing.stiffness : 180;
    const damping = c.easing.type === "spring" ? c.easing.damping : 12;
    return {
      skillId: "spring_bounce",
      parameters: {
        durationMs: c.durationMs,
        magnitude,
        stiffness,
        damping,
      },
      outcome: magnitude > 100 ? "overshot" : magnitude < 15 ? "undershot" : "met",
    };
  }

  // pulse_emphasis: scale-only with >1 iteration.
  if (props.has("scale") && c.iterationCount !== 1) {
    let scaleDelta = 0;
    for (const kf of c.keyframes) {
      const v = kf.properties.scale;
      if (typeof v === "number") scaleDelta = Math.max(scaleDelta, Math.abs(v - 1));
    }
    const iterations = typeof c.iterationCount === "number" ? c.iterationCount : 2;
    return {
      skillId: "pulse_emphasis",
      parameters: {
        durationMs: c.durationMs,
        scaleDelta,
        iterations,
      },
      outcome: scaleDelta > 0.15 ? "overshot" : scaleDelta < 0.02 ? "undershot" : "met",
    };
  }

  // slide_exit: translate-only with onClick/afterDelay and end-state opacity.
  if ((props.has("translateX") || props.has("translateY")) && (c.trigger === "onClick" || c.trigger === "afterDelay")) {
    let magnitude = 0;
    for (const kf of c.keyframes) {
      for (const prop of ["translateX", "translateY"] as const) {
        const v = kf.properties[prop];
        if (typeof v === "number") magnitude = Math.max(magnitude, Math.abs(v));
      }
    }
    return {
      skillId: "slide_exit",
      parameters: {
        durationMs: c.durationMs,
        magnitude,
        endOpacity: 0,
      },
      outcome: c.durationMs > 600 ? "undershot" : magnitude > 160 ? "overshot" : "met",
    };
  }

  return null;
}

function isBouncyEasingLocal(c: MotionComponent): boolean {
  const e = c.easing;
  if (e.type === "preset") return ["bounce", "back", "elastic"].includes(e.name);
  if (e.type === "bezier") return e.p2[1] > 1 || e.p1[1] < 0;
  return false;
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

function recommend(skill: ProceduralSkill): SkillRecommendation | null {
  if (skill.parameters.length === 0) return null;
  // Pick the parameter with the largest absolute drift — it is the one
  // most in need of stabilization.
  let target = skill.parameters[0];
  for (const p of skill.parameters) {
    if (Math.abs(p.drift) > Math.abs(target.drift)) target = p;
  }
  const confidence = Math.min(1, target.samples / 8);
  const direction =
    target.drift > 0.05 ? "crept upward" : target.drift < -0.05 ? "crept downward" : "stable";
  return {
    skillId: skill.id,
    skillName: skill.name,
    parameter: target.name,
    recommendedValue: target.value,
    reason: `${target.name} has ${direction} across ${target.samples} invocation(s) (drift ${target.drift}); recommend ${target.value}.`,
    confidence: Math.round(confidence * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run skills analysis on a project spec. Each component is treated as a
 * candidate invocation of one of the seeded skills; matched invocations
 * are fed into the registry so the skill's parameters tighten over time.
 */
export function analyzeSkills(spec: MotionSpec, now = Date.now()): SkillsReport {
  const reg = ensureRegistry();
  const components = spec.components;

  // Replay each component as an invocation against its inferred skill.
  for (const c of components) {
    const inferred = inferFromComponent(c);
    if (!inferred) continue;
    const skill = reg.get(inferred.skillId);
    if (!skill) continue;
    applyOutcome(skill, inferred.parameters, inferred.outcome, now);
  }

  const skills = Array.from(reg.values());
  const totalInvocations = skills.reduce((s, k) => s + k.invocations.length, 0);
  const totalMet = skills.reduce((s, k) => s + k.metCount, 0);
  const metRate = totalInvocations > 0 ? Math.round((totalMet / totalInvocations) * 100) / 100 : 0;

  const stableSkillCount = skills.filter(
    (k) => k.parameters.every((p) => Math.abs(p.drift) < 0.1) && k.invocations.length >= 2,
  ).length;
  const convergingSkillCount = skills.length - stableSkillCount;

  const recommendations: SkillRecommendation[] = [];
  for (const k of skills) {
    if (k.invocations.length === 0) continue;
    const rec = recommend(k);
    if (rec) recommendations.push(rec);
  }

  const summary = `${skills.length} skill(s) registered; ${totalInvocations} invocation(s) replayed; met-rate ${metRate}; ${stableSkillCount} stable, ${convergingSkillCount} converging.`;

  return {
    skills,
    totalInvocations,
    metRate,
    stableSkillCount,
    convergingSkillCount,
    recommendations,
    skillCount: skills.length,
    summary,
  };
}

/** Reset the in-memory registry (useful for tests / deterministic runs). */
export function resetSkillRegistry(): void {
  registry.clear();
}

/** Format a skills report as a human-readable string. */
export function formatSkillsReport(report: SkillsReport): string {
  const lines: string[] = [];
  lines.push("=== Motion Skills ===");
  lines.push("");
  lines.push(`Registry: ${report.skillCount} skills`);
  lines.push(`Invocations: ${report.totalInvocations}`);
  lines.push(`Met-rate: ${report.metRate}`);
  lines.push(`Stable: ${report.stableSkillCount} / converging: ${report.convergingSkillCount}`);
  lines.push("");

  if (report.skills.length > 0) {
    lines.push("--- Skills ---");
    for (const k of report.skills) {
      const total = k.invocations.length;
      lines.push(`• ${k.name.padEnd(18)} inv=${total} met=${k.metCount} over=${k.overshotCount} under=${k.undershotCount} fail=${k.failedCount}`);
      for (const p of k.parameters) {
        const driftFlag = Math.abs(p.drift) > 0.1 ? "!" : " ";
        lines.push(`    [${driftFlag}] ${p.name.padEnd(14)} = ${p.value} (drift ${p.drift}, ${p.samples} samples)`);
      }
    }
    lines.push("");
  }

  if (report.recommendations.length > 0) {
    lines.push("--- Recommendations ---");
    for (const r of report.recommendations) {
      lines.push(`• ${r.skillName} -> ${r.parameter} = ${r.recommendedValue} (conf ${r.confidence})`);
      lines.push(`    ${r.reason}`);
    }
    lines.push("");
  }

  lines.push(`Summary: ${report.summary}`);
  return lines.join("\n");
}
