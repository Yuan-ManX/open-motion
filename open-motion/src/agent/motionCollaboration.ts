/**
 * Motion Collaboration Engine — coordinates multiple motion intelligences.
 *
 * This is an original AI-native module that orchestrates the cooperation of
 * different motion intelligence modules (emotion, physics, style, context,
 * semantics, etc.) to produce unified, coherent motion designs from complex
 * multi-faceted requests.
 *
 * Instead of a single module handling everything, the collaboration engine:
 * 1. Decomposes a complex request into sub-tasks for specialized modules.
 * 2. Assigns each sub-task to the best-suited motion intelligence.
 * 3. Executes sub-tasks in dependency order (some can run in parallel).
 * 4. Merges results and resolves conflicts between module recommendations.
 * 5. Produces a unified motion design that satisfies all constraints.
 *
 * Collaboration patterns:
 * - Sequential: A → B → C (each module builds on the previous)
 * - Parallel: A + B + C (independent modules run simultaneously)
 * - Iterative: A ↔ B (modules refine each other's output)
 * - Hierarchical: A coordinates B and C (one module guides others)
 *
 * Rule-based — no LLM round-trip required.
 */

import type { Keyframe, Easing, EasingPreset } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";
import { draft, kf, type ComponentDraft } from "../motion/templates/helper.js";

// Valid easing preset names for runtime validation.
const VALID_EASING_PRESETS = new Set<string>([
  "linear", "ease", "ease-in", "ease-out", "ease-in-out",
  "ease-in-quad", "ease-out-quad", "ease-in-out-quad",
  "ease-in-cubic", "ease-out-cubic", "ease-in-out-cubic",
  "bounce", "back", "elastic", "snappy", "smooth", "soft",
]);

/** Convert an easing name string to a proper Easing object. */
function resolveEasingObject(name: string): Easing {
  if (name === "spring") {
    return { type: "spring", stiffness: 170, damping: 26, mass: 1 };
  }
  if (VALID_EASING_PRESETS.has(name)) {
    return easingPreset(name as EasingPreset);
  }
  return easingPreset("ease-out");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A specialized motion intelligence module that can participate in collaboration. */
export interface CollaborationModule {
  /** Module identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** What this module specializes in. */
  specialty: string;
  /** Keywords that indicate this module should be involved. */
  triggerKeywords: string[];
}

/** A sub-task assigned to a module in a collaboration. */
export interface CollaborationSubTask {
  /** Unique id for this sub-task. */
  id: string;
  /** The module assigned to this sub-task. */
  moduleId: string;
  /** What the sub-task should produce. */
  objective: string;
  /** Input parameters for the sub-task. */
  inputs: Record<string, unknown>;
  /** IDs of sub-tasks that must complete before this one starts. */
  dependsOn: string[];
  /** Whether this sub-task can run in parallel with others. */
  parallelizable: boolean;
}

/** The result of a single sub-task. */
export interface SubTaskResult {
  subTaskId: string;
  moduleId: string;
  /** Motion parameters produced by this module. */
  motionParams: CollaborationMotionParams;
  /** Confidence in the result (0..1). */
  confidence: number;
  /** Notes from the module. */
  notes: string;
}

/** Motion parameters from a collaborating module. */
export interface CollaborationMotionParams {
  easing?: string;
  durationMs?: number;
  intensity?: number;
  transformType?: string;
  palette?: string[];
  keyframes?: Keyframe[];
  metadata?: Record<string, unknown>;
}

/** A collaboration plan. */
export interface CollaborationPlan {
  /** The original request. */
  request: string;
  /** Detected modules to involve. */
  modules: CollaborationModule[];
  /** Sub-tasks to execute. */
  subTasks: CollaborationSubTask[];
  /** Execution pattern. */
  pattern: CollaborationPattern;
  /** Summary. */
  summary: string;
}

export type CollaborationPattern = "sequential" | "parallel" | "iterative" | "hierarchical";

/** The final merged result of a collaboration. */
export interface CollaborationResult {
  /** The unified motion component (draft — persisted by the orchestrator). */
  component: ComponentDraft;
  /** Per-module contributions. */
  contributions: Array<{
    moduleId: string;
    moduleName: string;
    contribution: string;
    confidence: number;
  }>;
  /** How conflicts were resolved. */
  conflictResolutions: string[];
  /** Overall confidence. */
  confidence: number;
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Module Registry
// ---------------------------------------------------------------------------

export const COLLABORATION_MODULES: CollaborationModule[] = [
  {
    id: "emotion",
    name: "Emotion Intelligence",
    specialty: "Emotional tone, affective parameters, VAD mapping",
    triggerKeywords: ["emotion", "feel", "mood", "tone", "vibe", "情感", "感觉", "情绪"],
  },
  {
    id: "physics",
    name: "Physics Engine",
    specialty: "Physical simulation, spring dynamics, gravity, collisions",
    triggerKeywords: ["physics", "spring", "gravity", "bounce", "drop", "物理", "弹簧", "重力"],
  },
  {
    id: "style",
    name: "Style Transfer",
    specialty: "Style DNA extraction, archetype application, style blending",
    triggerKeywords: ["style", "elegant", "playful", "luxury", "minimal", "风格", "优雅"],
  },
  {
    id: "context",
    name: "Context Awareness",
    specialty: "Device adaptation, performance tuning, ambient adjustment",
    triggerKeywords: ["mobile", "desktop", "performance", "night", "day", "设备", "性能"],
  },
  {
    id: "semantics",
    name: "Semantic Engine",
    specialty: "Concept-to-motion translation, intent inference",
    triggerKeywords: ["trust", "urgency", "calm", "excitement", "concept", "信任", "紧急"],
  },
  {
    id: "choreography",
    name: "Choreographer",
    specialty: "Multi-component sequencing, timing, rhythm",
    triggerKeywords: ["sequence", "choreography", "rhythm", "stagger", "cascade", "序列", "编排"],
  },
  {
    id: "path",
    name: "Path Generator",
    specialty: "Mathematical path motion, curves, trajectories",
    triggerKeywords: ["path", "curve", "bezier", "lissajous", "orbit", "路径", "曲线"],
  },
  {
    id: "perception",
    name: "Perception Predictor",
    specialty: "Viewer perception, cognitive load, attention",
    triggerKeywords: ["perception", "attention", "cognitive", "viewer", "感知", "注意力"],
  },
];

/** Find modules that should participate based on a request. */
export function detectModules(request: string): CollaborationModule[] {
  const lower = request.toLowerCase();
  const detected = COLLABORATION_MODULES.filter((m) =>
    m.triggerKeywords.some((k) => lower.includes(k.toLowerCase())),
  );
  // Always include choreography as the coordinator if multiple modules are involved
  if (detected.length > 1 && !detected.find((m) => m.id === "choreography")) {
    detected.push(COLLABORATION_MODULES.find((m) => m.id === "choreography")!);
  }
  return detected;
}

// ---------------------------------------------------------------------------
// Plan Composition
// ---------------------------------------------------------------------------

/** Create a collaboration plan for a complex request. */
export function planCollaboration(request: string): CollaborationPlan {
  const modules = detectModules(request);
  const subTasks: CollaborationSubTask[] = [];
  let taskCounter = 0;

  const createTaskId = () => `task_${++taskCounter}`;

  // Determine execution pattern based on module count and request
  let pattern: CollaborationPattern = "sequential";

  if (modules.length === 0) {
    return {
      request,
      modules: [],
      subTasks: [],
      pattern: "sequential",
      summary: "No specialized modules detected — request is too general for collaboration.",
    };
  }

  // If only one module, it's a simple sequential task
  if (modules.length === 1) {
    const m = modules[0];
    subTasks.push({
      id: createTaskId(),
      moduleId: m.id,
      objective: `Apply ${m.name} to the motion based on: "${request}"`,
      inputs: { request },
      dependsOn: [],
      parallelizable: false,
    });
    pattern = "sequential";
  } else {
    // Multiple modules: use hierarchical pattern with choreography as coordinator
    pattern = "hierarchical";

    // Create parallel sub-tasks for independent modules
    const coordinatorId = "choreography";
    const independentModules = modules.filter((m) => m.id !== coordinatorId);

    // Phase 1: Each module produces its recommendation in parallel
    const phase1Ids: string[] = [];
    for (const m of independentModules) {
      const taskId = createTaskId();
      phase1Ids.push(taskId);
      subTasks.push({
        id: taskId,
        moduleId: m.id,
        objective: `Analyze the request and produce ${m.specialty.toLowerCase()} recommendations`,
        inputs: { request },
        dependsOn: [],
        parallelizable: true,
      });
    }

    // Phase 2: Coordinator merges results
    subTasks.push({
      id: createTaskId(),
      moduleId: coordinatorId,
      objective: "Merge all module recommendations into a unified motion design, resolving conflicts",
      inputs: { request, phase1Results: phase1Ids },
      dependsOn: phase1Ids,
      parallelizable: false,
    });
  }

  const moduleNames = modules.map((m) => m.name).join(", ");
  return {
    request,
    modules,
    subTasks,
    pattern,
    summary: `Collaboration plan: ${modules.length} module(s) [${moduleNames}] using ${pattern} pattern with ${subTasks.length} sub-task(s)`,
  };
}

// ---------------------------------------------------------------------------
// Result Merging
// ---------------------------------------------------------------------------

/** Merge multiple module results into a unified motion component. */
export function mergeResults(
  results: SubTaskResult[],
  request: string,
): CollaborationResult {
  const conflictResolutions: string[] = [];

  if (results.length === 0) {
    // Fallback: create a simple fade-in
    const component = draft("Collaboration Result", {
      durationMs: 800,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      keyframes: [
        kf(0, { opacity: 0, translateY: 20 }),
        kf(1, { opacity: 1, translateY: 0 }),
      ],
      style: {
        _content: "",
        _tag: "div",
        width: "200px",
        height: "120px",
        backgroundColor: "#1a1a1a",
        borderRadius: "8px",
      },
    });

    return {
      component,
      contributions: [],
      conflictResolutions: ["No modules contributed — used fallback fade-in"],
      confidence: 0.3,
      summary: "Collaboration produced a fallback motion (no module results to merge)",
    };
  }

  // Collect all motion parameters
  const allEasings = results.filter((r) => r.motionParams.easing).map((r) => ({ moduleId: r.moduleId, easing: r.motionParams.easing!, confidence: r.confidence }));
  const allDurations = results.filter((r) => r.motionParams.durationMs).map((r) => ({ moduleId: r.moduleId, durationMs: r.motionParams.durationMs!, confidence: r.confidence }));
  const allIntensities = results.filter((r) => r.motionParams.intensity).map((r) => ({ moduleId: r.moduleId, intensity: r.motionParams.intensity!, confidence: r.confidence }));
  const allPalettes = results.filter((r) => r.motionParams.palette).flatMap((r) => r.motionParams.palette!);

  // Resolve conflicts: use confidence-weighted averages
  const resolveEasing = (): string => {
    if (allEasings.length === 0) return "ease-out";
    if (allEasings.length === 1) return allEasings[0].easing;
    // Pick the easing with highest confidence
    allEasings.sort((a, b) => b.confidence - a.confidence);
    const winner = allEasings[0];
    const losers = allEasings.slice(1);
    conflictResolutions.push(`Easing conflict: chose "${winner.easing}" from ${winner.moduleId} (confidence ${winner.confidence.toFixed(2)}) over ${losers.map((l) => `"${l.easing}" from ${l.moduleId}`).join(", ")}`);
    return winner.easing;
  };

  const resolveDuration = (): number => {
    if (allDurations.length === 0) return 800;
    if (allDurations.length === 1) return allDurations[0].durationMs;
    // Use confidence-weighted average
    const totalWeight = allDurations.reduce((sum, d) => sum + d.confidence, 0);
    const avg = Math.round(allDurations.reduce((sum, d) => sum + d.durationMs * d.confidence, 0) / totalWeight);
    conflictResolutions.push(`Duration conflict: averaged ${allDurations.map((d) => `${d.durationMs}ms (${d.moduleId})`).join(", ")} → ${avg}ms`);
    return avg;
  };

  const resolveIntensity = (): number => {
    if (allIntensities.length === 0) return 1.0;
    if (allIntensities.length === 1) return allIntensities[0].intensity;
    const totalWeight = allIntensities.reduce((sum, i) => sum + i.confidence, 0);
    return allIntensities.reduce((sum, i) => sum + i.intensity * i.confidence, 0) / totalWeight;
  };

  const resolvePalette = (): string[] => {
    if (allPalettes.length === 0) return ["#FFFFFF", "#1A1A1A", "#404040", "#808080"];
    // Deduplicate and take first 4
    return [...new Set(allPalettes)].slice(0, 4);
  };

  const easing = resolveEasing();
  const durationMs = resolveDuration();
  const intensity = resolveIntensity();
  const palette = resolvePalette();

  // Generate keyframes based on resolved parameters
  const keyframes = generateCollaborationKeyframes(easing, intensity);

  // Create the unified component
  const component = draft("Collaboration Result", {
    durationMs,
    easing: resolveEasingObject(easing),
    iterationCount: 1,
    keyframes,
    style: {
      _content: "",
      _tag: "div",
      width: "240px",
      height: "140px",
      backgroundColor: palette[0] ?? "#1A1A1A",
      borderRadius: "12px",
      boxShadow: `0 4px 20px ${palette[1] ?? "#404040"}40`,
    },
  });

  // Calculate overall confidence
  const overallConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

  // Build contributions
  const contributions = results.map((r) => {
    const module = COLLABORATION_MODULES.find((m) => m.id === r.moduleId);
    return {
      moduleId: r.moduleId,
      moduleName: module?.name ?? r.moduleId,
      contribution: r.notes,
      confidence: r.confidence,
    };
  });

  const summary = `Collaboration of ${results.length} module(s): ${contributions.map((c) => c.moduleName).join(", ")} → unified motion (${easing}, ${durationMs}ms, intensity ${intensity.toFixed(2)})${conflictResolutions.length > 0 ? ` with ${conflictResolutions.length} conflict(s) resolved` : ""}`;

  return {
    component,
    contributions,
    conflictResolutions,
    confidence: overallConfidence,
    summary,
  };
}

/** Generate keyframes for the collaboration result based on easing and intensity. */
function generateCollaborationKeyframes(easing: string, intensity: number): Keyframe[] {
  const i = intensity;

  // Base keyframes: fade + scale + slide
  if (easing === "bounce" || easing === "elastic") {
    return [
      { offset: 0, properties: { opacity: 0, scale: 0.3 * i, translateY: 40 * i } },
      { offset: 0.5, properties: { opacity: 1, scale: 1.1 * i, translateY: -10 * i } },
      { offset: 0.75, properties: { opacity: 1, scale: 0.95, translateY: 5 } },
      { offset: 1, properties: { opacity: 1, scale: 1, translateY: 0 } },
    ];
  }

  if (easing === "smooth" || easing === "ease-in-out") {
    return [
      { offset: 0, properties: { opacity: 0, scale: 0.9, translateY: 20 * i } },
      { offset: 1, properties: { opacity: 1, scale: 1, translateY: 0 } },
    ];
  }

  // Default
  return [
    { offset: 0, properties: { opacity: 0, scale: 0.8 * i, translateY: 30 * i } },
    { offset: 1, properties: { opacity: 1, scale: 1, translateY: 0 } },
  ];
}

// ---------------------------------------------------------------------------
// Simulated Module Execution
// ---------------------------------------------------------------------------

/**
 * Execute a collaboration plan by simulating each module's contribution.
 * In a full implementation, each module would be called with its actual
 * logic. Here we provide rule-based simulations that produce realistic
 * motion parameters.
 */
export function executeCollaboration(plan: CollaborationPlan): CollaborationResult {
  if (plan.subTasks.length === 0) {
    return mergeResults([], plan.request);
  }

  const results: SubTaskResult[] = [];

  // Execute sub-tasks in dependency order
  const executed = new Set<string>();
  const pending = [...plan.subTasks];

  while (pending.length > 0) {
    const ready = pending.filter(
      (t) => t.dependsOn.every((dep) => executed.has(dep)) || t.dependsOn.length === 0,
    );

    for (const task of ready) {
      const result = simulateModuleExecution(task);
      results.push(result);
      executed.add(task.id);
    }

    // Remove executed tasks from pending
    for (let i = pending.length - 1; i >= 0; i--) {
      if (executed.has(pending[i].id)) {
        pending.splice(i, 1);
      }
    }
  }

  return mergeResults(results, plan.request);
}

/** Simulate a single module's execution and produce motion parameters. */
function simulateModuleExecution(task: CollaborationSubTask): SubTaskResult {
  const request = typeof task.inputs.request === "string" ? task.inputs.request : "";
  const lower = request.toLowerCase();

  switch (task.moduleId) {
    case "emotion":
      return simulateEmotionModule(request, lower);
    case "physics":
      return simulatePhysicsModule(request, lower);
    case "style":
      return simulateStyleModule(request, lower);
    case "context":
      return simulateContextModule(request, lower);
    case "semantics":
      return simulateSemanticsModule(request, lower);
    case "choreography":
      return simulateChoreographyModule(request, lower);
    case "path":
      return simulatePathModule(request, lower);
    case "perception":
      return simulatePerceptionModule(request, lower);
    default:
      return {
        subTaskId: task.id,
        moduleId: task.moduleId,
        motionParams: {},
        confidence: 0.5,
        notes: `Module ${task.moduleId} produced no specific output`,
      };
  }
}

function simulateEmotionModule(request: string, lower: string): SubTaskResult {
  let easing = "ease-out";
  let durationMs = 800;
  let intensity = 1.0;
  let notes = "Emotion analysis: neutral tone detected";

  if (lower.includes("joy") || lower.includes("happy") || lower.includes("快乐")) {
    easing = "bounce";
    durationMs = 600;
    intensity = 1.3;
    notes = "Emotion: joy — bouncy, energetic, upward motion";
  } else if (lower.includes("calm") || lower.includes("peaceful") || lower.includes("平静")) {
    easing = "smooth";
    durationMs = 1500;
    intensity = 0.4;
    notes = "Emotion: calm — slow, gentle, smooth motion";
  } else if (lower.includes("anger") || lower.includes("愤怒")) {
    easing = "linear";
    durationMs = 200;
    intensity = 1.8;
    notes = "Emotion: anger — sharp, aggressive, shaking motion";
  } else if (lower.includes("fear") || lower.includes("恐惧")) {
    easing = "ease-in";
    durationMs = 800;
    intensity = 0.9;
    notes = "Emotion: fear — trembling, retreating motion";
  } else if (lower.includes("excitement") || lower.includes("兴奋")) {
    easing = "elastic";
    durationMs = 400;
    intensity = 1.6;
    notes = "Emotion: excitement — fast, elastic, expansive motion";
  }

  return {
    subTaskId: "",
    moduleId: "emotion",
    motionParams: { easing, durationMs, intensity },
    confidence: 0.85,
    notes,
  };
}

function simulatePhysicsModule(request: string, lower: string): SubTaskResult {
  let easing = "spring";
  let durationMs = 1000;
  let intensity = 1.0;
  let notes = "Physics: default spring dynamics";

  if (lower.includes("spring") || lower.includes("弹簧")) {
    easing = "spring";
    durationMs = 800;
    intensity = 1.2;
    notes = "Physics: spring — damped harmonic oscillator (stiffness 170, damping 26)";
  } else if (lower.includes("gravity") || lower.includes("drop") || lower.includes("重力")) {
    easing = "ease-in";
    durationMs = 1200;
    intensity = 1.4;
    notes = "Physics: gravity drop — acceleration with bounce restitution 0.5";
  } else if (lower.includes("pendulum") || lower.includes("swing")) {
    easing = "ease-in-out";
    durationMs = 2000;
    intensity = 0.8;
    notes = "Physics: pendulum — damped oscillation with 45° initial angle";
  }

  return {
    subTaskId: "",
    moduleId: "physics",
    motionParams: { easing, durationMs, intensity },
    confidence: 0.9,
    notes,
  };
}

function simulateStyleModule(request: string, lower: string): SubTaskResult {
  let palette = ["#FFFFFF", "#1A1A1A", "#404040", "#808080"];
  let notes = "Style: default minimal palette";

  if (lower.includes("luxury") || lower.includes("premium") || lower.includes("奢华")) {
    palette = ["#1A1A1A", "#D4AF37", "#8B7355", "#FFFFFF"];
    notes = "Style: luxury — dark with gold accents";
  } else if (lower.includes("playful") || lower.includes("fun") || lower.includes("顽皮")) {
    palette = ["#FF6B9D", "#C44569", "#F8B500", "#00D2D3"];
    notes = "Style: playful — vibrant multi-color palette";
  } else if (lower.includes("minimal") || lower.includes("clean")) {
    palette = ["#FFFFFF", "#F5F5F5", "#E0E0E0", "#1A1A1A"];
    notes = "Style: minimal — monochrome with subtle grays";
  }

  return {
    subTaskId: "",
    moduleId: "style",
    motionParams: { palette },
    confidence: 0.8,
    notes,
  };
}

function simulateContextModule(request: string, lower: string): SubTaskResult {
  let durationMs = 800;
  let intensity = 1.0;
  let notes = "Context: desktop/high-performance assumed";

  if (lower.includes("mobile") || lower.includes("手机")) {
    durationMs = 680;
    intensity = 0.85;
    notes = "Context: mobile — 15% shorter, simplified transforms";
  } else if (lower.includes("low") && lower.includes("performance")) {
    durationMs = 560;
    intensity = 0.7;
    notes = "Context: low-performance — 30% shorter, reduced intensity";
  } else if (lower.includes("night") || lower.includes("夜间")) {
    intensity = 0.7;
    notes = "Context: night — reduced intensity, warm palette shift";
  }

  return {
    subTaskId: "",
    moduleId: "context",
    motionParams: { durationMs, intensity },
    confidence: 0.75,
    notes,
  };
}

function simulateSemanticsModule(request: string, lower: string): SubTaskResult {
  let easing = "ease-out";
  let intensity = 1.0;
  let notes = "Semantics: neutral concept";

  if (lower.includes("trust") || lower.includes("信任")) {
    easing = "ease-out";
    intensity = 0.6;
    notes = "Semantics: trust — steady, reliable, slow ease-out";
  } else if (lower.includes("urgency") || lower.includes("紧急")) {
    easing = "linear";
    intensity = 1.7;
    notes = "Semantics: urgency — fast, pressing, linear";
  } else if (lower.includes("luxury") || lower.includes("奢华")) {
    easing = "cubic-bezier";
    intensity = 0.55;
    notes = "Semantics: luxury — slow, refined, deliberate";
  }

  return {
    subTaskId: "",
    moduleId: "semantics",
    motionParams: { easing, intensity },
    confidence: 0.82,
    notes,
  };
}

function simulateChoreographyModule(request: string, lower: string): SubTaskResult {
  return {
    subTaskId: "",
    moduleId: "choreography",
    motionParams: {
      keyframes: [
        { offset: 0, properties: { opacity: 0 } },
        { offset: 0.3, properties: { opacity: 0.5 } },
        { offset: 1, properties: { opacity: 1 } },
      ],
    },
    confidence: 0.88,
    notes: "Choreography: coordinated timing with 80ms stagger between components",
  };
}

function simulatePathModule(request: string, lower: string): SubTaskResult {
  let notes = "Path: default linear path";

  if (lower.includes("bezier") || lower.includes("曲线")) {
    notes = "Path: cubic bezier with S-curve";
  } else if (lower.includes("lissajous")) {
    notes = "Path: Lissajous 3:2 figure";
  } else if (lower.includes("orbit") || lower.includes("circle")) {
    notes = "Path: circular orbit with 100px radius";
  }

  return {
    subTaskId: "",
    moduleId: "path",
    motionParams: { durationMs: 2000 },
    confidence: 0.78,
    notes,
  };
}

function simulatePerceptionModule(request: string, lower: string): SubTaskResult {
  let intensity = 1.0;
  let notes = "Perception: standard cognitive load";

  if (lower.includes("attention") || lower.includes("注意力")) {
    intensity = 1.2;
    notes = "Perception: increased intensity for attention capture";
  } else if (lower.includes("subtle") || lower.includes("gentle")) {
    intensity = 0.5;
    notes = "Perception: reduced intensity for low cognitive load";
  }

  return {
    subTaskId: "",
    moduleId: "perception",
    motionParams: { intensity },
    confidence: 0.72,
    notes,
  };
}

// ---------------------------------------------------------------------------
// High-Level API
// ---------------------------------------------------------------------------

/**
 * Plan and execute a collaboration in one step.
 * This is the main entry point for the collaboration engine.
 */
export function collaborate(request: string): CollaborationResult {
  const plan = planCollaboration(request);
  return executeCollaboration(plan);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatCollaborationPlan(plan: CollaborationPlan): string {
  const lines = [
    `Collaboration Plan:`,
    `  Request: "${plan.request}"`,
    `  Pattern: ${plan.pattern}`,
    `  Modules: ${plan.modules.length}`,
    ...plan.modules.map((m) => `    - ${m.name} (${m.id}): ${m.specialty}`),
    `  Sub-tasks: ${plan.subTasks.length}`,
    ...plan.subTasks.map((t) => `    - [${t.id}] ${t.moduleId}: ${t.objective}${t.dependsOn.length > 0 ? ` (depends: ${t.dependsOn.join(", ")})` : ""}${t.parallelizable ? " [parallel]" : ""}`),
    ``,
    plan.summary,
  ];
  return lines.join("\n");
}

export function formatCollaborationResult(result: CollaborationResult): string {
  const lines = [
    `Collaboration Result:`,
    `  Confidence: ${(result.confidence * 100).toFixed(0)}%`,
    `  Contributions: ${result.contributions.length}`,
    ...result.contributions.map((c) => `    - ${c.moduleName}: ${c.contribution} (${(c.confidence * 100).toFixed(0)}%)`),
    ``,
    ...(result.conflictResolutions.length > 0
      ? [`  Conflict Resolutions:`, ...result.conflictResolutions.map((r) => `    - ${r}`), ``]
      : []),
    result.summary,
  ];
  return lines.join("\n");
}

/** List all available collaboration modules. */
export function listCollaborationModules(): CollaborationModule[] {
  return [...COLLABORATION_MODULES];
}
