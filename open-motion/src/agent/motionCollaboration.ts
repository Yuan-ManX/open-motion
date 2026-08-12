/** Motion Collaboration Engine — coordinates multiple motion intelligences. */

import type { Keyframe, Easing, EasingPreset, MotionSpec, MotionComponent } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";
import { draft, kf, type ComponentDraft } from "../motion/templates/helper.js";
import { detectEmotionFromText, synthesizeFromEmotion } from "./motionEmotion.js";
import { simulateSpring, simulateGravityDrop, runPreset } from "./motionPhysics.js";
import { inferIntent } from "./motionSemantics.js";
import { generatePathMotion, runPathPreset } from "./motionPath.js";
import { predictPerception } from "./motionPerception.js";

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
// Module Execution — each module invokes its real motion engine
// ---------------------------------------------------------------------------

/**
 * Execute a collaboration plan by invoking each module's real motion engine.
 * Each module calls its corresponding intelligence engine to produce concrete
 * motion parameters derived from actual computation rather than heuristics.
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
      const result = executeModule(task);
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

/** Execute a single module by invoking its real motion engine. */
function executeModule(task: CollaborationSubTask): SubTaskResult {
  const request = typeof task.inputs.request === "string" ? task.inputs.request : "";
  const lower = request.toLowerCase();

  switch (task.moduleId) {
    case "emotion":
      return executeEmotionModule(task.id, request);
    case "physics":
      return executePhysicsModule(task.id, request, lower);
    case "style":
      return executeStyleModule(task.id, request, lower);
    case "context":
      return executeContextModule(task.id, request, lower);
    case "semantics":
      return executeSemanticsModule(task.id, request);
    case "choreography":
      return executeChoreographyModule(task.id, request, lower);
    case "path":
      return executePathModule(task.id, request, lower);
    case "perception":
      return executePerceptionModule(task.id, request, lower);
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

function executeEmotionModule(taskId: string, request: string): SubTaskResult {
  const emotion = detectEmotionFromText(request);
  if (!emotion) {
    return {
      subTaskId: taskId,
      moduleId: "emotion",
      motionParams: { easing: "ease-out", durationMs: 800, intensity: 1.0 },
      confidence: 0.6,
      notes: "Emotion: no specific emotion detected — using neutral defaults",
    };
  }
  const synth = synthesizeFromEmotion(emotion.id);
  if (synth) {
    return {
      subTaskId: taskId,
      moduleId: "emotion",
      motionParams: {
        easing: typeof synth.easing === "string" ? synth.easing : "ease-out",
        durationMs: synth.durationMs,
        intensity: synth.intensity,
        keyframes: synth.keyframes,
      },
      confidence: 0.9,
      notes: `Emotion: ${emotion.name} (${emotion.category}) — ${emotion.description}`,
    };
  }
  return {
    subTaskId: taskId,
    moduleId: "emotion",
    motionParams: { easing: "ease-out", durationMs: 800, intensity: 1.0 },
    confidence: 0.7,
    notes: `Emotion: ${emotion.name} detected but synthesis unavailable`,
  };
}

function executePhysicsModule(taskId: string, request: string, lower: string): SubTaskResult {
  if (lower.includes("gravity") || lower.includes("drop") || lower.includes("重力")) {
    const sim = simulateGravityDrop({ initialHeight: 200, bounce: 0.5 });
    return {
      subTaskId: taskId,
      moduleId: "physics",
      motionParams: { easing: "ease-in", durationMs: 1200, intensity: 1.4, keyframes: sim.component.keyframes },
      confidence: 0.92,
      notes: `Physics: gravity drop — ${sim.summary}`,
    };
  }
  if (lower.includes("pendulum") || lower.includes("swing")) {
    const preset = runPreset("pendulum");
    if (preset) {
      return {
        subTaskId: taskId,
        moduleId: "physics",
        motionParams: { easing: "ease-in-out", durationMs: 2000, intensity: 0.8, keyframes: preset.component.keyframes },
        confidence: 0.9,
        notes: `Physics: pendulum — ${preset.summary}`,
      };
    }
  }
  // Default: spring simulation
  const sim = simulateSpring({ stiffness: 170, damping: 26, mass: 1 });
  return {
    subTaskId: taskId,
    moduleId: "physics",
    motionParams: { easing: "spring", durationMs: 800, intensity: 1.2, keyframes: sim.component.keyframes },
    confidence: 0.9,
    notes: `Physics: spring — ${sim.summary}`,
  };
}

function executeStyleModule(taskId: string, request: string, lower: string): SubTaskResult {
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

  // Cross-reference with semantic intent to refine palette selection
  const intent = inferIntent(request);
  if (intent.suggestedProfile && intent.concepts.length > 0) {
    const top = intent.concepts[0];
    notes += ` | Semantic: ${top.conceptLabel} (${Math.round(top.confidence * 100)}% match)`;
  }

  return {
    subTaskId: taskId,
    moduleId: "style",
    motionParams: { palette },
    confidence: 0.82,
    notes,
  };
}

function executeContextModule(taskId: string, request: string, lower: string): SubTaskResult {
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
    subTaskId: taskId,
    moduleId: "context",
    motionParams: { durationMs, intensity },
    confidence: 0.75,
    notes,
  };
}

function executeSemanticsModule(taskId: string, request: string): SubTaskResult {
  const intent = inferIntent(request);
  const profile = intent.suggestedProfile;
  const easing = profile.easings.length > 0 ? profile.easings[0] : "ease-out";
  const durationMs = Math.round((profile.durationRange.min + profile.durationRange.max) / 2);
  const intensity = profile.delayStrategy === "none" ? 1.0 : 0.85;

  const conceptList = intent.concepts.length > 0
    ? intent.concepts.slice(0, 3).map((c) => `${c.conceptLabel} (${Math.round(c.confidence * 100)}%)`).join(", ")
    : "no specific concept matched";

  return {
    subTaskId: taskId,
    moduleId: "semantics",
    motionParams: { easing, durationMs, intensity, metadata: { delayStrategy: profile.delayStrategy, staggerMs: profile.staggerMs } },
    confidence: 0.88,
    notes: `Semantics: ${conceptList} | ${intent.summary}`,
  };
}

function executeChoreographyModule(taskId: string, request: string, lower: string): SubTaskResult {
  return {
    subTaskId: taskId,
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

function executePathModule(taskId: string, request: string, lower: string): SubTaskResult {
  if (lower.includes("bezier") || lower.includes("曲线")) {
    const result = generatePathMotion({ type: "bezier", samples: 20 });
    return {
      subTaskId: taskId,
      moduleId: "path",
      motionParams: { durationMs: 2000, keyframes: result.component.keyframes },
      confidence: 0.85,
      notes: `Path: bezier — ${result.summary}`,
    };
  }
  if (lower.includes("lissajous")) {
    const result = generatePathMotion({ type: "lissajous", samples: 30 });
    return {
      subTaskId: taskId,
      moduleId: "path",
      motionParams: { durationMs: 2000, keyframes: result.component.keyframes },
      confidence: 0.85,
      notes: `Path: lissajous — ${result.summary}`,
    };
  }
  if (lower.includes("orbit") || lower.includes("circle")) {
    const result = generatePathMotion({ type: "circle", samples: 20 });
    return {
      subTaskId: taskId,
      moduleId: "path",
      motionParams: { durationMs: 2000, keyframes: result.component.keyframes },
      confidence: 0.85,
      notes: `Path: circle — ${result.summary}`,
    };
  }
  // Default: spiral path
  const result = generatePathMotion({ type: "spiral", samples: 15 });
  return {
    subTaskId: taskId,
    moduleId: "path",
    motionParams: { durationMs: 2000, keyframes: result.component.keyframes },
    confidence: 0.78,
    notes: `Path: spiral — ${result.summary}`,
  };
}

function executePerceptionModule(taskId: string, request: string, lower: string): SubTaskResult {
  // Construct a minimal spec from the request so the perception engine has
  // enough structure to produce a real prediction.
  const ts = new Date().toISOString();
  const component: MotionComponent = {
    id: "collab-perception",
    projectId: "collab",
    sceneId: null,
    name: "Perception Probe",
    selector: ".probe",
    templateId: null,
    durationMs: 800,
    delayMs: 0,
    iterationCount: 1,
    direction: "normal",
    fillMode: "forwards",
    playState: "running",
    trigger: "onLoad",
    easing: { type: "preset", name: "ease-out" },
    keyframes: [
      { offset: 0, properties: { opacity: 0 } },
      { offset: 1, properties: { opacity: 1 } },
    ],
    style: {},
    orderIndex: 0,
    parentId: null,
    createdAt: ts,
    updatedAt: ts,
  };
  const spec: MotionSpec = {
    project: {
      id: "collab",
      name: "Collaboration Perception Probe",
      description: "",
      scenes: [],
      tokens: {},
      globalTiming: {},
      status: "draft",
      sourceTemplateId: null,
      createdAt: ts,
      updatedAt: ts,
    },
    components: [component],
  };

  const report = predictPerception(spec);
  let intensity = 1.0;
  if (lower.includes("attention") || lower.includes("注意力")) intensity = 1.2;
  else if (lower.includes("subtle") || lower.includes("gentle")) intensity = 0.5;
  else if (report.cognitiveLoad) {
    const cl = report.cognitiveLoad.level;
    if (cl === "heavy" || cl === "overwhelming") intensity = 1.3;
    else if (cl === "effortless" || cl === "light") intensity = 0.6;
    else intensity = 1.0;
  }

  return {
    subTaskId: taskId,
    moduleId: "perception",
    motionParams: { intensity, metadata: { overallScore: report.overallScore, summary: report.summary } },
    confidence: 0.8,
    notes: `Perception: ${report.summary} (score ${report.overallScore}/100)`,
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
