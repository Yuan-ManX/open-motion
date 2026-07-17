import { Router } from "express";
import { normalize, join } from "node:path";
import { z } from "zod";
import { ExportVideoInputSchema } from "@openmotion/shared";
import { HttpError } from "../middleware/error.js";
import { validate, validated } from "../middleware/validate.js";
import { runAsync } from "../../utils/async.js";
import {
  exportHtml,
  exportVideo,
  exportCode,
  exportFramer,
  exportLottie,
  getJobOrThrow,
} from "../services/exportService.js";
import { exportsDir } from "../../db/index.js";
import { publicBaseUrl } from "../../config.js";

export const exportRouter = Router();

exportRouter.post(
  "/projects/:id/export/html",
  runAsync(async (req, res) => {
    const result = exportHtml(req.params.id);
    res.json({ url: result.url, filename: result.filename, html: result.html });
  }),
);

exportRouter.post(
  "/projects/:id/export/video",
  validate(ExportVideoInputSchema),
  runAsync(async (req, res) => {
    const input = validated<z.infer<typeof ExportVideoInputSchema>>(req);
    const handle = await exportVideo(req.params.id, input);
    res.status(202).json(handle);
  }),
);

exportRouter.get(
  "/projects/:id/export/css",
  runAsync(async (req, res) => {
    res.json(exportCode(req.params.id, "css"));
  }),
);

exportRouter.get(
  "/projects/:id/export/json",
  runAsync(async (req, res) => {
    res.json(exportCode(req.params.id, "json"));
  }),
);

exportRouter.get(
  "/projects/:id/export/react",
  runAsync(async (req, res) => {
    res.json(exportCode(req.params.id, "react"));
  }),
);

exportRouter.get(
  "/projects/:id/export/framer",
  runAsync(async (req, res) => {
    res.json(exportFramer(req.params.id));
  }),
);

exportRouter.get(
  "/projects/:id/export/lottie",
  runAsync(async (req, res) => {
    const fps = req.query.fps ? parseInt(String(req.query.fps), 10) : undefined;
    res.json(exportLottie(req.params.id, fps));
  }),
);

exportRouter.get(
  "/exports/jobs/:jobId",
  runAsync(async (req, res) => {
    res.json(getJobOrThrow(req.params.jobId));
  }),
);

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
