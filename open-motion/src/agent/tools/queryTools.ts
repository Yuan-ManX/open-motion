import type { MotionComponent, Scene, Easing, ToolName } from "@openmotion/shared";
import { getProject, getProjectSpec, updateProject } from "../../db/repositories/projects.js";
import { listComponents, deleteComponent, createComponent } from "../../db/repositories/components.js";
import { listTemplates } from "../../db/repositories/templates.js";
import { instantiateTemplate } from "../../motion/templates/index.js";
import { TEMPLATES } from "../../motion/templates/index.js";
import { publicBaseUrl } from "../../config.js";
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
};
