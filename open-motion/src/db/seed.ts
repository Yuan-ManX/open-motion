import type { Template } from "@openmotion/shared";
import { now } from "../utils/id.js";
import { upsertTemplate, countTemplates } from "./repositories/templates.js";
import { TEMPLATES, instantiateTemplate } from "../motion/templates/index.js";
import { generateStandaloneHtml } from "../motion/generator/html.js";

/** Build a template record (with a live preview HTML) from a template definition. */
function buildTemplateRecord(tplId: string): Template {
  const tpl = TEMPLATES.find((t) => t.id === tplId)!;
  const tempProjectId = `preview_${tpl.id}`;
  const components = instantiateTemplate(tpl.id, tempProjectId);
  const spec = {
    project: {
      id: tempProjectId,
      name: tpl.name,
      description: tpl.description,
      scenes: [],
      tokens: {},
      globalTiming: {},
      status: "draft" as const,
      sourceTemplateId: tpl.id,
      createdAt: now(),
      updatedAt: now(),
    },
    components,
  };
  const previewHtml = generateStandaloneHtml(spec);
  return {
    id: tpl.id,
    name: tpl.name,
    category: tpl.category,
    description: tpl.description,
    tags: tpl.tags,
    spec,
    previewHtml,
    createdAt: now(),
  };
}

export function seedTemplates(): void {
  for (const tpl of TEMPLATES) {
    upsertTemplate(buildTemplateRecord(tpl.id));
  }
}

export { countTemplates };
