/**
 * Hierarchical Motion Planner — decomposes high-level motion goals into
 * nested sub-plans that each produce a concrete, composable motion output.
 *
 * Planner depth:
 *   Level 0 — Goal         (user intent)
 *   Level 1 — Objectives   (3..6 concrete objectives that realize the goal)
 *   Level 2 — Tactics      (per-objective: 2..4 candidate motion tactics)
 *   Level 3 — Actions      (per-tactic: concrete tool invocations + params)
 *
 * The planner also produces dependency edges between objectives so the
 * execution layer can parallelize work and honour ordering constraints.
 */

import type { Keyframe, Easing, EasingPreset, MotionSpec, MotionComponent } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";
import { inferIntent, type SemanticConcept } from "./motionSemantics.js";
import { detectEmotionFromText } from "./motionEmotion.js";
import { simulateSpring, simulateGravityDrop, runPreset } from "./motionPhysics.js";
import { generatePathMotion, runPathPreset } from "./motionPath.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MotionGoal {
  /** Short label for the goal (matches the user's headline request). */
  label: string;
  /** The original request text. */
  rawRequest: string;
  /** Project-level constraints. */
  constraints: GoalConstraints;
  /** Top-level semantic tags. */
  semanticTags: string[];
}

export interface GoalConstraints {
  /** Target duration budget in ms. */
  durationBudgetMs: number;
  /** 0..1 intensity ceiling (1.0 = full motion, 0.1 = almost static). */
  intensityCeiling: number;
  /** If true, reduced-motion profile is forced. */
  prefersReducedMotion: boolean;
  /** Maximum concurrent components with active transforms. */
  maxConcurrentTransforms: number;
  /** Device class: mobile → stricter budget, desktop → more generous. */
  deviceClass: "mobile" | "desktop" | "auto";
}

export interface MotionObjective {
  id: string;
  /** Describes what this objective achieves. */
  description: string;
  /** Index in user-perceived order. */
  priorityRank: number;
  /** Objectives that must complete before this one can start. */
  dependsOn: string[];
  /** Can this objective run in parallel with siblings that share no deps? */
  parallelizable: boolean;
  /** The kind of output this objective will synthesize. */
  objectiveType: ObjectiveType;
  /** Rough duration budget allocated to this objective. */
  durationBudgetMs: number;
  /** Tactics that could realize this objective — ranked best-first. */
  tactics: MotionTactic[];
}

export type ObjectiveType =
  | "entrance"
  | "exit"
  | "attention"
  | "transition"
  | "loop_ambient"
  | "interaction_feedback"
  | "choreography_ordering"
  | "color_style"
  | "accessibility_tuning"
  | "performance_tuning";

export interface MotionTactic {
  id: string;
  /** Human-readable tactic name. */
  name: string;
  /** Short explanation of the approach. */
  description: string;
  /** Heuristic confidence score (0..1). */
  confidence: number;
  /** Concrete actions that implement the tactic. */
  actions: TacticAction[];
}

export interface TacticAction {
  id: string;
  /** The tool, executor or engine to call. */
  actionType:
    | "set_duration"
    | "set_easing"
    | "generate_keyframes"
    | "apply_spring_sim"
    | "apply_gravity_sim"
    | "apply_path"
    | "apply_preset"
    | "set_palette"
    | "set_stagger"
    | "set_reduced_motion"
    | "set_iterations";
  /** Parameters the action needs. */
  params: Record<string, unknown>;
  /** A dry-run preview of the output this action produces. */
  preview: ActionPreview;
}

export interface ActionPreview {
  /** Number of keyframes produced. */
  keyframeCount: number;
  /** Estimated ms this action occupies. */
  estimatedDurationMs: number;
  /** Transforms touched: opacity / scale / translate / rotate / skew / filter. */
  transformBudget: string[];
}

export interface MotionPlan {
  goal: MotionGoal;
  objectives: MotionObjective[];
  /** Ordered list of objective ids that honors dependencies. */
  executionOrder: string[];
  /** Maximum parallelism reachable given the dependency edges. */
  maxParallelism: number;
  /** Human-readable plan summary for the UI. */
  summary: string;
  /** Total duration allocated across the longest critical path. */
  criticalPathMs: number;
}

// ---------------------------------------------------------------------------
// Goal Construction
// ---------------------------------------------------------------------------

export function buildMotionGoal(request: string): MotionGoal {
  const lower = request.toLowerCase();
  const intent = inferIntent(request);
  const emotion = detectEmotionFromText(request);

  const constraints: GoalConstraints = {
    durationBudgetMs: 2400,
    intensityCeiling: 1.0,
    prefersReducedMotion: false,
    maxConcurrentTransforms: 6,
    deviceClass: "auto",
  };

  // Duration overrides: explicit ms / s keywords and request semantics.
  const msMatch = request.match(/(\d{2,4})\s*(ms|milliseconds?)/i);
  const sMatch = request.match(/(\d+(?:\.\d+)?)\s*s(?:econds?)?/i);
  if (msMatch) constraints.durationBudgetMs = Math.min(8000, Math.max(200, parseInt(msMatch[1], 10)));
  else if (sMatch) {
    constraints.durationBudgetMs = Math.min(8000, Math.max(200, Math.round(parseFloat(sMatch[1]) * 1000)));
  } else {
    if (lower.includes("quick") || lower.includes("fast") || lower.includes("快速"))
      constraints.durationBudgetMs = 700;
    else if (lower.includes("long") || lower.includes("extended") || lower.includes("缓慢"))
      constraints.durationBudgetMs = 3200;
    else if (lower.includes("micro") || lower.includes("微交互"))
      constraints.durationBudgetMs = 320;
  }

  if (lower.includes("reduced") || lower.includes("safe") || lower.includes("quiet") || lower.includes("减少")) {
    constraints.prefersReducedMotion = true;
    constraints.intensityCeiling = 0.5;
  } else if (lower.includes("subtle") || lower.includes("gentle") || lower.includes("轻柔")) {
    constraints.intensityCeiling = 0.6;
  } else if (lower.includes("intense") || lower.includes("strong") || lower.includes("剧烈")) {
    constraints.intensityCeiling = 1.15;
  }

  if (lower.includes("mobile") || lower.includes("phone") || lower.includes("手机")) {
    constraints.deviceClass = "mobile";
    constraints.maxConcurrentTransforms = 3;
  } else if (lower.includes("desktop") || lower.includes("桌面")) {
    constraints.deviceClass = "desktop";
    constraints.maxConcurrentTransforms = 8;
  }

  const semanticTags: string[] = [];
  semanticTags.push(...intent.concepts.slice(0, 4).map((c) => (c as { label?: string; conceptLabel?: string }).label ?? (c as { conceptLabel: string }).conceptLabel));
  if (emotion) semanticTags.push(emotion.name);

  // Headline label extraction: first noun phrase, fall back to a trimmed sentence.
  const trimmed = request.trim().replace(/\s+/g, " ");
  const label = trimmed.length > 64 ? `${trimmed.slice(0, 61)}...` : trimmed || "Motion goal";

  return { label, rawRequest: request, constraints, semanticTags };
}

// ---------------------------------------------------------------------------
// Objective Synthesis
// ---------------------------------------------------------------------------

/**
 * Synthesize 3–6 objectives from a goal.
 * Objectives are selected from a library of 10 archetypes; each archetype
 * can be activated by specific keyword cues or by semantic tags.
 */
export function synthesizeObjectives(goal: MotionGoal): MotionObjective[] {
  const request = goal.rawRequest;
  const lower = request.toLowerCase();
  const intent = inferIntent(request);
  const emotion = detectEmotionFromText(request);

  const archetypeCues: Array<{
    type: ObjectiveType;
    description: (tags: Array<{ conceptId?: string; conceptLabel?: string; id?: string; label?: string; confidence: number }>) => string;
    keywords: string[];
    default: boolean;
    durationRatio: number;
    tacticsFactory: () => MotionTactic[];
  }> = [
    {
      type: "entrance",
      description: (tags) => `Introduce content on-stage with${tags.length > 0 ? ` thematic alignment to ${tags[0].label ?? tags[0].conceptLabel}` : " a canonical entrance curve"}.`,
      keywords: ["enter", "appear", "reveal", "intro", "onstage", "进入", "出现", "入场", "reveal"],
      default: true,
      durationRatio: 0.45,
      tacticsFactory: () => buildEntranceTactics(goal),
    },
    {
      type: "attention",
      description: () => `Apply a micro-punch that draws viewer attention without dominating the layout.`,
      keywords: ["attention", "focus", "highlight", "pop", "stand out", "注意力", "突出", "焦点"],
      default: false,
      durationRatio: 0.2,
      tacticsFactory: () => buildAttentionTactics(goal),
    },
    {
      type: "choreography_ordering",
      description: () => `Define stagger, delay grids and on-screen ordering so multiple elements arrive coherently.`,
      keywords: ["order", "stagger", "sequence", "timeline", "coordinate", "顺序", "交错", "时间轴"],
      default: false,
      durationRatio: 0.25,
      tacticsFactory: () => buildChoreographyTactics(goal),
    },
    {
      type: "interaction_feedback",
      description: () => `Craft a tactile hover-and-click feedback pair so the motion feels responsive under user control.`,
      keywords: ["hover", "click", "tap", "press", "button", "交互", "点击", "悬停"],
      default: false,
      durationRatio: 0.12,
      tacticsFactory: () => buildInteractionTactics(goal),
    },
    {
      type: "color_style",
      description: () => `Pick a palette, shader tint and easing family that matches the request tone.`,
      keywords: ["color", "palette", "style", "brand", "look", "theme", "色彩", "风格", "品牌", "主题"],
      default: false,
      durationRatio: 0.0,
      tacticsFactory: () => buildColorStyleTactics(),
    },
    {
      type: "loop_ambient",
      description: () => `Layer an ambient idle loop that keeps the composition alive after entrance completes.`,
      keywords: ["loop", "idle", "ambient", "pulse", "breath", "循环", "呼吸", "闲置"],
      default: false,
      durationRatio: 0.5,
      tacticsFactory: () => buildAmbientTactics(goal),
    },
    {
      type: "transition",
      description: () => `Bridge two scenes or states with a cinematic transition pattern.`,
      keywords: ["transition", "scene", "state", "page", "switch", "过渡", "切换", "转场"],
      default: false,
      durationRatio: 0.4,
      tacticsFactory: () => buildTransitionTactics(goal),
    },
    {
      type: "exit",
      description: () => `Produce a graceful exit curve so content can leave the stage without jarring the viewer.`,
      keywords: ["exit", "leave", "dismiss", "close", "disappear", "退出", "关闭", "消失"],
      default: false,
      durationRatio: 0.3,
      tacticsFactory: () => buildExitTactics(goal),
    },
    {
      type: "accessibility_tuning",
      description: () => `Apply vestibular-safe tuning and reduced-motion fallback variants.`,
      keywords: ["accessible", "accessibility", "a11y", "safe", "quiet", "reduce", "无障碍", "安全", "减少"],
      default: !!goal.constraints.prefersReducedMotion,
      durationRatio: 0.0,
      tacticsFactory: () => buildA11yTactics(goal),
    },
    {
      type: "performance_tuning",
      description: () => `Trim transform budget, cut keyframes where redundant, and keep to GPU-friendly transforms only.`,
      keywords: ["fast", "performance", "lightweight", "optimize", "fps", "性能", "流畅", "轻量"],
      default: goal.constraints.deviceClass === "mobile",
      durationRatio: 0.0,
      tacticsFactory: () => buildPerfTactics(goal),
    },
  ];

  const activated: Array<{ archetype: typeof archetypeCues[number]; hitCount: number }> = [];
  for (const archetype of archetypeCues) {
    let hits = 0;
    for (const kw of archetype.keywords) {
      if (lower.includes(kw.toLowerCase())) hits += 1;
    }
    // Semantic boosting: if the intent profile labels the goal with a
    // relevant concept, count that as a soft hit too.
    const conceptBoost = intent.concepts.some((c) => {
      const cl = (c as { label?: string; conceptLabel?: string }).label ?? (c as { conceptLabel: string }).conceptLabel;
      return archetype.keywords.some((kw) => cl.toLowerCase().includes(kw.toLowerCase()));
    })
      ? 0.5
      : 0;
    const score = hits + conceptBoost + (archetype.default ? 0.3 : 0);
    if (score > 0.25) activated.push({ archetype, hitCount: hits });
  }

  activated.sort((a, b) => b.hitCount - a.hitCount);
  // Keep between 3 and 6 objectives.
  const chosen = activated.slice(0, 6);
  if (chosen.length < 3) {
    // Fill with defaults so the plan always has enough structure.
    for (const archetype of archetypeCues) {
      if (chosen.length >= 3) break;
      if (!chosen.find((c) => c.archetype.type === archetype.type) && archetype.default) {
        chosen.push({ archetype, hitCount: 0 });
      }
    }
  }

  // Build the dependency graph.
  const objectives: MotionObjective[] = chosen.map((c, idx) => {
    const durationMs = Math.max(
      80,
      Math.round(goal.constraints.durationBudgetMs * c.archetype.durationRatio),
    );
    const tactics = c.archetype.tacticsFactory();
    // Emotion bias: when we have an emotion tag, push tactic confidence
    // toward candidates that share that emotion's intensity profile.
    const emotionBiased = emotion
      ? tactics.map((t) => ({
          ...t,
          confidence: clamp01(t.confidence + emotionBiasFor(emotion.category, t.id)),
        })).sort((a, b) => b.confidence - a.confidence)
      : tactics;

    const dependsOn: string[] = [];
    // Entrance and style always run first; everything else can parallelize
    // if its archetype permits.
    if (idx > 0) {
      const firstTypes = new Set<ObjectiveType>(["entrance", "color_style", "accessibility_tuning"]);
      const prereqs = objectives.filter((o) => firstTypes.has(o.objectiveType)).map((o) => o.id);
      dependsOn.push(...prereqs);
    }

    return {
      id: `obj_${idx + 1}_${c.archetype.type}`,
      description: c.archetype.description(intent.concepts),
      priorityRank: idx + 1,
      dependsOn,
      parallelizable: c.archetype.type !== "entrance" && c.archetype.type !== "color_style",
      objectiveType: c.archetype.type,
      durationBudgetMs: durationMs,
      tactics: emotionBiased,
    };
  });

  // Ensure dependencies are consistent (no self-loops, no missing ids).
  for (const obj of objectives) {
    obj.dependsOn = obj.dependsOn.filter((id) => objectives.some((o) => o.id === id && o.id !== obj.id));
  }

  return objectives;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function emotionBiasFor(category: string, tacticId: string): number {
  const c = category.toLowerCase();
  const t = tacticId.toLowerCase();
  let bias = 0;
  if (c.includes("energetic") && (t.includes("spring") || t.includes("bounce"))) bias += 0.12;
  if (c.includes("calm") && (t.includes("fade") || t.includes("smooth"))) bias += 0.12;
  if (c.includes("dramatic") && (t.includes("warp") || t.includes("cinematic"))) bias += 0.14;
  if (c.includes("playful") && t.includes("stagger") ) bias += 0.1;
  if (c.includes("luxury") && (t.includes("gold") || t.includes("elegant"))) bias += 0.12;
  return bias;
}

// ---------------------------------------------------------------------------
// Tactic Factories
// ---------------------------------------------------------------------------

function buildEntranceTactics(goal: MotionGoal): MotionTactic[] {
  const d = Math.max(300, Math.round(goal.constraints.durationBudgetMs * 0.45));
  const intensity = goal.constraints.intensityCeiling;
  return [
    {
      id: "tac-entrance-spring",
      name: "Spring Entrance",
      description: "Spring simulation that overshoots slightly and settles naturally.",
      confidence: 0.9,
      actions: [
        buildAction("apply_spring_sim", { stiffness: 170, damping: 26, mass: 1, intensity }, {
          keyframeCount: 4, estimatedDurationMs: d, transformBudget: ["translateY", "scale"],
        }),
        buildAction("set_easing", { easingName: "spring" }, {
          keyframeCount: 0, estimatedDurationMs: 0, transformBudget: [],
        }),
        buildAction("set_duration", { durationMs: d }, {
          keyframeCount: 0, estimatedDurationMs: d, transformBudget: [],
        }),
      ],
    },
    {
      id: "tac-entrance-fade-slide",
      name: "Fade + Slide",
      description: "Progressive opacity combined with a soft vertical offset.",
      confidence: 0.86,
      actions: [
        buildAction("generate_keyframes", {
          pattern: "fade-slide",
          distancePx: Math.round(32 * intensity),
          durationMs: d,
        }, {
          keyframeCount: 3, estimatedDurationMs: d, transformBudget: ["opacity", "translateY"],
        }),
        buildAction("set_easing", { easingName: "ease-out-cubic" }, {
          keyframeCount: 0, estimatedDurationMs: 0, transformBudget: [],
        }),
      ],
    },
    {
      id: "tac-entrance-cinematic-warp",
      name: "Cinematic Warp",
      description: "Scale + blur + chromatic entrance for a dramatic reveal.",
      confidence: 0.82,
      actions: [
        buildAction("generate_keyframes", {
          pattern: "warp-reveal",
          intensity,
          durationMs: d,
        }, {
          keyframeCount: 5, estimatedDurationMs: d, transformBudget: ["scale", "blur", "rotateX", "translateY"],
        }),
        buildAction("set_easing", { easingName: "ease-out" }, {
          keyframeCount: 0, estimatedDurationMs: 0, transformBudget: [],
        }),
      ],
    },
  ];
}

function buildAttentionTactics(goal: MotionGoal): MotionTactic[] {
  const d = Math.max(180, Math.round(goal.constraints.durationBudgetMs * 0.2));
  const intensity = goal.constraints.intensityCeiling;
  return [
    {
      id: "tac-att-pulse-scale",
      name: "Pulse Scale",
      description: "Brief scale nudge that attracts eyes without breaking layout.",
      confidence: 0.88,
      actions: [
        buildAction("generate_keyframes", {
          pattern: "pulse-scale",
          scale: 1 + 0.06 * intensity,
          durationMs: d,
        }, {
          keyframeCount: 3, estimatedDurationMs: d, transformBudget: ["scale"],
        }),
      ],
    },
    {
      id: "tac-att-glow-flash",
      name: "Glow Flash",
      description: "Brief glow overlay that fades, perfect for feature highlights.",
      confidence: 0.8,
      actions: [
        buildAction("generate_keyframes", {
          pattern: "glow-flash",
          durationMs: d,
          intensity,
        }, {
          keyframeCount: 3, estimatedDurationMs: d, transformBudget: ["blur", "opacity"],
        }),
      ],
    },
  ];
}

function buildChoreographyTactics(goal: MotionGoal): MotionTactic[] {
  const intensity = goal.constraints.intensityCeiling;
  return [
    {
      id: "tac-choreo-stagger-80",
      name: "Tight 80ms Stagger",
      description: "Small per-item delays — 80ms grid — for a snappy ensemble.",
      confidence: 0.9,
      actions: [
        buildAction("set_stagger", { staggerMs: Math.round(80 * intensity), pattern: "forward" }, {
          keyframeCount: 0, estimatedDurationMs: 320, transformBudget: [],
        }),
      ],
    },
    {
      id: "tac-choreo-centerout",
      name: "Center-Out Ordering",
      description: "Elements activate from the visual centre outward (radial stagger).",
      confidence: 0.82,
      actions: [
        buildAction("set_stagger", { staggerMs: Math.round(110 * intensity), pattern: "center-out" }, {
          keyframeCount: 0, estimatedDurationMs: 440, transformBudget: [],
        }),
      ],
    },
  ];
}

function buildInteractionTactics(goal: MotionGoal): MotionTactic[] {
  const d = Math.max(120, Math.round(goal.constraints.durationBudgetMs * 0.12));
  return [
    {
      id: "tac-int-hover-press",
      name: "Hover + Press Feedback",
      description: "Slight grow on hover, compacting press with snappy easing.",
      confidence: 0.92,
      actions: [
        buildAction("generate_keyframes", { pattern: "hover-grow", durationMs: d, scale: 1.03 }, {
          keyframeCount: 2, estimatedDurationMs: d, transformBudget: ["scale"],
        }),
        buildAction("generate_keyframes", { pattern: "press-compact", durationMs: Math.max(80, Math.round(d * 0.6)), scale: 0.96 }, {
          keyframeCount: 2, estimatedDurationMs: Math.max(80, Math.round(d * 0.6)), transformBudget: ["scale"],
        }),
      ],
    },
  ];
}

function buildColorStyleTactics(): MotionTactic[] {
  return [
    {
      id: "tac-style-minimal",
      name: "Minimal Palette",
      description: "Monochrome black-and-white with soft neutrals.",
      confidence: 0.86,
      actions: [
        buildAction("set_palette", { palette: ["#FFFFFF", "#1A1A1A", "#404040", "#808080"], profile: "minimal" }, {
          keyframeCount: 0, estimatedDurationMs: 0, transformBudget: [],
        }),
      ],
    },
    {
      id: "tac-style-elegant-gold",
      name: "Elegant Gold Accent",
      description: "Deep navy, ivory and a thin gold accent for a luxurious feel.",
      confidence: 0.78,
      actions: [
        buildAction("set_palette", { palette: ["#0A0A14", "#F5F0E1", "#D4AF37", "#8B7355"], profile: "luxury-gold" }, {
          keyframeCount: 0, estimatedDurationMs: 0, transformBudget: [],
        }),
      ],
    },
    {
      id: "tac-style-neon-arc",
      name: "Neon Arc Gradient",
      description: "Neon multi-hue with deep-space background for high-tech.",
      confidence: 0.74,
      actions: [
        buildAction("set_palette", { palette: ["#020214", "#EC4899", "#22D3EE", "#A3E635"], profile: "neon" }, {
          keyframeCount: 0, estimatedDurationMs: 0, transformBudget: [],
        }),
      ],
    },
  ];
}

function buildAmbientTactics(goal: MotionGoal): MotionTactic[] {
  const d = Math.max(1200, Math.round(goal.constraints.durationBudgetMs * 0.5));
  const intensity = goal.constraints.intensityCeiling;
  return [
    {
      id: "tac-ambient-breath",
      name: "Breathing Loop",
      description: "Slow scale oscillation that simulates breathing — ideal idle motion.",
      confidence: 0.92,
      actions: [
        buildAction("generate_keyframes", { pattern: "breath-loop", durationMs: d, intensity }, {
          keyframeCount: 3, estimatedDurationMs: d, transformBudget: ["scale", "opacity"],
        }),
        buildAction("set_iterations", { count: Infinity, direction: "alternate" }, {
          keyframeCount: 0, estimatedDurationMs: d, transformBudget: [],
        }),
      ],
    },
    {
      id: "tac-ambient-float-drift",
      name: "Float Drift",
      description: "Soft sinusoidal vertical drift — pairs well with hover states.",
      confidence: 0.86,
      actions: [
        buildAction("apply_path", { pathType: "sine", amplitudePx: Math.round(8 * intensity), samples: 24, durationMs: d }, {
          keyframeCount: 24, estimatedDurationMs: d, transformBudget: ["translateY"],
        }),
        buildAction("set_iterations", { count: Infinity, direction: "alternate" }, {
          keyframeCount: 0, estimatedDurationMs: d, transformBudget: [],
        }),
      ],
    },
  ];
}

function buildTransitionTactics(goal: MotionGoal): MotionTactic[] {
  const d = Math.max(400, Math.round(goal.constraints.durationBudgetMs * 0.4));
  const intensity = goal.constraints.intensityCeiling;
  return [
    {
      id: "tac-trans-wipe-horizontal",
      name: "Horizontal Wipe",
      description: "Classic ltr screen wipe with soft edge feathering.",
      confidence: 0.85,
      actions: [
        buildAction("generate_keyframes", { pattern: "wipe-horizontal", durationMs: d, intensity }, {
          keyframeCount: 4, estimatedDurationMs: d, transformBudget: ["translateX", "clipPath"],
        }),
      ],
    },
    {
      id: "tac-trans-curtain-reveal",
      name: "Curtain Reveal",
      description: "Two halves pull away from the center like opening curtains.",
      confidence: 0.82,
      actions: [
        buildAction("generate_keyframes", { pattern: "curtain", durationMs: d, intensity }, {
          keyframeCount: 4, estimatedDurationMs: d, transformBudget: ["translateX", "opacity"],
        }),
      ],
    },
    {
      id: "tac-trans-iris",
      name: "Iris Close/Open",
      description: "Circular iris animation — cinematic scene transition.",
      confidence: 0.8,
      actions: [
        buildAction("generate_keyframes", { pattern: "iris", durationMs: d, intensity }, {
          keyframeCount: 5, estimatedDurationMs: d, transformBudget: ["clipPath", "opacity"],
        }),
      ],
    },
  ];
}

function buildExitTactics(goal: MotionGoal): MotionTactic[] {
  const d = Math.max(300, Math.round(goal.constraints.durationBudgetMs * 0.3));
  const intensity = goal.constraints.intensityCeiling;
  return [
    {
      id: "tac-exit-smooth-collapse",
      name: "Smooth Collapse",
      description: "Fade + shrink to zero without layout jump.",
      confidence: 0.9,
      actions: [
        buildAction("generate_keyframes", { pattern: "collapse-exit", durationMs: d, intensity }, {
          keyframeCount: 4, estimatedDurationMs: d, transformBudget: ["opacity", "scale", "height"],
        }),
        buildAction("set_easing", { easingName: "ease-in" }, {
          keyframeCount: 0, estimatedDurationMs: 0, transformBudget: [],
        }),
      ],
    },
    {
      id: "tac-exit-quantum-dissolve",
      name: "Quantum Dissolve",
      description: "Particle-like disintegration — for high-tech exit.",
      confidence: 0.78,
      actions: [
        buildAction("generate_keyframes", { pattern: "dissolve-exit", durationMs: d, intensity }, {
          keyframeCount: 5, estimatedDurationMs: d, transformBudget: ["opacity", "blur", "translateY"],
        }),
      ],
    },
  ];
}

function buildA11yTactics(goal: MotionGoal): MotionTactic[] {
  const d = Math.max(200, 520);
  return [
    {
      id: "tac-a11y-reduced-opacity-only",
      name: "Opacity-Only Reduced Motion",
      description: "WCAG-friendly: only opacity changes, linear easing, no vestibular triggers.",
      confidence: 0.95,
      actions: [
        buildAction("set_reduced_motion", { enable: true, allowOpacityOnly: true }, {
          keyframeCount: 0, estimatedDurationMs: 0, transformBudget: [],
        }),
        buildAction("generate_keyframes", { pattern: "fade-only", durationMs: d }, {
          keyframeCount: 2, estimatedDurationMs: d, transformBudget: ["opacity"],
        }),
        buildAction("set_easing", { easingName: "linear" }, {
          keyframeCount: 0, estimatedDurationMs: 0, transformBudget: [],
        }),
      ],
    },
  ];
}

function buildPerfTactics(goal: MotionGoal): MotionTactic[] {
  const isMobile = goal.constraints.deviceClass === "mobile";
  return [
    {
      id: "tac-perf-gpu-only",
      name: "GPU-Friendly Transform Set",
      description: "Restrict to opacity + translate + scale; disallow filters, box-shadows and clip-path.",
      confidence: 0.92,
      actions: [
        buildAction("set_duration", { durationMs: isMobile ? 520 : 680 }, {
          keyframeCount: 0, estimatedDurationMs: 0, transformBudget: [],
        }),
      ],
    },
  ];
}

function buildAction(
  actionType: TacticAction["actionType"],
  params: Record<string, unknown>,
  preview: ActionPreview,
): TacticAction {
  return {
    id: `${actionType}_${Math.random().toString(36).slice(2, 7)}`,
    actionType,
    params,
    preview,
  };
}

// ---------------------------------------------------------------------------
// Execution Order & Critical Path
// ---------------------------------------------------------------------------

export function computeExecutionOrder(objectives: MotionObjective[]): {
  executionOrder: string[];
  maxParallelism: number;
  criticalPathMs: number;
} {
  const remaining = new Map(objectives.map((o) => [o.id, o]));
  const executed = new Set<string>();
  const order: string[] = [];
  let maxParallel = 0;
  let criticalPathMs = 0;

  while (remaining.size > 0) {
    const ready = [...remaining.values()].filter(
      (o) => o.dependsOn.every((d) => executed.has(d) || !remaining.has(d)),
    );
    if (ready.length === 0) {
      // Circular dependency — pick the lowest rank and force it.
      const forced = [...remaining.values()].sort((a, b) => a.priorityRank - b.priorityRank)[0];
      if (!forced) break;
      ready.push(forced);
    }
    maxParallel = Math.max(maxParallel, ready.length);
    // This "wave" contributes the longest objective in the wave to the critical path.
    criticalPathMs += Math.max(...ready.map((o) => o.durationBudgetMs));
    for (const obj of ready) {
      order.push(obj.id);
      executed.add(obj.id);
      remaining.delete(obj.id);
    }
  }

  return { executionOrder: order, maxParallelism: maxParallel, criticalPathMs };
}

// ---------------------------------------------------------------------------
// Top-level plan builder
// ---------------------------------------------------------------------------

export function planMotionHierarchy(request: string): MotionPlan {
  const goal = buildMotionGoal(request);
  const objectives = synthesizeObjectives(goal);
  const { executionOrder, maxParallelism, criticalPathMs } = computeExecutionOrder(objectives);

  const lines: string[] = [];
  lines.push(`Goal: ${goal.label}`);
  lines.push(`Budget: ${goal.constraints.durationBudgetMs}ms (critical path ${criticalPathMs}ms)`);
  lines.push(`Objectives: ${objectives.length} · Parallelism: ${maxParallelism}`);
  lines.push(...objectives.map((o, i) => `  ${i + 1}. [${o.objectiveType}] ${o.description.slice(0, 92)}`));

  return {
    goal,
    objectives,
    executionOrder,
    maxParallelism,
    criticalPathMs,
    summary: lines.join("\n"),
  };
}

/**
 * Render a plan into a preview motion spec that the executor can convert
 * into concrete component edits. Produces one component per objective so
 * the UI can show what each objective contributes visually.
 */
export function renderPlanPreview(plan: MotionPlan): MotionSpec {
  const ts = new Date().toISOString();
  const project = {
    id: `preview_${Math.random().toString(36).slice(2, 8)}`,
    name: `Plan preview: ${plan.goal.label.slice(0, 32)}`,
    description: plan.summary,
    scenes: [],
    tokens: {},
    globalTiming: { totalDurationMs: plan.criticalPathMs },
    status: "draft" as const,
    sourceTemplateId: null,
    createdAt: ts,
    updatedAt: ts,
  };

  const components: MotionComponent[] = plan.objectives.map((obj, idx) => {
    // Use the first tactic's first action that produces keyframes.
    let kfs: Keyframe[] = [
      { offset: 0, properties: { opacity: 0 } },
      { offset: 1, properties: { opacity: 1 } },
    ];
    let easing: Easing = easingPreset("ease-out");
    for (const tactic of obj.tactics) {
      const producing = tactic.actions.find((a) => a.actionType === "generate_keyframes" || a.actionType === "apply_spring_sim" || a.actionType === "apply_path" || a.actionType === "apply_gravity_sim");
      if (!producing) continue;
      kfs = keyframesForAction(producing);
      break;
    }
    const easingAction = obj.tactics[0]?.actions.find((a) => a.actionType === "set_easing");
    if (easingAction?.params.easingName && typeof easingAction.params.easingName === "string") {
      easing = resolveEasing(easingAction.params.easingName);
    }

    return {
      id: `c_${idx}_${obj.id}`,
      projectId: project.id,
      sceneId: null,
      name: obj.description.slice(0, 48),
      selector: `.plan-preview-${idx}`,
      templateId: null,
      durationMs: obj.durationBudgetMs || 800,
      delayMs: idx * 40,
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      playState: "running",
      trigger: "onLoad",
      easing,
      keyframes: kfs,
      style: {},
      orderIndex: idx,
      parentId: null,
      createdAt: ts,
      updatedAt: ts,
    };
  });

  return { project, components };
}

function keyframesForAction(action: TacticAction): Keyframe[] {
  const params = action.params;
  const d = (params.durationMs as number) ?? 800;
  switch (action.actionType) {
    case "apply_spring_sim": {
      const r = simulateSpring({
        stiffness: (params.stiffness as number) ?? 170,
        damping: (params.damping as number) ?? 26,
        mass: (params.mass as number) ?? 1,
      });
      return r.component.keyframes;
    }
    case "apply_gravity_sim": {
      const r = simulateGravityDrop({ initialHeight: 200, bounce: 0.5 });
      return r.component.keyframes;
    }
    case "apply_path": {
      const r = generatePathMotion({
        type: (params.pathType as any) ?? "sine",
        samples: (params.samples as number) ?? 20,
      });
      return r.component.keyframes;
    }
    default:
      return defaultKeyframes(params, d);
  }
}

function defaultKeyframes(params: Record<string, unknown>, d: number): Keyframe[] {
  const intensity = (params.intensity as number) ?? 1;
  const pattern = (params.pattern as string) ?? "fade-slide";
  switch (pattern) {
    case "fade-slide": {
      const distance = (params.distancePx as number) ?? 32;
      return [
        { offset: 0, properties: { opacity: 0, translateY: distance } },
        { offset: 1, properties: { opacity: 1, translateY: 0 } },
      ];
    }
    case "pulse-scale": {
      const scale = (params.scale as number) ?? 1.06;
      return [
        { offset: 0, properties: { scale: 1 } },
        { offset: 0.4, properties: { scale } },
        { offset: 1, properties: { scale: 1 } },
      ];
    }
    case "warp-reveal":
      return [
        { offset: 0, properties: { opacity: 0, scale: 0.2, blur: 24, translateY: 60 * intensity } },
        { offset: 0.5, properties: { opacity: 0.6, scale: 0.9, blur: 6, translateY: 10 * intensity } },
        { offset: 1, properties: { opacity: 1, scale: 1, blur: 0, translateY: 0 } },
      ];
    case "breath-loop":
      return [
        { offset: 0, properties: { scale: 1, opacity: 1 } },
        { offset: 0.5, properties: { scale: 1 + 0.04 * intensity, opacity: 0.95 } },
        { offset: 1, properties: { scale: 1, opacity: 1 } },
      ];
    case "collapse-exit":
      return [
        { offset: 0, properties: { opacity: 1, scale: 1 } },
        { offset: 1, properties: { opacity: 0, scale: 0.85 * intensity, translateY: 20 * intensity } },
      ];
    default:
      return [
        { offset: 0, properties: { opacity: 0 } },
        { offset: 1, properties: { opacity: 1 } },
      ];
  }
}

// ---------------------------------------------------------------------------
// Easing resolver
// ---------------------------------------------------------------------------

const EASING_NAME_SET = new Set<string>([
  "linear", "ease", "ease-in", "ease-out", "ease-in-out",
  "ease-in-quad", "ease-out-quad", "ease-in-out-quad",
  "ease-in-cubic", "ease-out-cubic", "ease-in-out-cubic",
  "bounce", "back", "elastic", "snappy", "smooth", "soft",
]);

function resolveEasing(name: string): Easing {
  if (name === "spring") return { type: "spring", stiffness: 170, damping: 26, mass: 1 };
  if (EASING_NAME_SET.has(name)) return easingPreset(name as EasingPreset);
  return easingPreset("ease-out");
}
