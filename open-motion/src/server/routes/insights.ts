import { Router } from "express";
import { getProjectSpec } from "../../db/repositories/projects.js";
import { analyzeMood, listMoods } from "../../motion/moodEngine.js";
import { suggestCreative, suggestStyleTransfer } from "../../motion/creativeEngine.js";
import { analyzeMotion } from "../../motion/analysis.js";
import { analyzeRestraint } from "../../motion/restraint.js";

export const insightsRouter = Router();

/**
 * GET /api/projects/:id/insights — aggregate motion analytics for a project.
 * Returns mood analysis, complexity score, diversity index, quality insights,
 * restraint score, timing distribution, and creative recommendations.
 */
insightsRouter.get("/projects/:id/insights", (_req, res) => {
  const projectId = _req.params.id;
  const spec = getProjectSpec(projectId);

  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  const mood = analyzeMood(spec);
  const quality = analyzeMotion(spec);
  const restraint = analyzeRestraint(spec);
  const creative = suggestCreative(spec, { surprise: true });
  const transfer = suggestStyleTransfer(spec);

  const suggestions = transfer ? [transfer, ...creative.suggestions] : creative.suggestions;

  const easingDistribution: Record<string, number> = {};
  for (const c of spec.components) {
    const fam = c.easing.type === "preset" ? c.easing.name : c.easing.type;
    easingDistribution[fam] = (easingDistribution[fam] ?? 0) + 1;
  }

  const durationBuckets = { fast: 0, normal: 0, slow: 0 };
  for (const c of spec.components) {
    if (c.durationMs < 500) durationBuckets.fast++;
    else if (c.durationMs <= 1500) durationBuckets.normal++;
    else durationBuckets.slow++;
  }

  const propertySet = new Set<string>();
  for (const c of spec.components) {
    for (const kf of c.keyframes) {
      for (const key of Object.keys(kf.properties)) propertySet.add(key);
    }
  }

  const complexityScore = Math.min(
    100,
    Math.round(
      spec.components.length * 5 +
      propertySet.size * 8 +
      Object.keys(easingDistribution).length * 6 +
      (spec.components.filter((c) => c.iterationCount === "infinite").length * 4),
    ),
  );

  res.json({
    mood,
    quality: {
      score: quality.score,
      insights: quality.insights,
      componentCount: quality.componentCount,
    },
    restraint: {
      score: restraint.score,
      warnings: restraint.warnings ?? [],
    },
    creative: {
      suggestions: suggestions.slice(0, 8),
      diversityIndex: creative.diversityIndex,
      projectFingerprint: creative.projectFingerprint,
    },
    timing: {
      easingDistribution,
      durationBuckets,
      totalDurationMs: spec.components.reduce(
        (max, c) => Math.max(max, c.delayMs + c.durationMs * (c.iterationCount === "infinite" ? 1 : Number(c.iterationCount) || 1)),
        0,
      ),
    },
    complexity: {
      score: complexityScore,
      componentCount: spec.components.length,
      propertyCount: propertySet.size,
      easingVariety: Object.keys(easingDistribution).length,
      loopCount: spec.components.filter((c) => c.iterationCount === "infinite").length,
    },
    availableMoods: listMoods(),
  });
});
