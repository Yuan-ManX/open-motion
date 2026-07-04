import { Router } from "express";
import { HttpError } from "../middleware/error.js";
import { runAsync } from "../../utils/async.js";
import {
  listTemplates,
  getTemplate,
} from "../../db/repositories/templates.js";

export const templatesRouter = Router();

templatesRouter.get(
  "/templates",
  runAsync(async (req, res) => {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;
    res.json(listTemplates(category, tag));
  }),
);

templatesRouter.get(
  "/templates/:id",
  runAsync(async (req, res) => {
    const tpl = getTemplate(req.params.id);
    if (!tpl) throw new HttpError(404, "template not found");
    res.json(tpl);
  }),
);
