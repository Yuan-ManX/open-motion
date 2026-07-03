import type { ToolName } from "@openmotion/shared";
import { getProjectSpec } from "../../db/repositories/projects.js";
import { listComponents, deleteComponent, createComponent } from "../../db/repositories/components.js";
import { listTemplates } from "../../db/repositories/templates.js";
import { instantiateTemplate } from "../../motion/templates/index.js";
import { publicBaseUrl } from "../../config.js";
import type { ToolContext, ToolResult } from "./registry.js";

type Executor = (args: Record<string, unknown>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;

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
