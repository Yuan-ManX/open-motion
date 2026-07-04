import { Router } from "express";
import { runAsync } from "../../utils/async.js";
import { listAllTemplates, getTemplateOrThrow } from "../services/templateService.js";

export const templatesRouter = Router();

templatesRouter.get(
  "/templates",
  runAsync(async (req, res) => {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;
    res.json(listAllTemplates(category, tag));
  }),
);

templatesRouter.get(
  "/templates/:id",
  runAsync(async (req, res) => {
    res.json(getTemplateOrThrow(req.params.id));
  }),
);
