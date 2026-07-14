import { Router } from "express";
import { z } from "zod";
import { runAsync } from "../../utils/async.js";
import { saveVersion, listVersions, getVersion, deleteVersion, restoreVersion } from "../../db/repositories/versions.js";
import { getProjectSpec } from "../../db/repositories/projects.js";

export const versionsRouter = Router();

const CreateVersionSchema = z.object({
  label: z.string().min(1).max(120),
});

versionsRouter.post(
  "/projects/:id/versions",
  runAsync(async (req, res) => {
    const parsed = CreateVersionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "label is required (1-120 chars)" });
      return;
    }
    const spec = getProjectSpec(req.params.id);
    if (!spec) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    const version = saveVersion(req.params.id, parsed.data.label);
    if (!version) {
      res.status(500).json({ error: "failed to capture version" });
      return;
    }
    res.status(201).json(version);
  }),
);

versionsRouter.get(
  "/projects/:id/versions",
  runAsync(async (req, res) => {
    res.json(listVersions(req.params.id));
  }),
);

versionsRouter.get(
  "/projects/:id/versions/:versionId",
  runAsync(async (req, res) => {
    const spec = getVersion(req.params.versionId);
    if (!spec) {
      res.status(404).json({ error: "version not found" });
      return;
    }
    res.json(spec);
  }),
);

versionsRouter.post(
  "/projects/:id/versions/:versionId/restore",
  runAsync(async (req, res) => {
    const restored = restoreVersion(req.params.versionId);
    if (!restored) {
      res.status(404).json({ error: "version not found" });
      return;
    }
    res.json(restored);
  }),
);

versionsRouter.delete(
  "/projects/:id/versions/:versionId",
  runAsync(async (req, res) => {
    const ok = deleteVersion(req.params.versionId);
    if (!ok) {
      res.status(404).json({ error: "version not found" });
      return;
    }
    res.status(204).end();
  }),
);
