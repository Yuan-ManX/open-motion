import type { Template } from "@openmotion/shared";
import { HttpError } from "../middleware/error.js";
import { listTemplates, getTemplate } from "../../db/repositories/templates.js";

export function listAllTemplates(category?: string, tag?: string): Template[] {
  return listTemplates(category, tag);
}

export function getTemplateOrThrow(id: string): Template {
  const tpl = getTemplate(id);
  if (!tpl) throw new HttpError(404, "template not found");
  return tpl;
}
