import { Router } from "express";
import { getProjectSpec } from "../../db/repositories/projects.js";
import { runQualityPipeline } from "../../agent/qualityPipeline.js";

export const qualityRouter = Router();

// POST /api/projects/:id/quality — run the full quality pipeline on a project
// and return the aggregate grade, per-dimension findings, and autofix hints.
qualityRouter.post("/projects/:id/quality", (req, res) => {
  const projectId = req.params.id;
  const spec = getProjectSpec(projectId);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const report = runQualityPipeline(spec.components);
  const componentsOnly = Array.isArray(req.body?.components) ? req.body.components : undefined;
  const scoped = componentsOnly
    ? spec.components.filter((c) => componentsOnly.includes(c.id))
    : spec.components;
  const scopedReport = componentsOnly ? runQualityPipeline(scoped) : report;
  res.json({
    ok: true,
    projectId,
    scope: componentsOnly ? "component_subset" : "project",
    scopedComponentCount: scoped.length,
    report: scopedReport,
  });
});

// GET /api/projects/:id/quality/dimensions — describe supported quality dimensions
qualityRouter.get("/projects/:id/quality/dimensions", (_req, res) => {
  res.json({
    ok: true,
    dimensions: [
      {
        key: "performance",
        name: "Performance",
        description: "Keyframe count, filter usage, infinite loop cost, GPU layer overhead",
        threshold: 70,
      },
      {
        key: "a11y",
        name: "Accessibility",
        description: "Seizure-risk flash detection, infinite-loop WCAG 2.2.2, baseline contrast risk",
        threshold: 75,
      },
      {
        key: "cross_browser",
        name: "Cross-browser",
        description: "Animating clipPath/blur on engines that may render or perform differently",
        threshold: 80,
      },
      {
        key: "rhythm",
        name: "Rhythm Coherence",
        description: "Alignment of durations to a shared rhythm grid and easing-energy variance",
        threshold: 80,
      },
      {
        key: "brand",
        name: "Brand Consistency",
        description: "Easing family consistency and brand palette coverage in components",
        threshold: 85,
      },
      {
        key: "physics",
        name: "Physics Stability",
        description: "Spring damping ratio (zeta) — avoid underdamped ringing and overdamped lag",
        threshold: 80,
      },
    ],
  });
});
