/**
 * Domain analysis tool executors.
 *
 * The platform exposes a broad family of lens analysis tools (alchemy,
 * architecture, astronomy, botany, chemistry, cinema, ...). Each one maps to a
 * dedicated motion <Domain> engine that turns a MotionSpec into a structured
 * report. Wiring them here means the agent produces real, spec-derived insight
 * instead of a generic simulated acknowledgment.
 */

import type { ToolName, MotionSpec } from "@openmotion/shared";
import { getProjectSpec } from "../../db/repositories/projects.js";
import type { ToolContext, ToolResult } from "./registry.js";

type Executor = (args: Record<string, unknown>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;

// --- Domain analysis engines ------------------------------------------------

import { analyzeAlchemy, formatAlchemyReport } from "../motionAlchemy.js";
import { analyzeArchitecture, formatArchitectureReport } from "../motionArchitecture.js";
import { analyzeAstronomy, formatAstronomyReport } from "../motionAstronomy.js";
import { analyzeBotany, formatBotanyReport } from "../motionBotany.js";
import { analyzeCalligraphy, formatCalligraphyReport } from "../motionCalligraphy.js";
import { analyzeCartography, formatCartographyReport } from "../motionCartography.js";
import { analyzeChemistry, formatChemistryReport } from "../motionChemistry.js";
import { analyzeCinema, formatCinemaReport } from "../motionCinema.js";
import { analyzeCognitiveLoad, formatCognitionReport } from "../motionCognition.js";
import { analyzeEcosystem, formatEcosystemReport } from "../motionEcology.js";
import { analyzeEntropy, formatEntropyReport } from "../motionEntropy.js";
import { analyzeGenealogy, formatGenealogyReport } from "../motionGenealogy.js";
import { analyzeGeology, formatGeologyReport } from "../motionGeology.js";
import { analyzeHarmonics, formatHarmonicsReport } from "../motionHarmonics.js";
import { analyzeLinguistics, formatLinguisticsReport } from "../motionLinguistics.js";
import { analyzeMusicology, formatMusicologyReport } from "../motionMusicology.js";
import { analyzeMythology, formatMythologyReport } from "../motionMythology.js";
import { analyzePhysics, formatPhysicsReport } from "../motionPhysics.js";
import { analyzePoetics, formatPoeticsReport } from "../motionPoetics.js";
import { analyzeResonance, formatResonanceReport } from "../motionResonance.js";
import { analyzeTopology, formatTopologyReport } from "../motionTopology.js";
import { analyzeWeather, formatWeatherReport } from "../motionWeather.js";

// --- Action engines ----------------------------------------------------------

import { verifyMotion, formatVerificationReport } from "../motionVerification.js";
import { selfCorrectMotion, formatSelfCorrectionReport } from "../motionSelfCorrect.js";
import {
  evolveMotion,
  formatEvolutionSummary,
  listEvolutionStrategies,
} from "../motionEvolution.js";

/** A uniform domain analysis: a spec-feeding analyzer plus a report formatter. */
interface DomainAnalyzer {
  // The analyzer and formatter are heterogeneous across engines, so the result
  // is intentionally loosely typed here and narrowed inside each engine.
  analyze: (spec: MotionSpec) => unknown;
  format: (result: any) => string;
  label: string;
}

/** Registry of every domain-analysis tool wired to its motion engine. */
const DOMAIN_ANALYZERS: Record<string, DomainAnalyzer> = {
  analyze_alchemy: { analyze: analyzeAlchemy, format: formatAlchemyReport, label: "alchemy" },
  analyze_architecture: { analyze: analyzeArchitecture, format: formatArchitectureReport, label: "architecture" },
  analyze_astronomy: { analyze: analyzeAstronomy, format: formatAstronomyReport, label: "astronomy" },
  analyze_botany: { analyze: analyzeBotany, format: formatBotanyReport, label: "botany" },
  analyze_calligraphy: { analyze: analyzeCalligraphy, format: formatCalligraphyReport, label: "calligraphy" },
  analyze_cartography: { analyze: analyzeCartography, format: formatCartographyReport, label: "cartography" },
  analyze_chemistry: { analyze: analyzeChemistry, format: formatChemistryReport, label: "chemistry" },
  analyze_cinema: { analyze: analyzeCinema, format: formatCinemaReport, label: "cinema" },
  analyze_cognitive_load: { analyze: analyzeCognitiveLoad, format: formatCognitionReport, label: "cognitive load" },
  analyze_ecosystem: { analyze: analyzeEcosystem, format: formatEcosystemReport, label: "ecosystem" },
  analyze_entropy: { analyze: analyzeEntropy, format: formatEntropyReport, label: "entropy" },
  analyze_genealogy: { analyze: analyzeGenealogy, format: formatGenealogyReport, label: "genealogy" },
  analyze_geology: { analyze: analyzeGeology, format: formatGeologyReport, label: "geology" },
  analyze_harmonics: { analyze: analyzeHarmonics, format: formatHarmonicsReport, label: "harmonics" },
  analyze_linguistics: { analyze: analyzeLinguistics, format: formatLinguisticsReport, label: "linguistics" },
  analyze_musicology: { analyze: analyzeMusicology, format: formatMusicologyReport, label: "musicology" },
  analyze_mythology: { analyze: analyzeMythology, format: formatMythologyReport, label: "mythology" },
  analyze_physics: { analyze: analyzePhysics, format: formatPhysicsReport, label: "physics" },
  analyze_poetics: { analyze: analyzePoetics, format: formatPoeticsReport, label: "poetics" },
  analyze_resonance: { analyze: analyzeResonance, format: formatResonanceReport, label: "resonance" },
  analyze_topology: { analyze: analyzeTopology, format: formatTopologyReport, label: "topology" },
  analyze_weather: { analyze: analyzeWeather, format: formatWeatherReport, label: "weather" },
};

/** Build a domain-analysis executor from a registered analyzer. */
function makeDomainExecutor(name: string, entry: DomainAnalyzer): Executor {
  return (_args, ctx) => {
    const spec = getProjectSpec(ctx.projectId);
    if (!spec) {
      return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    }
    const result = entry.analyze(spec);
    const report = entry.format(result);
    return {
      ok: true,
      summary: report,
      specChanged: false,
      data: { domain: entry.label, result },
    };
  };
}

export const domainAnalysisExecutors: Partial<Record<ToolName, Executor>> = {};

for (const [toolName, entry] of Object.entries(DOMAIN_ANALYZERS)) {
  domainAnalysisExecutors[toolName as ToolName] = makeDomainExecutor(toolName, entry);
}

// verify_motion — evaluate the user's request against the resulting spec.
domainAnalysisExecutors.verify_motion = (args, ctx) => {
  const spec = getProjectSpec(ctx.projectId);
  if (!spec) {
    return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
  }
  const message = typeof args.message === "string" ? args.message : "";
  const report = verifyMotion(message, spec);
  return {
    ok: true,
    summary: formatVerificationReport(report),
    specChanged: false,
    data: report,
  };
};

// self_correct — apply automated remediations to close the intent gap.
domainAnalysisExecutors.self_correct = (args, ctx) => {
  const spec = getProjectSpec(ctx.projectId);
  if (!spec) {
    return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
  }
  const intent = typeof args.intent === "string" ? args.intent : "";
  if (!intent) {
    return { ok: false, summary: "self_correct requires an intent describing the goal", specChanged: false };
  }
  const report = selfCorrectMotion(intent, spec);
  return {
    ok: true,
    summary: formatSelfCorrectionReport(report),
    specChanged: report.applied.length > 0,
    data: report,
  };
};

// evolve_motion — run a genetic search over the composition.
domainAnalysisExecutors.evolve_motion = (args, ctx) => {
  const spec = getProjectSpec(ctx.projectId);
  if (!spec) {
    return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
  }
  const partialConfig =
    args && typeof args === "object"
      ? (args as Record<string, unknown>)
      : {};
  const result = evolveMotion(spec, partialConfig as never);
  const seedScore = result.history[0]?.bestFitness ?? 0;
  const summary = formatEvolutionSummary(
    result.history,
    result.best,
    seedScore,
    result.improvement,
  );
  return {
    ok: true,
    summary,
    specChanged: false,
    data: { best: result.best.spec, fitness: result.best.fitness, generations: result.history.length - 1 },
  };
};

// list_evolution_strategies — enumerate available evolution presets.
domainAnalysisExecutors.list_evolution_strategies = (_args, _ctx) => {
  const strategies = listEvolutionStrategies();
  return {
    ok: true,
    summary: `${strategies.length} evolution strategy(ies) available`,
    specChanged: false,
    data: strategies,
  };
};