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
import { searchRecipes } from "../../motion/recipes.js";
import { listStylePresets } from "../../motion/stylePresets.js";
import { listShaderEffects } from "../../motion/shaders.js";
import { listPresetPacks } from "../../motion/presetPacks.js";
import { EXPORT_PRESETS } from "../../motion/exportPresets.js";
import { PRESETS, PRESET_NAMES } from "./presets.js";
import { publicBaseUrl } from "../../config.js";
import { generateMedia, isModalityAvailable } from "../provider/generation.js";
import { MODEL_REGISTRY, modelsByProvider, modelsByModality } from "../provider/registry.js";
import { routeSkill, listSkills, getSkillsSummary } from "../skillsRouter.js";
import { listThemes, getThemesByPersonality } from "../../motion/motionThemeSystem.js";
import { listRhythmPatterns, getRhythmPatternsByCategory, computeRhythmTiming, applyRhythmToItems, visualizeRhythm } from "../../motion/rhythmPatterns.js";
import { listArcTemplates } from "../../motion/motionSequencePlanner.js";
import type { ToolContext, ToolResult } from "./registry.js";

type Executor = (args: Record<string, unknown>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;

/** Score relevance of a catalog entry against a query. */
function scoreCatalogMatch(query: string, fields: string[]): number {
  const queryTokens = query.split(/\s+/).filter((t) => t.length >= 2);
  let maxScore = 0;
  for (const field of fields) {
    if (!field) continue;
    const lower = field.toLowerCase();
    if (lower === query) {
      maxScore = Math.max(maxScore, 100);
    } else if (lower.startsWith(query)) {
      maxScore = Math.max(maxScore, 80);
    } else if (lower.includes(query)) {
      maxScore = Math.max(maxScore, 60);
    } else {
      const words = lower.split(/\s+/);
      // Whole single-token query matched against a field word.
      let best = 0;
      for (const word of words) {
        if (word.startsWith(query)) best = Math.max(best, 40);
        else if (word.includes(query) && query.length >= 3) best = Math.max(best, 20);
      }
      // Multi-word query: score by the fraction of query tokens appearing in
      // this field's words, so "gentle float" still surfaces "ambient float"
      // and "gentle entrance" resources rather than returning nothing.
      if (queryTokens.length > 1) {
        let hits = 0;
        for (const qt of queryTokens) {
          if (words.some((w) => w === qt || w.startsWith(qt) || w.includes(qt))) hits++;
        }
        const frac = hits / queryTokens.length;
        if (frac >= 0.5) best = Math.max(best, Math.round(30 * frac));
      }
      maxScore = Math.max(maxScore, best);
    }
  }
  return maxScore;
}

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
    // Instantiate the template first; only remove existing components if
    // the new template is valid. This prevents data loss when a template
    // ID is unrecognized.
    const components = instantiateTemplate(templateId, ctx.projectId);
    if (components.length === 0) {
      return { ok: false, summary: `template ${templateId} not found`, specChanged: false };
    }
    for (const c of listComponents(ctx.projectId)) {
      deleteComponent(ctx.projectId, c.id);
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
  search_catalog: (args) => {
    const query = String(args.query ?? "").toLowerCase().trim();
    const limit = Math.min(Number(args.limit) || 10, 50);
    if (!query) {
      return { ok: false, summary: "query is required", specChanged: false };
    }
    const results: Array<{ type: string; id: string; name: string; description: string; score: number }> = [];

    // Search recipes
    for (const r of searchRecipes(query, limit)) {
      results.push({ type: "recipe", id: r.id, name: r.name, description: r.description ?? "", score: 80 });
    }
    // Search templates
    for (const t of TEMPLATES) {
      const score = scoreCatalogMatch(query, [t.id, t.name, t.description, t.category, ...(t.tags ?? [])]);
      if (score > 0) results.push({ type: "template", id: t.id, name: t.name, description: t.description, score });
    }
    // Search style presets
    for (const s of listStylePresets()) {
      const score = scoreCatalogMatch(query, [s.name, s.description ?? "", ...(s.tags ?? [])]);
      if (score > 0) results.push({ type: "style", id: s.id, name: s.name, description: s.description ?? "", score });
    }
    // Search preset packs (curated template bundles)
    for (const p of listPresetPacks()) {
      const score = scoreCatalogMatch(query, [p.name, p.description, ...(p.tags ?? [])]);
      if (score > 0) results.push({ type: "preset-pack", id: p.id, name: p.name, description: p.description, score });
    }
    // Search animation presets (shake/wiggle/float/glow/heartbeat/typewriter)
    for (const name of PRESET_NAMES) {
      const preset = PRESETS[name];
      const description = `${name} animation preset — ${preset.keyframes.length} keyframes, ${preset.durationMs}ms, ${preset.iterationCount === "infinite" ? "looping" : "one-shot"}`;
      const score = scoreCatalogMatch(query, [name, description]);
      if (score > 0) results.push({ type: "animation-preset", id: name, name, description, score });
    }
    // Search export presets (platform-aware export profiles)
    for (const e of EXPORT_PRESETS) {
      const score = scoreCatalogMatch(query, [
        e.name,
        e.description,
        e.platform,
        e.format,
        ...(e.keywords ?? []),
        ...(e.recommendedFor ?? []),
      ]);
      if (score > 0) results.push({ type: "export-preset", id: e.id, name: e.name, description: e.description, score });
    }
    // Search rhythm patterns
    for (const r of listRhythmPatterns()) {
      const score = scoreCatalogMatch(query, [r.name, r.description, r.category]);
      if (score > 0) results.push({ type: "rhythm", id: r.id, name: r.name, description: r.description, score });
    }
    // Search motion themes
    for (const t of listThemes()) {
      const score = scoreCatalogMatch(query, [t.name, t.description, t.personality]);
      if (score > 0) results.push({ type: "motion-theme", id: t.id, name: t.name, description: t.description, score });
    }
    // Search narrative arcs
    for (const a of listArcTemplates()) {
      const score = scoreCatalogMatch(query, [a.name, a.description]);
      if (score > 0) results.push({ type: "narrative-arc", id: a.id, name: a.name, description: a.description, score });
    }
    // Search shaders
    for (const sh of listShaderEffects()) {
      const score = scoreCatalogMatch(query, [sh.name, sh.description, sh.category]);
      if (score > 0) results.push({ type: "shader", id: sh.id, name: sh.name, description: sh.description, score });
    }
    // Search choreography patterns
    for (const cp of CHOREOGRAPHY_PATTERNS) {
      const score = scoreCatalogMatch(query, [cp.name, cp.description]);
      if (score > 0) results.push({ type: "choreography", id: cp.id, name: cp.name, description: cp.description, score });
    }
    // Search story genres
    for (const g of listStoryGenres()) {
      const score = scoreCatalogMatch(query, [g.name, g.description]);
      if (score > 0) results.push({ type: "story-genre", id: g.id, name: g.name, description: g.description, score });
    }

    results.sort((a, b) => b.score - a.score);
    const limited = results.slice(0, limit);
    return {
      ok: true,
      summary: `${results.length} catalog match(es) for "${query}"`,
      specChanged: false,
      data: {
        results: limited,
        total: results.length,
        query,
      },
    };
  },
  route_skill: (args) => {
    const userInput = String(args.userInput ?? "");
    if (!userInput) {
      return { ok: false, summary: "userInput is required", specChanged: false };
    }
    const result = routeSkill(userInput);
    return {
      ok: true,
      summary: `Routed to "${result.primary.name}" (intent: ${result.intent}, confidence: ${(result.confidence * 100).toFixed(0)}%) with ${result.supporting.length} supporting skill(s)`,
      specChanged: false,
      data: {
        intent: result.intent,
        confidence: result.confidence,
        primary: {
          id: result.primary.id,
          name: result.primary.name,
          description: result.primary.description,
          category: result.primary.category,
          complexity: result.primary.complexity,
          tools: result.primary.tools,
          estimatedSteps: result.primary.estimatedSteps,
        },
        supporting: result.supporting.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          tools: s.tools,
        })),
        plan: result.plan,
      },
    };
  },
  list_skills: (args) => {
    const category = args.category as "creation" | "analysis" | "optimization" | "export" | "editing" | "intelligence" | undefined;
    const skills = listSkills(category);
    const summary = getSkillsSummary();
    return {
      ok: true,
      summary: `${skills.length} skill(s)${category ? ` in ${category}` : ""} — ${summary.totalSkills} total across ${Object.keys(summary.byCategory).length} categories`,
      specChanged: false,
      data: {
        skills: skills.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          category: s.category,
          complexity: s.complexity,
          tools: s.tools,
          mockAvailable: s.mockAvailable,
          estimatedSteps: s.estimatedSteps,
        })),
        summary,
      },
    };
  },

  list_narrative_arcs: () => {
    const arcs = listArcTemplates();
    return {
      ok: true,
      summary: `${arcs.length} narrative arc templates available`,
      specChanged: false,
      data: {
        arcs: arcs.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          defaultSceneCount: a.defaultSceneCount,
          toneProgression: a.toneProgression,
        })),
        count: arcs.length,
      },
    };
  },

  list_motion_themes: (args) => {
    const personality = args.personality as ReturnType<typeof Object.keys>[0] | undefined;
    const themes = personality
      ? getThemesByPersonality(personality as never)
      : listThemes();
    return {
      ok: true,
      summary: `${themes.length} motion theme(s) available${personality ? ` for personality "${personality}"` : ""}`,
      specChanged: false,
      data: {
        themes: themes.map((t) => ({
          id: t.id,
          name: t.name,
          personality: t.personality,
          description: t.description,
          tags: t.tags,
          easingFamily: {
            standard: t.easingFamily.standard.type === "preset" ? t.easingFamily.standard.name : "bezier",
            spring: t.easingFamily.spring,
          },
          timingScale: t.timingScale,
          vocabulary: t.vocabulary,
        })),
        count: themes.length,
      },
    };
  },

  list_rhythm_patterns: (args) => {
    const category = args.category as never | undefined;
    const patterns = category
      ? getRhythmPatternsByCategory(category)
      : listRhythmPatterns();
    return {
      ok: true,
      summary: `${patterns.length} rhythm pattern(s) available${category ? ` in category "${category}"` : ""}`,
      specChanged: false,
      data: {
        patterns: patterns.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          category: p.category,
          bpm: p.bpm,
          timeSignature: `${p.beatsPerMeasure}/${p.beatValue}`,
          beatMultipliers: p.beatMultipliers,
          accents: p.accents,
          tags: p.tags,
        })),
        count: patterns.length,
      },
    };
  },

  apply_rhythm: (args) => {
    const patternId = String(args.patternId) as never;
    const itemCount = Number(args.itemCount);
    if (!patternId || itemCount <= 0) {
      return { ok: false, summary: "patternId and itemCount (positive) are required", specChanged: false };
    }
    const bpm = args.bpm ? Number(args.bpm) : undefined;
    const scale = args.scale ? Number(args.scale) : undefined;
    const result = applyRhythmToItems(patternId, itemCount, { bpm, scale });
    const timing = computeRhythmTiming(patternId, { beatCount: itemCount, bpm, scale });
    const visualization = visualizeRhythm(timing);
    return {
      ok: true,
      summary: `Rhythm "${patternId}" applied to ${itemCount} items: ${result.totalMs}ms total, delays=[${result.delays.slice(0, 8).join(", ")}${result.delays.length > 8 ? "..." : ""}]`,
      specChanged: false,
      data: {
        patternId,
        delays: result.delays,
        accents: result.accents,
        totalMs: result.totalMs,
        bpm: timing.bpm,
        beatTimes: timing.beatTimes,
        beatAccents: timing.beatAccents,
        visualization,
      },
    };
  },
};
