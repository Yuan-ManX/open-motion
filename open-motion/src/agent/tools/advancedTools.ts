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
  listSemanticConcepts,
  inferIntent,
  blendConcepts,
  formatProfile,
} from "../motionSemantics.js";
import { findHarmonics } from "../motionHarmonics.js";

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

  execute_collaboration: (args, _ctx) => {
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
    return { ok: true, summary: formatCollaborationResult(result), specChanged: false, data: result };
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
};