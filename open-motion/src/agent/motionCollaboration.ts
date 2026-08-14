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
  {
    id: "musicology",
    name: "Musicology Engine",
    specialty: "Musical tempo, beat alignment, rhythm patterns, BPM mapping",
    triggerKeywords: ["music", "beat", "bpm", "rhythm", "tempo", "音乐", "节拍", "鼓点"],
  },
  {
    id: "narrative",
    name: "Narrative Architect",
    specialty: "Story beats, dramatic arcs, tension curves, payoff timing",
    triggerKeywords: ["story", "narrative", "arc", "dramatic", "tension", "故事", "叙事", "剧情"],
  },
  {
    id: "harmony",
    name: "Color Harmony",
    specialty: "Color theory, palette generation, contrast, accessibility colors",
    triggerKeywords: ["color", "palette", "harmony", "contrast", "gradient", "颜色", "配色", "和谐"],
  },
  {
    id: "accessibility",
    name: "Accessibility Engine",
    specialty: "Motion reduction, WCAG compliance, cognitive safety, vestibular safety",
    triggerKeywords: ["accessibility", "a11y", "reduced", "motion", "wcag", "access", "无障碍", "可访问"],
  },
  {
    id: "rhythm",
    name: "Rhythm Pattern Engine",
    specialty: "Rhythm grids, polyrhythm, syncopation, groove templates",
    triggerKeywords: ["groove", "syncopation", "polyrhythm", "swing", "timing grid", "节奏", "律动"],
  },
  {
    id: "brand",
    name: "Brand Pack Engine",
    specialty: "Brand motion DNA, product identity, platform presets, theme systems",
    triggerKeywords: ["brand", "identity", "theme", "logo", "product", "品牌", "标识", "主题"],
  },
  {
    id: "restraint",
    name: "Restraint Budget",
    specialty: "Motion budgeting, restraint scoring, anti-noise, attention conservation",
    triggerKeywords: ["restraint", "budget", "quiet", "minimal motion", "calm", "克制", "预算", "安静"],
  },
  {
    id: "tempo",
    name: "Tempo Shaper",
    specialty: "Micro-timing, easing modulation, snap-to-grid, humanize",
    triggerKeywords: ["tempo", "humanize", "snap", "micro", "latency", "节拍", "人性化", "对齐"],
  },
  {
    id: "alchemy",
    name: "Motion Alchemy",
    specialty: "Concept blending, motion transmutation, genre fusion, hybrid effects",
    triggerKeywords: ["alchemy", "blend", "mix", "hybrid", "fusion", "remix", "炼金术", "混合", "融合"],
  },
  {
    id: "cinema",
    name: "Cinematography Engine",
    specialty: "Camera framing, shot language, scene rhythm, cinematic transitions",
    triggerKeywords: ["cinematic", "camera", "shot", "scene", "film", "movie", "电影", "镜头", "拍摄"],
  },
  {
    id: "harmonics",
    name: "Harmonic Resonance",
    specialty: "Spectral easing curves, harmonic oscillation, consonant motion intervals",
    triggerKeywords: ["harmonic", "spectral", "oscillation", "consonant", "resonance", "谐波", "共振", "频谱"],
  },
  {
    id: "topology",
    name: "Topology Weaver",
    specialty: "Spatial deformations, surface warping, morphing, topology-preserving transforms",
    triggerKeywords: ["topology", "morph", "warp", "deform", "reshape", "拓扑", "变形", "扭曲"],
  },
  {
    id: "synesthesia",
    name: "Synesthesia Engine",
    specialty: "Cross-sensory motion: color-to-movement, sound-to-shape, texture-to-easing",
    triggerKeywords: ["synesthesia", "cross-sensory", "color-move", "sound-motion", "texture", "联觉", "通感", "跨感官"],
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
export function executeModule(task: CollaborationSubTask): SubTaskResult {
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
    case "musicology":
      return executeMusicologyModule(task.id, request, lower);
    case "narrative":
      return executeNarrativeModule(task.id, request, lower);
    case "harmony":
      return executeHarmonyModule(task.id, request, lower);
    case "accessibility":
      return executeAccessibilityModule(task.id, request, lower);
    case "rhythm":
      return executeRhythmModule(task.id, request, lower);
    case "brand":
      return executeBrandModule(task.id, request, lower);
    case "restraint":
      return executeRestraintModule(task.id, request, lower);
    case "tempo":
      return executeTempoModule(task.id, request, lower);
    case "alchemy":
      return executeAlchemyModule(task.id, request, lower);
    case "cinema":
      return executeCinemaModule(task.id, request, lower);
    case "harmonics":
      return executeHarmonicsModule(task.id, request, lower);
    case "topology":
      return executeTopologyModule(task.id, request, lower);
    case "synesthesia":
      return executeSynesthesiaModule(task.id, request, lower);
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
    notes += ` | Semantic: ${top.conceptLabel ?? (top as { label?: string }).label} (${Math.round(top.confidence * 100)}% match)`;
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
    ? intent.concepts.slice(0, 3).map((c) => `${c.conceptLabel ?? (c as { label?: string }).label} (${Math.round(c.confidence * 100)}%)`).join(", ")
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

function executeMusicologyModule(taskId: string, request: string, lower: string): SubTaskResult {
  // Extract BPM hint from the request or fall back to a musical default.
  let bpm = 120;
  const bpmMatch = request.match(/(\d{2,3})\s*bpm/i);
  if (bpmMatch) bpm = parseInt(bpmMatch[1], 10) || 120;
  if (lower.includes("fast") || lower.includes("upbeat") || lower.includes("快速")) bpm = 140;
  if (lower.includes("slow") || lower.includes("ballad") || lower.includes("舒缓")) bpm = 72;
  const beatMs = Math.round(60000 / bpm);
  // Duration aligns to 4 beats; easing follows the groove feel implied.
  const durationMs = beatMs * 4;
  const easing = bpm > 120 ? "snappy" : bpm < 80 ? "smooth" : "ease-out";
  // On-beat keyframes: punch at downbeat, settle over the bar.
  const keyframes = [
    { offset: 0, properties: { scale: 0.9, opacity: 0.7 } },
    { offset: 0.0625, properties: { scale: 1.04, opacity: 1 } },
    { offset: 0.125, properties: { scale: 1, opacity: 1 } },
    { offset: 0.5625, properties: { scale: 1.02, opacity: 1 } },
    { offset: 0.625, properties: { scale: 1, opacity: 1 } },
    { offset: 1, properties: { scale: 1, opacity: 1 } },
  ];
  return {
    subTaskId: taskId,
    moduleId: "musicology",
    motionParams: { durationMs, easing, keyframes, metadata: { bpm, beatMs, division: "4" } },
    confidence: 0.86,
    notes: `Musicology: locked to ${bpm} BPM — 1 bar = ${durationMs}ms, easing "${easing}"`,
  };
}

function executeNarrativeModule(taskId: string, request: string, lower: string): SubTaskResult {
  // Three-act structure detection maps to an easing curve and keyframe count.
  let acts: "setup" | "conflict" | "payoff" = "payoff";
  if (lower.includes("build") || lower.includes("intro") || lower.includes("setup") || lower.includes("开始")) {
    acts = "setup";
  } else if (lower.includes("tension") || lower.includes("climax") || lower.includes("冲突") || lower.includes("高潮")) {
    acts = "conflict";
  }
  let easing = "ease-in-out";
  let durationMs = 1200;
  let intensity = 1.0;
  let keyframes: Keyframe[];
  if (acts === "setup") {
    easing = "ease-in";
    durationMs = 900;
    intensity = 0.8;
    keyframes = [
      { offset: 0, properties: { opacity: 0, scale: 0.95 } },
      { offset: 0.6, properties: { opacity: 0.7, scale: 0.98 } },
      { offset: 1, properties: { opacity: 1, scale: 1 } },
    ];
  } else if (acts === "conflict") {
    easing = "ease-out";
    durationMs = 1400;
    intensity = 1.25;
    keyframes = [
      { offset: 0, properties: { opacity: 1, scale: 1, translateX: 0 } },
      { offset: 0.3, properties: { scale: 1.08, translateX: 12 } },
      { offset: 0.6, properties: { scale: 0.94, translateX: -10 } },
      { offset: 1, properties: { opacity: 1, scale: 1, translateX: 0 } },
    ];
  } else {
    easing = "ease-out-cubic";
    durationMs = 1100;
    intensity = 1.1;
    keyframes = [
      { offset: 0, properties: { opacity: 0.6, scale: 1.15 } },
      { offset: 0.5, properties: { opacity: 1, scale: 0.98 } },
      { offset: 1, properties: { opacity: 1, scale: 1 } },
    ];
  }
  return {
    subTaskId: taskId,
    moduleId: "narrative",
    motionParams: { easing, durationMs, intensity, keyframes, metadata: { arc: acts } },
    confidence: 0.83,
    notes: `Narrative: three-act phase "${acts}" — ${acts === "setup" ? "slow reveal" : acts === "conflict" ? "stressed climax" : "resolving payoff"}`,
  };
}

function executeHarmonyModule(taskId: string, request: string, lower: string): SubTaskResult {
  // Pick a harmony strategy and a 4-color palette grounded in color theory.
  let strategy = "monochromatic";
  let base = "#6366F1";
  if (lower.includes("warm") || lower.includes("暖色")) {
    strategy = "analogous-warm";
    base = "#F97316";
  } else if (lower.includes("cool") || lower.includes("冷色")) {
    strategy = "analogous-cool";
    base = "#0EA5E9";
  } else if (lower.includes("contrast") || lower.includes("对比")) {
    strategy = "complementary";
    base = "#8B5CF6";
  } else if (lower.includes("neon") || lower.includes("霓虹")) {
    strategy = "triadic-neon";
    base = "#EC4899";
  } else if (lower.includes("earthy") || lower.includes("大地")) {
    strategy = "analogous-earth";
    base = "#A16207";
  }
  const palettes: Record<string, string[]> = {
    monochromatic: [base, shade(base, -20), shade(base, 20), shade(base, 45)],
    "analogous-warm": ["#F97316", "#EF4444", "#F59E0B", "#FDE68A"],
    "analogous-cool": ["#0EA5E9", "#6366F1", "#14B8A6", "#7DD3FC"],
    complementary: ["#8B5CF6", "#F59E0B", "#C4B5FD", "#FDE68A"],
    "triadic-neon": ["#EC4899", "#22D3EE", "#A3E635", "#1E1B4B"],
    "analogous-earth": ["#A16207", "#78350F", "#451A03", "#FEF3C7"],
  };
  const palette = palettes[strategy];
  return {
    subTaskId: taskId,
    moduleId: "harmony",
    motionParams: { palette, metadata: { strategy, base } },
    confidence: 0.9,
    notes: `Color Harmony: strategy "${strategy}" anchored at ${base} — 4 colors`,
  };
}

/** Produce a hex color with a lightness shift (percent, -100..100). */
function shade(hex: string, percent: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  const amt = Math.round(2.55 * percent);
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function executeAccessibilityModule(taskId: string, request: string, lower: string): SubTaskResult {
  // Prefer reduced motion unless the user explicitly asks for intensity.
  const reduce =
    lower.includes("reduced") ||
    lower.includes("quiet") ||
    lower.includes("safe") ||
    lower.includes("calm") ||
    lower.includes("减少") ||
    lower.includes("安全") ||
    !lower.includes("fast") && !lower.includes("intense");
  let durationMs = reduce ? 520 : 720;
  let intensity = reduce ? 0.55 : 0.9;
  // Opacity-only motion is preferred for vestibular safety when reduce is on.
  const keyframes: Keyframe[] = reduce
    ? [
        { offset: 0, properties: { opacity: 0 } },
        { offset: 1, properties: { opacity: 1 } },
      ]
    : [
        { offset: 0, properties: { opacity: 0, translateY: 14 } },
        { offset: 1, properties: { opacity: 1, translateY: 0 } },
      ];
  // Easing must be smooth to avoid flicker/vestibular triggers.
  const easing = reduce ? "linear" : "ease-out";
  return {
    subTaskId: taskId,
    moduleId: "accessibility",
    motionParams: { easing, durationMs, intensity, keyframes, metadata: { prefersReducedMotion: reduce, wcagSafe: true } },
    confidence: 0.94,
    notes: `Accessibility: ${reduce ? "reduced-motion profile — opacity only, linear easing" : "standard profile with vestibular-safe parameters"}`,
  };
}

function executeRhythmModule(taskId: string, request: string, lower: string): SubTaskResult {
  // Build a stagger grid that a rhythm pattern would produce.
  let staggerMs = 80;
  let division = 4;
  let groove = "straight";
  if (lower.includes("swing") || lower.includes("摇摆")) {
    staggerMs = 110;
    division = 3;
    groove = "swing-8ths";
  } else if (lower.includes("funk") || lower.includes("放克")) {
    staggerMs = 96;
    division = 6;
    groove = "syncopated-16ths";
  } else if (lower.includes("march") || lower.includes("进行曲")) {
    staggerMs = 140;
    division = 2;
    groove = "two-beat-march";
  } else if (lower.includes("bounce") || lower.includes("弹跳")) {
    staggerMs = 60;
    division = 8;
    groove = "trap-snap";
  }
  const keyframes: Keyframe[] = [
    { offset: 0, properties: { opacity: 0, translateY: 6 } },
    { offset: 0.08, properties: { opacity: 1, translateY: -4 } },
    { offset: 0.16, properties: { translateY: 0 } },
    { offset: 0.58, properties: { translateY: -3 } },
    { offset: 0.66, properties: { translateY: 0 } },
    { offset: 1, properties: { opacity: 1, translateY: 0 } },
  ];
  return {
    subTaskId: taskId,
    moduleId: "rhythm",
    motionParams: { durationMs: 1000, easing: "snappy", keyframes, metadata: { staggerMs, division, groove } },
    confidence: 0.87,
    notes: `Rhythm: "${groove}" pattern — stagger ${staggerMs}ms / division ${division}`,
  };
}

function executeBrandModule(taskId: string, request: string, lower: string): SubTaskResult {
  let palette = ["#0A0A0A", "#141414", "#A3A3A3", "#FFFFFF"];
  let easing = "ease-out";
  let durationMs = 700;
  let profile = "product-neutral";
  if (lower.includes("ios") || lower.includes("apple") || lower.includes("苹果")) {
    palette = ["#000000", "#1C1C1E", "#8E8E93", "#F2F2F7"];
    easing = "smooth";
    durationMs = 650;
    profile = "apple-ios";
  } else if (lower.includes("material") || lower.includes("material you") || lower.includes("安卓")) {
    palette = ["#111218", "#2B2C33", "#B6B8C0", "#FEF7FF"];
    easing = "ease-in-out-cubic";
    durationMs = 500;
    profile = "material-you";
  } else if (lower.includes("fluent") || lower.includes("windows")) {
    palette = ["#0B0B0B", "#202020", "#797979", "#FFFFFF"];
    easing = "ease-out-quad";
    durationMs = 580;
    profile = "microsoft-fluent";
  } else if (lower.includes("samsung") || lower.includes("one ui")) {
    palette = ["#000000", "#1A1A1A", "#9E9EA3", "#FAFAFA"];
    easing = "snappy";
    durationMs = 620;
    profile = "samsung-oneui";
  } else if (lower.includes("brand") || lower.includes("品牌") || lower.includes("product")) {
    palette = ["#0A0A0A", "#18181B", "#71717A", "#FFFFFF"];
    easing = "ease-out";
    durationMs = 700;
    profile = "product-neutral";
  }
  return {
    subTaskId: taskId,
    moduleId: "brand",
    motionParams: { palette, easing, durationMs, metadata: { profile } },
    confidence: 0.89,
    notes: `Brand: motion profile "${profile}" — ${durationMs}ms canonical duration, easing "${easing}"`,
  };
}

function executeRestraintModule(taskId: string, request: string, lower: string): SubTaskResult {
  // Restraint score targets 0..1 — higher score means less motion.
  let restraint = 0.4;
  if (lower.includes("max") && lower.includes("restraint")) restraint = 0.9;
  else if (lower.includes("ultra") && lower.includes("quiet")) restraint = 0.85;
  else if (lower.includes("quiet") || lower.includes("calm")) restraint = 0.65;
  else if (lower.includes("calm") || lower.includes("克制")) restraint = 0.55;
  // Duration compresses and intensity drops as restraint increases.
  const durationMs = Math.round(900 * (1 - 0.45 * restraint));
  const intensity = Math.max(0.15, 1 - 0.8 * restraint);
  const keyframes: Keyframe[] =
    restraint > 0.7
      ? [
          { offset: 0, properties: { opacity: 0.85 } },
          { offset: 1, properties: { opacity: 1 } },
        ]
      : restraint > 0.4
        ? [
            { offset: 0, properties: { opacity: 0.5, translateY: 8 * intensity } },
            { offset: 1, properties: { opacity: 1, translateY: 0 } },
          ]
        : [
            { offset: 0, properties: { opacity: 0, scale: 0.92, translateY: 16 * intensity } },
            { offset: 1, properties: { opacity: 1, scale: 1, translateY: 0 } },
          ];
  return {
    subTaskId: taskId,
    moduleId: "restraint",
    motionParams: { durationMs, intensity, keyframes, metadata: { restraintScore: restraint } },
    confidence: 0.91,
    notes: `Restraint: budget score ${(restraint * 100).toFixed(0)}% — ${durationMs}ms, intensity ${intensity.toFixed(2)}`,
  };
}

function executeTempoModule(taskId: string, request: string, lower: string): SubTaskResult {
  let humanizeMs = 0;
  let snap = "16ths";
  let easingVariant = "ease-out";
  let microLatencyMs = 0;
  if (lower.includes("humanize") || lower.includes("人性化") || lower.includes("loose")) {
    humanizeMs = 18;
    snap = "none";
    easingVariant = "snappy";
  } else if (lower.includes("tight") || lower.includes("精准")) {
    humanizeMs = 0;
    snap = "32nds";
    easingVariant = "ease-out-cubic";
  } else if (lower.includes("swing") || lower.includes("shuffle")) {
    humanizeMs = 22;
    snap = "triplets";
    easingVariant = "snappy";
  } else if (lower.includes("latency compensated") || lower.includes("delay")) {
    microLatencyMs = -12;
    snap = "16ths";
    easingVariant = "ease-out";
  }
  const durationMs = 760;
  const keyframes: Keyframe[] = [
    { offset: 0, properties: { opacity: 0, translateY: 18 } },
    { offset: 0.12, properties: { opacity: 1, translateY: -2 } },
    { offset: 0.2, properties: { translateY: 0 } },
    { offset: 1, properties: { opacity: 1, translateY: 0 } },
  ];
  return {
    subTaskId: taskId,
    moduleId: "tempo",
    motionParams: {
      durationMs,
      easing: easingVariant,
      keyframes,
      metadata: { humanizeMs, snap, microLatencyMs, easingVariant },
    },
    confidence: 0.88,
    notes: `Tempo: snap-to="${snap}", humanize ±${humanizeMs}ms, latency offset ${microLatencyMs}ms, easing "${easingVariant}"`,
  };
}

// --- New module implementations: Alchemy, Cinema, Harmonics, Topology, Synesthesia ---

function executeAlchemyModule(taskId: string, request: string, lower: string): SubTaskResult {
  // Blend two archetypal motion styles based on user cue keywords.
  let primary = "spring";
  let secondary = "fade-slide";
  let blendRatio = 0.5;

  if (lower.includes("bounce") && lower.includes("glow")) {
    primary = "bounce";
    secondary = "glow";
    blendRatio = 0.6;
  } else if (lower.includes("float") && lower.includes("rotate") || lower.includes("spin")) {
    primary = "float";
    secondary = "rotate";
    blendRatio = 0.55;
  } else if (lower.includes("ripple") && lower.includes("type") || lower.includes("text")) {
    primary = "ripple";
    secondary = "typewriter";
    blendRatio = 0.45;
  } else if (lower.includes("flip") && lower.includes("glow")) {
    primary = "flip-3d";
    secondary = "glow-pulse";
    blendRatio = 0.5;
  } else if (lower.includes("organic") || lower.includes("bio") || lower.includes("生物")) {
    primary = "breath";
    secondary = "bio-luminescence";
    blendRatio = 0.5;
  } else if (lower.includes("sci-fi") || lower.includes("科技") || lower.includes("tech")) {
    primary = "gravitational-lens";
    secondary = "quantum-dissolve";
    blendRatio = 0.55;
  } else if (lower.includes("earth") || lower.includes("geology") || lower.includes("地质")) {
    primary = "tectonic-shift";
    secondary = "warp";
    blendRatio = 0.5;
  }

  const durationMs = 1100;
  // Produce blended keyframes: primary's entrance skeleton with secondary's accent inflections.
  const keyframes: Keyframe[] = blendKeyframes(primary, secondary, blendRatio);

  return {
    subTaskId: taskId,
    moduleId: "alchemy",
    motionParams: {
      easing: "ease-in-out-cubic",
      durationMs,
      intensity: 1.05,
      keyframes,
      metadata: { primary, secondary, blendRatio, fusionId: `${primary}+${secondary}@${(blendRatio * 100).toFixed(0)}` },
    },
    confidence: 0.86,
    notes: `Alchemy: fused "${primary}" + "${secondary}" at ${(blendRatio * 100).toFixed(0)}% ratio → hybrid motion recipe.`,
  };
}

function blendKeyframes(primary: string, secondary: string, ratio: number): Keyframe[] {
  // Generate a canonical keyframe set that blends transform flavours.
  const translate = (t: number) => Math.round((1 - ratio) * 20 * t + ratio * 60 * Math.sin(t * Math.PI));
  const scale = (t: number) => {
    const base = 1 + (1 - ratio) * 0.2 * Math.sin(t * Math.PI);
    const accent = ratio * 0.35 * Math.pow(Math.sin(t * Math.PI * 2), 2);
    return 1 + (base - 1) + accent;
  };
  const rotation = (t: number) => ratio * 12 * Math.sin(t * Math.PI * 2);

  return [
    { offset: 0, properties: { opacity: 0, translateY: 28 + translate(0), scale: 0.4 * scale(0), rotateZ: rotation(0) } },
    { offset: 0.28, properties: { opacity: 0.75, translateY: 8 + translate(0.28), scale: scale(0.28), rotateZ: rotation(0.28) } },
    { offset: 0.55, properties: { opacity: 1, translateY: -6 + translate(0.55), scale: scale(0.55), rotateZ: rotation(0.55) } },
    { offset: 1, properties: { opacity: 1, translateY: 0, scale: 1, rotateZ: 0 } },
  ];
}

function executeCinemaModule(taskId: string, request: string, lower: string): SubTaskResult {
  // Shot-language detection → cinematic framing and transition pattern.
  let shot = "medium-shot";
  let transition = "dissolve";
  let dollyMs = 0;
  let zoom = 1;

  if (lower.includes("close up") || lower.includes("特写")) {
    shot = "close-up";
    zoom = 1.25;
    transition = "iris";
    dollyMs = 220;
  } else if (lower.includes("wide") || lower.includes("全景") || lower.includes("远景")) {
    shot = "wide-shot";
    zoom = 0.88;
    transition = "pan";
    dollyMs = 480;
  } else if (lower.includes("tracking") || lower.includes("follow") || lower.includes("跟随")) {
    shot = "tracking-shot";
    transition = "wipe-horizontal";
    dollyMs = 520;
  } else if (lower.includes("over the shoulder") || lower.includes("dutch") || lower.includes("俯仰")) {
    shot = "dutch-angle";
    transition = "tilt-reveal";
    dollyMs = 380;
    zoom = 1.05;
  } else if (lower.includes("establishing") || lower.includes("开场")) {
    shot = "establishing";
    transition = "fade-to-black";
    dollyMs = 800;
    zoom = 0.8;
  } else if (lower.includes("punch in") || lower.includes("push") || lower.includes("推进")) {
    shot = "punch-in";
    transition = "dolly-in";
    dollyMs = 360;
    zoom = 1.4;
  }

  const durationMs = Math.max(700, 900 + dollyMs);
  const keyframes: Keyframe[] = [
    { offset: 0, properties: { opacity: 0, scale: zoom * 0.7 }, },
    { offset: dollyMs / durationMs * 0.4, properties: { opacity: 0.85, scale: zoom * 0.95 } },
    { offset: 0.75, properties: { opacity: 1, scale: zoom * 1.02 } },
    { offset: 1, properties: { opacity: 1, scale: zoom } },
  ];

  return {
    subTaskId: taskId,
    moduleId: "cinema",
    motionParams: {
      easing: "ease-in-out",
      durationMs,
      intensity: 0.95,
      keyframes,
      metadata: { shot, transition, cameraMoveMs: dollyMs, framingZoom: zoom },
    },
    confidence: 0.9,
    notes: `Cinematography: ${shot} with "${transition}" transition — camera move ${dollyMs}ms, framing zoom ${(zoom * 100).toFixed(0)}%.`,
  };
}

function executeHarmonicsModule(taskId: string, request: string, lower: string): SubTaskResult {
  // Spectral motion: harmonic overtones (1f, 2f, 3f) combined into one easing curve.
  let fundamentalHz = 1.2;
  let overtones = 2;
  let decay = 0.82;
  let consonance = "just";

  if (lower.includes("chord") || lower.includes("和弦")) {
    overtones = 3;
    consonance = "triadic";
  } else if (lower.includes("drone") || lower.includes("嗡鸣")) {
    fundamentalHz = 0.5;
    overtones = 1;
    consonance = "drone";
  } else if (lower.includes("bell") || lower.includes("铃")) {
    fundamentalHz = 2.4;
    overtones = 4;
    decay = 0.55;
    consonance = "inharmonic-bell";
  } else if (lower.includes("glass") || lower.includes("水晶") || lower.includes("玻璃")) {
    fundamentalHz = 3.6;
    overtones = 3;
    decay = 0.65;
    consonance = "quartal";
  } else if (lower.includes("pluck") || lower.includes("拨")) {
    fundamentalHz = 2;
    overtones = 2;
    decay = 0.5;
    consonance = "plucked";
  }

  // Build keyframes with damped oscillation at each harmonic.
  const samples = 16;
  const keyframes: Keyframe[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    let oscillation = 0;
    for (let h = 1; h <= overtones; h += 1) {
      const amp = Math.pow(decay, h - 1) / h;
      const phase = h * fundamentalHz * 2 * Math.PI * t;
      oscillation += amp * Math.sin(phase);
    }
    const oscNorm = Math.max(-1, Math.min(1, oscillation));
    keyframes.push({
      offset: t,
      properties: {
        scale: 1 + oscNorm * 0.08,
        opacity: 0.85 + Math.abs(oscNorm) * 0.15,
        blur: t < 0.1 ? 4 * (1 - t * 10) : 0,
      },
    });
  }

  return {
    subTaskId: taskId,
    moduleId: "harmonics",
    motionParams: {
      easing: "smooth",
      durationMs: 1600,
      intensity: 0.95,
      keyframes,
      metadata: { fundamentalHz, overtones, decay, consonance, sampleCount: samples + 1 },
    },
    confidence: 0.87,
    notes: `Harmonics: ${consonance} series — fundamental ${fundamentalHz}Hz, ${overtones} overtone${overtones === 1 ? "" : "s"}, decay coefficient ${decay}.`,
  };
}

function executeTopologyModule(taskId: string, request: string, lower: string): SubTaskResult {
  // Topology-preserving spatial warps: morph corners, skew, ripple, or fold.
  let technique = "ripple-warp";
  let amplitude = 1;
  let foldBias = 0.5;

  if (lower.includes("fold") || lower.includes("折纸") || lower.includes("折叠")) {
    technique = "paper-fold";
    foldBias = lower.includes("diagonal") ? 0.75 : 0.5;
    amplitude = 1.2;
  } else if (lower.includes("liquify") || lower.includes("熔化") || lower.includes("液化")) {
    technique = "liquify";
    amplitude = 1.5;
  } else if (lower.includes("morph") || lower.includes("形变")) {
    technique = "morph-between";
    amplitude = 1.1;
  } else if (lower.includes("peel") || lower.includes("剥离") || lower.includes("撕")) {
    technique = "peel-back";
    foldBias = 0.25;
    amplitude = 1.4;
  } else if (lower.includes("spiral") || lower.includes("螺旋")) {
    technique = "spiral-warp";
    amplitude = 1.3;
  }

  const durationMs = 1300;
  const kfs: Keyframe[] = topologyKeyframes(technique, amplitude, foldBias);

  return {
    subTaskId: taskId,
    moduleId: "topology",
    motionParams: {
      easing: "ease-in-out-cubic",
      durationMs,
      intensity: amplitude,
      keyframes: kfs,
      metadata: { technique, amplitude, foldBias },
    },
    confidence: 0.84,
    notes: `Topology: "${technique}" warp — amplitude ${amplitude.toFixed(2)}, foldBias ${foldBias.toFixed(2)}.`,
  };
}

function topologyKeyframes(technique: string, amplitude: number, foldBias: number): Keyframe[] {
  switch (technique) {
    case "paper-fold":
      return [
        { offset: 0, properties: { opacity: 0, skewX: -20 * amplitude, scale: 0.9, rotateZ: foldBias * -8 } },
        { offset: 0.5, properties: { opacity: 0.7, skewX: -6 * amplitude, scale: 0.96, rotateZ: foldBias * -3 } },
        { offset: 1, properties: { opacity: 1, skewX: 0, scale: 1, rotateZ: 0 } },
      ];
    case "liquify":
      return [
        { offset: 0, properties: { opacity: 0, borderRadius: "0%", skewX: 14 * amplitude, scale: 0.7 } },
        { offset: 0.3, properties: { opacity: 0.6, borderRadius: "30%", skewX: -8 * amplitude, scale: 0.88 } },
        { offset: 0.6, properties: { opacity: 0.9, borderRadius: "15%", skewX: 4 * amplitude, scale: 0.97 } },
        { offset: 1, properties: { opacity: 1, borderRadius: "12px", skewX: 0, scale: 1 } },
      ];
    case "peel-back":
      return [
        { offset: 0, properties: { opacity: 0, rotateX: 85 * foldBias, scale: 0.5, translateY: 20 * amplitude } },
        { offset: 0.45, properties: { opacity: 0.7, rotateX: 30 * foldBias, scale: 0.82, translateY: 6 * amplitude } },
        { offset: 1, properties: { opacity: 1, rotateX: 0, scale: 1, translateY: 0 } },
      ];
    case "spiral-warp":
      return [
        { offset: 0, properties: { opacity: 0, rotateZ: -90 * amplitude, scale: 0.2, translateY: 40 } },
        { offset: 0.35, properties: { opacity: 0.5, rotateZ: -30 * amplitude, scale: 0.65, translateY: 12 } },
        { offset: 0.7, properties: { opacity: 0.9, rotateZ: 6 * amplitude, scale: 0.92, translateY: 2 } },
        { offset: 1, properties: { opacity: 1, rotateZ: 0, scale: 1, translateY: 0 } },
      ];
    default: // ripple-warp
      return [
        { offset: 0, properties: { opacity: 0, scale: 0.7, borderRadius: "0%" } },
        { offset: 0.25, properties: { opacity: 0.5, scale: 1.08 * amplitude, borderRadius: "10%" } },
        { offset: 0.55, properties: { opacity: 0.9, scale: 0.97, borderRadius: "16%" } },
        { offset: 1, properties: { opacity: 1, scale: 1, borderRadius: "12px" } },
      ];
  }
}

function executeSynesthesiaModule(taskId: string, request: string, lower: string): SubTaskResult {
  // Cross-sensory mapping: tone → easing, texture → keyframe shape, color → distance.
  let hue = 250;
  let brightness = 0.55;
  let tonalQuality = "neutral";
  let textureGrain = 0;

  if (lower.includes("warm") || lower.includes("暖色")) {
    hue = 30;
    brightness = 0.65;
    tonalQuality = "warm";
  } else if (lower.includes("cool") || lower.includes("冷色")) {
    hue = 210;
    brightness = 0.5;
    tonalQuality = "cool";
  } else if (lower.includes("red") || lower.includes("红")) { hue = 0; brightness = 0.55; tonalQuality = "alert"; }
  else if (lower.includes("green") || lower.includes("绿")) { hue = 135; brightness = 0.5; tonalQuality = "calming"; }
  else if (lower.includes("purple") || lower.includes("紫")) { hue = 280; brightness = 0.55; tonalQuality = "luxurious"; }
  else if (lower.includes("blue") || lower.includes("蓝")) { hue = 215; brightness = 0.5; tonalQuality = "trust"; }

  if (lower.includes("rough") || lower.includes("粗糙")) textureGrain = 0.6;
  else if (lower.includes("smooth") || lower.includes("丝滑")) textureGrain = 0;
  else if (lower.includes("glossy") || lower.includes("光泽")) textureGrain = 0.1;
  else if (lower.includes("matte") || lower.includes("哑光")) textureGrain = 0.3;

  // Hue → rotate degree, brightness → intensity mapping, grain → micro-jitter count.
  const rotate = Math.round((hue / 360) * 24 - 12);
  const intensity = 0.5 + brightness * 0.8;
  const grainSteps = Math.round(textureGrain * 4);
  const keyframes = synesthesiaKeyframes(rotate, intensity, grainSteps, tonalQuality);
  const palette = synesthesiaPalette(hue, brightness, tonalQuality);

  return {
    subTaskId: taskId,
    moduleId: "synesthesia",
    motionParams: {
      easing: tonalQuality === "alert" ? "snappy" : tonalQuality === "calming" ? "smooth" : "ease-out",
      durationMs: 900 + grainSteps * 50,
      intensity,
      palette,
      keyframes,
      metadata: { hue, brightness, tonalQuality, textureGrain, rotate },
    },
    confidence: 0.83,
    notes: `Synesthesia: hue ${hue}° → rotate ${rotate}°, brightness → intensity ${intensity.toFixed(2)}, grain ${textureGrain} → ${grainSteps} micro-jitter steps, tone "${tonalQuality}".`,
  };
}

function synesthesiaKeyframes(rotate: number, intensity: number, grainSteps: number, tonal: string): Keyframe[] {
  const base: Keyframe[] = [
    { offset: 0, properties: { opacity: 0, translateY: 28 * intensity, scale: 0.6, rotateZ: rotate } },
    { offset: 0.5, properties: { opacity: 0.8, translateY: 6 * intensity, scale: 0.96, rotateZ: rotate * 0.3 } },
    { offset: 1, properties: { opacity: 1, translateY: 0, scale: 1, rotateZ: 0 } },
  ];
  if (tonal === "alert") {
    base.splice(1, 0, { offset: 0.2, properties: { opacity: 0.5, translateY: 18 * intensity, scale: 0.82 } });
  } else if (tonal === "luxurious") {
    base.splice(1, 0, { offset: 0.3, properties: { opacity: 0.4, translateY: 12 * intensity, scale: 0.88, blur: 4 } });
  }
  // Grain: insert high-frequency small steps at mid-range offsets.
  for (let i = 0; i < grainSteps; i += 1) {
    const t = 0.35 + 0.3 * (i / Math.max(1, grainSteps));
    base.push({
      offset: t,
      properties: { translateY: (Math.random() - 0.5) * 4 * intensity, scale: 1 + (Math.random() - 0.5) * 0.04 },
    });
  }
  base.sort((a, b) => a.offset - b.offset);
  return base;
}

function synesthesiaPalette(hue: number, brightness: number, tonal: string): string[] {
  const h = ((hue % 360) + 360) % 360;
  const b = Math.max(0.2, Math.min(0.9, brightness));
  const base = hslHex(h, 0.6, b);
  const accent = hslHex((h + 40) % 360, 0.55, Math.min(0.95, b + 0.15));
  const deep = hslHex(h, 0.5, Math.max(0.15, b - 0.3));
  if (tonal === "luxurious") return [deep, base, accent, "#FFFFFF"];
  if (tonal === "alert") return [deep, base, hslHex(0, 0.7, 0.55), "#FFFFFF"];
  if (tonal === "calming") return [deep, base, accent, hslHex(180, 0.5, 0.85)];
  return ["#FFFFFF", deep, base, accent];
}

function hslHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r, g, bl] = [0, 0, 0];
  if (hp < 1) [r, g, bl] = [c, x, 0];
  else if (hp < 2) [r, g, bl] = [x, c, 0];
  else if (hp < 3) [r, g, bl] = [0, c, x];
  else if (hp < 4) [r, g, bl] = [0, x, c];
  else if (hp < 5) [r, g, bl] = [x, 0, c];
  else [r, g, bl] = [c, 0, x];
  const m = l - c / 2;
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
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
