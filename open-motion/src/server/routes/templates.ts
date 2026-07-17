import { Router } from "express";
import { runAsync } from "../../utils/async.js";
import { listAllTemplates, getTemplateOrThrow, searchTemplates } from "../services/templateService.js";
import { generateReactFile } from "../../motion/generator/react.js";
import { generateSpecCss } from "../../motion/generator/css.js";
import { generateStandaloneHtml } from "../../motion/generator/html.js";
import {
  getTemplate as getTemplateDef,
  instantiateTemplate,
  getCategories,
} from "../../motion/templates/index.js";
import { listStylePresets } from "../../motion/stylePresets.js";

export const templatesRouter = Router();

templatesRouter.get(
  "/style-presets",
  runAsync(async (_req, res) => {
    res.json(listStylePresets());
  }),
);

templatesRouter.get(
  "/templates",
  runAsync(async (req, res) => {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;
    res.json(listAllTemplates(category, tag));
  }),
);

templatesRouter.get(
  "/templates/search",
  runAsync(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const limit = req.query.limit ? Math.min(100, parseInt(String(req.query.limit), 10)) : 30;
    if (!q.trim()) {
      res.json({ results: [], total: 0, query: q });
      return;
    }
    const results = searchTemplates(q, limit);
    res.json({ results, total: results.length, query: q });
  }),
);

templatesRouter.get(
  "/templates/categories",
  runAsync(async (_req, res) => {
    res.json(getCategories());
  }),
);

templatesRouter.get(
  "/templates/:id",
  runAsync(async (req, res) => {
    res.json(getTemplateOrThrow(req.params.id));
  }),
);

templatesRouter.get(
  "/templates/:id/code",
  runAsync(async (req, res) => {
    const format = (typeof req.query.format === "string" ? req.query.format : "react") as
      | "react"
      | "framer"
      | "html"
      | "css";
    const customization = {
      color: typeof req.query.color === "string" ? req.query.color : undefined,
      speed: req.query.speed ? parseFloat(String(req.query.speed)) : undefined,
      scale: req.query.scale ? parseFloat(String(req.query.scale)) : undefined,
    };

    // Get the template definition from code (not DB)
    const tplDef = getTemplateDef(req.params.id);
    if (!tplDef) {
      res.status(404).json({ error: "template not found" });
      return;
    }

    // Build components from the template definition
    const drafts = tplDef.build();

    // Apply customization overrides and add synthetic ids (drafts omit id/projectId/timestamps)
    const components = drafts.map((d, i) => {
      const customized = { ...d };
      if (customization.color) {
        customized.style = { ...customized.style, color: customization.color };
      }
      if (customization.speed && customization.speed > 0) {
        customized.durationMs = Math.round(customized.durationMs / customization.speed);
      }
      if (customization.scale) {
        const s = customization.scale;
        customized.style = {
          ...customized.style,
          width: `${Math.round((typeof customized.style.width === "number" ? customized.style.width : 200) * s)}px`,
          height: `${Math.round((typeof customized.style.height === "number" ? customized.style.height : 200) * s)}px`,
        };
      }
      return {
        ...customized,
        id: `tpl_${tplDef.id}_${i}`,
        projectId: "preview",
        createdAt: "",
        updatedAt: "",
      };
    });

    // Generate code based on format
    let code: string;
    let language: string;
    let filename: string;

    if (format === "react") {
      code = generateReactFile(components as any, { format: "react", typescript: true });
      language = "tsx";
      filename = `${tplDef.id}.tsx`;
    } else if (format === "framer") {
      code = generateReactFile(components as any, { format: "framer", typescript: true });
      language = "tsx";
      filename = `${tplDef.id}.framer.tsx`;
    } else if (format === "css") {
      code = generateSpecCss(components as any);
      language = "css";
      filename = `${tplDef.id}.css`;
    } else {
      // html format
      const spec = {
        project: {
          id: "preview",
          name: tplDef.name,
          description: tplDef.description,
          scenes: [],
          tokens: {},
          globalTiming: {},
          status: "draft" as const,
          sourceTemplateId: tplDef.id,
          createdAt: "",
          updatedAt: "",
        },
        components: components as any,
      };
      code = generateStandaloneHtml(spec as any);
      language = "html";
      filename = `${tplDef.id}.html`;
    }

    res.json({ code, language, filename });
  }),
);
