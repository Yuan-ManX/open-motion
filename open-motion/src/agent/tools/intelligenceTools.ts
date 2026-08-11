/**
 * Motion intelligence tool executors.
 *
 * Wires the emotion, style-transfer, knowledge-graph, physics, path, and codec
 * tool families to their dedicated intelligence engines. Each returns real,
 * computed insight (or generated output) instead of a simulated ack, so the
 * agent gives concrete, spec-derived answers to creative-intent requests.
 */

import type { ToolName } from "@openmotion/shared";
import { getProjectSpec } from "../../db/repositories/projects.js";
import { getComponent } from "../../db/repositories/components.js";
import type { ToolContext, ToolResult } from "./registry.js";
import * as styleTransfer from "../motionStyleTransfer.js";
import * as knowledgeGraph from "../motionKnowledgeGraph.js";
import * as codec from "../motionCodec.js";
import * as physics from "../motionPhysics.js";
import * as pathEngine from "../motionPath.js";
import {
  listEmotions,
  synthesizeFromEmotion,
  detectEmotionFromMotion,
  blendEmotions,
  planEmotionJourney,
  formatEmotionReport,
  formatDetectionReport,
  formatBlendReport,
  formatJourneyReport,
} from "../motionEmotion.js";

type Executor = (args: Record<string, unknown>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;

/** Discriminate a physics simulation by its type and run the matching engine. */
function runPhysicsSimulation(type: string, config: Record<string, unknown>): { summary: string; sampleCount: number; componentName: string } | null {
  const sim =
    type === "spring"
      ? physics.simulateSpring(config as never)
      : type === "gravity"
        ? physics.simulateGravityDrop(config as never)
        : type === "projectile"
          ? physics.simulateProjectile(config as never)
          : type === "friction"
            ? physics.simulateFriction(config as never)
            : type === "pendulum"
              ? physics.simulatePendulum(config as never)
              : null;
  if (!sim) return null;
  return { summary: sim.summary, sampleCount: sim.samples.length, componentName: sim.component.name };
}

export const intelligenceExecutors: Partial<Record<ToolName, Executor>> = {
  // --- Emotion intelligence -------------------------------------------------

  list_emotions: (args) => {
    const category = typeof args.category === "string" ? args.category : undefined;
    const emotions = listEmotions(category as never);
    return {
      ok: true,
      summary: `${emotions.length} emotion profile(s)${category ? ` in "${category}"` : ""} available`,
      specChanged: false,
      data: emotions.map((e) => ({ id: e.id, name: e.name, category: e.category })),
    };
  },

  synthesize_from_emotion: (args) => {
    const result = synthesizeFromEmotion(String(args.emotionId));
    if (!result) return { ok: false, summary: `unknown emotion: ${args.emotionId}`, specChanged: false };
    return { ok: true, summary: formatEmotionReport(result), specChanged: false, data: result };
  },

  detect_emotion: (args, ctx) => {
    const comp = getComponent(ctx.projectId, String(args.componentId));
    if (!comp) return { ok: false, summary: `component ${args.componentId} not found`, specChanged: false };
    const result = detectEmotionFromMotion(comp);
    return { ok: true, summary: formatDetectionReport(result), specChanged: false, data: result };
  },

  blend_emotions: (args) => {
    const emotions = Array.isArray(args.emotions)
      ? (args.emotions as Array<{ emotionId: string; weight: number }>)
      : [];
    if (emotions.length < 2) return { ok: false, summary: "blend_emotions requires at least two emotions", specChanged: false };
    const result = blendEmotions(emotions);
    if (!result) return { ok: false, summary: "could not blend the given emotions", specChanged: false };
    return { ok: true, summary: formatBlendReport(result), specChanged: false, data: result };
  },

  plan_emotion_journey: (args) => {
    const emotionIds = Array.isArray(args.emotionIds) ? args.emotionIds.map(String) : [];
    const result = planEmotionJourney(emotionIds, Number(args.totalDurationMs ?? 5000));
    if (!result) return { ok: false, summary: "could not plan the requested emotion journey", specChanged: false };
    return { ok: true, summary: formatJourneyReport(result), specChanged: false, data: result };
  },

  // --- Style transfer -------------------------------------------------------

  extract_style_dna: (_args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    return { ok: true, summary: "Extracted style DNA from the project", specChanged: false, data: styleTransfer.extractStyleDNA(spec) };
  },

  describe_style: (_args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    return { ok: true, summary: styleTransfer.describeStyle(styleTransfer.extractStyleDNA(spec)), specChanged: false };
  },

  compare_styles: (args) => {
    const specA = getProjectSpec(String(args.projectIdA));
    const specB = getProjectSpec(String(args.projectIdB));
    if (!specA || !specB) return { ok: false, summary: "one or both projects not found", specChanged: false };
    const comparison = styleTransfer.compareStyles(styleTransfer.extractStyleDNA(specA), styleTransfer.extractStyleDNA(specB));
    return {
      ok: true,
      summary: `Compared style DNA across ${comparison.perDimension?.length ?? 0} dimension(s)`,
      specChanged: false,
      data: comparison,
    };
  },

  blend_styles: (args) => {
    const specA = getProjectSpec(String(args.projectIdA));
    const specB = getProjectSpec(String(args.projectIdB));
    if (!specA || !specB) return { ok: false, summary: "one or both projects not found", specChanged: false };
    const ratio = Number(args.ratio ?? 0.5);
    return {
      ok: true,
      summary: `Blended style DNA at ratio ${ratio} (0=A, 1=B)`,
      specChanged: false,
      data: styleTransfer.blendStyles(specA, specB, ratio),
    };
  },

  list_style_archetypes: () => {
    const archetypes = styleTransfer.listStyleArchetypes();
    return {
      ok: true,
      summary: `${archetypes.length} style archetype(s) available`,
      specChanged: false,
      data: archetypes.map((a) => ({ id: a.id, name: a.name, description: a.description })),
    };
  },

  apply_style_archetype: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const archetypeId = String(args.archetypeId);
    const archetype = styleTransfer.getStyleArchetype(archetypeId);
    if (!archetype) return { ok: false, summary: `unknown archetype: ${archetypeId}`, specChanged: false };
    const transformed = styleTransfer.applyArchetype(archetypeId, spec);
    return {
      ok: true,
      summary: `Applied "${archetype.name}" archetype to the project (${transformed.components.length} components)`,
      specChanged: true,
      data: { archetypeId, componentCount: transformed.components.length },
    };
  },

  transfer_project_style: (args, ctx) => {
    const target = getProjectSpec(ctx.projectId);
    const source = getProjectSpec(String(args.sourceProjectId));
    if (!target || !source) return { ok: false, summary: "source or target project not found", specChanged: false };
    const transformed = styleTransfer.transferStyle(source, target, {
      easingStrength: args.easingStrength !== undefined ? Number(args.easingStrength) : undefined,
      tempoStrength: args.tempoStrength !== undefined ? Number(args.tempoStrength) : undefined,
      energyStrength: args.energyStrength !== undefined ? Number(args.energyStrength) : undefined,
      colorStrength: args.colorStrength !== undefined ? Number(args.colorStrength) : undefined,
    });
    return {
      ok: true,
      summary: `Transferred style from "${args.sourceProjectId}" to the current project`,
      specChanged: true,
      data: { componentCount: transformed.components.length },
    };
  },

  // --- Knowledge graph ------------------------------------------------------

  build_knowledge_graph: () => {
    const graph = knowledgeGraph.buildKnowledgeGraph();
    return {
      ok: true,
      summary: `Built knowledge graph with ${graph.nodes.length} concept(s) and ${graph.edges.length} relation(s)`,
      specChanged: false,
      data: { nodeCount: graph.nodes.length, edgeCount: graph.edges.length },
    };
  },

  query_concept: (args) => {
    const graph = knowledgeGraph.buildKnowledgeGraph();
    const node = knowledgeGraph.queryConcept(graph, String(args.conceptId));
    if (!node) return { ok: false, summary: `concept not found: ${args.conceptId}`, specChanged: false };
    return { ok: true, summary: `Concept "${node.label}" (${node.id})`, specChanged: false, data: node };
  },

  find_related: (args) => {
    const graph = knowledgeGraph.buildKnowledgeGraph();
    const relationship = typeof args.relationship === "string" ? String(args.relationship) : undefined;
    const related = knowledgeGraph.findRelated(graph, String(args.conceptId), relationship as never);
    return {
      ok: true,
      summary: `${related.length} related concept(s)${relationship ? ` via "${relationship}"` : ""} found`,
      specChanged: false,
      data: related,
    };
  },

  find_concept_path: (args) => {
    const graph = knowledgeGraph.buildKnowledgeGraph();
    const path = knowledgeGraph.findPath(graph, String(args.fromId), String(args.toId));
    if (path.length === 0) return { ok: false, summary: `no path found between "${args.fromId}" and "${args.toId}"`, specChanged: false };
    return { ok: true, summary: `Shortest path: ${path.join(" → ")}`, specChanged: false, data: path };
  },

  search_concepts: (args) => {
    const graph = knowledgeGraph.buildKnowledgeGraph();
    const results = knowledgeGraph.searchConcepts(graph, String(args.query));
    return { ok: true, summary: `${results.length} matching concept(s)`, specChanged: false, data: results };
  },

  suggest_connections: (args) => {
    const graph = knowledgeGraph.buildKnowledgeGraph();
    const ids = Array.isArray(args.conceptIds) ? args.conceptIds.map(String) : [];
    const suggestions = knowledgeGraph.suggestConnections(graph, ids);
    return { ok: true, summary: `${suggestions.length} connection suggestion(s)`, specChanged: false, data: suggestions };
  },

  recommend_next: (args) => {
    const graph = knowledgeGraph.buildKnowledgeGraph();
    const used = Array.isArray(args.usedConceptIds) ? args.usedConceptIds.map(String) : [];
    const recommendations = knowledgeGraph.recommendNext(graph, used);
    return {
      ok: true,
      summary: `${recommendations.length} next concept(s) recommended`,
      specChanged: false,
      data: recommendations,
    };
  },

  analyze_graph: () => {
    const graph = knowledgeGraph.buildKnowledgeGraph();
    return { ok: true, summary: knowledgeGraph.formatGraphReport(graph), specChanged: false, data: knowledgeGraph.analyzeGraph(graph) };
  },

  // --- Codec ----------------------------------------------------------------

  list_codec_formats: () => {
    const formats = codec.listCodecFormats();
    return { ok: true, summary: `${formats.length} codec format(s) available`, specChanged: false, data: formats };
  },

  encode_motion: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const result = codec.encodeMotion(spec, String(args.format) as never, { minify: Boolean(args.minify) });
    return {
      ok: true,
      summary: result.summary,
      specChanged: false,
      data: { format: result.format, output: result.output, mimeType: result.mimeType, fileExtension: result.fileExtension },
    };
  },

  // --- Physics --------------------------------------------------------------

  list_physics_presets: () => {
    const presets = physics.listPhysicsPresets();
    return { ok: true, summary: `${presets.length} physics preset(s) available`, specChanged: false, data: presets };
  },

  simulate_physics: (args) => {
    const config = args && typeof args.config === "object" ? (args.config as Record<string, unknown>) : {};
    const result = runPhysicsSimulation(String(args.type), config);
    if (!result) return { ok: false, summary: `unsupported physics type: ${args.type}`, specChanged: false };
    return { ok: true, summary: result.summary, specChanged: false, data: result };
  },

  run_physics_preset: (args) => {
    const result = physics.runPreset(String(args.presetId));
    if (!result) return { ok: false, summary: `unknown physics preset: ${args.presetId}`, specChanged: false };
    return { ok: true, summary: result.summary, specChanged: false, data: { sampleCount: result.samples.length, componentName: result.component.name } };
  },

  // --- Path -----------------------------------------------------------------

  list_path_presets: () => {
    const presets = pathEngine.listPathPresets();
    return { ok: true, summary: `${presets.length} path preset(s) available`, specChanged: false, data: presets };
  },

  generate_path_motion: (args) => {
    const config = {
      type: String(args.type ?? "lissajous"),
      durationMs: Number(args.durationMs ?? 2000),
      samples: Number(args.samples ?? 60),
      scale: Number(args.scale ?? 1),
      loop: args.loop !== undefined ? Boolean(args.loop) : true,
    };
    const result = pathEngine.generatePathMotion(config as never);
    return {
      ok: true,
      summary: `Generated ${result.points.length} sample point(s) along a ${config.type} path`,
      specChanged: false,
      data: { type: config.type, points: result.points, component: result.component },
    };
  },

  run_path_preset: (args) => {
    const result = pathEngine.runPathPreset(String(args.presetId));
    if (!result) return { ok: false, summary: `unknown path preset: ${args.presetId}`, specChanged: false };
    return { ok: true, summary: result.summary, specChanged: false, data: { points: result.points, component: result.component } };
  },
};