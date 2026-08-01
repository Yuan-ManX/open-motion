import type { MotionSpec, MotionComponent } from "@openmotion/shared";
import { instantiateTemplate, TEMPLATES } from "./templates/index.js";
import { applyChoreography, CHOREOGRAPHY_PATTERNS, type ChoreographyPatternId } from "./choreography.js";
import { synthesizeEasing } from "./easingSynthesizer.js";
import { generateHarmony } from "./colorHarmony.js";
import { analyzePrinciples } from "./principles.js";
import { synthesizeMotion } from "./synthesis.js";
import { logger } from "../utils/logger.js";

/**
 * Automated motion pipeline — takes a high-level natural language
 * description and produces a complete, polished motion sequence.
 *
 * The pipeline chains intent analysis, template selection, easing
 * synthesis, choreography, color harmony, and principle validation
 * into a single automated flow.
 */

export type PipelineStage =
  | "intent"
  | "template"
  | "easing"
  | "timing"
  | "choreography"
  | "color"
  | "principles"
  | "synthesis"
  | "complete";

export interface PipelineStep {
  stage: PipelineStage;
  status: "pending" | "running" | "done" | "skipped";
  detail?: string;
  durationMs?: number;
}

export interface PipelineResult {
  spec: MotionSpec;
  steps: PipelineStep[];
  totalDurationMs: number;
  componentCount: number;
  summary: string;
}

export interface PipelineOptions {
  /** Natural language description of the desired motion. */
  description: string;
  /** Optional base spec to build upon. */
  baseSpec?: MotionSpec;
  /** Target duration in milliseconds. */
  durationMs?: number;
  /** Color scheme hint. */
  colorScheme?: "complementary" | "analogous" | "triadic" | "monochrome";
  /** Base color as hex string. */
  baseColor?: string;
  /** Choreography pattern hint. */
  choreography?: ChoreographyPatternId | "auto";
  /** Number of components to generate. */
  componentCount?: number;
}

interface IntentAnalysis {
  primaryAction: string;
  emotion: string;
  intensity: number;
  suggestedTemplate: string;
  suggestedEasing: string;
  suggestedDuration: number;
  suggestedChoreography: ChoreographyPatternId;
}

/** Analyze natural language description to extract motion intent. */
function analyzeIntent(description: string): IntentAnalysis {
  const text = description.toLowerCase();

  // Determine primary action
  let primaryAction = "reveal";
  if (/fade|dissolve|appear/.test(text)) primaryAction = "fade";
  else if (/slide|move|pan/.test(text)) primaryAction = "slide";
  else if (/scale|zoom|grow/.test(text)) primaryAction = "scale";
  else if (/rotate|spin|turn/.test(text)) primaryAction = "rotate";
  else if (/bounce|spring|elastic/.test(text)) primaryAction = "bounce";
  else if (/drop|fall|gravity/.test(text)) primaryAction = "drop";
  else if (/explode|burst|scatter/.test(text)) primaryAction = "burst";
  else if (/flip|card|swap/.test(text)) primaryAction = "flip";

  // Determine emotion
  let emotion = "neutral";
  if (/happy|joy|excit|celebrat/.test(text)) emotion = "joyful";
  else if (/calm|peace|gentle|soft/.test(text)) emotion = "calm";
  else if (/dramatic|intense|power|strong/.test(text)) emotion = "dramatic";
  else if (/playful|fun|quirky/.test(text)) emotion = "playful";
  else if (/elegan|sophisticat|premium/.test(text)) emotion = "elegant";

  // Determine intensity (0-1)
  let intensity = 0.5;
  if (/subtle|slight|gentle/.test(text)) intensity = 0.3;
  else if (/dramatic|intense|strong|powerful/.test(text)) intensity = 0.9;
  else if (/explosive|extreme/.test(text)) intensity = 1.0;

  // Suggest template based on action
  let suggestedTemplate = "tpl-fade-in";
  const templateMap: Record<string, string> = {
    fade: "tpl-fade-in",
    slide: "tpl-slide-in",
    scale: "tpl-scale-up",
    rotate: "tpl-spin-in",
    bounce: "tpl-bounce-in",
    drop: "tpl-gravity-drop",
    burst: "tpl-chromatic-pulse",
    flip: "tpl-hover-lift",
    reveal: "tpl-fade-in",
  };
  suggestedTemplate = templateMap[primaryAction] ?? "tpl-fade-in";

  // Verify template exists
  if (!TEMPLATES.find((t) => t.id === suggestedTemplate)) {
    suggestedTemplate = TEMPLATES[0]?.id ?? "tpl-fade-in";
  }

  // Suggest easing based on emotion
  let suggestedEasing = "ease-out";
  if (emotion === "joyful") suggestedEasing = "spring";
  else if (emotion === "calm") suggestedEasing = "ease-in-out";
  else if (emotion === "dramatic") suggestedEasing = "cubic-bezier(0.16, 1, 0.3, 1)";
  else if (emotion === "playful") suggestedEasing = "bounce";
  else if (emotion === "elegant") suggestedEasing = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

  // Suggest duration based on intensity
  let suggestedDuration = 800;
  if (intensity < 0.4) suggestedDuration = 1200;
  else if (intensity > 0.8) suggestedDuration = 500;

  // Suggest choreography
  let suggestedChoreography: ChoreographyPatternId = "stagger_grid";
  if (/cascade|waterfall|sequence/.test(text)) suggestedChoreography = "cascade";
  else if (/wave|ripple|flow/.test(text)) suggestedChoreography = "wave";
  else if (/unison|together|sync/.test(text)) suggestedChoreography = "unison";
  else if (/canon|round/.test(text)) suggestedChoreography = "canon";
  else if (/ripple|spread|outward/.test(text)) suggestedChoreography = "ripple_out";

  return {
    primaryAction,
    emotion,
    intensity,
    suggestedTemplate,
    suggestedEasing,
    suggestedDuration,
    suggestedChoreography,
  };
}

/** Run the automated motion pipeline. */
export async function runMotionPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const startTime = Date.now();
  const steps: PipelineStep[] = [];

  // Step 1: Intent analysis
  const intentStep: PipelineStep = { stage: "intent", status: "running" };
  steps.push(intentStep);
  const intent = analyzeIntent(options.description);
  intentStep.status = "done";
  intentStep.detail = `action=${intent.primaryAction}, emotion=${intent.emotion}, intensity=${intent.intensity}`;
  intentStep.durationMs = Date.now() - startTime;

  // Step 2: Template instantiation
  const templateStart = Date.now();
  const templateStep: PipelineStep = { stage: "template", status: "running" };
  steps.push(templateStep);

  let spec: MotionSpec;
  try {
    const templateId = intent.suggestedTemplate;
    const projectId = `pipeline-${Date.now()}`;
    const components = instantiateTemplate(templateId, projectId);
    const ts = new Date().toISOString();
    spec = {
      project: {
        id: projectId,
        name: options.description.slice(0, 60),
        description: options.description,
        scenes: [{ id: "scene-1", name: "Scene 1", durationMs: options.durationMs ?? intent.suggestedDuration }],
        tokens: {},
        globalTiming: { totalDurationMs: options.durationMs ?? intent.suggestedDuration },
        status: "draft",
        sourceTemplateId: templateId,
        createdAt: ts,
        updatedAt: ts,
      },
      components,
    };
    templateStep.status = "done";
    templateStep.detail = `template=${templateId}`;
  } catch {
    // Fallback: create empty spec
    const ts = new Date().toISOString();
    const projectId = `pipeline-${Date.now()}`;
    spec = {
      project: {
        id: projectId,
        name: options.description.slice(0, 60),
        description: options.description,
        scenes: [{ id: "scene-1", name: "Scene 1", durationMs: options.durationMs ?? intent.suggestedDuration }],
        tokens: {},
        globalTiming: { totalDurationMs: options.durationMs ?? intent.suggestedDuration },
        status: "draft",
        sourceTemplateId: null,
        createdAt: ts,
        updatedAt: ts,
      },
      components: [],
    };
    templateStep.status = "done";
    templateStep.detail = "created empty spec (template not found)";
  }
  templateStep.durationMs = Date.now() - templateStart;

  // Step 3: Easing synthesis
  const easingStart = Date.now();
  const easingStep: PipelineStep = { stage: "easing", status: "running" };
  steps.push(easingStep);

  try {
    const easingResult = synthesizeEasing(
      `${intent.emotion} ${intent.primaryAction} motion`,
      "bezier",
    );
    // Apply easing to all components
    for (const comp of spec.components) {
      comp.easing = easingResult.easing;
    }
    easingStep.status = "done";
    easingStep.detail = `easing=${easingResult.easing.type}`;
  } catch {
    easingStep.status = "skipped";
    easingStep.detail = "easing synthesis unavailable";
  }
  easingStep.durationMs = Date.now() - easingStart;

  // Step 4: Timing configuration
  const timingStart = Date.now();
  const timingStep: PipelineStep = { stage: "timing", status: "running" };
  steps.push(timingStep);

  const targetDuration = options.durationMs ?? intent.suggestedDuration;
  if (spec.project.globalTiming) {
    spec.project.globalTiming.totalDurationMs = targetDuration;
  } else {
    spec.project.globalTiming = { totalDurationMs: targetDuration };
  }
  // Distribute timing across components
  const componentCount = spec.components.length;
  if (componentCount > 0) {
    const perComponent = Math.floor(targetDuration / componentCount);
    for (const comp of spec.components) {
      comp.durationMs = perComponent;
    }
  }
  timingStep.status = "done";
  timingStep.detail = `duration=${targetDuration}ms, perComponent=${componentCount > 0 ? Math.floor(targetDuration / componentCount) : 0}ms`;
  timingStep.durationMs = Date.now() - timingStart;

  // Step 5: Choreography
  const choreoStart = Date.now();
  const choreoStep: PipelineStep = { stage: "choreography", status: "running" };
  steps.push(choreoStep);

  try {
    const pattern: ChoreographyPatternId = options.choreography && options.choreography !== "auto"
      ? (options.choreography as ChoreographyPatternId)
      : intent.suggestedChoreography;

    if (spec.components.length > 1 && CHOREOGRAPHY_PATTERNS.find((p) => p.id === pattern)) {
      applyChoreography(spec.components, pattern, { baseDelayMs: 0, baseDurationMs: 80 });
      choreoStep.status = "done";
      choreoStep.detail = `pattern=${pattern}, baseDurationMs=80`;
    } else {
      choreoStep.status = "skipped";
      choreoStep.detail = "single component or pattern not found";
    }
  } catch {
    choreoStep.status = "skipped";
    choreoStep.detail = "choreography unavailable";
  }
  choreoStep.durationMs = Date.now() - choreoStart;

  // Step 6: Color harmony
  const colorStart = Date.now();
  const colorStep: PipelineStep = { stage: "color", status: "running" };
  steps.push(colorStep);

  try {
    if (options.baseColor) {
      const scheme = options.colorScheme ?? "complementary";
      const harmony = generateHarmony(options.baseColor, scheme);
      // Apply harmonized colors to components
      for (let i = 0; i < spec.components.length; i++) {
        const comp = spec.components[i];
        const colorIndex = i % harmony.colors.length;
        if (comp.style) {
          comp.style.backgroundColor = harmony.colors[colorIndex];
        }
      }
      colorStep.status = "done";
      colorStep.detail = `scheme=${scheme}, colors=${harmony.colors.length}`;
    } else {
      colorStep.status = "skipped";
      colorStep.detail = "no base color provided";
    }
  } catch {
    colorStep.status = "skipped";
    colorStep.detail = "color harmony unavailable";
  }
  colorStep.durationMs = Date.now() - colorStart;

  // Step 7: Principles validation
  const principlesStart = Date.now();
  const principlesStep: PipelineStep = { stage: "principles", status: "running" };
  steps.push(principlesStep);

  try {
    if (spec.components.length === 0) {
      principlesStep.status = "skipped";
      principlesStep.detail = "no components to analyze";
    } else {
      const analysis = analyzePrinciples(spec.components[0]);
      const issues = analysis.assessments.filter((r) => r.score < 50);
      principlesStep.status = "done";
      principlesStep.detail = `${analysis.assessments.length} principles checked, ${issues.length} issues`;
    }
  } catch {
    principlesStep.status = "skipped";
    principlesStep.detail = "principles analysis unavailable";
  }
  principlesStep.durationMs = Date.now() - principlesStart;

  // Step 8: Synthesis (generative pattern overlay)
  const synthStart = Date.now();
  const synthStep: PipelineStep = { stage: "synthesis", status: "running" };
  steps.push(synthStep);

  try {
    if (intent.intensity > 0.7) {
      const synthResult = synthesizeMotion({
        projectId: spec.project.id,
        componentName: `synth-${Date.now()}`,
        pattern: "ocean-wave",
        durationMs: targetDuration,
        loopCount: "infinite",
        amplitudeScale: intent.intensity,
        speedScale: 1,
      });
      synthStep.status = "done";
      synthStep.detail = `pattern=ocean-wave (intensity=${intent.intensity})`;
    } else {
      synthStep.status = "skipped";
      synthStep.detail = "intensity below threshold";
    }
  } catch {
    synthStep.status = "skipped";
    synthStep.detail = "synthesis unavailable";
  }
  synthStep.durationMs = Date.now() - synthStart;

  // Complete
  const totalDurationMs = Date.now() - startTime;
  steps.push({ stage: "complete", status: "done", durationMs: totalDurationMs });

  const summary = `Generated ${spec.components.length} component(s) with ${intent.primaryAction} motion, ${intent.emotion} emotion, ${targetDuration}ms duration`;

  logger.info("Motion pipeline complete", {
    componentCount: spec.components.length,
    durationMs: totalDurationMs,
    intent: intent.primaryAction,
  });

  return {
    spec,
    steps,
    totalDurationMs,
    componentCount: spec.components.length,
    summary,
  };
}
