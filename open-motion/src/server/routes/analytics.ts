import { Router } from "express";
import { getProjectSpec, listProjects } from "../../db/repositories/projects.js";
import { analyzeMotion } from "../../motion/analysis.js";
import { runQualityPipeline } from "../../agent/qualityPipeline.js";
import { getToolUsageSnapshot, getToolTaxonomySummary } from "../../agent/tools/registry.js";

export const analyticsRouter = Router();

// GET /api/analytics/overview — cross-project aggregate analytics
analyticsRouter.get("/analytics/overview", (_req, res) => {
  const projects = listProjects();
  const totals = {
    projectCount: projects.length,
    componentCount: 0,
    templateCount: 0,
    keyframeCount: 0,
    durationMs: 0,
  };
  const complexityBuckets = { low: 0, medium: 0, high: 0, extreme: 0 };
  const perProject: Array<{
    projectId: string;
    name: string;
    componentCount: number;
    keyframes: number;
    complexity: string;
    overallQuality: number | null;
    grade: string | null;
  }> = [];
  for (const p of projects) {
    const spec = getProjectSpec(p.id);
    if (!spec) continue;
    totals.componentCount += spec.components.length;
    const motion = analyzeMotion(spec);
    const totalKfs = spec.components.reduce((acc, c) => acc + (c.keyframes?.length ?? 0), 0);
    const totalDur = spec.components.reduce((acc, c) => acc + (c.durationMs ?? 0), 0);
    const complexityScore = motion.score;
    totals.keyframeCount += totalKfs;
    totals.durationMs += totalDur;
    totals.templateCount += spec.components.filter((c) => !!c.templateId).length;
    const bucket = complexityScore < 30 ? "low" : complexityScore < 60 ? "medium" : complexityScore < 85 ? "high" : "extreme";
    complexityBuckets[bucket] += 1;
    const quality = spec.components.length > 0 ? runQualityPipeline(spec.components) : null;
    perProject.push({
      projectId: p.id,
      name: p.name,
      componentCount: spec.components.length,
      keyframes: totalKfs,
      complexity: bucket,
      overallQuality: quality?.overall ?? null,
      grade: quality?.grade ?? null,
    });
  }
  res.json({
    ok: true,
    totals,
    complexityBuckets,
    perProject,
  });
});

// GET /api/analytics/tools — tool executor usage snapshot and taxonomy summary
analyticsRouter.get("/analytics/tools", (_req, res) => {
  const usage = getToolUsageSnapshot();
  const taxonomy = getToolTaxonomySummary();
  res.json({
    ok: true,
    usage,
    taxonomy,
  });
});

// GET /api/analytics/projects/:id — per-project analytics with quality + complexity
analyticsRouter.get("/analytics/projects/:id", (req, res) => {
  const projectId = req.params.id;
  const spec = getProjectSpec(projectId);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const motion = analyzeMotion(spec);
  const quality = spec.components.length > 0 ? runQualityPipeline(spec.components) : null;
  const propertyFrequency: Record<string, number> = {};
  const easingFrequency: Record<string, number> = {};
  let totalKeyframes = 0;
  let totalDurationMs = 0;
  const transformSet = new Set<string>();
  for (const c of spec.components) {
    totalKeyframes += c.keyframes?.length ?? 0;
    totalDurationMs += c.durationMs ?? 0;
    const fam = c.easing.type === "preset" ? c.easing.name : c.easing.type;
    easingFrequency[fam] = (easingFrequency[fam] ?? 0) + 1;
    for (const kf of c.keyframes) {
      for (const k of Object.keys(kf.properties)) {
        propertyFrequency[k] = (propertyFrequency[k] ?? 0) + 1;
        transformSet.add(k);
      }
    }
  }
  const complexityStats = {
    totalKeyframes,
    totalDurationMs,
    complexityScore: motion.score,
    componentCount: motion.componentCount,
    insights: motion.insights,
  };
  const diversityScore = {
    transformCount: transformSet.size,
    easingFamilyCount: Object.keys(easingFrequency).length,
    propertySpread: Object.keys(propertyFrequency).length,
    overallDiversity: Math.round(
      Math.min(100, (transformSet.size * 10 + Object.keys(easingFrequency).length * 15)),
    ),
  };
  res.json({
    ok: true,
    projectId,
    complexity: complexityStats,
    diversity: diversityScore,
    quality,
    propertyFrequency,
    easingFrequency,
  });
});
