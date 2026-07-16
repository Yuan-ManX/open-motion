import type { MotionComponent, Scene, Easing, ToolName } from "@openmotion/shared";
import { getProject, getProjectSpec, updateProject } from "../../db/repositories/projects.js";
import { listComponents, deleteComponent, createComponent, patchComponent } from "../../db/repositories/components.js";
import { listTemplates } from "../../db/repositories/templates.js";
import { instantiateTemplate } from "../../motion/templates/index.js";
import { TEMPLATES } from "../../motion/templates/index.js";
import { findSimilarMotions, summarizeSimilarity } from "../../motion/similarity.js";
import { generateMotionDocumentation } from "../../motion/documentation.js";
import { analyzePrinciples, applyPrinciple, PRINCIPLES } from "../../motion/principles.js";
import { synthesizeEasing } from "../../motion/easingSynthesizer.js";
import { applyChoreography, CHOREOGRAPHY_PATTERNS } from "../../motion/choreography.js";
import { blendMotions, interpolateMotion, mergeProperties, describeBlend } from "../../motion/blend.js";
import { analyzeIntelligence } from "../../motion/intelligence.js";
import { adaptMotion, generateResponsiveCss, previewAdaptations } from "../../motion/adaptive.js";
import { synthesizeMotion, morphToPattern, synthesizeCustomWaveform, listGenerativePatterns } from "../../motion/synthesis.js";
import { createStorytellingPlan, analyzePacing, applyStorytellingPlan, listStoryGenres } from "../../motion/storytelling.js";
import { publicBaseUrl } from "../../config.js";
import { generateMedia, isModalityAvailable } from "../provider/generation.js";
import { MODEL_REGISTRY, findModel, modelsByProvider, modelsByModality } from "../provider/registry.js";
import type { ToolContext, ToolResult } from "./registry.js";

type Executor = (args: Record<string, unknown>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;

/** Classify an easing into a short DNA token. */
function easingDnaToken(easing: Easing | undefined): string {
  if (!easing) return "LINEAR";
  if (easing.type === "preset") {
    const n = easing.name;
    if (/bounce|back|elastic|spring/.test(n)) return "BOUNCE";
    if (/smooth|ease-in-out|ease-out/.test(n)) return "SMOOTH";
    if (/snappy|ease-in/.test(n)) return "SNAPPY";
    return n.toUpperCase();
  }
  if (easing.type === "spring") return "SPRING";
  if (easing.type === "bezier") return "BEZIER";
  return "LINEAR";
}

/** Classify a duration into a short DNA token. */
function durationDnaToken(ms: number): string {
  if (ms < 500) return "FAST";
  if (ms <= 1500) return "NORMAL";
  return "SLOW";
}

/** Classify iteration count into a short DNA token. */
function loopDnaToken(count: number | "infinite"): string {
  if (count === "infinite") return "LOOP∞";
  if (count === 1) return "ONCE";
  return `LOOP×${count}`;
}

/** Classify direction into a short DNA token. */
function directionDnaToken(dir: string): string {
  if (dir === "alternate" || dir === "alternate-reverse") return "ALT";
  if (dir === "reverse") return "REV";
  return "FWD";
}

/** Extract the set of animated properties from a component's keyframes. */
function animatedProps(comp: MotionComponent): string[] {
  const props = new Set<string>();
  for (const kf of comp.keyframes) {
    for (const key of Object.keys(kf.properties)) {
      props.add(key);
    }
  }
  return Array.from(props);
}

/**
 * Build a Motion DNA signature: a compact pipe-delimited string capturing the
 * essence of a motion. Example: BOUNCE|NORMAL|LOOP∞|SCALE+OPACITY|FWD
 */
function buildMotionDna(comp: MotionComponent): string {
  const easing = easingDnaToken(comp.easing);
  const duration = durationDnaToken(comp.durationMs);
  const loop = loopDnaToken(comp.iterationCount);
  const props = animatedProps(comp).map((p) => p.toUpperCase()).join("+") || "STATIC";
  const dir = directionDnaToken(comp.direction);
  return [easing, duration, loop, props, dir].join("|");
}

/** Generate a natural-language description of what a single component's motion looks like. */
function describeComponentMotion(comp: MotionComponent): string {
  const parts: string[] = [];
  const easingName = comp.easing?.type === "preset" ? comp.easing.name : comp.easing?.type ?? "linear";
  const props = animatedProps(comp);
  const durSec = (comp.durationMs / 1000).toFixed(comp.durationMs % 1000 === 0 ? 0 : 1);

  parts.push(`"${comp.name}"`);

  if (props.length === 0) {
    parts.push(`is currently static with no keyframe animation`);
  } else {
    parts.push(`animates ${props.join(" and ")}`);
  }

  parts.push(`over ${durSec}s with ${easingName} easing`);

  if (comp.iterationCount === "infinite") {
    parts.push(`looping forever`);
  } else if (typeof comp.iterationCount === "number" && comp.iterationCount > 1) {
    parts.push(`repeating ${comp.iterationCount} times`);
  } else {
    parts.push(`playing once`);
  }

  if (comp.direction === "alternate" || comp.direction === "alternate-reverse") {
    parts.push(`in alternating direction`);
  } else if (comp.direction === "reverse") {
    parts.push(`in reverse`);
  }

  if (comp.delayMs > 0) {
    parts.push(`with a ${comp.delayMs}ms delay`);
  }

  return parts.join(" ") + ".";
}

export const queryExecutors: Partial<Record<ToolName, Executor>> = {
  get_motion_spec: (_args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    return {
      ok: true,
      summary: `current spec has ${spec.components.length} component(s): ${spec.components.map((c) => c.name).join(", ") || "none"}`,
      specChanged: false,
      data: spec,
    };
  },

  describe_motion: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };

    const targetId = args.componentId ? String(args.componentId) : undefined;
    const components = targetId
      ? spec.components.filter((c) => c.id === targetId)
      : spec.components;

    if (components.length === 0) {
      return {
        ok: true,
        summary: "No components to describe yet — the canvas is empty.",
        specChanged: false,
        data: { description: "The project has no animated layers yet.", dna: "", componentCount: 0 },
      };
    }

    const descriptions = components.map(describeComponentMotion);
    const dnaSignatures = components.map((c) => ({ name: c.name, dna: buildMotionDna(c) }));

    let description: string;
    if (components.length === 1) {
      description = descriptions[0];
    } else {
      description = `This project has ${components.length} layers. ${descriptions.join(" ")}`;
    }

    const primaryDna = dnaSignatures[0].dna;
    const summary = `Motion DNA: ${primaryDna} — ${components.length} layer(s)`;

    return {
      ok: true,
      summary,
      specChanged: false,
      data: {
        description,
        dna: primaryDna,
        perComponent: dnaSignatures,
        componentCount: components.length,
      },
    };
  },

  match_template: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    const currentComponents = spec?.components ?? [];
    const hint = args.hint ? String(args.hint) : "";

    // Build a profile of the current motion (or use the hint).
    const currentProps = new Set<string>();
    let currentEasingToken = "";
    if (currentComponents.length > 0) {
      const first = currentComponents[0];
      currentEasingToken = easingDnaToken(first.easing);
      for (const kf of first.keyframes) {
        for (const key of Object.keys(kf.properties)) currentProps.add(key.toUpperCase());
      }
    }

    // Score each template by similarity.
    const scored = TEMPLATES.map((tpl) => {
      const drafts = tpl.build();
      const first = drafts[0];
      if (!first) return { template: tpl, score: 0, reasons: [] };

      let score = 0;
      const reasons: string[] = [];

      // Easing match.
      const tplEasingToken = easingDnaToken(first.easing);
      if (currentEasingToken && tplEasingToken === currentEasingToken) {
        score += 30;
        reasons.push(`matching easing (${tplEasingToken})`);
      }

      // Property overlap.
      const tplProps = new Set<string>();
      for (const kf of first.keyframes ?? []) {
        for (const key of Object.keys(kf.properties)) tplProps.add(key.toUpperCase());
      }
      const overlap = [...tplProps].filter((p) => currentProps.has(p));
      if (overlap.length > 0) {
        score += 20 * overlap.length;
        reasons.push(`shared properties (${overlap.join(", ")})`);
      }

      // Hint keyword matching.
      if (hint) {
        const hintLower = hint.toLowerCase();
        const tplText = `${tpl.name} ${tpl.description} ${tpl.tags.join(" ")}`.toLowerCase();
        const hintWords = hintLower.split(/\s+/).filter((w) => w.length > 2);
        for (const word of hintWords) {
          if (tplText.includes(word)) {
            score += 15;
            reasons.push(`keyword "${word}"`);
          }
        }
      }

      // Category bonus — entrance templates are generally useful.
      if (tpl.category === "entrance") score += 5;

      return {
        template: {
          id: tpl.id,
          name: tpl.name,
          category: tpl.category,
          description: tpl.description,
          tags: tpl.tags,
        },
        score: Math.min(score, 100),
        reasons,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 5).filter((s) => s.score > 0);

    if (top.length === 0) {
      return {
        ok: true,
        summary: "no close template matches found — try describing what you want",
        specChanged: false,
        data: { matches: [], currentDna: currentComponents[0] ? buildMotionDna(currentComponents[0]) : "" },
      };
    }

    const best = top[0];
    return {
      ok: true,
      summary: `best match: ${best.template.name} (${best.score}% match)`,
      specChanged: false,
      data: {
        matches: top.map((s) => ({ ...s.template, score: s.score, reasons: s.reasons })),
        currentDna: currentComponents[0] ? buildMotionDna(currentComponents[0]) : "",
      },
    };
  },

  find_similar_motion: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const targetId = args.componentId ? String(args.componentId) : undefined;
    const components = targetId
      ? spec.components.filter((c) => c.id === targetId)
      : spec.components;
    if (components.length === 0) {
      return {
        ok: true,
        summary: "no components to search — the canvas is empty",
        specChanged: false,
        data: { queryDna: "", matches: [] },
      };
    }
    const queryComp = components[0];
    const limit = args.limit ? Number(args.limit) : 10;
    const threshold = args.threshold ? Number(args.threshold) : 40;
    const { queryDna, matches } = findSimilarMotions(queryComp, {
      excludeProjectId: ctx.projectId,
      limit,
      threshold,
    });
    return {
      ok: true,
      summary: summarizeSimilarity(matches),
      specChanged: false,
      data: { queryDna, matches },
    };
  },

  generate_motion_docs: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const format = (args.format as "markdown" | "json" | undefined) ?? "markdown";
    const doc = generateMotionDocumentation(spec, {
      format,
      includeAccessibility: args.includeAccessibility as boolean | undefined,
      includePerformance: args.includePerformance as boolean | undefined,
      includeStoryboard: args.includeStoryboard as boolean | undefined,
    });
    const compCount = spec.components.length;
    return {
      ok: true,
      summary: `generated ${format} documentation for "${spec.project.name}" — ${compCount} component(s), ${doc.content.length} chars`,
      specChanged: false,
      data: {
        projectName: doc.projectName,
        format: doc.format,
        generatedAt: doc.generatedAt,
        content: doc.content,
        contentLength: doc.content.length,
      },
    };
  },

  list_scenes: (_args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const spec = getProjectSpec(ctx.projectId);
    const components = spec?.components ?? [];
    const scenes: Array<Scene & { componentCount: number }> = project.scenes.map((s) => ({
      ...s,
      componentCount: components.filter((c) => c.sceneId === s.id).length,
    }));
    const unassigned = components.filter((c) => !c.sceneId).length;
    return {
      ok: true,
      summary: `${scenes.length} scene(s), ${unassigned} unassigned component(s)`,
      specChanged: false,
      data: { scenes, unassignedCount: unassigned },
    };
  },

  remove_scene: (args, ctx) => {
    const sceneId = String(args.sceneId);
    const project = getProject(ctx.projectId);
    if (!project) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const scene = project.scenes.find((s) => s.id === sceneId);
    if (!scene) return { ok: false, summary: `scene ${sceneId} not found`, specChanged: false };

    // Unassign components from this scene (set sceneId to null) rather than deleting them.
    const spec = getProjectSpec(ctx.projectId);
    if (spec) {
      for (const comp of spec.components) {
        if (comp.sceneId === sceneId) {
          deleteComponent(ctx.projectId, comp.id);
          createComponent({ ...comp, sceneId: null, updatedAt: new Date().toISOString() });
        }
      }
    }

    const remainingScenes = project.scenes.filter((s) => s.id !== sceneId);
    updateProject(ctx.projectId, { scenes: remainingScenes });
    return {
      ok: true,
      summary: `removed scene "${scene.name}" and unassigned its components`,
      specChanged: true,
    };
  },

  list_templates: (args, _ctx) => {
    const category = args.category ? String(args.category) : undefined;
    const tag = args.tag ? String(args.tag) : undefined;
    const templates = listTemplates(category, tag);
    const summaries = templates.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description,
      tags: t.tags,
    }));
    return {
      ok: true,
      summary: `${templates.length} template(s) available`,
      specChanged: false,
      data: summaries,
    };
  },

  set_template: (args, ctx) => {
    const templateId = String(args.templateId);
    // Remove existing components, then materialize the chosen template.
    for (const c of listComponents(ctx.projectId)) {
      deleteComponent(ctx.projectId, c.id);
    }
    const components = instantiateTemplate(templateId, ctx.projectId);
    if (components.length === 0) {
      return { ok: false, summary: `template ${templateId} not found`, specChanged: false };
    }
    for (const c of components) createComponent(c);
    return {
      ok: true,
      summary: `reset project to template "${templateId}" (${components.length} components)`,
      specChanged: true,
      data: { componentIds: components.map((c) => c.id) },
    };
  },

  preview_url: (_args, ctx) => {
    const url = `${publicBaseUrl()}/api/projects/${ctx.projectId}/preview`;
    return { ok: true, summary: `preview running at ${url}`, specChanged: false, data: { url } };
  },

  analyze_principles: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const componentId = args.componentId as string | undefined;
    const targets = componentId
      ? spec.components.filter((c) => c.id === componentId)
      : spec.components;
    if (targets.length === 0) {
      return { ok: false, summary: componentId ? `component ${componentId} not found` : "no components in project", specChanged: false };
    }
    const reports = targets.map((c) => analyzePrinciples(c));
    const avgScore = Math.round(reports.reduce((s, r) => s + r.overallScore, 0) / reports.length);
    const allMissing = reports.flatMap((r) => r.missingPrinciples);
    const missingCounts: Record<string, number> = {};
    for (const m of allMissing) missingCounts[m] = (missingCounts[m] ?? 0) + 1;
    const topMissing = Object.entries(missingCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const summary = `${reports.length} component(s) analyzed — avg score ${avgScore}/100. ${reports[0].presentCount}/12 principles present on average. Top missing: ${topMissing.map(([k, v]) => `${k} (${v})`).join(", ") || "none"}.`;
    return {
      ok: true,
      summary,
      specChanged: false,
      data: {
        reports,
        averageScore: avgScore,
        principlesList: PRINCIPLES.map((p) => ({ id: p.id, name: p.name, category: p.category, description: p.description })),
        topMissing,
      },
    };
  },

  apply_principle: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const componentId = args.componentId as string;
    const principle = args.principle as Parameters<typeof applyPrinciple>[1];
    const comp = spec.components.find((c) => c.id === componentId);
    if (!comp) return { ok: false, summary: `component ${componentId} not found`, specChanged: false };
    const result = applyPrinciple(comp, principle);
    deleteComponent(ctx.projectId, componentId);
    createComponent({
      ...comp,
      keyframes: result.modifiedKeyframes,
      easing: result.modifiedEasing ?? comp.easing,
      updatedAt: new Date().toISOString(),
    });
    return {
      ok: true,
      summary: `applied ${principle} to "${comp.name}" — ${result.description.slice(0, 100)}`,
      specChanged: true,
      data: {
        principle,
        componentId,
        description: result.description,
        keyframeCount: result.modifiedKeyframes.length,
        easingChanged: !!result.modifiedEasing,
      },
    };
  },

  synthesize_easing: (args, _ctx) => {
    const description = args.description as string;
    const format = (args.format as "bezier" | "spring" | "css" | undefined) ?? "bezier";
    const result = synthesizeEasing(description, format);
    return {
      ok: true,
      summary: `synthesized ${result.detectedQualities.join("+") || "default"} easing → ${result.cssString}`,
      specChanged: false,
      data: {
        description: result.description,
        detectedQualities: result.detectedQualities,
        easing: result.easing,
        cssString: result.cssString,
        rationale: result.rationale,
      },
    };
  },

  apply_choreography: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const pattern = args.pattern as Parameters<typeof applyChoreography>[1];
    const baseDelayMs = args.baseDelayMs as number | undefined;
    const baseDurationMs = args.baseDurationMs as number | undefined;
    const components = spec.components;
    if (components.length < 2) {
      return { ok: false, summary: "need at least 2 components for choreography", specChanged: false };
    }
    const result = applyChoreography(components, pattern, { baseDelayMs, baseDurationMs });
    for (const assignment of result.assignments) {
      const comp = components.find((c) => c.id === assignment.componentId);
      if (!comp) continue;
      deleteComponent(ctx.projectId, assignment.componentId);
      createComponent({
        ...comp,
        delayMs: assignment.delayMs,
        durationMs: assignment.durationMs,
        updatedAt: new Date().toISOString(),
      });
    }
    return {
      ok: true,
      summary: result.description,
      specChanged: true,
      data: {
        pattern: result.pattern,
        patternName: result.patternName,
        componentCount: result.componentCount,
        assignments: result.assignments,
        totalDurationMs: result.totalDurationMs,
      },
    };
  },
  blend_motions: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const source = spec.components.find((c) => c.id === args.sourceComponentId);
    const target = spec.components.find((c) => c.id === args.targetComponentId);
    if (!source || !target) {
      return { ok: false, summary: "source or target component not found", specChanged: false };
    }
    const ratio = args.ratio as number;
    const result = blendMotions(source, target, ratio);
    const applyTo = args.applyTo as "source" | "new";

    if (applyTo === "source") {
      deleteComponent(ctx.projectId, source.id);
      createComponent({
        ...source,
        keyframes: result.keyframes,
        easing: result.easing,
        durationMs: result.durationMs,
        delayMs: result.delayMs,
        iterationCount: result.iterationCount,
        direction: result.direction,
        updatedAt: new Date().toISOString(),
      });
    } else {
      createComponent({
        ...source,
        id: `c_blend${Date.now().toString(36)}`,
        name: `${source.name}+${target.name} Blend`,
        keyframes: result.keyframes,
        easing: result.easing,
        durationMs: result.durationMs,
        delayMs: result.delayMs,
        iterationCount: result.iterationCount,
        direction: result.direction,
        templateId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    return {
      ok: true,
      summary: `Blended ${source.name} and ${target.name} at ratio ${ratio.toFixed(2)} — ${describeBlend(result)}`,
      specChanged: true,
      data: {
        ratio: result.ratio,
        blendedProperties: result.blendedProperties,
        keyframeCount: result.keyframes.length,
        durationMs: result.durationMs,
        easing: result.easing,
        appliedTo: applyTo,
      },
    };
  },
  interpolate_motion: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const source = spec.components.find((c) => c.id === args.sourceComponentId);
    const target = spec.components.find((c) => c.id === args.targetComponentId);
    if (!source || !target) {
      return { ok: false, summary: "source or target component not found", specChanged: false };
    }
    const steps = args.steps as number;
    const results = interpolateMotion(source, target, steps);
    return {
      ok: true,
      summary: `Generated ${results.length} interpolation steps from ${source.name} to ${target.name}`,
      specChanged: false,
      data: {
        steps: results.map((s) => ({
          index: s.index,
          ratio: s.ratio,
          description: describeBlend(s.result),
          keyframeCount: s.result.keyframes.length,
          durationMs: s.result.durationMs,
          easing: s.result.easing,
        })),
      },
    };
  },
  merge_properties: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const source = spec.components.find((c) => c.id === args.sourceComponentId);
    const target = spec.components.find((c) => c.id === args.targetComponentId);
    if (!source || !target) {
      return { ok: false, summary: "source or target component not found", specChanged: false };
    }
    const result = mergeProperties(source, target);
    const applyTo = args.applyTo as "source" | "new";

    if (applyTo === "source") {
      deleteComponent(ctx.projectId, source.id);
      createComponent({
        ...source,
        keyframes: result.keyframes,
        updatedAt: new Date().toISOString(),
      });
    } else {
      createComponent({
        ...source,
        id: `c_merge${Date.now().toString(36)}`,
        name: `${source.name}+${target.name} Merged`,
        keyframes: result.keyframes,
        templateId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    return {
      ok: true,
      summary: `Merged properties from ${source.name} and ${target.name} — ${result.mergedProperties.length} properties, ${result.conflicts.length} conflicts`,
      specChanged: true,
      data: {
        mergedProperties: result.mergedProperties,
        sourceAProperties: result.sourceAProperties,
        sourceBProperties: result.sourceBProperties,
        conflicts: result.conflicts,
        keyframeCount: result.keyframes.length,
        appliedTo: applyTo,
      },
    };
  },

  analyze_emotion: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const report = analyzeIntelligence(spec);
    return {
      ok: true,
      summary: report.emotion.narrativeDescription,
      specChanged: false,
      data: {
        journey: report.emotion.journey,
        dominantEmotion: report.emotion.dominantEmotion,
        emotionalRange: report.emotion.emotionalRange,
        emotionalArc: report.emotion.emotionalArc,
        peakIntensity: report.emotion.peakIntensity,
        description: report.emotion.narrativeDescription,
      },
    };
  },

  analyze_rhythm: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const report = analyzeIntelligence(spec);
    return {
      ok: true,
      summary: report.rhythm.description,
      specChanged: false,
      data: {
        beats: report.rhythm.beats,
        tempoBpm: report.rhythm.tempoBpm,
        rhythmType: report.rhythm.rhythmType,
        regularity: report.rhythm.regularity,
        groove: report.rhythm.groove,
        conflicts: report.rhythm.conflicts,
        description: report.rhythm.description,
      },
    };
  },

  analyze_narrative: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const report = analyzeIntelligence(spec);
    return {
      ok: true,
      summary: report.narrative.description,
      specChanged: false,
      data: {
        segments: report.narrative.segments,
        hasCompleteArc: report.narrative.hasCompleteArc,
        missingActs: report.narrative.missingActs,
        pacingScore: report.narrative.pacingScore,
        coherenceScore: report.narrative.coherenceScore,
        suggestions: report.narrative.suggestions,
        personality: report.personality,
        attention: report.attention,
        overallIntelligence: report.overallIntelligence,
        description: report.narrative.description,
      },
    };
  },

  adapt_motion: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const result = adaptMotion(spec, {
      viewport: {
        device: args.device as "desktop" | "tablet" | "mobile" | "tv",
        width: args.viewportWidth as number,
        height: args.viewportHeight as number,
        pixelRatio: 1,
      },
      performance: args.performance as "high" | "medium" | "low",
      accessibility: args.accessibility as "full" | "reduced" | "minimal",
      connectionSpeed: args.connectionSpeed as "fast" | "slow" | "offline",
      batteryLevel: (args.batteryLevel as number) ?? 1,
    });
    const apply = (args.apply as boolean) ?? false;
    if (apply) {
      for (const adapted of result.adaptedSpec.components) {
        patchComponent(ctx.projectId, adapted.id, {
          durationMs: adapted.durationMs,
          delayMs: adapted.delayMs,
          iterationCount: adapted.iterationCount,
          easing: adapted.easing,
          keyframes: adapted.keyframes,
        });
      }
    }
    return {
      ok: true,
      summary: result.summary,
      specChanged: apply,
      data: {
        changes: result.changes,
        reductionLevel: result.reductionLevel,
        applied: apply,
        adaptedSpec: apply ? undefined : result.adaptedSpec,
      },
    };
  },

  preview_adaptations: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const previews = previewAdaptations(spec);
    return {
      ok: true,
      summary: previews.map((p) => p.description).join("; "),
      specChanged: false,
      data: { previews },
    };
  },

  generate_responsive_css: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const css = generateResponsiveCss(spec);
    return {
      ok: true,
      summary: `Generated responsive CSS with ${spec.components.length} component(s) across 4 breakpoints.`,
      specChanged: false,
      data: { css, componentCount: spec.components.length },
    };
  },

  synthesize_motion: (args, ctx) => {
    const result = synthesizeMotion({
      pattern: args.pattern as "heartbeat" | "breathing" | "walk-cycle" | "bounce-ball" | "pendulum" | "ocean-wave" | "tremor" | "fidget" | "heartbeat-fast" | "shake-violent" | "sway-gentle" | "orbit-elliptical",
      durationMs: (args.durationMs as number) || 0,
      loopCount: (args.loopCount as number | "infinite") ?? "infinite",
      amplitudeScale: (args.amplitudeScale as number) ?? 1,
      speedScale: (args.speedScale as number) ?? 1,
      componentName: (args.componentName as string) || "",
      projectId: ctx.projectId,
    });
    createComponent(result.component);
    return {
      ok: true,
      summary: `Synthesized a ${args.pattern} motion — ${result.description} (${result.keyframeCount} keyframes).`,
      specChanged: true,
      data: {
        componentId: result.component.id,
        componentName: result.component.name,
        description: result.description,
        waveform: result.waveform,
        keyframeCount: result.keyframeCount,
        patterns: listGenerativePatterns(),
      },
    };
  },

  morph_to_pattern: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    if (spec.components.length === 0) {
      return { ok: false, summary: "No components to morph. Add a component first.", specChanged: false };
    }
    const result = morphToPattern({
      sourceSpec: spec,
      targetPattern: args.targetPattern as "heartbeat" | "breathing" | "walk-cycle" | "bounce-ball" | "pendulum" | "ocean-wave" | "tremor" | "fidget" | "heartbeat-fast" | "shake-violent" | "sway-gentle" | "orbit-elliptical",
      morphSteps: (args.morphSteps as number) ?? 5,
      durationMs: (args.durationMs as number) || 0,
      projectId: ctx.projectId,
    });
    for (const step of result.steps) {
      createComponent(step);
    }
    return {
      ok: true,
      summary: result.description,
      specChanged: true,
      data: {
        steps: result.steps.map((s) => ({ id: s.id, name: s.name, durationMs: s.durationMs, keyframeCount: s.keyframes.length })),
        targetPattern: args.targetPattern,
      },
    };
  },

  synthesize_waveform: (args, ctx) => {
    const result = synthesizeCustomWaveform({
      waveform: args.waveform as "sine" | "square" | "triangle" | "sawtooth" | "noise" | "pulse",
      amplitude: args.amplitude as number,
      frequency: args.frequency as number,
      phase: (args.phase as number) ?? 0,
      offset: (args.offset as number) ?? 0,
      property: args.property as string,
      durationMs: args.durationMs as number,
      loopCount: (args.loopCount as number | "infinite") ?? "infinite",
      componentName: (args.componentName as string) || "",
      keyframeCount: (args.keyframeCount as number) ?? 12,
      projectId: ctx.projectId,
    });
    createComponent(result.component);
    return {
      ok: true,
      summary: `Synthesized a ${args.waveform} wave on ${args.property} — ${result.keyframeCount} keyframes, amplitude ${args.amplitude}, frequency ${args.frequency}Hz.`,
      specChanged: true,
      data: {
        componentId: result.component.id,
        componentName: result.component.name,
        description: result.description,
        waveform: result.waveform,
        keyframeCount: result.keyframeCount,
      },
    };
  },

  create_story_arc: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const plan = createStorytellingPlan(
      args.genre as "hero" | "mystery" | "romance" | "comedy" | "thriller" | "documentary" | "fantasy" | "horror",
      (args.totalDurationMs as number) ?? 10000,
      spec.components,
    );
    return {
      ok: true,
      summary: plan.description,
      specChanged: false,
      data: {
        arc: plan.arc,
        transitions: plan.transitions,
        componentAssignments: plan.componentAssignments,
        genres: listStoryGenres(),
      },
    };
  },

  analyze_pacing: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const plan = createStorytellingPlan("hero", spec.components.reduce((s, c) => Math.max(s, c.delayMs + c.durationMs), 5000), spec.components);
    const pacing = analyzePacing(plan.arc);
    return {
      ok: true,
      summary: `Pacing score: ${pacing.overallScore}/100. ${pacing.recommendations[0]}`,
      specChanged: false,
      data: {
        tempoCurve: pacing.tempoCurve,
        avgTempo: pacing.avgTempo,
        tempoVariance: pacing.tempoVariance,
        slowSegments: pacing.slowSegments,
        fastSegments: pacing.fastSegments,
        recommendations: pacing.recommendations,
        overallScore: pacing.overallScore,
      },
    };
  },

  apply_story_plan: (args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    const plan = createStorytellingPlan(
      args.genre as "hero" | "mystery" | "romance" | "comedy" | "thriller" | "documentary" | "fantasy" | "horror",
      (args.totalDurationMs as number) ?? 10000,
      spec.components,
    );
    const { changes } = applyStorytellingPlan(spec, plan);
    const apply = (args.apply as boolean) ?? false;
    if (apply) {
      for (const change of changes) {
        if (change.field === "delayMs") {
          patchComponent(ctx.projectId, change.componentId, { delayMs: parseInt(change.newValue) });
        } else if (change.field === "durationMs") {
          patchComponent(ctx.projectId, change.componentId, { durationMs: parseInt(change.newValue) });
        }
      }
    }
    return {
      ok: true,
      summary: `Story plan ${apply ? "applied" : "previewed"}: ${changes.length} timing change(s). ${plan.description}`,
      specChanged: apply,
      data: {
        changes,
        applied: apply,
        arc: plan.arc,
        componentAssignments: plan.componentAssignments,
      },
    };
  },

  generate_image: async (args) => {
    const result = await generateMedia({
      prompt: args.prompt as string,
      modality: "text-to-image",
      model: args.model as string | undefined,
      width: args.width as number | undefined,
      height: args.height as number | undefined,
      negativePrompt: args.negativePrompt as string | undefined,
    });
    return { ok: true, summary: `Generated image via ${result.provider}/${result.model}`, specChanged: false, data: result };
  },

  generate_speech: async (args) => {
    const result = await generateMedia({
      prompt: args.text as string,
      modality: "text-to-speech",
      model: args.model as string | undefined,
      voiceId: args.voiceId as string | undefined,
    });
    return { ok: true, summary: `Generated speech via ${result.provider}/${result.model}`, specChanged: false, data: result };
  },

  generate_video: async (args) => {
    const sourceImage = args.sourceImage as string | undefined;
    const result = await generateMedia({
      prompt: args.prompt as string,
      modality: sourceImage ? "image-to-video" : "text-to-video",
      model: args.model as string | undefined,
      sourceImage,
      duration: args.duration as number | undefined,
    });
    return { ok: true, summary: `Generated video via ${result.provider}/${result.model}`, specChanged: false, data: result };
  },

  generate_3d: async (args) => {
    const sourceImage = args.sourceImage as string | undefined;
    const result = await generateMedia({
      prompt: args.prompt as string,
      modality: "text-to-3d",
      model: args.model as string | undefined,
      sourceImage,
    });
    return { ok: true, summary: `Generated 3D model via ${result.provider}/${result.model}`, specChanged: false, data: result };
  },

  list_models: (args) => {
    let filtered = MODEL_REGISTRY;
    if (args.provider) {
      filtered = modelsByProvider(String(args.provider));
    }
    if (args.modality) {
      const byModality = modelsByModality(args.modality as Parameters<typeof modelsByModality>[0]);
      filtered = filtered.filter((m) => byModality.includes(m));
    }
    const models = filtered.map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      contextWindow: m.contextWindow,
      capabilities: m.capabilities,
      generationModality: m.generationModality,
      description: m.description,
      available: m.generationModality ? isModalityAvailable(m.generationModality) : true,
    }));
    return {
      ok: true,
      summary: `${models.length} model(s) available`,
      specChanged: false,
      data: { models },
    };
  },
};
