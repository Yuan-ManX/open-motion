import { TOOL_NAMES, TOOL_DESCRIPTIONS } from "@openmotion/shared";
import { listSkills, getSkillsSummary } from "./skillsRouter.js";
import { MODEL_REGISTRY, getAllProviders } from "./provider/registry.js";
import { INTENT_PATTERNS } from "./intents.js";

/**
 * The 15 cross-disciplinary analysis engines exposed via
 * /api/projects/:id/analyze-all. Each name matches the `name` field used
 * by that batch route so the manifest stays in sync with the engine list.
 */
export const CROSS_DISCIPLINARY_ENGINES: string[] = [
  "physics", "linguistics", "cinema", "astronomy", "chemistry",
  "musicology", "botany", "geology", "weather", "alchemy",
  "architecture", "calligraphy", "mythology", "cartography", "genealogy",
];

/**
 * Motion-intelligence ("motionX") engines — specialized analysis, critique,
 * and generation modules that operate on a project spec. Names match the
 * motionX*.ts modules in src/agent/. Exposed as a static catalog so the UI
 * can list them without scanning the filesystem.
 */
export const MOTION_X_ENGINES: string[] = [
  "Adaptive", "Auditor", "AutoFix", "Budget", "Calibration", "CausalInference",
  "Choreographer", "Codec", "Cognition", "Cohesion", "Collaboration",
  "Comparator", "Conflict", "Context", "Critique", "Curator", "Dialect",
  "Dream", "Ecology", "Emotion", "Entropy", "Evolution", "ExportOptimizer",
  "Forecast", "Genome", "Harmonics", "Intelligence", "Jury", "KnowledgeGraph",
  "LayerGraph", "Lineage", "Narrative", "Negotiation", "Path", "Perception",
  "Persona", "Poetics", "Profiler", "Recipes", "Reflection", "Remix",
  "Resonance", "Semantics", "ShaderField", "Skills", "StateGraph",
  "Strategist", "Storytelling", "StyleTransfer", "Synesthesia", "Synthesis",
  "Testing", "Thermodynamics", "Topology", "Trajectory",
];

export interface CapabilityManifest {
  /** All registered tool names with their descriptions. */
  tools: Array<{ name: string; description: string }>;
  /** All skills from the skills router. */
  skills: ReturnType<typeof listSkills>;
  /** Aggregate counts describing the skills system. */
  skillsSummary: ReturnType<typeof getSkillsSummary>;
  /** Cross-disciplinary analysis engine names. */
  crossDisciplinaryEngines: string[];
  /** Motion-intelligence engine names. */
  motionXEngines: string[];
  /** Number of intent patterns used by classifyIntent. */
  intentPatternCount: number;
  /** All provider names known to the model registry. */
  providers: string[];
  /** Number of models in the registry. */
  modelCount: number;
  /** ISO timestamp the manifest was built. */
  generatedAt: string;
}

/**
 * Build a single aggregated view of everything the agent can do: tools,
 * skills, engines, intents, and providers. Used by the
 * GET /api/agent/capabilities route so the frontend can render a unified
 * capabilities overview without calling a dozen separate endpoints.
 */
export function buildCapabilityManifest(): CapabilityManifest {
  return {
    tools: TOOL_NAMES.map((name) => ({
      name,
      description: TOOL_DESCRIPTIONS[name] ?? "",
    })),
    skills: listSkills(),
    skillsSummary: getSkillsSummary(),
    crossDisciplinaryEngines: CROSS_DISCIPLINARY_ENGINES,
    motionXEngines: MOTION_X_ENGINES,
    intentPatternCount: INTENT_PATTERNS.length,
    providers: getAllProviders(),
    modelCount: MODEL_REGISTRY.length,
    generatedAt: new Date().toISOString(),
  };
}
