/**
 * Motion Atelier — a creative session orchestrator that unifies the flow state,
 * heuristics, debate, reflection, and creative context engines into a single
 * cohesive creative workflow. The atelier monitors the session, decides when to
 * trigger quality checks, and produces a session manifesto that captures the
 * creative journey.
 */

import type { MotionSpec } from "@openmotion/shared";
import { getFlowState, type FlowPhase } from "./motionFlowState.js";
import { runHeuristics, type HeuristicsReport } from "./motionHeuristics.js";
import { analyzeCreativeContext, type CreativeContextReport } from "./motionCreativeContext.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AtelierStage =
  | "intake" // Understanding the brief
  | "exploration" // Broad ideation
  | "refinement" // Narrowing and polishing
  | "validation" // Quality checks
  | "delivery"; // Final output

export interface AtelierCheckpoint {
  stage: AtelierStage;
  timestamp: number;
  flowPhase: FlowPhase;
  heuristicScore: number;
  creativeMaturity: number;
  recommendation: string;
}

export interface AtelierSession {
  stage: AtelierStage;
  checkpoints: AtelierCheckpoint[];
  sessionStart: number;
  totalActions: number;
  stageTransitions: number;
  manifesto: AtelierManifesto | null;
}

export interface AtelierManifesto {
  creativeDirection: string;
  styleArchetype: string;
  keyDecisions: string[];
  qualityJourney: { time: number; score: number }[];
  breakthroughs: string[];
  finalScore: number;
  narrative: string;
}

export interface AtelierReport {
  stage: AtelierStage;
  flowSnapshot: ReturnType<typeof getFlowState>;
  heuristics: HeuristicsReport | null;
  creativeContext: CreativeContextReport | null;
  checkpoint: AtelierCheckpoint | null;
  nextActions: string[];
  stageProgress: number; // 0..1 within current stage
  overallProgress: number; // 0..1 across entire session
}

// ---------------------------------------------------------------------------
// Session state — in-memory per project
// ---------------------------------------------------------------------------

const sessions = new Map<string, AtelierSession>();

function getOrCreateSession(projectId: string): AtelierSession {
  let session = sessions.get(projectId);
  if (!session) {
    session = {
      stage: "intake",
      checkpoints: [],
      sessionStart: Date.now(),
      totalActions: 0,
      stageTransitions: 0,
      manifesto: null,
    };
    sessions.set(projectId, session);
  }
  return session;
}

// ---------------------------------------------------------------------------
// Stage management
// ---------------------------------------------------------------------------

/** Determine if the session should transition to the next stage. */
function shouldTransition(
  session: AtelierSession,
  flowPhase: FlowPhase,
  heuristicScore: number,
  creativeMaturity: number,
): boolean {
  switch (session.stage) {
    case "intake":
      // Move to exploration once we have some content
      return session.totalActions >= 3 || creativeMaturity > 0.2;
    case "exploration":
      // Move to refinement when flow stabilizes or heuristics are decent
      return (flowPhase === "flow" && heuristicScore > 0.6) || creativeMaturity > 0.5;
    case "refinement":
      // Move to validation when heuristics are strong
      return heuristicScore > 0.75 && flowPhase !== "stagnation";
    case "validation":
      // Move to delivery when all checks pass
      return heuristicScore > 0.85;
    case "delivery":
      return false;
  }
}

const STAGE_ORDER: AtelierStage[] = ["intake", "exploration", "refinement", "validation", "delivery"];

function nextStage(current: AtelierStage): AtelierStage {
  const idx = STAGE_ORDER.indexOf(current);
  return idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1]! : current;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Record an action in the atelier session. */
export function recordAtelierAction(projectId: string): void {
  const session = getOrCreateSession(projectId);
  session.totalActions++;
}

/** Generate a full atelier report for the current session state. */
export function generateAtelierReport(projectId: string, spec: MotionSpec): AtelierReport {
  const session = getOrCreateSession(projectId);
  const now = Date.now();

  // Gather data from sub-engines
  const flowSnapshot = getFlowState(projectId, spec);
  const heuristics = spec.components.length > 0 ? runHeuristics(spec) : null;
  const creativeContext = analyzeCreativeContext(projectId, spec);

  const heuristicScore = heuristics?.compositeScore ?? 0;
  const creativeMaturity = creativeContext.direction.maturity;

  // Check for stage transition
  if (shouldTransition(session, flowSnapshot.phase, heuristicScore, creativeMaturity)) {
    session.stage = nextStage(session.stage);
    session.stageTransitions++;
  }

  // Create checkpoint
  const checkpoint: AtelierCheckpoint = {
    stage: session.stage,
    timestamp: now,
    flowPhase: flowSnapshot.phase,
    heuristicScore,
    creativeMaturity,
    recommendation: generateStageRecommendation(session.stage, flowSnapshot.phase, heuristicScore, creativeMaturity),
  };
  session.checkpoints.push(checkpoint);
  if (session.checkpoints.length > 50) {
    session.checkpoints = session.checkpoints.slice(-50);
  }

  // Compute progress
  const stageIdx = STAGE_ORDER.indexOf(session.stage);
  const stageProgress = computeStageProgress(session.stage, heuristicScore, creativeMaturity, session.totalActions);
  const overallProgress = (stageIdx + stageProgress) / STAGE_ORDER.length;

  // Generate next actions
  const nextActions = generateNextActions(session.stage, flowSnapshot, heuristics, creativeContext);

  return {
    stage: session.stage,
    flowSnapshot,
    heuristics,
    creativeContext,
    checkpoint,
    nextActions,
    stageProgress,
    overallProgress,
  };
}

/** Generate the final session manifesto. */
export function generateManifesto(projectId: string, spec: MotionSpec): AtelierManifesto {
  const session = getOrCreateSession(projectId);
  const report = generateAtelierReport(projectId, spec);
  const ctx = report.creativeContext;

  // Collect key decisions from checkpoints
  const keyDecisions = session.checkpoints
    .filter((cp) => cp.recommendation)
    .map((cp) => cp.recommendation)
    .slice(-5);

  // Build quality journey
  const qualityJourney = session.checkpoints.map((cp) => ({
    time: cp.timestamp,
    score: cp.heuristicScore,
  }));

  // Detect breakthroughs — moments where heuristic score jumped significantly
  const breakthroughs: string[] = [];
  for (let i = 1; i < session.checkpoints.length; i++) {
    const prev = session.checkpoints[i - 1]!;
    const curr = session.checkpoints[i]!;
    if (curr.heuristicScore - prev.heuristicScore > 0.15) {
      breakthroughs.push(`Score jumped from ${(prev.heuristicScore * 100).toFixed(0)} to ${(curr.heuristicScore * 100).toFixed(0)} at ${new Date(curr.timestamp).toLocaleTimeString()}`);
    }
  }

  const finalScore = report.heuristics?.compositeScore ?? 0;
  const narrative = buildNarrative(session, ctx.direction.style, finalScore);

  const manifesto: AtelierManifesto = {
    creativeDirection: ctx.direction.primaryIntent.replace(/_/g, " "),
    styleArchetype: ctx.direction.style,
    keyDecisions,
    qualityJourney,
    breakthroughs,
    finalScore,
    narrative,
  };

  session.manifesto = manifesto;
  return manifesto;
}

/** Reset the atelier session for a project. */
export function resetAtelierSession(projectId: string): void {
  sessions.delete(projectId);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateStageRecommendation(
  stage: AtelierStage,
  flowPhase: FlowPhase,
  heuristicScore: number,
  creativeMaturity: number,
): string {
  switch (stage) {
    case "intake":
      if (creativeMaturity < 0.2) return "Define the creative brief — apply a template or describe the desired mood.";
      return "Ready to explore — try different style archetypes and semantic concepts.";
    case "exploration":
      if (flowPhase === "stagnation") return "Break out of stagnation — try a completely different motion category.";
      return "Keep exploring broadly — generate variations and compare directions.";
    case "refinement":
      if (heuristicScore < 0.6) return "Focus on fixing heuristic issues — check duration range and stagger patterns.";
      return "Polish the details — run the reflection loop for auto-correction.";
    case "validation":
      if (heuristicScore < 0.85) return "Run the motion debate to get adversarial feedback before delivery.";
      return "All checks passing — ready for delivery.";
    case "delivery":
      return "Session complete — export the final composition.";
  }
}

function computeStageProgress(
  stage: AtelierStage,
  heuristicScore: number,
  creativeMaturity: number,
  totalActions: number,
): number {
  switch (stage) {
    case "intake":
      return Math.min(1, totalActions / 3);
    case "exploration":
      return Math.min(1, creativeMaturity / 0.5);
    case "refinement":
      return Math.min(1, heuristicScore / 0.75);
    case "validation":
      return Math.min(1, heuristicScore / 0.85);
    case "delivery":
      return 1;
  }
}

function generateNextActions(
  stage: AtelierStage,
  flow: ReturnType<typeof getFlowState>,
  heuristics: HeuristicsReport | null,
  creativeContext: CreativeContextReport,
): string[] {
  const actions: string[] = [];

  switch (stage) {
    case "intake":
      actions.push("Apply a template to establish a baseline");
      actions.push("Describe the mood — the Agent maps it to a semantic concept");
      actions.push("Add layers for the key visual elements");
      break;
    case "exploration":
      actions.push("Generate A/B variants to compare directions");
      actions.push("Try different style archetypes");
      actions.push("Run the chronopath prediction to check attention flow");
      break;
    case "refinement":
      if (heuristics && heuristics.quickWins.length > 0) {
        actions.push(`Quick fix: ${heuristics.quickWins[0]}`);
      }
      actions.push("Run the reflection loop for auto-polishing");
      actions.push("Fine-tune easing curves for consistency");
      break;
    case "validation":
      actions.push("Run the motion debate for adversarial review");
      actions.push("Check accessibility compliance");
      actions.push("Verify performance (GPU compositing)");
      break;
    case "delivery":
      actions.push("Export the final composition");
      actions.push("Generate a session manifesto");
      actions.push("Save the project");
      break;
  }

  // Add flow-based recommendation
  if (flow.phase === "stagnation") {
    actions.push("Break stagnation — try a mutation or evolution strategy");
  }

  // Add creative context recommendation
  if (creativeContext.direction.recommendations.length > 0) {
    const top = creativeContext.direction.recommendations[0];
    if (top) {
      actions.push(`${top.action}: ${top.reason}`);
    }
  }

  return actions.slice(0, 5);
}

function buildNarrative(session: AtelierSession, style: string, finalScore: number): string {
  const duration = Math.round((Date.now() - session.sessionStart) / 1000);
  const transitions = session.stageTransitions;

  const scoreLabel = finalScore >= 0.9 ? "exceptional" : finalScore >= 0.75 ? "strong" : finalScore >= 0.6 ? "solid" : "developing";

  return `This creative session spanned ${duration}s across ${transitions + 1} stage(s), ` +
    `arriving at a ${scoreLabel} quality score of ${(finalScore * 100).toFixed(0)}/100. ` +
    `The creative direction settled into a "${style}" style archetype, ` +
    `with ${session.totalActions} total actions recorded. ` +
    `${session.checkpoints.length} quality checkpoints were captured throughout the journey.`;
}

/** Format the atelier report as a human-readable string. */
export function formatAtelierReport(report: AtelierReport): string {
  const stageLabels: Record<AtelierStage, string> = {
    intake: "Intake",
    exploration: "Exploration",
    refinement: "Refinement",
    validation: "Validation",
    delivery: "Delivery",
  };

  const lines = [
    `Atelier Stage: ${stageLabels[report.stage]}`,
    `Overall Progress: ${(report.overallProgress * 100).toFixed(0)}%`,
    `Stage Progress: ${(report.stageProgress * 100).toFixed(0)}%`,
    `Flow Phase: ${report.flowSnapshot.phase.replace("_", " ")}`,
    `Heuristic Score: ${report.heuristics ? (report.heuristics.compositeScore * 100).toFixed(0) : "N/A"}/100`,
  ];

  if (report.checkpoint) {
    lines.push(`Recommendation: ${report.checkpoint.recommendation}`);
  }

  if (report.nextActions.length > 0) {
    lines.push("Next Actions:");
    for (const a of report.nextActions) {
      lines.push(`  → ${a}`);
    }
  }

  return lines.join("\n");
}
