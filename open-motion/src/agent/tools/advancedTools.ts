/**
 * Advanced motion tool executors.
 *
 * Wires the testing, adaptive-learning, contextual-awareness, collaboration,
 * synesthesia, dream, resonance-tuning, entropy-hotspot, and temporal-path tool
 * families to their dedicated motion engines. Each executor returns real,
 * computed insight (or generated output) instead of a simulated ack, giving the
 * agent concrete, spec-derived answers across the full creative surface.
 */

import type { ToolName, MotionSpec } from "@openmotion/shared";
import { getProjectSpec } from "../../db/repositories/projects.js";
import { getComponent } from "../../db/repositories/components.js";
import type { ToolContext, ToolResult } from "./registry.js";
import { addLayer } from "./specUtils.js";

import {
  runAllTests,
  runTestsByCategory,
  runTestSuite,
  listTestSuites,
  formatTestReport,
} from "../motionTesting.js";
import {
  recordMotionObservation,
  getProjectTasteProfile,
  recommendForProject,
  formatTasteProfile,
  formatRecommendation,
} from "../motionAdaptive.js";
import {
  computeContextAdjustments,
  adaptComponentForContext,
  autoDetectContext,
  formatContextReport,
  formatAdaptationReport,
  listContextOptions,
} from "../motionContext.js";
import {
  planCollaboration,
  executeCollaboration,
  formatCollaborationPlan,
  formatCollaborationResult,
  listCollaborationModules,
} from "../motionCollaboration.js";
import {
  translateSpec,
  mapSensoryToMotion,
  formatSynestheticReport,
} from "../motionSynesthesia.js";
import {
  dreamFromPrompt,
  generateDreamSequence,
  listDreamConcepts,
  formatDreamReport,
  formatDreamSequenceReport,
} from "../motionDream.js";
import { tuneForResonance } from "../motionResonance.js";
import { identifyInformationHotspots } from "../motionEntropy.js";
import { findTemporalPath } from "../motionTopology.js";
import {
  predictPerception,
  formatPerceptionReport,
} from "../motionPerception.js";
import {
  predictChronopath,
  formatChronopathReport,
} from "../motionChronopath.js";
import {
  listSemanticConcepts,
  inferIntent,
  blendConcepts,
  formatProfile,
} from "../motionSemantics.js";
import { analyzeHarmonics, findHarmonics, formatHarmonicsReport } from "../motionHarmonics.js";
import { analyzeTopology, formatTopologyReport } from "../motionTopology.js";
import { analyzeAlchemy, formatAlchemyReport } from "../motionAlchemy.js";
import { analyzeCinema, formatCinemaReport } from "../motionCinema.js";
import { analyzeCreativeContext } from "../motionCreativeContext.js";
import { runDesignDebate, formatDebateReport } from "../motionDebate.js";
import { runReflectionLoop, formatReflectionReport, type ReflectionPatch } from "../motionReflectionLoop.js";
import { getFlowState, formatFlowStateReport } from "../motionFlowState.js";
import { runHeuristics, formatHeuristicsReport } from "../motionHeuristics.js";
import { generateAtelierReport, formatAtelierReport, generateManifesto } from "../motionAtelier.js";

type Executor = (args: Record<string, unknown>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;

/** Load the current project spec, or return a failure result. */
function loadSpec(ctx: ToolContext): { spec: MotionSpec } | { error: ToolResult } {
  const spec = getProjectSpec(ctx.projectId);
  if (!spec) {
    return { error: { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false } };
  }
  return { spec };
}

export const advancedExecutors: Partial<Record<ToolName, Executor>> = {
  // --- Testing framework ----------------------------------------------------

  run_all_tests: (_args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const report = runAllTests(loaded.spec);
    return { ok: true, summary: formatTestReport(report), specChanged: false, data: report };
  },

  run_tests_by_category: (args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const category = args.category as string;
    const results = runTestsByCategory(loaded.spec, category as never);
    const passed = results.filter((r) => r.passed).length;
    return {
      ok: true,
      summary: `${category} tests: ${passed}/${results.length} passed`,
      specChanged: false,
      data: results,
    };
  },

  run_test_suite: (args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const suiteId = args.suiteId as string;
    const result = runTestSuite(loaded.spec, suiteId);
    if (!result) {
      return { ok: false, summary: `test suite "${suiteId}" not found`, specChanged: false };
    }
    return {
      ok: true,
      summary: `${result.suiteName}: ${result.passed ? "passed" : "failed"} (score ${result.score})`,
      specChanged: false,
      data: result,
    };
  },

  list_test_suites: () => {
    const suites = listTestSuites();
    return {
      ok: true,
      summary: `${suites.length} test suite(s) available`,
      specChanged: false,
      data: suites,
    };
  },

  // --- Adaptive learning ----------------------------------------------------

  get_taste_profile: (_args, ctx) => {
    const profile = getProjectTasteProfile(ctx.projectId);
    return { ok: true, summary: formatTasteProfile(profile), specChanged: false, data: profile };
  },

  recommend_for_project: (_args, ctx) => {
    const rec = recommendForProject(ctx.projectId);
    if (!rec) {
      return {
        ok: true,
        summary: "Not enough observations yet to build a recommendation",
        specChanged: false,
        data: null,
      };
    }
    return { ok: true, summary: formatRecommendation(rec), specChanged: false, data: rec };
  },

  record_motion_observation: (args, ctx) => {
    const component = getComponent(ctx.projectId, args.componentId as string);
    if (!component) {
      return {
        ok: false,
        summary: `component ${args.componentId} not found`,
        specChanged: false,
      };
    }
    recordMotionObservation(ctx.projectId, {
      component,
      action: args.action as never,
    });
    return {
      ok: true,
      summary: `recorded "${args.action}" on "${component.name}"`,
      specChanged: false,
      data: { componentId: component.id, action: args.action },
    };
  },

  // --- Contextual awareness -------------------------------------------------

  compute_context_adjustments: (args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const context = {
      device: (args.device as string) || "desktop",
      performance: (args.performance as string) || "high",
      timeOfDay: (args.timeOfDay as string) || "afternoon",
      ambientLight: (args.ambientLight as string) || "normal",
      userState: (args.userState as string) || "casual",
    } as never;
    const adjustments = computeContextAdjustments(context);
    return {
      ok: true,
      summary: formatContextReport(context, adjustments),
      specChanged: false,
      data: adjustments,
    };
  },

  adapt_component_for_context: (args, ctx) => {
    const component = getComponent(ctx.projectId, args.componentId as string);
    if (!component) {
      return {
        ok: false,
        summary: `component ${args.componentId} not found`,
        specChanged: false,
      };
    }
    const context = {
      device: (args.device as string) || "desktop",
      performance: (args.performance as string) || "high",
      timeOfDay: (args.timeOfDay as string) || "afternoon",
      ambientLight: (args.ambientLight as string) || "normal",
      userState: (args.userState as string) || "casual",
    } as never;
    const result = adaptComponentForContext(component, context);
    return {
      ok: true,
      summary: formatAdaptationReport(result),
      specChanged: true,
      data: result,
    };
  },

  auto_detect_context: () => {
    const detected = autoDetectContext();
    return {
      ok: true,
      summary: detected.summary,
      specChanged: false,
      data: detected.context,
    };
  },

  list_context_options: () => {
    const options = listContextOptions();
    return { ok: true, summary: "Context options listed", specChanged: false, data: options };
  },

  // --- Motion collaboration -------------------------------------------------

  plan_collaboration: (args, _ctx) => {
    const request = args.request as string;
    const plan = planCollaboration(request);
    return { ok: true, summary: formatCollaborationPlan(plan), specChanged: false, data: plan };
  },

  execute_collaboration: (args, ctx) => {
    const request = args.request as string;
    const plan = planCollaboration(request);
    if (plan.subTasks.length === 0) {
      return {
        ok: true,
        summary: "Request is too general to decompose into collaborative sub-tasks",
        specChanged: false,
        data: plan,
      };
    }
    const result = executeCollaboration(plan);
    // Persist the unified component the collaboration produced so the motion
    // becomes part of the project spec, not just a reported plan.
    const produced = result.component;
    let componentId: string | null = null;
    try {
      componentId = addLayer(ctx.projectId, "Collaboration Result", {
        style: produced.style,
        keyframes: produced.keyframes,
        durationMs: produced.durationMs,
        easing: produced.easing,
        iterationCount: produced.iterationCount,
      });
    } catch {
      // Persistence failure is non-fatal; the collaboration report still stands.
    }
    return {
      ok: true,
      summary: formatCollaborationResult(result),
      specChanged: componentId !== null,
      data: { ...result, componentId },
    };
  },

  list_collaboration_modules: () => {
    const modules = listCollaborationModules();
    return {
      ok: true,
      summary: `${modules.length} collaboration module(s) available`,
      specChanged: false,
      data: modules,
    };
  },

  // --- Motion synesthesia ---------------------------------------------------

  translate_synesthesia: (_args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const experience = translateSpec(loaded.spec);
    return {
      ok: true,
      summary: formatSynestheticReport(experience),
      specChanged: false,
      data: experience,
    };
  },

  map_sensory_to_motion: (args) => {
    const modality = args.modality as "color" | "sound" | "texture" | "emotion";
    const value = args.value as string;
    const mapping = mapSensoryToMotion(modality, value);
    return {
      ok: true,
      summary: `Mapped ${modality} "${value}" → ${mapping.durationMs}ms with ${mapping.easingPreset} easing (intensity ${mapping.intensity.toFixed(2)})`,
      specChanged: false,
      data: mapping,
    };
  },

  // --- Motion dream ---------------------------------------------------------

  dream_from_prompt: (args, _ctx) => {
    const prompt = args.prompt as string;
    const motion = dreamFromPrompt(prompt);
    return {
      ok: true,
      summary: formatDreamReport(motion),
      specChanged: false,
      data: motion,
    };
  },

  generate_dream_sequence: (args) => {
    const length = typeof args.length === "number" ? args.length : 3;
    const seed = typeof args.seed === "string" ? args.seed : undefined;
    const sequence = generateDreamSequence(length, seed);
    return {
      ok: true,
      summary: formatDreamSequenceReport(sequence),
      specChanged: false,
      data: sequence,
    };
  },

  list_dream_concepts: () => {
    const concepts = listDreamConcepts();
    return {
      ok: true,
      summary: `${concepts.length} dream concept(s) available`,
      specChanged: false,
      data: concepts,
    };
  },

  // --- Resonance tuning -----------------------------------------------------

  tune_resonance: (args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const viewer = args.viewerState as never;
    const tuned = tuneForResonance(loaded.spec, viewer);
    return {
      ok: true,
      summary: tuned.summary,
      specChanged: true,
      data: tuned,
    };
  },

  // --- Entropy hotspots -----------------------------------------------------

  identify_information_hotspots: (_args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const hotspots = identifyInformationHotspots(loaded.spec);
    return {
      ok: true,
      summary: `Found ${hotspots.mostVaried.length} high-variance and ${hotspots.redundantPairs.length} redundant pair(s)`,
      specChanged: false,
      data: hotspots,
    };
  },

  // --- Temporal path --------------------------------------------------------

  find_temporal_path: (args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const path = findTemporalPath(loaded.spec, args.fromId as string, args.toId as string);
    if (!path) {
      return {
        ok: false,
        summary: `no temporal path from ${args.fromId} to ${args.toId}`,
        specChanged: false,
        data: null,
      };
    }
    return {
      ok: true,
      summary: `Temporal path (${path.path.length} components, ${path.totalOverlapMs}ms overlap): ${path.path.join(" → ")}`,
      specChanged: false,
      data: path,
    };
  },

  // --- Motion perception ----------------------------------------------------

  predict_perception: (_args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const report = predictPerception(loaded.spec);
    return {
      ok: true,
      summary: formatPerceptionReport(report),
      specChanged: false,
      data: report,
    };
  },

  // --- Motion chronopath — gaze trajectory prediction -----------------------

  predict_chronopath: (_args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const report = predictChronopath(loaded.spec);
    return {
      ok: true,
      summary: formatChronopathReport(report),
      specChanged: false,
      data: report,
    };
  },

  // --- Motion creative context — session-aware intelligence -----------------

  analyze_creative_context: (_args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const report = analyzeCreativeContext(ctx.projectId, loaded.spec);
    return {
      ok: true,
      summary: report.summary,
      specChanged: false,
      data: report,
    };
  },

  // --- Motion semantics -----------------------------------------------------

  list_semantic_concepts: (args) => {
    const all = listSemanticConcepts();
    const category = typeof args.category === "string" ? args.category : undefined;
    const concepts = category ? all.filter((c) => c.category === category) : all;
    return {
      ok: true,
      summary: `${concepts.length} semantic concept(s) available`,
      specChanged: false,
      data: concepts,
    };
  },

  infer_intent: (args) => {
    const description = args.description as string;
    const intent = inferIntent(description);
    return {
      ok: true,
      summary: intent.summary,
      specChanged: false,
      data: intent,
    };
  },

  blend_concepts: (args) => {
    const weightA = typeof args.weightA === "number" ? args.weightA : 0.5;
    const blended = blendConcepts(args.conceptA as string, args.conceptB as string, weightA);
    return {
      ok: true,
      summary: `Blended "${args.conceptA}" + "${args.conceptB}":\n${formatProfile(blended.profile)}`,
      specChanged: false,
      data: blended,
    };
  },

  // --- Motion harmonics -----------------------------------------------------

  find_harmonics: (args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const result = findHarmonics(loaded.spec, args.componentId as string);
    return {
      ok: true,
      summary: `Found ${result.compatible.length} compatible and ${result.dissonant.length} dissonant partner(s) for ${args.componentId}`,
      specChanged: false,
      data: result,
    };
  },

  analyze_harmonics: (_args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const report = analyzeHarmonics(loaded.spec);
    return {
      ok: true,
      summary: formatHarmonicsReport(report),
      specChanged: false,
      data: report,
    };
  },

  // --- Motion topology ------------------------------------------------------

  analyze_topology: (_args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const report = analyzeTopology(loaded.spec);
    return {
      ok: true,
      summary: formatTopologyReport(report),
      specChanged: false,
      data: report,
    };
  },

  // --- Motion alchemy -------------------------------------------------------

  analyze_alchemy: (_args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const report = analyzeAlchemy(loaded.spec);
    return {
      ok: true,
      summary: formatAlchemyReport(report),
      specChanged: false,
      data: report,
    };
  },

  // --- Motion cinema --------------------------------------------------------

  analyze_cinema: (_args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const report = analyzeCinema(loaded.spec);
    return {
      ok: true,
      summary: formatCinemaReport(report),
      specChanged: false,
      data: report,
    };
  },

  // --- Motion Debate — adversarial multi-judge design review ----------------

  run_motion_debate: async (args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const request = args.request as string;
    const plan = planCollaboration(request);
    if (plan.subTasks.length === 0) {
      return {
        ok: true,
        summary: "Request is too general to build a collaboration plan for debate",
        specChanged: false,
        data: null,
      };
    }
    const collaboration = await import("../motionCollaboration.js").then((m) => m.executeCollaboration(plan));
    const weightsOverride: Partial<Record<"accessibility" | "brand" | "performance", number>> = {};
    if (typeof args.accessibilityWeight === "number") weightsOverride.accessibility = args.accessibilityWeight;
    if (typeof args.performanceWeight === "number") weightsOverride.performance = args.performanceWeight;
    if (typeof args.brandWeight === "number") weightsOverride.brand = args.brandWeight;
    const report = runDesignDebate(loaded.spec, collaboration, Object.keys(weightsOverride).length > 0 ? weightsOverride : undefined);
    return {
      ok: true,
      summary: formatDebateReport(report),
      specChanged: false,
      data: report,
    };
  },

  // --- Motion Reflection Loop — automatic post-turn polishing ---------------

  run_reflection_loop: async (args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const maxPasses = typeof args.maxPasses === "number" ? args.maxPasses : 2;
    const autoApply = args.autoApply !== false;
    const mutator = async (patch: ReflectionPatch): Promise<void> => {
      if (!autoApply) return;
      // Persist each patch via patchComponent mutation
      await import("../../db/repositories/components.js").then((m) => {
        m.patchComponent(ctx.projectId, patch.componentId, patch.patch as Record<string, unknown>);
      }).catch(() => { /* non-fatal */ });
    };
    const result = await runReflectionLoop(loaded.spec, "reflection-loop", ctx.projectId, mutator);
    return {
      ok: true,
      summary: formatReflectionReport(result),
      specChanged: result.totalPatches > 0 && autoApply,
      data: result,
    };
  },

  // --- Motion Flow State — creative momentum tracking ---------------------

  get_flow_state: (_args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const snap = getFlowState(ctx.projectId, loaded.spec);
    return {
      ok: true,
      summary: formatFlowStateReport(snap),
      specChanged: false,
      data: snap,
    };
  },

  // --- Motion Heuristics — design principle evaluation ---------------------

  run_heuristics: (_args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const report = runHeuristics(loaded.spec);
    return {
      ok: true,
      summary: formatHeuristicsReport(report),
      specChanged: false,
      data: report,
    };
  },

  // --- Motion Atelier — creative session orchestrator ----------------------

  get_atelier_report: (_args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const report = generateAtelierReport(ctx.projectId, loaded.spec);
    return {
      ok: true,
      summary: formatAtelierReport(report),
      specChanged: false,
      data: report,
    };
  },

  generate_manifesto: (_args, ctx) => {
    const loaded = loadSpec(ctx);
    if ("error" in loaded) return loaded.error;
    const manifesto = generateManifesto(ctx.projectId, loaded.spec);
    return {
      ok: true,
      summary: manifesto.narrative,
      specChanged: false,
      data: manifesto,
    };
  },
};