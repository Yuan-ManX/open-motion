import { Router } from "express";
import { join, normalize } from "node:path";
import { getProjectSpec } from "../../db/repositories/projects.js";
import { generateStandaloneHtml } from "../../motion/generator/html.js";
import { exportsDir } from "../../db/index.js";
import { publicBaseUrl } from "../../config.js";
import { HttpError } from "../middleware/error.js";
import { runAsync } from "../../utils/async.js";

export const previewRouter = Router();

/** Live, always-fresh HTML preview of a project's current motion spec. */
previewRouter.get(
  "/projects/:id/preview",
  runAsync(async (req, res) => {
    const spec = getProjectSpec(req.params.id);
    if (!spec) throw new HttpError(404, "project not found");
    const html = generateStandaloneHtml(spec);
    res.type("html").send(html);
  }),
);

/** Serve a previously exported standalone HTML file by filename. */
previewRouter.get(
  "/exports/:filename",
  runAsync(async (req, res) => {
    const filename = req.params.filename;
    if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      throw new HttpError(400, "invalid filename");
    }
    const filePath = normalize(join(exportsDir, filename));
    res.sendFile(filePath, (err) => {
      if (err) {
        res.status(404).json({ error: "export not found", url: `${publicBaseUrl()}/api/exports/${filename}` });
      }
    });
  }),
);
