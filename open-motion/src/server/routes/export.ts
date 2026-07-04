import { Router } from "express";
import { normalize, join } from "node:path";
import { z } from "zod";
import { ExportVideoInputSchema } from "@openmotion/shared";
import { HttpError } from "../middleware/error.js";
import { validate, validated } from "../middleware/validate.js";
import { runAsync } from "../../utils/async.js";
import { getProject } from "../../db/repositories/projects.js";
import { getExportJob } from "../../db/repositories/exports.js";
import { exportProjectHtml } from "../../export/html.js";
import { exportProjectVideo } from "../../export/video.js";
import { exportProjectCss, exportProjectJson, exportProjectReact } from "../../export/code.js";
import { exportsDir } from "../../db/index.js";
import { publicBaseUrl } from "../../config.js";

export const exportRouter = Router();

/** Synchronously render and persist a standalone HTML artifact for a project. */
exportRouter.post(
  "/projects/:id/export/html",
  runAsync(async (req, res) => {
    if (!getProject(req.params.id)) throw new HttpError(404, "project not found");
    const result = exportProjectHtml(req.params.id);
    if (!result) throw new HttpError(500, "export failed");
    res.json({ url: result.url, filename: result.filename, html: result.html });
  }),
);

/** Start an asynchronous video export job. Returns the jobId to poll. */
exportRouter.post(
  "/projects/:id/export/video",
  validate(ExportVideoInputSchema),
  runAsync(async (req, res) => {
    if (!getProject(req.params.id)) throw new HttpError(404, "project not found");
    const input = validated<z.infer<typeof ExportVideoInputSchema>>(req);
    const handle = await exportProjectVideo(req.params.id, {
      format: input.format,
      fps: input.fps,
      width: input.width,
      height: input.height,
    });
    res.status(202).json(handle);
  }),
);

/** Export animation code as CSS. */
exportRouter.get(
  "/projects/:id/export/css",
  runAsync(async (req, res) => {
    if (!getProject(req.params.id)) throw new HttpError(404, "project not found");
    const result = exportProjectCss(req.params.id);
    if (!result) throw new HttpError(500, "export failed");
    res.json(result);
  }),
);

/** Export the MotionSpec as JSON. */
exportRouter.get(
  "/projects/:id/export/json",
  runAsync(async (req, res) => {
    if (!getProject(req.params.id)) throw new HttpError(404, "project not found");
    const result = exportProjectJson(req.params.id);
    if (!result) throw new HttpError(500, "export failed");
    res.json(result);
  }),
);

/** Export animation as a React component. */
exportRouter.get(
  "/projects/:id/export/react",
  runAsync(async (req, res) => {
    if (!getProject(req.params.id)) throw new HttpError(404, "project not found");
    const result = exportProjectReact(req.params.id);
    if (!result) throw new HttpError(500, "export failed");
    res.json(result);
  }),
);

/** Poll the status of a video export job. */
exportRouter.get(
  "/exports/jobs/:jobId",
  runAsync(async (req, res) => {
    const job = getExportJob(req.params.jobId);
    if (!job) throw new HttpError(404, "job not found");
    res.json(job);
  }),
);

/** Serve a previously rendered video/html export file by filename. */
exportRouter.get(
  "/exports/files/:filename",
  runAsync(async (req, res) => {
    const filename = req.params.filename;
    if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      throw new HttpError(400, "invalid filename");
    }
    const filePath = normalize(join(exportsDir, filename));
    res.sendFile(filePath, (err) => {
      if (err) {
        res
          .status(404)
          .json({ error: "export not found", url: `${publicBaseUrl()}/api/exports/files/${filename}` });
      }
    });
  }),
);
