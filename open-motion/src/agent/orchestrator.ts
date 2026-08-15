import type { ChatEvent, ToolName } from "@openmotion/shared";
import type { ChatOptions, ChatResult, LlmProvider, LlmToolCall } from "./provider/types.js";
import { OpenAIProviderError } from "./provider/openai.js";
import { assembleAgentContext } from "./context.js";
import { buildToolSpecs } from "./tools/schema.js";
import { executeTool, type ToolContext, type ToolResult } from "./tools/registry.js";
import { addMemory, listMemory, restoreMemory, compressMemory } from "./memory/store.js";
import { buildPlan } from "./planner.js";
import { think, reevaluateConstraints } from "./reasoning.js";
import { reflectOnSuccess } from "./motionReflection.js";
import {
  decomposeGoal,
  startToolGoal,
  completeToolGoal,
  serializeGoal,
  type GoalTree,
} from "./goals.js";
import { addMessage } from "../db/repositories/messages.js";
import { getProjectSpec } from "../db/repositories/projects.js";
import { remember } from "./memory/persistentMemory.js";
import { recordFailure, searchFailureMemory } from "./memory/failureMemory.js";
import { resetForTurn as resetScratch, addScratch } from "./memory/workingMemory.js";
import { recordGoalFromMessage, completeGoalByCategory, type GoalCategory } from "./memory/goalContinuity.js";
import { verifyMotion, formatVerificationReport } from "./motionVerification.js";
import {
  selfCorrectMotion,
  formatSelfCorrectionReport,
  type SelfCorrectionReport,
} from "./motionSelfCorrect.js";
import { replanAfterFailure } from "./replanner.js";
import { extractSkill } from "./memory/skillGenerator.js";
import { suggestProactive } from "./proactiveEngine.js";
import { recordToolExecution, isToolUnreliable } from "./analytics.js";
import { recordDecision, inferCreativeIntent } from "./motionCreativeContext.js";
import { generateSessionSummary } from "./sessionSummary.js";
import { composeTools, composedToToolCalls } from "./toolComposer.js";
import { capture, isSpecMutating } from "./checkpointManager.js";
import { getCached, setCached, invalidateProject } from "./toolResultCache.js";
import { selectTools } from "./toolSelector.js";
import { runPreHooks, runPostHooks } from "./pluginHooks.js";
import { analyzeToolDependencies } from "./toolDependencyAnalyzer.js";
import {
  createParentBudget,
  consume,
  mayExtendForConsolidation,
  describeBudget,
  type IterationBudget,
} from "./iterationBudget.js";
import {
  shouldUsePlanMode,
  composeStructuredPlan,
  initPlanExecution,
  completeAction,
  failAction,
  planProgress,
  isPlanFinished,
  type PlanExecutionState,
  type StructuredPlan,
  type PlanAction,
} from "./planExecutor.js";
import { setPlanState, clearPlanState } from "./tools/agentTools.js";
import {
  shouldDelegate,
  composeSubagentTasks,
  runSubagentsParallel,
  type SubagentContext,
} from "./subagent.js";
import { routeNamespacedExternalCall, describeExternalToolsForOrchestrator } from "./mcpClient.js";
import {
  generateVariations,
  extractDNA,
  transferStyle,
  formatVariationSummary,
  formatDNAReport,
  formatStyleTransferReport,
} from "./motionIntelligence.js";
import { critiqueMotion, formatCritiqueReport } from "./motionCritique.js";
import {
  generateStorySequence,
  formatStoryReport,
  detectNarrativeIntent,
  listNarrativeIntents,
  type NarrativeIntent,
} from "./motionStorytelling.js";
import {
  recordLineage,
  getLineage,
  getLineageTree,
  generateLineageReport,
  getProjectLineageSummary,
  formatLineageTree,
} from "./motionLineage.js";
import {
  synthesizeMotion,
  applySynthesizedDNA,
  formatSynthesisReport,
  type SynthesisStrategy,
} from "./motionSynthesis.js";
import {
  autoFixAccessibility,
  formatAutoFixReport,
  type AutoFixOptions,
} from "./motionAutoFix.js";
import {
  applyPersona,
  detectPersona,
  formatPersonaApplicationReport,
  formatPersonaDetectionReport,
  listPersonas,
} from "./motionPersona.js";
import {
  coachMotion,
  formatCoachReport,
} from "./motionCoach.js";
import {
  analyzeGenome,
  formatGenomeReport,
} from "./motionGenome.js";
import {
  forecastMotion,
  formatForecastReport,
} from "./motionForecast.js";
import {
  deliberateMotion,
  formatJuryReport,
} from "./motionJury.js";
import { analyzeBudget, formatAttentionBudgetReport } from "./motionBudget.js";
import {
  negotiateIntent,
  formatNegotiationReport,
  listConstraintProfiles,
  getConstraintProfile,
} from "./motionNegotiation.js";
import {
  remixMotion,
  formatRemixReport,
  listRemixStrategies,
  type RemixStrategy,
} from "./motionRemix.js";
import {
  translateDialect,
  formatDialectReport,
  listDialects,
  detectDialect,
  type DialectId,
} from "./motionDialect.js";
import {
  profileMotion,
  formatProfilerReport,
} from "./motionProfiler.js";
import {
  curateMotion,
  formatCurationReport,
  listSemanticRoles,
} from "./motionCurator.js";
import {
  strategizeMotion,
  formatStrategyReport,
  listArchetypes,
} from "./motionStrategist.js";
import {
  auditMotion,
  formatAuditReport,
} from "./motionAuditor.js";
import {
  choreographMotion,
  formatChoreographyReport,
  listChoreographyModes,
  type ChoreographyMode,
} from "./motionChoreographer.js";
import {
  optimizeForExport,
  formatExportReport,
  listExportTargets,
  type ExportTarget,
} from "./motionExportOptimizer.js";
import {
  analyzeCohesion,
  formatCohesionReport,
} from "./motionCohesion.js";
import {
  detectConflicts,
  formatConflictReport,
} from "./motionConflict.js";
import {
  compareVariants,
  formatComparisonReport,
} from "./motionComparator.js";
import {
  evolveMotion,
  listEvolutionStrategies,
  getEvolutionConfig,
} from "./motionEvolution.js";
import {
  predictPerception,
  formatPerceptionReport,
} from "./motionPerception.js";
import {
  listSemanticConcepts,
  inferIntent,
  blendConcepts,
  formatProfile,
} from "./motionSemantics.js";
import {
  simulateSpring,
  simulateGravityDrop,
  simulateProjectile,
  simulateFriction,
  simulatePendulum,
  listPhysicsPresets,
  listPhysicsTypes,
  runPreset,
} from "./motionPhysics.js";
import {
  generatePathMotion,
  listPathPresets,
  listPathTypes,
  runPathPreset,
} from "./motionPath.js";
import {
  encodeMotion,
  listCodecFormats,
  type CodecFormat,
} from "./motionCodec.js";
import {
  extractStyleDNA,
  transferStyle as transferMotionStyle,
  blendStyles,
  describeStyle,
  compareStyles,
  listStyleArchetypes,
  applyArchetype,
} from "./motionStyleTransfer.js";
import {
  buildKnowledgeGraph,
  queryConcept,
  findRelated,
  findPath,
  searchConcepts,
  suggestConnections,
  recommendNext,
  analyzeGraph,
  formatGraphReport,
} from "./motionKnowledgeGraph.js";
import {
  runAllTests,
  runTestsByCategory,
  runTestSuite,
  listTestSuites,
  formatTestReport,
} from "./motionTesting.js";
import {
  synthesizeFromEmotion,
  detectEmotionFromMotion,
  blendEmotions,
  planEmotionJourney,
  listEmotions,
  getEmotion,
  formatEmotionReport,
  formatDetectionReport,
  formatBlendReport,
  formatJourneyReport,
} from "./motionEmotion.js";
import {
  recordMotionObservation,
  getProjectTasteProfile,
  recommendForProject,
  formatTasteProfile,
  formatRecommendation,
} from "./motionAdaptive.js";
import {
  computeContextAdjustments,
  adaptComponentForContext,
  autoDetectContext,
  listContextOptions,
  detectTimeOfDay,
  formatContextReport,
  formatAdaptationReport,
} from "./motionContext.js";
import {
  planCollaboration,
  listCollaborationModules,
  collaborate,
  formatCollaborationPlan,
  formatCollaborationResult,
} from "./motionCollaboration.js";
import {
  analyzeResonance,
  tuneForResonance,
  defaultViewerState,
  formatResonanceReport,
  type ViewerState,
} from "./motionResonance.js";
import {
  translateSpec as translateSynesthesia,
  mapSensoryToMotion,
  formatSynestheticReport,
} from "./motionSynesthesia.js";
import {
  dreamFromPrompt,
  generateDreamSequence,
  listDreamConcepts,
  formatDreamReport,
  formatDreamSequenceReport,
} from "./motionDream.js";
import {
  analyzeHarmonics,
  findHarmonics as findHarmonicsForComponent,
  formatHarmonicsReport,
} from "./motionHarmonics.js";
import {
  analyzeEntropy,
  identifyInformationHotspots,
  formatEntropyReport,
} from "./motionEntropy.js";
import {
  analyzeCognitiveLoad,
  formatCognitionReport,
} from "./motionCognition.js";
import {
  analyzeTopology,
  findTemporalPath,
  formatTopologyReport,
} from "./motionTopology.js";
import {
  analyzePoetics,
  formatPoeticsReport,
} from "./motionPoetics.js";
import {
  analyzeEcosystem,
  formatEcosystemReport,
} from "./motionEcology.js";
import {
  analyzeCalligraphy,
  formatCalligraphyReport,
} from "./motionCalligraphy.js";
import {
  analyzeMythology,
  formatMythologyReport,
} from "./motionMythology.js";
import {
  analyzeWeather,
  formatWeatherReport,
} from "./motionWeather.js";
import {
  analyzeAlchemy,
  formatAlchemyReport,
} from "./motionAlchemy.js";
import {
  analyzeArchitecture,
  formatArchitectureReport,
} from "./motionArchitecture.js";
import {
  analyzeCartography,
  formatCartographyReport,
} from "./motionCartography.js";
import {
  analyzeGenealogy,
  formatGenealogyReport,
} from "./motionGenealogy.js";
import {
  analyzeAstronomy,
  formatAstronomyReport,
} from "./motionAstronomy.js";
import {
  analyzeChemistry,
  formatChemistryReport,
} from "./motionChemistry.js";
import {
  analyzeMusicology,
  formatMusicologyReport,
} from "./motionMusicology.js";
import {
  analyzeBotany,
  formatBotanyReport,
} from "./motionBotany.js";
import {
  analyzeGeology,
  formatGeologyReport,
} from "./motionGeology.js";
import {
  analyzePhysics,
  formatPhysicsReport,
} from "./motionPhysics.js";
import {
  analyzeLinguistics,
  formatLinguisticsReport,
} from "./motionLinguistics.js";
import {
  analyzeCinema,
  formatCinemaReport,
} from "./motionCinema.js";
import { patchComponent, createComponent } from "../db/repositories/components.js";
import { createId, now } from "../utils/id.js";
import { logger } from "../utils/logger.js";

const MAX_ITERATIONS = 12;

/**
 * Maps verification claim keywords to goal-ledger categories so a passing
 * assertion can advance the matching cross-turn goal to "done". Kept narrow
 * to the categories the verification engine actually asserts on.
 */
const GOAL_CATEGORY_KEYWORDS: Array<{ category: GoalCategory; pattern: RegExp }> = [
  { category: "easing", pattern: /easing family/i },
  { category: "timing", pattern: /duration/i },
  { category: "other", pattern: /loop|infinitely/i },
  { category: "choreography", pattern: /stagger|delay/i },
  { category: "color", pattern: /color|background/i },
  { category: "other", pattern: /3D transform/i },
  { category: "creation", pattern: /component.*exist/i },
  { category: "shader", pattern: /shader/i },
  { category: "path", pattern: /translateX.*translateY|path/i },
  { category: "other", pattern: /trigger/i },
];

export interface OrchestrateOptions {
  projectId: string;
  userMessage: string;
  provider: LlmProvider;
  onEvent: (event: ChatEvent) => void;
  /** Optional model ID for token-aware context windowing. */
  model?: string;
  /** Optional abort signal. When aborted, the agent stops issuing further
   *  tool calls and emits a graceful `done` so the SSE stream never hangs. */
  signal?: AbortSignal;
}

/**
 * Classify whether a provider error is worth retrying.
 * - 429 (rate limited): retryable, with backoff respecting retry-after hint
 * - 5xx (server errors): retryable
 * - 401/403 (auth/permission): never retry — the key is wrong
 * - Network errors (fetch failed, timeouts): retryable
 */
function classifyError(err: unknown): { retryable: boolean; retryAfterMs?: number } {
  if (err instanceof OpenAIProviderError) {
    if (err.status === 429) {
      return { retryable: true, retryAfterMs: err.retryAfter ? err.retryAfter * 1000 : undefined };
    }
    if (err.status >= 500) return { retryable: true };
    return { retryable: false };
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/.test(msg)) {
    return { retryable: true };
  }
  return { retryable: false };
}

/**
 * Wrap provider.chat with bounded retry + exponential backoff. Only network-class
 * errors and 429/5xx retry; auth errors surface immediately. Backoff: 500ms → 1000ms,
 * or the server's retry-after hint when available.
 */
async function chatWithRetry(
  provider: LlmProvider,
  options: ChatOptions,
  retries = 2,
): Promise<ChatResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await provider.chat(options);
    } catch (err) {
      lastErr = err;
      const { retryable, retryAfterMs } = classifyError(err);
      if (!retryable || attempt === retries) throw err;
      const backoff = retryAfterMs ?? 500 * Math.pow(2, attempt);
      logger.warn("provider.chat retryable error, backing off", { attempt, backoff, message: err instanceof Error ? err.message : String(err) });
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

/**
 * Bounded execution of a tool call. A hung executor (one that neither resolves
 * nor rejects) is abandoned after the timeout and reported as a recoverable
 * failure so the agent loop can continue with a graceful message.
 */
const TOOL_EXECUTION_TIMEOUT_MS = 120_000;

async function withToolTimeout(
  tool: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      executeTool(tool as never, args, ctx),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`tool ${tool} timed out after ${TOOL_EXECUTION_TIMEOUT_MS}ms`)),
          TOOL_EXECUTION_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("tool execution timeout", { tool, message });
    return {
      ok: false,
      summary: `${tool} did not complete in time (${TOOL_EXECUTION_TIMEOUT_MS}ms) — it can be retried`,
      specChanged: false,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Execute a tool with full guardrail wrapping:
 *   1. Capture a checkpoint if the tool is spec-mutating (so we can undo).
 *   2. Run pre-hooks (validation, veto, arg patching).
 *   3. Execute the tool via the standard registry.
 *   4. Run post-hooks (side effects, metrics).
 *   5. Emit checkpoint / hook_warning events to the UI.
 *
 * Returns the tool result plus any warnings emitted by hooks. If a hook
 * vetoes the call, returns a synthetic failed result with the veto reason.
 */
async function executeToolWithGuardrails(
  tool: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  onEvent: (event: ChatEvent) => void,
): Promise<{ result: ToolResult; warnings: string[]; checkpointId?: string }> {
  const warnings: string[] = [];
  let checkpointId: string | undefined;

  // 0. Tool result cache: short-circuit read-only idempotent calls that were
  // already answered within this turn. The cache is invalidated the moment a
  // spec-mutating tool runs (see step 4), so a stale read after a mutation is
  // impossible. This dedupe is especially valuable when the model re-asks for
  // get_motion_spec / list_templates after every spec change.
  if (!isSpecMutating(tool) && !tool.includes("__")) {
    const cached = getCached(ctx.projectId, tool, args);
    if (cached) {
      return { result: cached, warnings, checkpointId };
    }
  }

  // 0b. External MCP routing: namespaced tool names ("serverId__toolName")
  // bypass the local registry entirely and call the external server.
  if (tool.includes("__")) {
    const externalResult = await routeNamespacedExternalCall(tool, args);
    if (externalResult) {
      const textParts = externalResult.content
        .map((c: { type: string; text?: string } & Record<string, unknown>) =>
          typeof c.text === "string" ? c.text : JSON.stringify(c),
        )
        .join("\n");
      return {
        result: {
          ok: externalResult.ok,
          summary: textParts.slice(0, 500) || `external call ${externalResult.ok ? "ok" : "failed"}`,
          specChanged: false,
          data: {
            external: true,
            content: externalResult.content,
            durationMs: externalResult.durationMs,
          },
        },
        warnings,
        checkpointId,
      };
    }
    // If the namespace does not match any connected server, fall through to
    // the local registry so the user sees a normal "unknown tool" error.
  }

  // 1. Checkpoint capture for spec-mutating tools.
  if (isSpecMutating(tool)) {
    const cp = capture(ctx.projectId, tool);
    if (cp) {
      checkpointId = cp.id;
      onEvent({
        type: "checkpoint",
        checkpointId: cp.id,
        triggerTool: tool,
        componentCount: cp.componentCount,
        label: cp.label,
      });
    }
  }

  // 2. Pre-hooks: validate, patch args, or veto.
  const pre = await runPreHooks({
    projectId: ctx.projectId,
    tool: tool as never,
    args,
  });
  if (pre.warnings.length > 0) {
    warnings.push(...pre.warnings);
    onEvent({ type: "hook_warning", warnings: pre.warnings, tool });
  }
  if (pre.veto) {
    return {
      result: {
        ok: false,
        summary: `vetoed by guardrail: ${pre.reason ?? "unknown reason"}`,
        specChanged: false,
      },
      warnings,
      checkpointId,
    };
  }

  // 3. Execute the tool with (possibly patched) args, bounded by a timeout so
  // a hung or never-resolving executor (e.g. a stalled export render) cannot
  // block the agent loop indefinitely.
  const result = await withToolTimeout(tool, pre.args, ctx);

  // 4. Post-hooks: side effects only.
  await runPostHooks(
    { projectId: ctx.projectId, tool: tool as never, args: pre.args },
    result,
  );

  // 5. Cache maintenance: store read-only successes for dedupe; invalidate the
  // entire project cache the moment a spec-mutating tool succeeds so the next
  // read sees the fresh state. Failures are never cached.
  if (result.ok) {
    if (result.specChanged || isSpecMutating(tool)) {
      invalidateProject(ctx.projectId);
    } else if (!tool.includes("__")) {
      setCached(ctx.projectId, tool, args, result);
    }
  }

  return { result, warnings, checkpointId };
}

/**
 * Execute a structured plan: walk each action, run its tool calls, and emit
 * plan_progress events as actions complete. Returns when all actions are done
 * or the user requests cancellation.
 */
async function executeStructuredPlan(
  plan: StructuredPlan,
  ctx: ToolContext,
  onEvent: (event: ChatEvent) => void,
  allToolCalls: LlmToolCall[],
  allToolResults: ToolResult[],
  goalTree: GoalTree | null,
): Promise<{ componentCountDelta: number; anySpecChanged: boolean }> {
  const state: PlanExecutionState = initPlanExecution(plan);
  // Surface the plan state to the LLM via the cancel_plan / get_plan_state tools.
  setPlanState(ctx.projectId, {
    planSummary: plan.summary,
    currentActionIndex: -1,
    completed: 0,
    failed: 0,
    total: plan.actions.length,
    cancelRequested: false,
  });

  let anySpecChanged = false;
  const componentCountBefore =
    getProjectSpec(ctx.projectId)?.components.length ?? 0;

  for (let i = 0; i < plan.actions.length; i++) {
    if (state.cancelRequested) break;
    const action = plan.actions[i];
    state.currentActionIndex = i;

    let actionOk = true;
    for (const call of action.toolCalls) {
      if (state.cancelRequested) break;
      const callId = `plan_${action.id}_${call.tool}`;
      // Resolve the __last__ placeholder to the most recently created
      // component, mirroring the ReAct loop (see runCall below). This lets a
      // plan chain set_template (which resets the spec and creates a fresh
      // component) followed by property tuning (set_duration/set_color/...)
      // targeting that new component instead of a stale pre-reset id.
      let resolvedArgs = call.args;
      if (
        resolvedArgs &&
        typeof resolvedArgs === "object" &&
        resolvedArgs.componentId === "__last__"
      ) {
        const freshSpec = getProjectSpec(ctx.projectId);
        const lastComponent = freshSpec?.components[freshSpec.components.length - 1];
        if (lastComponent) {
          resolvedArgs = { ...resolvedArgs, componentId: lastComponent.id };
        } else {
          logger.warn("__last__ placeholder could not resolve in plan — no component exists", { tool: call.tool });
          continue;
        }
      }
      onEvent({ type: "tool_call", tool: call.tool, args: resolvedArgs, callId });

      const activeGoalId = goalTree ? startToolGoal(goalTree, call.tool) : null;
      if (goalTree && activeGoalId) {
        onEvent({ type: "goal", root: serializeGoal(goalTree) });
      }

      const toolStart = Date.now();
      const { result } = await executeToolWithGuardrails(
        call.tool as string,
        resolvedArgs,
        ctx,
        onEvent,
      );
      const toolDurationMs = Date.now() - toolStart;
      recordToolExecution(ctx.projectId, call.tool, result.ok, toolDurationMs);

      // Record creative decision for session-aware intelligence
      try {
        const specForCtx = getProjectSpec(ctx.projectId);
        if (specForCtx) {
          const intent = inferCreativeIntent(call.tool, resolvedArgs as Record<string, unknown>, specForCtx);
          recordDecision(ctx.projectId, call.tool, result.summary, intent, undefined, result.ok);
        }
      } catch { /* creative context is non-critical */ }

      allToolCalls.push({ tool: call.tool, args: resolvedArgs, callId });
      allToolResults.push(result);

      if (goalTree && activeGoalId) {
        if (result.ok) completeToolGoal(goalTree, activeGoalId);
        onEvent({ type: "goal", root: serializeGoal(goalTree) });
      }

      onEvent({
        type: "tool_result",
        callId,
        tool: call.tool,
        result: result.data ?? null,
        summary: result.summary,
        ok: result.ok,
        specChanged: result.specChanged ?? false,
      });
      // Forward editor commands to the frontend so the Agent can drive the UI.
      if (result.editorCommands) {
        for (const cmd of result.editorCommands) {
          onEvent({ type: "editor_command", command: cmd.command, args: cmd.args });
        }
      }
      addMemory(ctx.projectId, {
        role: "tool",
        content: result.summary,
        toolCallId: callId,
        toolName: call.tool,
      });
      addMessage(ctx.projectId, {
        role: "tool",
        content: result.summary,
        toolCallId: callId,
        toolName: call.tool,
      });

      if (result.specChanged) anySpecChanged = true;
      if (!result.ok) actionOk = false;
    }

    if (actionOk) {
      completeAction(state, action.id);
    } else {
      failAction(state, action.id);
    }

    // Update shared plan state for cancel_plan / get_plan_state tools.
    setPlanState(ctx.projectId, {
      planSummary: plan.summary,
      currentActionIndex: i,
      completed: state.completedActionIds.size,
      failed: state.failedActionIds.size,
      total: plan.actions.length,
      cancelRequested: state.cancelRequested,
    });

    onEvent({
      type: "plan_progress",
      actionId: action.id,
      actionType: action.type,
      description: action.description,
      completed: state.completedActionIds.size,
      total: plan.actions.length,
    });

    // Emit spec_update after each spec-mutating action so the canvas refreshes.
    if (action.mutatesSpec && anySpecChanged) {
      const fresh = getProjectSpec(ctx.projectId);
      if (fresh) {
        onEvent({
          type: "spec_update",
          components: fresh.components,
          project: fresh.project,
        });
      }
    }
  }

  clearPlanState(ctx.projectId);

  const componentCountAfter =
    getProjectSpec(ctx.projectId)?.components.length ?? componentCountBefore;
  return {
    componentCountDelta: componentCountAfter - componentCountBefore,
    anySpecChanged,
  };
}

/**
 * Inline executor for Motion Intelligence tools.
 *
 * These tools are not registered in the standard tool registry because they
 * return analysis/creative output rather than mutating the project spec. They
 * are intercepted here so the orchestrator can run them as part of a composed
 * tool pipeline.
 *
 * Returns the tool result, or `null` if the tool name is not a Motion
 * Intelligence tool — in which case the caller falls through to the standard
 * `executeToolWithGuardrails` path.
 */
async function executeMotionIntelligenceTool(
  tool: string,
  args: Record<string, unknown>,
  projectId: string,
): Promise<ToolResult | null> {
  if (
    tool !== "generate_variations" &&
    tool !== "extract_motion_dna" &&
    tool !== "transfer_style" &&
    tool !== "critique_motion" &&
    tool !== "generate_story" &&
    tool !== "list_story_intents" &&
    tool !== "query_lineage" &&
    tool !== "get_lineage_tree" &&
    tool !== "get_lineage_summary" &&
    tool !== "record_lineage" &&
    tool !== "synthesize_motion" &&
    tool !== "auto_fix_accessibility" &&
    tool !== "apply_persona" &&
    tool !== "detect_persona" &&
    tool !== "list_personas" &&
    tool !== "coach_motion" &&
    tool !== "analyze_genome" &&
    tool !== "forecast_motion" &&
    tool !== "negotiate_intent" &&
    tool !== "list_constraint_profiles" &&
    tool !== "remix_motion" &&
    tool !== "list_remix_strategies" &&
    tool !== "translate_dialect" &&
    tool !== "list_dialects" &&
    tool !== "detect_dialect" &&
    tool !== "profile_motion" &&
    tool !== "curate_motion" &&
    tool !== "list_semantic_roles" &&
    tool !== "strategize_motion" &&
    tool !== "list_archetypes" &&
    tool !== "audit_motion" &&
    tool !== "choreograph_motion" &&
    tool !== "list_choreography_modes" &&
    tool !== "optimize_export" &&
    tool !== "list_export_targets" &&
    tool !== "analyze_cohesion" &&
    tool !== "detect_conflicts" &&
    tool !== "compare_variants" &&
    tool !== "evolve_motion" &&
    tool !== "list_evolution_strategies" &&
    tool !== "predict_perception" &&
    tool !== "list_semantic_concepts" &&
    tool !== "infer_intent" &&
    tool !== "blend_concepts" &&
    tool !== "simulate_physics" &&
    tool !== "list_physics_presets" &&
    tool !== "run_physics_preset" &&
    tool !== "list_physics_types" &&
    tool !== "generate_path_motion" &&
    tool !== "list_path_presets" &&
    tool !== "run_path_preset" &&
    tool !== "list_path_types" &&
    tool !== "encode_motion" &&
    tool !== "list_codec_formats" &&
    tool !== "extract_style_dna" &&
    tool !== "transfer_project_style" &&
    tool !== "blend_styles" &&
    tool !== "describe_style" &&
    tool !== "compare_styles" &&
    tool !== "list_style_archetypes" &&
    tool !== "apply_style_archetype" &&
    tool !== "build_knowledge_graph" &&
    tool !== "query_concept" &&
    tool !== "find_related" &&
    tool !== "find_concept_path" &&
    tool !== "search_concepts" &&
    tool !== "suggest_connections" &&
    tool !== "recommend_next" &&
    tool !== "analyze_graph" &&
    tool !== "run_all_tests" &&
    tool !== "run_tests_by_category" &&
    tool !== "run_test_suite" &&
    tool !== "list_test_suites" &&
    tool !== "synthesize_from_emotion" &&
    tool !== "detect_emotion" &&
    tool !== "blend_emotions" &&
    tool !== "plan_emotion_journey" &&
    tool !== "list_emotions" &&
    tool !== "get_taste_profile" &&
    tool !== "recommend_for_project" &&
    tool !== "record_motion_observation" &&
    tool !== "compute_context_adjustments" &&
    tool !== "adapt_component_for_context" &&
    tool !== "auto_detect_context" &&
    tool !== "list_context_options" &&
    tool !== "plan_collaboration" &&
    tool !== "execute_collaboration" &&
    tool !== "list_collaboration_modules" &&
    tool !== "analyze_resonance" &&
    tool !== "tune_resonance" &&
    tool !== "translate_synesthesia" &&
    tool !== "map_sensory_to_motion" &&
    tool !== "dream_from_prompt" &&
    tool !== "generate_dream_sequence" &&
    tool !== "list_dream_concepts" &&
    tool !== "analyze_harmonics" &&
    tool !== "find_harmonics" &&
    tool !== "analyze_entropy" &&
    tool !== "identify_information_hotspots" &&
    tool !== "analyze_cognitive_load" &&
    tool !== "analyze_topology" &&
    tool !== "find_temporal_path" &&
    tool !== "analyze_poetics" &&
    tool !== "analyze_ecosystem" &&
    tool !== "analyze_calligraphy" &&
    tool !== "analyze_mythology" &&
    tool !== "analyze_weather" &&
    tool !== "analyze_alchemy" &&
    tool !== "analyze_architecture" &&
    tool !== "analyze_cartography" &&
    tool !== "analyze_genealogy" &&
    tool !== "analyze_astronomy" &&
    tool !== "analyze_chemistry" &&
    tool !== "analyze_musicology" &&
    tool !== "analyze_botany" &&
    tool !== "analyze_geology" &&
    tool !== "analyze_physics" &&
    tool !== "analyze_linguistics" &&
    tool !== "analyze_cinema" &&
    tool !== "verify_motion" &&
    tool !== "self_correct"
  ) {
    return null;
  }

  // List story intents does not require a spec.
  if (tool === "list_story_intents") {
    const intents = listNarrativeIntents();
    return {
      ok: true,
      summary: `${intents.length} narrative intents available: ${intents.map((i) => i.intent).join(", ")}`,
      specChanged: false,
      data: { kind: "story_intents", intents },
    };
  }

  // List evolution strategies does not require a spec.
  if (tool === "list_evolution_strategies") {
    const strategies = listEvolutionStrategies();
    return {
      ok: true,
      summary: `${strategies.length} evolution strategies available: ${strategies.map((s) => s.name).join(", ")}`,
      specChanged: false,
      data: { kind: "evolution_strategies", strategies },
    };
  }

  // Predict viewer perception of the motion.
  // (Moved below — requires spec to be loaded first.)

  // List semantic concepts that can be mapped to motion.
  if (tool === "list_semantic_concepts") {
    const category = typeof args.category === "string" ? args.category : undefined;
    const all = listSemanticConcepts();
    const filtered = category ? all.filter((c) => c.category === category) : all;
    return {
      ok: true,
      summary: `${filtered.length} semantic concepts available: ${filtered.map((c) => c.label).join(", ")}`,
      specChanged: false,
      data: {
        kind: "semantic_concepts",
        concepts: filtered.map((c) => ({
          id: c.id,
          label: c.label,
          category: c.category,
          description: c.description,
          keywords: c.keywords,
        })),
      },
    };
  }

  // Infer semantic intent from a natural language description.
  if (tool === "infer_intent") {
    const description = typeof args.description === "string" ? args.description : "";
    if (!description) {
      return {
        ok: false,
        summary: "description is required to infer intent",
        specChanged: false,
      };
    }
    const intent = inferIntent(description);
    return {
      ok: true,
      summary: `${intent.summary}\n\nSuggested profile:\n${formatProfile(intent.suggestedProfile)}`,
      specChanged: false,
      data: { kind: "inferred_intent", intent },
    };
  }

  // Blend two semantic concepts into a hybrid motion profile.
  if (tool === "blend_concepts") {
    const conceptA = typeof args.conceptA === "string" ? args.conceptA : "";
    const conceptB = typeof args.conceptB === "string" ? args.conceptB : "";
    if (!conceptA || !conceptB) {
      return {
        ok: false,
        summary: "both conceptA and conceptB are required",
        specChanged: false,
      };
    }
    const weightA = typeof args.weightA === "number" ? args.weightA : 0.5;
    try {
      const blend = blendConcepts(conceptA, conceptB, weightA);
      return {
        ok: true,
        summary: `Blended ${blend.recipe}\n\n${formatProfile(blend.profile)}`,
        specChanged: false,
        data: { kind: "blended_concept", blend },
      };
    } catch {
      return {
        ok: false,
        summary: `Unknown concept id — use list_semantic_concepts to see available options`,
        specChanged: false,
      };
    }
  }

  // Run a physics simulation and generate motion keyframes.
  if (tool === "simulate_physics") {
    const simType = typeof args.type === "string" ? args.type : "spring";
    const simConfig = typeof args.config === "object" && args.config !== null
      ? args.config as Record<string, number>
      : {};
    let result;
    switch (simType) {
      case "spring": result = simulateSpring(simConfig); break;
      case "gravity": result = simulateGravityDrop(simConfig); break;
      case "projectile": result = simulateProjectile(simConfig); break;
      case "friction": result = simulateFriction(simConfig); break;
      case "pendulum": result = simulatePendulum(simConfig); break;
      default:
        return {
          ok: false,
          summary: `Unknown physics type: ${simType}. Available: spring, gravity, projectile, friction, pendulum`,
          specChanged: false,
        };
    }
    const ts = now();
    const componentId = createId("c_");
    createComponent({
      ...result.component,
      id: componentId,
      projectId,
      createdAt: ts,
      updatedAt: ts,
    });
    return {
      ok: true,
      summary: result.summary,
      specChanged: true,
      data: { kind: "physics_simulation", simulationType: simType, samples: result.samples.length },
      editorCommands: [
        { command: "select_component", args: { componentId } },
        { command: "refresh_canvas", args: {} },
      ],
    };
  }

  // List physics presets.
  if (tool === "list_physics_presets") {
    const presets = listPhysicsPresets();
    const types = listPhysicsTypes();
    return {
      ok: true,
      summary: `${presets.length} physics presets available across ${types.length} simulation types`,
      specChanged: false,
      data: { kind: "physics_presets", presets, types },
    };
  }

  // Run a named physics preset.
  if (tool === "run_physics_preset") {
    const presetId = typeof args.presetId === "string" ? args.presetId : "";
    if (!presetId) {
      return {
        ok: false,
        summary: "presetId is required — use list_physics_presets to see available options",
        specChanged: false,
      };
    }
    const result = runPreset(presetId);
    if (!result) {
      return {
        ok: false,
        summary: `Unknown preset: ${presetId}`,
        specChanged: false,
      };
    }
    const ts = now();
    const componentId = createId("c_");
    createComponent({
      ...result.component,
      id: componentId,
      projectId,
      createdAt: ts,
      updatedAt: ts,
    });
    return {
      ok: true,
      summary: result.summary,
      specChanged: true,
      data: { kind: "physics_simulation", presetId, samples: result.samples.length },
      editorCommands: [
        { command: "select_component", args: { componentId } },
        { command: "refresh_canvas", args: {} },
      ],
    };
  }

  // Generate motion along a mathematical path.
  if (tool === "generate_path_motion") {
    const pathType = typeof args.type === "string" ? args.type : "lissajous";
    const pathConfig: Record<string, unknown> = { type: pathType };
    if (typeof args.durationMs === "number") pathConfig.durationMs = args.durationMs;
    if (typeof args.samples === "number") pathConfig.samples = args.samples;
    if (typeof args.scale === "number") pathConfig.scale = args.scale;
    if (typeof args.loop === "boolean") pathConfig.loop = args.loop;
    const result = generatePathMotion(pathConfig);
    const ts = now();
    const componentId = createId("c_");
    createComponent({
      ...result.component,
      id: componentId,
      projectId,
      createdAt: ts,
      updatedAt: ts,
    });
    return {
      ok: true,
      summary: result.summary,
      specChanged: true,
      data: { kind: "path_motion", pathType, pointCount: result.points.length },
      editorCommands: [
        { command: "select_component", args: { componentId } },
        { command: "refresh_canvas", args: {} },
      ],
    };
  }

  // List path motion presets.
  if (tool === "list_path_presets") {
    const presets = listPathPresets();
    const types = listPathTypes();
    return {
      ok: true,
      summary: `${presets.length} path presets available across ${types.length} path types`,
      specChanged: false,
      data: { kind: "path_presets", presets, types },
    };
  }

  // Run a named path preset.
  if (tool === "run_path_preset") {
    const presetId = typeof args.presetId === "string" ? args.presetId : "";
    if (!presetId) {
      return {
        ok: false,
        summary: "presetId is required — use list_path_presets to see available options",
        specChanged: false,
      };
    }
    const result = runPathPreset(presetId);
    if (!result) {
      return {
        ok: false,
        summary: `Unknown preset: ${presetId}`,
        specChanged: false,
      };
    }
    const ts = now();
    const componentId = createId("c_");
    createComponent({
      ...result.component,
      id: componentId,
      projectId,
      createdAt: ts,
      updatedAt: ts,
    });
    return {
      ok: true,
      summary: result.summary,
      specChanged: true,
      data: { kind: "path_motion", presetId, pointCount: result.points.length },
      editorCommands: [
        { command: "select_component", args: { componentId } },
        { command: "refresh_canvas", args: {} },
      ],
    };
  }

  // Encode motion to a standard format (requires spec — moved below).

  // List codec formats.
  if (tool === "list_codec_formats") {
    const formats = listCodecFormats();
    return {
      ok: true,
      summary: `${formats.length} codec formats available: ${formats.map((f) => f.name).join(", ")}`,
      specChanged: false,
      data: { kind: "codec_formats", formats },
    };
  }

  // Lineage tools work on the in-memory lineage store, not the spec.
  if (tool === "get_lineage_summary") {
    const summary = getProjectLineageSummary(projectId);
    return {
      ok: true,
      summary: `Lineage: ${summary.totalComponents} components, ${summary.rootCount} roots, max generation ${summary.maxGeneration}, avg ${summary.averageGeneration.toFixed(1)}`,
      specChanged: false,
      data: { kind: "lineage_summary", summary },
    };
  }

  if (tool === "get_lineage_tree") {
    const tree = getLineageTree(projectId);
    return {
      ok: true,
      summary: formatLineageTree(tree),
      specChanged: false,
      data: { kind: "lineage_tree", tree },
    };
  }

  if (tool === "query_lineage") {
    const componentId = typeof args.componentId === "string" ? args.componentId : "";
    if (!componentId) {
      return {
        ok: false,
        summary: "componentId is required for query_lineage",
        specChanged: false,
      };
    }
    const report = generateLineageReport(projectId, componentId);
    if (!report) {
      return {
        ok: false,
        summary: `no lineage record found for component ${componentId}`,
        specChanged: false,
      };
    }
    return {
      ok: true,
      summary: report.summary,
      specChanged: false,
      data: { kind: "lineage_report", report },
    };
  }

  if (tool === "record_lineage") {
    const componentId = typeof args.componentId === "string" ? args.componentId : "";
    const componentName = typeof args.componentName === "string" ? args.componentName : "";
    const operation = typeof args.operation === "string" ? args.operation : "original";
    const parentIds = Array.isArray(args.parentIds) ? args.parentIds.filter((id): id is string => typeof id === "string") : [];
    const params = (args.params && typeof args.params === "object" ? args.params : {}) as Record<string, unknown>;
    if (!componentId || !componentName) {
      return {
        ok: false,
        summary: "componentId and componentName are required for record_lineage",
        specChanged: false,
      };
    }
    const record = recordLineage(projectId, componentId, componentName, operation as never, parentIds, params);
    return {
      ok: true,
      summary: `Recorded lineage: ${componentName} (${operation}, generation ${record.generation})`,
      specChanged: false,
      data: { kind: "lineage_record", record },
    };
  }

  const spec = getProjectSpec(projectId);
  if (!spec) {
    return {
      ok: false,
      summary: "no project spec available for Motion Intelligence analysis",
      specChanged: false,
    };
  }

  // Verify the current motion against the user's stated intent by compiling
  // the request into testable assertions and evaluating each one. The intent
  // defaults to the most recent user message when not explicitly supplied.
  if (tool === "verify_motion") {
    const explicitIntent = typeof args.intent === "string" ? args.intent : "";
    const intent = explicitIntent || (() => {
      const mem = listMemory(projectId);
      const lastUser = [...mem].reverse().find((m) => m.role === "user");
      return lastUser?.content ?? "";
    })();
    if (!intent) {
      return {
        ok: false,
        summary: "No intent to verify against — pass an `intent` argument or run after a user message.",
        specChanged: false,
      };
    }
    const report = verifyMotion(intent, spec);
    return {
      ok: true,
      summary: formatVerificationReport(report),
      specChanged: false,
      data: { kind: "verification", report },
    };
  }

  // Self-correct: close the verification loop by applying the concrete
  // remediation patch for each failed required assertion, then re-verifying.
  // Mirrors auto_fix_accessibility: compute fixes on a clone, then apply them
  // to the live project via patchComponent so the canvas reflects the change.
  if (tool === "self_correct") {
    if (spec.components.length === 0) {
      return {
        ok: false,
        summary: "no components to self-correct — add content first",
        specChanged: false,
      };
    }
    const explicitIntent = typeof args.intent === "string" ? args.intent : "";
    const intent = explicitIntent || (() => {
      const mem = listMemory(projectId);
      const lastUser = [...mem].reverse().find((m) => m.role === "user");
      return lastUser?.content ?? "";
    })();
    if (!intent) {
      return {
        ok: false,
        summary: "No intent to self-correct against — pass an `intent` argument or run after a user message.",
        specChanged: false,
      };
    }
    const report = selfCorrectMotion(intent, spec);
    const apply = args.apply !== false; // default true
    let specChanged = false;
    if (apply && report.applied.length > 0) {
      for (const fix of report.applied) {
        patchComponent(projectId, fix.componentId, fix.patch);
      }
      specChanged = true;
    }
    return {
      ok: true,
      summary: formatSelfCorrectionReport(report),
      specChanged,
      data: {
        kind: "self_correction",
        report,
        applied: apply,
      },
    };
  }

  // Predict viewer perception of the motion (requires spec).
  if (tool === "predict_perception") {
    if (spec.components.length === 0) {
      return {
        ok: false,
        summary: "no components to analyze — add content first",
        specChanged: false,
      };
    }
    const report = predictPerception(spec);
    return {
      ok: true,
      summary: formatPerceptionReport(report),
      specChanged: false,
      data: { kind: "perception", report },
    };
  }

  // Encode motion to a standard format (requires spec).
  if (tool === "encode_motion") {
    const format = typeof args.format === "string" ? args.format as CodecFormat : "css";
    const minify = args.minify === true;
    const result = encodeMotion(spec, format, { minify });
    return {
      ok: true,
      summary: result.summary,
      specChanged: false,
      data: {
        kind: "codec",
        format: result.format,
        output: result.output,
        mimeType: result.mimeType,
        fileExtension: result.fileExtension,
      },
    };
  }

  if (tool === "evolve_motion") {
    if (spec.components.length === 0) {
      return {
        ok: false,
        summary: "no components to evolve — add content first",
        specChanged: false,
      };
    }
    const strategyId = typeof args.strategy === "string" ? args.strategy : "balanced";
    const config = getEvolutionConfig(strategyId);
    if (typeof args.generations === "number") config.generations = args.generations;
    if (typeof args.populationSize === "number") config.populationSize = args.populationSize;
    if (typeof args.mutationRate === "number") config.mutationRate = args.mutationRate;
    const result = evolveMotion(spec, config);
    const apply = args.apply === true;
    if (apply && result.improvement > 0) {
      for (const comp of result.best.spec.components) {
        patchComponent(projectId, comp.id, {
          easing: comp.easing,
          durationMs: comp.durationMs,
          delayMs: comp.delayMs,
          iterationCount: comp.iterationCount,
          direction: comp.direction,
        });
      }
    }
    return {
      ok: true,
      summary: result.summary,
      specChanged: apply && result.improvement > 0,
      data: {
        kind: "evolution",
        best: {
          generation: result.best.generation,
          origin: result.best.origin,
          fitness: result.best.fitness,
        },
        history: result.history,
        improvement: result.improvement,
        applied: apply && result.improvement > 0,
      },
      editorCommands: apply && result.improvement > 0 ? [{ command: "refresh_canvas", args: {} }] : undefined,
    };
  }

  if (tool === "synthesize_motion") {
    // Resolve source component IDs from args. Supports componentIds array
    // or sourceComponentId + targetComponentId pair.
    const componentIds = Array.isArray(args.componentIds)
      ? args.componentIds.filter((id): id is string => typeof id === "string")
      : [];
    const sourceId = typeof args.sourceComponentId === "string" ? args.sourceComponentId : "";
    const targetId = typeof args.targetComponentId === "string" ? args.targetComponentId : "";
    const ids = componentIds.length >= 2
      ? componentIds
      : [sourceId, targetId].filter(Boolean);
    if (ids.length < 2) {
      return {
        ok: false,
        summary: "synthesize_motion requires at least 2 source component IDs",
        specChanged: false,
      };
    }
    const sources = ids
      .map((id) => spec.components.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => c !== undefined);
    if (sources.length < 2) {
      return {
        ok: false,
        summary: "could not resolve at least 2 valid source components",
        specChanged: false,
      };
    }
    const strategy = typeof args.strategy === "string" ? (args.strategy as SynthesisStrategy) : "blend";
    const result = synthesizeMotion(sources, { strategy });
    // Persist the synthesized component so the DNA-level result becomes a
    // concrete motion layer in the project.
    const synthesized = applySynthesizedDNA(sources[0]!, result);
    const ts = now();
    const componentId = createId("c_");
    createComponent({
      ...synthesized,
      id: componentId,
      projectId,
      createdAt: ts,
      updatedAt: ts,
    });
    return {
      ok: true,
      summary: formatSynthesisReport(result),
      specChanged: true,
      data: { kind: "synthesis", result, componentId },
      editorCommands: [
        { command: "select_component", args: { componentId } },
        { command: "refresh_canvas", args: {} },
      ],
    };
  }

  if (tool === "critique_motion") {
    const report = critiqueMotion(spec);
    return {
      ok: true,
      summary: formatCritiqueReport(report, spec.project.name),
      specChanged: false,
      data: { kind: "critique", report },
    };
  }

  if (tool === "generate_story") {
    // Accept either an explicit intent or a natural-language prompt.
    const explicitIntent = typeof args.intent === "string" ? (args.intent as NarrativeIntent) : null;
    const prompt = typeof args.prompt === "string" ? args.prompt : "";
    const intent = explicitIntent ?? detectNarrativeIntent(prompt);
    if (!intent) {
      return {
        ok: false,
        summary: "could not detect a narrative intent from the message. Available intents: hero-entrance, celebration, dramatic-reveal, conflict, transformation, journey, resolution",
        specChanged: false,
      };
    }
    const totalDurationMs = typeof args.totalDurationMs === "number" ? args.totalDurationMs : 4000;
    const intensityScale = typeof args.intensityScale === "number" ? args.intensityScale : 1.0;
    const sequence = generateStorySequence(intent, { totalDurationMs, intensityScale });
    return {
      ok: true,
      summary: formatStoryReport(sequence),
      specChanged: false,
      data: { kind: "story", sequence },
    };
  }

  if (tool === "generate_variations") {
    const componentId = typeof args.componentId === "string" ? args.componentId : "";
    const source = spec.components.find((c) => c.id === componentId);
    if (!source) {
      return {
        ok: false,
        summary: `component ${componentId} not found for variation generation`,
        specChanged: false,
      };
    }
    const countPerAxis = typeof args.countPerAxis === "number" ? args.countPerAxis : 3;
    const variations = generateVariations(source, { countPerAxis });
    return {
      ok: true,
      summary: formatVariationSummary(variations),
      specChanged: false,
      data: {
        kind: "variations",
        sourceComponentId: source.id,
        sourceComponentName: source.name,
        variations: variations.map((v) => ({
          label: v.label,
          axis: v.axis,
          delta: v.delta,
          component: v.component,
        })),
      },
    };
  }

  if (tool === "extract_motion_dna") {
    const componentId = typeof args.componentId === "string" ? args.componentId : "";
    const component = spec.components.find((c) => c.id === componentId);
    if (!component) {
      return {
        ok: false,
        summary: `component ${componentId} not found for DNA extraction`,
        specChanged: false,
      };
    }
    const dna = extractDNA(component);
    return {
      ok: true,
      summary: formatDNAReport(dna, component.name),
      specChanged: false,
      data: { kind: "motion_dna", componentId: component.id, componentName: component.name, dna },
    };
  }

  if (tool === "auto_fix_accessibility") {
    // Resolve target components: either an explicit list or the whole project.
    const requestedIds = Array.isArray(args.componentIds)
      ? args.componentIds.filter((id): id is string => typeof id === "string")
      : [];
    const targets = requestedIds.length > 0
      ? spec.components.filter((c) => requestedIds.includes(c.id))
      : spec.components;
    if (targets.length === 0) {
      return {
        ok: false,
        summary: "no components available to auto-fix",
        specChanged: false,
      };
    }
    const options: AutoFixOptions = {};
    if (typeof args.maxDisplacementPx === "number") options.maxDisplacementPx = args.maxDisplacementPx;
    if (typeof args.maxRotationDeg === "number") options.maxRotationDeg = args.maxRotationDeg;
    if (typeof args.minDurationMs === "number") options.minDurationMs = args.minDurationMs;
    if (typeof args.maxLoopIterations === "number") options.maxLoopIterations = args.maxLoopIterations;
    if (typeof args.staggerStepMs === "number") options.staggerStepMs = args.staggerStepMs;
    const { fixedComponents, result } = autoFixAccessibility(targets, options);

    // Optionally apply fixes to the project spec so the canvas reflects them.
    const apply = args.apply !== false; // default true
    let specChanged = false;
    if (apply && result.fixedCount > 0) {
      for (const fixed of fixedComponents) {
        const patch: Record<string, unknown> = {};
        const compFixes = result.fixes.filter((f) => f.componentId === fixed.id);
        const touchedFields = new Set(compFixes.map((f) => f.field.split(".")[0]));
        if (touchedFields.has("durationMs")) patch.durationMs = fixed.durationMs;
        if (touchedFields.has("delayMs")) patch.delayMs = fixed.delayMs;
        if (touchedFields.has("iterationCount")) patch.iterationCount = fixed.iterationCount;
        if (touchedFields.has("fillMode")) patch.fillMode = fixed.fillMode;
        if (touchedFields.has("easing")) patch.easing = fixed.easing;
        if (touchedFields.has("keyframe")) patch.keyframes = fixed.keyframes;
        if (Object.keys(patch).length > 0) {
          patchComponent(projectId, fixed.id, patch);
          specChanged = true;
        }
      }
    }
    return {
      ok: true,
      summary: formatAutoFixReport(result),
      specChanged,
      data: {
        kind: "auto_fix",
        result,
        applied: apply,
        components: apply ? fixedComponents : undefined,
      },
    };
  }

  if (tool === "list_personas") {
    const personas = listPersonas();
    return {
      ok: true,
      summary: `${personas.length} persona(s) available: ${personas.map((p) => p.name).join(", ")}`,
      specChanged: false,
      data: {
        kind: "persona_list",
        personas: personas.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          origin: p.origin,
          signatures: p.signatures,
          restraintLevel: p.restraintLevel,
          intensityCeiling: p.intensityCeiling,
        })),
      },
    };
  }

  if (tool === "detect_persona") {
    const detection = detectPersona(spec);
    return {
      ok: true,
      summary: formatPersonaDetectionReport(detection),
      specChanged: false,
      data: { kind: "persona_detection", detection },
    };
  }

  if (tool === "apply_persona") {
    const personaId = typeof args.personaId === "string" ? args.personaId : "";
    if (!personaId) {
      return {
        ok: false,
        summary: "personaId is required for apply_persona",
        specChanged: false,
      };
    }
    const result = applyPersona(spec, personaId);
    const apply = args.apply !== false; // default true
    let specChanged = false;
    if (apply && result.adjustedCount > 0) {
      // Persist the transformed components to the spec.
      for (const transformed of result.transformedComponents) {
        const adj = result.adjustments.filter((a) => a.componentId === transformed.id);
        if (adj.length === 0) continue;
        const patch: Record<string, unknown> = {};
        const fields = new Set(adj.map((a) => a.field.split(".")[0]));
        if (fields.has("easing")) patch.easing = transformed.easing;
        if (fields.has("durationMs")) patch.durationMs = transformed.durationMs;
        if (fields.has("delayMs")) patch.delayMs = transformed.delayMs;
        if (fields.has("iterationCount")) patch.iterationCount = transformed.iterationCount;
        if (fields.has("keyframe")) patch.keyframes = transformed.keyframes;
        if (Object.keys(patch).length > 0) {
          patchComponent(projectId, transformed.id, patch);
          specChanged = true;
        }
      }
    }
    return {
      ok: true,
      summary: formatPersonaApplicationReport(result),
      specChanged,
      data: {
        kind: "persona_application",
        result: {
          personaId: result.personaId,
          personaName: result.personaName,
          adjustments: result.adjustments,
          componentCount: result.componentCount,
          adjustedCount: result.adjustedCount,
          skippedCount: result.skippedCount,
          summary: result.summary,
        },
        applied: apply,
      },
    };
  }

  if (tool === "coach_motion") {
    const result = coachMotion(spec);
    return {
      ok: true,
      summary: formatCoachReport(result),
      specChanged: false,
      data: { kind: "coach", result },
    };
  }

  if (tool === "analyze_genome") {
    const result = analyzeGenome(spec);
    return {
      ok: true,
      summary: formatGenomeReport(result),
      specChanged: false,
      data: { kind: "genome", result },
    };
  }

  if (tool === "forecast_motion") {
    const result = forecastMotion(spec);
    return {
      ok: true,
      summary: formatForecastReport(result),
      specChanged: false,
      data: { kind: "forecast", result },
    };
  }

  if (tool === "list_constraint_profiles") {
    const profiles = listConstraintProfiles();
    return {
      ok: true,
      summary: `${profiles.length} constraint profile(s) available: ${profiles.map((p) => p.name).join(", ")}`,
      specChanged: false,
      data: {
        kind: "constraint_profiles",
        profiles: profiles.map((p) => ({
          name: p.name,
          maxDurationMs: p.maxDurationMs,
          minDurationMs: p.minDurationMs,
          maxDisplacementPx: p.maxDisplacementPx,
          maxRotationDeg: p.maxRotationDeg,
          maxScale: p.maxScale,
          maxOpacityDelta: p.maxOpacityDelta,
          forbiddenEasings: p.forbiddenEasings,
          preferredEasings: p.preferredEasings,
          maxLoops: p.maxLoops,
          maxConcurrentAnimations: p.maxConcurrentAnimations,
        })),
      },
    };
  }

  if (tool === "negotiate_intent") {
    const intent = typeof args.intent === "string" ? args.intent : "";
    if (!intent) {
      return {
        ok: false,
        summary: "intent is required for negotiate_intent",
        specChanged: false,
      };
    }
    const profileName = typeof args.profile === "string" ? args.profile : "vestibular-safe";
    const profile = getConstraintProfile(profileName) ?? getConstraintProfile("vestibular-safe")!;
    const result = negotiateIntent(intent, spec, profile);
    const apply = args.apply === true; // default false — negotiation is dry-run by default
    let specChanged = false;
    if (apply && result.negotiatedSpec.components.length > 0) {
      // Persist the negotiated components to the spec.
      for (const negotiated of result.negotiatedSpec.components) {
        // For existing components (renegotiated), patch them.
        const existing = spec.components.find((c) => c.id === negotiated.id);
        if (existing) {
          const patch: Record<string, unknown> = {};
          if (existing.durationMs !== negotiated.durationMs) patch.durationMs = negotiated.durationMs;
          if (existing.delayMs !== negotiated.delayMs) patch.delayMs = negotiated.delayMs;
          if (existing.iterationCount !== negotiated.iterationCount) patch.iterationCount = negotiated.iterationCount;
          if (existing.easing !== negotiated.easing) patch.easing = negotiated.easing;
          if (existing.keyframes !== negotiated.keyframes) patch.keyframes = negotiated.keyframes;
          if (Object.keys(patch).length > 0) {
            patchComponent(projectId, negotiated.id, patch);
            specChanged = true;
          }
        }
        // New components (negotiated from empty spec) are not auto-created here —
        // the caller can use the returned negotiatedSpec to create them via the
        // normal component creation flow.
      }
    }
    return {
      ok: true,
      summary: formatNegotiationReport(result),
      specChanged,
      data: {
        kind: "negotiation",
        result: {
          intent: result.intent,
          parsedIntent: result.parsedIntent,
          constraintProfile: {
            name: result.constraintProfile.name,
            maxDurationMs: result.constraintProfile.maxDurationMs,
            minDurationMs: result.constraintProfile.minDurationMs,
            maxDisplacementPx: result.constraintProfile.maxDisplacementPx,
            maxRotationDeg: result.constraintProfile.maxRotationDeg,
            maxScale: result.constraintProfile.maxScale,
            maxOpacityDelta: result.constraintProfile.maxOpacityDelta,
            forbiddenEasings: result.constraintProfile.forbiddenEasings,
            preferredEasings: result.constraintProfile.preferredEasings,
            maxLoops: result.constraintProfile.maxLoops,
            maxConcurrentAnimations: result.constraintProfile.maxConcurrentAnimations,
          },
          tradeoffs: result.tradeoffs,
          complianceScore: result.complianceScore,
          intentFidelityScore: result.intentFidelityScore,
          intentWasCompatible: result.intentWasCompatible,
          summary: result.summary,
        },
        applied: apply,
        negotiatedComponents: apply ? result.negotiatedSpec.components : undefined,
      },
    };
  }

  if (tool === "list_remix_strategies") {
    const strategies = listRemixStrategies();
    return {
      ok: true,
      summary: `${strategies.length} remix strategy(ies) available: ${strategies.map((s) => s.id).join(", ")}`,
      specChanged: false,
      data: {
        kind: "remix_strategies",
        strategies,
      },
    };
  }

  if (tool === "remix_motion") {
    const strategyArg = typeof args.strategy === "string" ? args.strategy : "shuffle";
    const validStrategies: RemixStrategy[] = ["shuffle", "mirror", "invert", "swap", "cascade", "scatter", "hybridize", "rephrase"];
    if (!validStrategies.includes(strategyArg as RemixStrategy)) {
      return {
        ok: false,
        summary: `Unknown remix strategy: ${strategyArg}. Valid strategies: ${validStrategies.join(", ")}`,
        specChanged: false,
      };
    }
    const strategy = strategyArg as RemixStrategy;
    const seed = typeof args.seed === "number" ? args.seed : Date.now();
    const result = remixMotion(spec, strategy, seed);
    const apply = args.apply === true; // default false — remix is dry-run by default
    let specChanged = false;
    if (apply && result.remixedSpec.components.length > 0) {
      // Persist the remixed component changes to the spec.
      for (const remixed of result.remixedSpec.components) {
        const existing = spec.components.find((c) => c.id === remixed.id);
        if (existing) {
          const patch: Record<string, unknown> = {};
          if (existing.durationMs !== remixed.durationMs) patch.durationMs = remixed.durationMs;
          if (existing.delayMs !== remixed.delayMs) patch.delayMs = remixed.delayMs;
          if (existing.iterationCount !== remixed.iterationCount) patch.iterationCount = remixed.iterationCount;
          if (existing.direction !== remixed.direction) patch.direction = remixed.direction;
          if (existing.easing !== remixed.easing) patch.easing = remixed.easing;
          if (existing.keyframes !== remixed.keyframes) patch.keyframes = remixed.keyframes;
          if (existing.name !== remixed.name) patch.name = remixed.name;
          if (existing.orderIndex !== remixed.orderIndex) patch.orderIndex = remixed.orderIndex;
          if (Object.keys(patch).length > 0) {
            patchComponent(projectId, remixed.id, patch);
            specChanged = true;
          }
        }
      }
    }
    return {
      ok: true,
      summary: formatRemixReport(result),
      specChanged,
      data: {
        kind: "remix",
        result: {
          strategy: result.strategy,
          seed: result.seed,
          sourceComponentCount: result.sourceComponentCount,
          remixComponentCount: result.remixComponentCount,
          changeCount: result.changes.length,
          changes: result.changes,
          summary: result.summary,
        },
        applied: apply,
      },
    };
  }

  if (tool === "list_dialects") {
    const dialects = listDialects();
    return {
      ok: true,
      summary: `${dialects.length} dialect(s) available: ${dialects.map((d) => d.name).join(", ")}`,
      specChanged: false,
      data: {
        kind: "dialects",
        dialects: dialects.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description,
          durationRange: d.durationRange,
          preferredEasings: d.preferredEasings,
          avoidedEasings: d.avoidedEasings,
          intensityMultiplier: d.intensityMultiplier,
          favorsInfiniteLoops: d.favorsInfiniteLoops,
          defaultLoopCount: d.defaultLoopCount,
          staggerInterval: d.staggerInterval,
          maxConcurrency: d.maxConcurrency,
          signatures: d.signatures,
        })),
      },
    };
  }

  if (tool === "detect_dialect") {
    const result = detectDialect(spec);
    return {
      ok: true,
      summary: `Best dialect match: ${result.bestMatch}. Scores: ${result.scores.map((s) => `${s.name}=${s.score}`).join(", ")}`,
      specChanged: false,
      data: {
        kind: "dialect_detection",
        bestMatch: result.bestMatch,
        scores: result.scores,
      },
    };
  }

  if (tool === "translate_dialect") {
    const validDialects: DialectId[] = ["web", "mobile", "gaming", "data-viz", "presentation", "kiosk", "accessibility"];
    const sourceId = typeof args.sourceDialect === "string" ? args.sourceDialect : "web";
    const targetId = typeof args.targetDialect === "string" ? args.targetDialect : "";
    if (!targetId || !validDialects.includes(targetId as DialectId)) {
      return {
        ok: false,
        summary: `Invalid target dialect: ${targetId}. Valid: ${validDialects.join(", ")}`,
        specChanged: false,
      };
    }
    // Auto-detect source if not provided or invalid.
    const finalSourceId = validDialects.includes(sourceId as DialectId)
      ? (sourceId as DialectId)
      : detectDialect(spec).bestMatch;
    const result = translateDialect(spec, finalSourceId, targetId as DialectId);
    const apply = args.apply === true; // default false — translation is dry-run by default
    let specChanged = false;
    if (apply && result.translatedSpec.components.length > 0) {
      for (const translated of result.translatedSpec.components) {
        const existing = spec.components.find((c) => c.id === translated.id);
        if (existing) {
          const patch: Record<string, unknown> = {};
          if (existing.durationMs !== translated.durationMs) patch.durationMs = translated.durationMs;
          if (existing.delayMs !== translated.delayMs) patch.delayMs = translated.delayMs;
          if (existing.iterationCount !== translated.iterationCount) patch.iterationCount = translated.iterationCount;
          if (existing.easing !== translated.easing) patch.easing = translated.easing;
          if (existing.keyframes !== translated.keyframes) patch.keyframes = translated.keyframes;
          if (Object.keys(patch).length > 0) {
            patchComponent(projectId, translated.id, patch);
            specChanged = true;
          }
        }
      }
    }
    return {
      ok: true,
      summary: formatDialectReport(result),
      specChanged,
      data: {
        kind: "dialect_translation",
        result: {
          sourceDialect: result.sourceDialect,
          targetDialect: result.targetDialect,
          componentCount: result.componentCount,
          changeCount: result.changeCount,
          changes: result.changes,
          summary: result.summary,
        },
        applied: apply,
      },
    };
  }

  // --- Motion Profiler ---
  if (tool === "profile_motion") {
    const report = profileMotion(spec);
    return {
      ok: true,
      summary: formatProfilerReport(report),
      specChanged: false,
      data: {
        kind: "profiler",
        report,
      },
    };
  }

  // --- Motion Curator ---
  if (tool === "list_semantic_roles") {
    const roles = listSemanticRoles();
    return {
      ok: true,
      summary: `${roles.length} semantic roles available: ${roles.map((r) => r.name).join(", ")}`,
      specChanged: false,
      data: {
        kind: "semantic_roles",
        roles,
      },
    };
  }

  if (tool === "curate_motion") {
    const report = curateMotion(spec);
    return {
      ok: true,
      summary: formatCurationReport(report),
      specChanged: false,
      data: {
        kind: "curator",
        report,
      },
    };
  }

  // --- Motion Strategist ---
  if (tool === "list_archetypes") {
    const archetypes = listArchetypes();
    return {
      ok: true,
      summary: `${archetypes.length} archetypes available: ${archetypes.map((a) => a.archetype).join(", ")}`,
      specChanged: false,
      data: {
        kind: "archetypes",
        archetypes,
      },
    };
  }

  if (tool === "strategize_motion") {
    const report = strategizeMotion(spec);
    return {
      ok: true,
      summary: formatStrategyReport(report),
      specChanged: false,
      data: {
        kind: "strategy",
        report,
      },
    };
  }

  // --- Motion Auditor ---
  if (tool === "audit_motion") {
    const report = auditMotion(spec);
    return {
      ok: true,
      summary: formatAuditReport(report),
      specChanged: false,
      data: {
        kind: "audit",
        report,
      },
    };
  }

  // --- Motion Choreographer ---
  if (tool === "list_choreography_modes") {
    const modes = listChoreographyModes();
    return {
      ok: true,
      summary: `${modes.length} choreography modes available: ${modes.map((m) => m.name).join(", ")}`,
      specChanged: false,
      data: {
        kind: "choreography_modes",
        modes,
      },
    };
  }

  if (tool === "choreograph_motion") {
    const mode = (typeof args.mode === "string" ? args.mode : "cascade") as ChoreographyMode;
    const plan = choreographMotion(spec, mode);
    const apply = args.apply === true;
    if (apply) {
      // Apply the choreographed delays to the spec
      for (const c of plan.components) {
        patchComponent(projectId, c.componentId, {
          delayMs: c.delayMs,
          durationMs: c.durationMs,
        });
      }
    }
    return {
      ok: true,
      summary: formatChoreographyReport(plan),
      specChanged: apply,
      data: {
        kind: "choreography",
        plan,
        applied: apply,
      },
    };
  }

  // --- Motion Export Optimizer ---
  if (tool === "list_export_targets") {
    const targets = listExportTargets();
    return {
      ok: true,
      summary: `${targets.length} export targets available: ${targets.map((t) => t.name).join(", ")}`,
      specChanged: false,
      data: {
        kind: "export_targets",
        targets,
      },
    };
  }

  if (tool === "optimize_export") {
    const target = (typeof args.target === "string" ? args.target : "css") as ExportTarget;
    const result = optimizeForExport(spec, target);
    return {
      ok: true,
      summary: formatExportReport(result),
      specChanged: false,
      data: {
        kind: "export_optimization",
        result,
      },
    };
  }

  // --- Motion Cohesion Analyzer ---
  if (tool === "analyze_cohesion") {
    const report = analyzeCohesion(spec);
    return {
      ok: true,
      summary: formatCohesionReport(report),
      specChanged: false,
      data: {
        kind: "cohesion",
        report,
      },
    };
  }

  // --- Motion Timeline Conflict Detector ---
  if (tool === "detect_conflicts") {
    const report = detectConflicts(spec);
    return {
      ok: true,
      summary: formatConflictReport(report),
      specChanged: false,
      data: {
        kind: "conflicts",
        report,
      },
    };
  }

  // --- Motion Variant Comparator ---
  if (tool === "compare_variants") {
    const variantIds = Array.isArray(args.variantIds)
      ? args.variantIds.filter((v): v is string => typeof v === "string")
      : undefined;
    const report = compareVariants(spec, variantIds);
    return {
      ok: true,
      summary: formatComparisonReport(report),
      specChanged: false,
      data: {
        kind: "comparison",
        report,
      },
    };
  }

  // transfer_style (component-level)
  if (tool === "transfer_style") {
    const sourceComponentId = typeof args.sourceComponentId === "string" ? args.sourceComponentId : "";
    const targetComponentId = typeof args.targetComponentId === "string" ? args.targetComponentId : "";
    const source = spec.components.find((c) => c.id === sourceComponentId);
    const target = spec.components.find((c) => c.id === targetComponentId);
    if (!source || !target) {
      return {
        ok: false,
        summary: `source ${sourceComponentId} or target ${targetComponentId} not found for style transfer`,
        specChanged: false,
      };
    }
    const result = transferStyle(source, target);
    // Persist the style-transferred component by patching the target.
    patchComponent(projectId, target.id, {
      easing: result.component.easing,
      durationMs: result.component.durationMs,
      keyframes: result.component.keyframes,
      style: result.component.style,
    });
    return {
      ok: true,
      summary: formatStyleTransferReport(result, source.name, target.name),
      specChanged: true,
      data: {
        kind: "style_transfer",
        sourceComponentId: source.id,
        targetComponentId: target.id,
        transferred: result.transferred,
        preserved: result.preserved,
        component: result.component,
      },
      editorCommands: [
        { command: "select_component", args: { componentId: target.id } },
        { command: "refresh_canvas", args: {} },
      ],
    };
  }

  // --- Style Transfer Engine (project-level) ---

  // List style archetypes (no spec required).
  if (tool === "list_style_archetypes") {
    const archetypes = listStyleArchetypes();
    return {
      ok: true,
      summary: `${archetypes.length} style archetypes available: ${archetypes.map((a) => a.name).join(", ")}`,
      specChanged: false,
      data: { kind: "style_archetypes", archetypes },
    };
  }

  // Build knowledge graph (no spec required).
  if (tool === "build_knowledge_graph") {
    const graph = buildKnowledgeGraph();
    return {
      ok: true,
      summary: formatGraphReport(graph),
      specChanged: false,
      data: { kind: "knowledge_graph", graph },
    };
  }

  // List test suites (no spec required).
  if (tool === "list_test_suites") {
    const suites = listTestSuites();
    return {
      ok: true,
      summary: `${suites.length} test suites available across ${new Set(suites.map((s) => s.category)).size} categories`,
      specChanged: false,
      data: { kind: "test_suites", suites },
    };
  }

  // Query a concept from the knowledge graph.
  if (tool === "query_concept") {
    const conceptId = String(args.conceptId ?? "");
    const graph = buildKnowledgeGraph();
    const concept = queryConcept(graph, conceptId);
    if (!concept) {
      return { ok: false, summary: `concept '${conceptId}' not found`, specChanged: false };
    }
    const c = concept;
    return {
      ok: true,
      summary: `${c.label} (${c.category}): ${c.description}`,
      specChanged: false,
      data: { kind: "concept", concept: c },
    };
  }

  // Find related concepts.
  if (tool === "find_related") {
    const conceptId = String(args.conceptId ?? "");
    const relationship = typeof args.relationship === "string" ? args.relationship as never : undefined;
    const graph = buildKnowledgeGraph();
    const related = findRelated(graph, conceptId, relationship);
    return {
      ok: true,
      summary: `${related.length} related concepts for '${conceptId}'`,
      specChanged: false,
      data: { kind: "related_concepts", conceptId, related },
    };
  }

  // Find path between two concepts.
  if (tool === "find_concept_path") {
    const fromId = String(args.fromId ?? "");
    const toId = String(args.toId ?? "");
    const graph = buildKnowledgeGraph();
    const path = findPath(graph, fromId, toId);
    return {
      ok: true,
      summary: path.length > 0 ? `Path: ${path.join(" → ")}` : `No path found between '${fromId}' and '${toId}'`,
      specChanged: false,
      data: { kind: "concept_path", fromId, toId, path },
    };
  }

  // Search concepts by keyword.
  if (tool === "search_concepts") {
    const query = String(args.query ?? "");
    const graph = buildKnowledgeGraph();
    const results = searchConcepts(graph, query);
    return {
      ok: true,
      summary: `${results.length} concepts matching '${query}'`,
      specChanged: false,
      data: { kind: "concept_search", query, results },
    };
  }

  // Suggest connections between concepts.
  if (tool === "suggest_connections") {
    const conceptIds = Array.isArray(args.conceptIds)
      ? (args.conceptIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [];
    const graph = buildKnowledgeGraph();
    const suggestions = suggestConnections(graph, conceptIds);
    return {
      ok: true,
      summary: `${suggestions.length} connection suggestions`,
      specChanged: false,
      data: { kind: "connection_suggestions", suggestions },
    };
  }

  // Recommend next concept to explore.
  if (tool === "recommend_next") {
    const usedConceptIds = Array.isArray(args.usedConceptIds)
      ? (args.usedConceptIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [];
    const graph = buildKnowledgeGraph();
    const recommendations = recommendNext(graph, usedConceptIds);
    return {
      ok: true,
      summary: `Top recommendations: ${recommendations.slice(0, 5).map((c) => c.label).join(", ")}`,
      specChanged: false,
      data: { kind: "recommendations", recommendations },
    };
  }

  // Analyze graph structure.
  if (tool === "analyze_graph") {
    const graph = buildKnowledgeGraph();
    const analysis = analyzeGraph(graph);
    return {
      ok: true,
      summary: `Graph: ${analysis.nodeCount} nodes, ${analysis.edgeCount} edges, ${analysis.clusters.length} clusters, density ${analysis.density.toFixed(3)}`,
      specChanged: false,
      data: { kind: "graph_analysis", analysis },
    };
  }

  // Extract style DNA from the current project.
  if (tool === "extract_style_dna") {
    const dna = extractStyleDNA(spec!);
    const description = describeStyle(dna);
    return {
      ok: true,
      summary: description,
      specChanged: false,
      data: { kind: "style_dna", dna, description },
    };
  }

  // Describe the project's motion style.
  if (tool === "describe_style") {
    const dna = extractStyleDNA(spec!);
    const description = describeStyle(dna);
    return {
      ok: true,
      summary: description,
      specChanged: false,
      data: { kind: "style_description", description, dna },
    };
  }

  // Transfer style from one project to another.
  if (tool === "transfer_project_style") {
    const sourceProjectId = String(args.sourceProjectId ?? "");
    const sourceSpec = getProjectSpec(sourceProjectId);
    if (!sourceSpec) {
      return { ok: false, summary: `source project ${sourceProjectId} not found`, specChanged: false };
    }
    const options: Record<string, unknown> = {};
    if (typeof args.easingStrength === "number") options.easingStrength = args.easingStrength;
    if (typeof args.tempoStrength === "number") options.tempoStrength = args.tempoStrength;
    if (typeof args.energyStrength === "number") options.energyStrength = args.energyStrength;
    if (typeof args.colorStrength === "number") options.colorStrength = args.colorStrength;
    const result = transferMotionStyle(sourceSpec, spec!, options);
    return {
      ok: true,
      summary: `Transferred style from project ${sourceProjectId} to ${projectId}`,
      specChanged: true,
      data: { kind: "style_transfer_result", result },
      editorCommands: [{ command: "refresh_canvas", args: {} }],
    };
  }

  // Blend styles of two projects.
  if (tool === "blend_styles") {
    const projectIdA = String(args.projectIdA ?? "");
    const projectIdB = String(args.projectIdB ?? "");
    const ratio = typeof args.ratio === "number" ? args.ratio : 0.5;
    const specA = getProjectSpec(projectIdA);
    const specB = getProjectSpec(projectIdB);
    if (!specA || !specB) {
      return { ok: false, summary: "both projects must exist", specChanged: false };
    }
    const blendedDna = blendStyles(specA, specB!, ratio);
    const description = describeStyle(blendedDna);
    return {
      ok: true,
      summary: `Blended style (ratio ${ratio}): ${description}`,
      specChanged: false,
      data: { kind: "blended_style", dna: blendedDna, description },
    };
  }

  // Compare styles of two projects.
  if (tool === "compare_styles") {
    const projectIdA = String(args.projectIdA ?? "");
    const projectIdB = String(args.projectIdB ?? "");
    const specA = getProjectSpec(projectIdA);
    const specB = getProjectSpec(projectIdB);
    if (!specA || !specB) {
      return { ok: false, summary: "both projects must exist", specChanged: false };
    }
    const dnaA = extractStyleDNA(specA!);
    const dnaB = extractStyleDNA(specB!);
    const comparison = compareStyles(dnaA, dnaB);
    return {
      ok: true,
      summary: `Style similarity: ${(comparison.overallSimilarity * 100).toFixed(1)}% (${comparison.verdict})`,
      specChanged: false,
      data: { kind: "style_comparison", comparison },
    };
  }

  // Apply a style archetype to the project.
  if (tool === "apply_style_archetype") {
    const archetypeId = String(args.archetypeId ?? "");
    const result = applyArchetype(archetypeId, spec!);
    return {
      ok: true,
      summary: `Applied '${archetypeId}' archetype to project`,
      specChanged: true,
      data: { kind: "archetype_applied", archetypeId, result },
      editorCommands: [{ command: "refresh_canvas", args: {} }],
    };
  }

  // Run all motion quality tests.
  if (tool === "run_all_tests") {
    const report = runAllTests(spec!);
    return {
      ok: true,
      summary: formatTestReport(report),
      specChanged: false,
      data: { kind: "test_report", report },
    };
  }

  // Run tests by category.
  if (tool === "run_tests_by_category") {
    const category = typeof args.category === "string" ? args.category as never : "accessibility";
    const results = runTestsByCategory(spec!, category);
    return {
      ok: true,
      summary: `${results.length} ${category} test suites run. Passed: ${results.filter((r) => r.passed).length}/${results.length}`,
      specChanged: false,
      data: { kind: "test_results_category", category, results },
    };
  }

  // Run a single test suite.
  if (tool === "run_test_suite") {
    const suiteId = String(args.suiteId ?? "");
    const result = runTestSuite(spec!, suiteId);
    if (!result) {
      return { ok: false, summary: `test suite '${suiteId}' not found`, specChanged: false };
    }
    return {
      ok: true,
      summary: `${result.suiteName}: ${result.passed ? "PASSED" : "FAILED"} (score: ${result.score}/100)`,
      specChanged: false,
      data: { kind: "test_result", result },
    };
  }

  // ------------------------------------------------------------------------
  // Emotion Intelligence tools
  // ------------------------------------------------------------------------

  // List all available emotions.
  if (tool === "list_emotions") {
    const category = typeof args.category === "string" ? args.category as never : undefined;
    const emotions = listEmotions(category);
    return {
      ok: true,
      summary: `${emotions.length} emotion profiles available: ${emotions.map((e) => e.name).join(", ")}`,
      specChanged: false,
      data: {
        kind: "emotions",
        emotions: emotions.map((e) => ({
          id: e.id,
          name: e.name,
          category: e.category,
          description: e.description,
          vad: e.vad,
        })),
      },
    };
  }

  // Synthesize motion from an emotion.
  if (tool === "synthesize_from_emotion") {
    const emotionId = String(args.emotionId ?? "");
    const result = synthesizeFromEmotion(emotionId);
    if (!result) {
      return { ok: false, summary: `emotion '${emotionId}' not found`, specChanged: false };
    }
    // Persist the synthesized emotion motion as a project component.
    const ts = now();
    const componentId = createId("c_");
    createComponent({
      id: componentId,
      projectId,
      sceneId: null,
      name: `Emotion: ${result.emotion.name}`,
      selector: null,
      templateId: null,
      durationMs: result.durationMs,
      delayMs: 0,
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      playState: "running",
      trigger: "onLoad",
      easing: result.easing,
      keyframes: result.keyframes,
      style: {},
      orderIndex: 0,
      parentId: null,
      createdAt: ts,
      updatedAt: ts,
    });
    return {
      ok: true,
      summary: result.summary,
      specChanged: true,
      data: {
        kind: "emotion_synthesis",
        emotion: { id: result.emotion.id, name: result.emotion.name },
        easing: result.easing,
        durationMs: result.durationMs,
        intensity: result.intensity,
        transformType: result.transformType,
        keyframes: result.keyframes,
        palette: result.palette,
        report: formatEmotionReport(result),
        componentId,
      },
      editorCommands: [
        { command: "select_component", args: { componentId } },
        { command: "refresh_canvas", args: {} },
      ],
    };
  }

  // Detect emotion from an existing motion component.
  if (tool === "detect_emotion") {
    const componentId = String(args.componentId ?? "");
    const component = spec?.components.find((c) => c.id === componentId);
    if (!component) {
      return { ok: false, summary: `component '${componentId}' not found`, specChanged: false };
    }
    const result = detectEmotionFromMotion(component);
    return {
      ok: true,
      summary: result.summary,
      specChanged: false,
      data: {
        kind: "emotion_detection",
        emotionId: result.emotionId,
        emotionName: result.emotionName,
        confidence: result.confidence,
        vad: result.vad,
        scores: result.scores,
        report: formatDetectionReport(result),
      },
    };
  }

  // Blend multiple emotions.
  if (tool === "blend_emotions") {
    const emotions = Array.isArray(args.emotions) ? args.emotions : [];
    const result = blendEmotions(
      emotions.map((e: { emotionId: string; weight: number }) => ({
        emotionId: String(e.emotionId),
        weight: Number(e.weight),
      })),
    );
    if (!result) {
      return { ok: false, summary: "failed to blend emotions — check emotion ids", specChanged: false };
    }
    // Persist the blended emotion motion as a project component.
    const ts = now();
    const componentId = createId("c_");
    createComponent({
      id: componentId,
      projectId,
      sceneId: null,
      name: "Blended Emotion",
      selector: null,
      templateId: null,
      durationMs: 800,
      delayMs: 0,
      iterationCount: 1,
      direction: "normal",
      fillMode: "forwards",
      playState: "running",
      trigger: "onLoad",
      easing: { type: "preset", name: "ease-in-out" },
      keyframes: result.keyframes,
      style: {},
      orderIndex: 0,
      parentId: null,
      createdAt: ts,
      updatedAt: ts,
    });
    return {
      ok: true,
      summary: result.summary,
      specChanged: true,
      data: {
        kind: "emotion_blend",
        vad: result.vad,
        motion: result.motion,
        components: result.components,
        keyframes: result.keyframes,
        report: formatBlendReport(result),
        componentId,
      },
      editorCommands: [
        { command: "select_component", args: { componentId } },
        { command: "refresh_canvas", args: {} },
      ],
    };
  }

  // Plan an emotion journey.
  if (tool === "plan_emotion_journey") {
    const emotionIds = Array.isArray(args.emotionIds) ? args.emotionIds.map(String) : [];
    const totalDurationMs = typeof args.totalDurationMs === "number" ? args.totalDurationMs : 5000;
    const result = planEmotionJourney(emotionIds, totalDurationMs);
    if (!result) {
      return { ok: false, summary: "failed to plan journey — check emotion ids", specChanged: false };
    }
    return {
      ok: true,
      summary: result.summary,
      specChanged: false,
      data: {
        kind: "emotion_journey",
        steps: result.steps,
        totalDurationMs: result.totalDurationMs,
        vadTrajectory: result.vadTrajectory,
        report: formatJourneyReport(result),
      },
    };
  }

  // ------------------------------------------------------------------------
  // Adaptive Learning tools
  // ------------------------------------------------------------------------

  // Get the user's taste profile.
  if (tool === "get_taste_profile") {
    const profile = getProjectTasteProfile(projectId);
    return {
      ok: true,
      summary: profile.summary,
      specChanged: false,
      data: {
        kind: "taste_profile",
        profile,
        report: formatTasteProfile(profile),
      },
    };
  }

  // Get a recommendation based on learned preferences.
  if (tool === "recommend_for_project") {
    const rec = recommendForProject(projectId);
    if (!rec) {
      return {
        ok: true,
        summary: "Not enough observations yet to make a recommendation. Interact with more motion components to build a taste profile.",
        specChanged: false,
        data: { kind: "recommendation", recommendation: null },
      };
    }
    return {
      ok: true,
      summary: rec.summary,
      specChanged: false,
      data: {
        kind: "recommendation",
        recommendation: rec,
        report: formatRecommendation(rec),
      },
    };
  }

  // Record a motion observation.
  if (tool === "record_motion_observation") {
    const componentId = String(args.componentId ?? "");
    const action = typeof args.action === "string" ? args.action as never : "created";
    const component = spec?.components.find((c) => c.id === componentId);
    if (!component) {
      return { ok: false, summary: `component '${componentId}' not found`, specChanged: false };
    }
    recordMotionObservation(projectId, { component, action });
    const profile = getProjectTasteProfile(projectId);
    return {
      ok: true,
      summary: `Recorded ${action} for "${component.name}". ${profile.summary}`,
      specChanged: false,
      data: { kind: "observation_recorded", action, componentId, profileSummary: profile.summary },
    };
  }

  // ------------------------------------------------------------------------
  // Contextual Awareness tools
  // ------------------------------------------------------------------------

  // List context options.
  if (tool === "list_context_options") {
    const options = listContextOptions();
    return {
      ok: true,
      summary: "Context options available across 6 dimensions",
      specChanged: false,
      data: { kind: "context_options", options },
    };
  }

  // Auto-detect the current context.
  if (tool === "auto_detect_context") {
    const result = autoDetectContext();
    return {
      ok: true,
      summary: result.summary,
      specChanged: false,
      data: { kind: "context_detected", context: result.context },
    };
  }

  // Compute context adjustments.
  if (tool === "compute_context_adjustments") {
    const context = {
      device: (typeof args.device === "string" ? args.device : "desktop") as never,
      performance: (typeof args.performance === "string" ? args.performance : "high") as never,
      timeOfDay: (typeof args.timeOfDay === "string" ? args.timeOfDay : detectTimeOfDay()) as never,
      ambientLight: (typeof args.ambientLight === "string" ? args.ambientLight : "normal") as never,
      userState: (typeof args.userState === "string" ? args.userState : "casual") as never,
    };
    const adjustments = computeContextAdjustments(context);
    return {
      ok: true,
      summary: adjustments.summary,
      specChanged: false,
      data: {
        kind: "context_adjustments",
        context,
        adjustments,
        report: formatContextReport(context, adjustments),
      },
    };
  }

  // Adapt a component for a specific context.
  if (tool === "adapt_component_for_context") {
    const componentId = String(args.componentId ?? "");
    const component = spec?.components.find((c) => c.id === componentId);
    if (!component) {
      return { ok: false, summary: `component '${componentId}' not found`, specChanged: false };
    }
    const context = {
      device: (typeof args.device === "string" ? args.device : "desktop") as never,
      performance: (typeof args.performance === "string" ? args.performance : "high") as never,
      timeOfDay: (typeof args.timeOfDay === "string" ? args.timeOfDay : detectTimeOfDay()) as never,
      ambientLight: (typeof args.ambientLight === "string" ? args.ambientLight : "normal") as never,
      userState: (typeof args.userState === "string" ? args.userState : "casual") as never,
    };
    const result = adaptComponentForContext(component, context);
    // Apply the adapted component to the spec
    patchComponent(projectId, result.component.id, result.component);
    return {
      ok: true,
      summary: result.summary,
      specChanged: true,
      data: {
        kind: "context_adaptation",
        componentId: result.component.id,
        adjustments: result.adjustments,
        report: formatAdaptationReport(result),
      },
      editorCommands: [
        { command: "select_component", args: { componentId: result.component.id } },
        { command: "refresh_canvas", args: {} },
      ],
    };
  }

  // ------------------------------------------------------------------------
  // Motion Collaboration tools
  // ------------------------------------------------------------------------

  // List all collaboration modules.
  if (tool === "list_collaboration_modules") {
    const modules = listCollaborationModules();
    return {
      ok: true,
      summary: `${modules.length} collaboration modules available: ${modules.map((m) => m.name).join(", ")}`,
      specChanged: false,
      data: {
        kind: "collaboration_modules",
        modules: modules.map((m) => ({
          id: m.id,
          name: m.name,
          specialty: m.specialty,
          triggerKeywords: m.triggerKeywords,
        })),
      },
    };
  }

  // Plan a collaboration.
  if (tool === "plan_collaboration") {
    const request = typeof args.request === "string" ? args.request : "";
    const plan = planCollaboration(request);
    return {
      ok: true,
      summary: plan.summary,
      specChanged: false,
      data: {
        kind: "collaboration_plan",
        plan,
        report: formatCollaborationPlan(plan),
      },
    };
  }

  // Execute a collaboration.
  if (tool === "execute_collaboration") {
    const request = typeof args.request === "string" ? args.request : "";
    const result = collaborate(request);
    // Create the component in the project
    const ts = now();
    const componentId = createId("c_");
    createComponent({
      ...result.component,
      id: componentId,
      projectId,
      createdAt: ts,
      updatedAt: ts,
    });
    return {
      ok: true,
      summary: result.summary,
      specChanged: true,
      data: {
        kind: "collaboration_result",
        componentId,
        contributions: result.contributions,
        conflictResolutions: result.conflictResolutions,
        confidence: result.confidence,
        report: formatCollaborationResult(result),
      },
      editorCommands: [
        { command: "select_component", args: { componentId } },
        { command: "refresh_canvas", args: {} },
      ],
    };
  }

  // ------------------------------------------------------------------------
  // Motion Resonance tools
  // ------------------------------------------------------------------------

  // Analyze resonance between motion and viewer state.
  if (tool === "analyze_resonance") {
    const viewer = typeof args.viewerState === "object" && args.viewerState !== null
      ? args.viewerState as ViewerState
      : defaultViewerState();
    const analysis = analyzeResonance(spec, viewer);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "resonance_analysis",
        analysis,
        report: formatResonanceReport(analysis),
      },
    };
  }

  // Tune motion for optimal resonance.
  if (tool === "tune_resonance") {
    const viewer = typeof args.viewerState === "object" && args.viewerState !== null
      ? args.viewerState as ViewerState
      : defaultViewerState();
    const result = tuneForResonance(spec, viewer);
    // Apply the tuned spec to the project
    for (const adj of result.adjustments) {
      const comp = spec.components.find((c) => c.id === adj.componentId);
      if (!comp) continue;
      if (adj.field === "durationMs" && typeof adj.newValue === "number") {
        patchComponent(projectId, adj.componentId, { durationMs: adj.newValue });
      } else if (adj.field === "easing") {
        patchComponent(projectId, adj.componentId, { easing: adj.newValue as never });
      }
    }
    return {
      ok: true,
      summary: result.summary,
      specChanged: result.adjustments.length > 0,
      data: {
        kind: "resonance_tuning",
        adjustments: result.adjustments,
        report: result.summary,
      },
      editorCommands: result.adjustments.length > 0
        ? [{ command: "refresh_canvas", args: {} }]
        : [],
    };
  }

  // ------------------------------------------------------------------------
  // Motion Synesthesia tools
  // ------------------------------------------------------------------------

  // Translate motion to multi-sensory experience.
  if (tool === "translate_synesthesia") {
    const experience = translateSynesthesia(spec);
    return {
      ok: true,
      summary: experience.summary,
      specChanged: false,
      data: {
        kind: "synesthetic_experience",
        experience,
        report: formatSynestheticReport(experience),
      },
    };
  }

  // Map a sensory input to motion parameters.
  if (tool === "map_sensory_to_motion") {
    const modality = args.modality as "color" | "sound" | "texture" | "emotion";
    const value = typeof args.value === "string" ? args.value : String(args.value ?? "");
    const mapping = mapSensoryToMotion(modality, value);
    return {
      ok: true,
      summary: mapping.rationale,
      specChanged: false,
      data: {
        kind: "sensory_to_motion_mapping",
        mapping,
      },
    };
  }

  // ------------------------------------------------------------------------
  // Motion Dream tools
  // ------------------------------------------------------------------------

  // List all dream concepts.
  if (tool === "list_dream_concepts") {
    const concepts = listDreamConcepts();
    return {
      ok: true,
      summary: `${concepts.length} dream concepts available: ${concepts.map((c) => c.name).join(", ")}`,
      specChanged: false,
      data: {
        kind: "dream_concepts",
        concepts: concepts.map((c) => ({
          id: c.id,
          name: c.name,
          category: c.category,
          triggerWords: c.triggerWords,
        })),
      },
    };
  }

  // Generate a dream motion from a prompt.
  if (tool === "dream_from_prompt") {
    const prompt = typeof args.prompt === "string" ? args.prompt : "";
    const dream = dreamFromPrompt(prompt);
    const ts = now();
    const componentId = createId("c_");
    createComponent({
      ...dream.component,
      id: componentId,
      projectId,
      createdAt: ts,
      updatedAt: ts,
    });
    return {
      ok: true,
      summary: dream.description,
      specChanged: true,
      data: {
        kind: "dream_motion",
        componentId,
        technique: dream.technique,
        sourceConcepts: dream.sourceConcepts,
        novelty: dream.novelty,
        report: formatDreamReport(dream),
      },
      editorCommands: [
        { command: "select_component", args: { componentId } },
        { command: "refresh_canvas", args: {} },
      ],
    };
  }

  // Generate a dream sequence.
  if (tool === "generate_dream_sequence") {
    const length = typeof args.length === "number" ? Math.min(8, Math.max(1, args.length)) : 3;
    const seed = typeof args.seed === "string" ? args.seed : undefined;
    const sequence = generateDreamSequence(length, seed);
    // Create all components in the project
    const componentIds: string[] = [];
    const ts = now();
    for (const motion of sequence.motions) {
      const componentId = createId("c_");
      createComponent({
        ...motion.component,
        id: componentId,
        projectId,
        createdAt: ts,
        updatedAt: ts,
      });
      componentIds.push(componentId);
    }
    return {
      ok: true,
      summary: sequence.summary,
      specChanged: true,
      data: {
        kind: "dream_sequence",
        title: sequence.title,
        componentIds,
        narrative: sequence.narrative,
        novelty: sequence.novelty,
        motions: sequence.motions.map((m) => ({
          technique: m.technique,
          sourceConcepts: m.sourceConcepts,
          novelty: m.novelty,
          description: m.description,
        })),
        report: formatDreamSequenceReport(sequence),
      },
      editorCommands: componentIds.length > 0
        ? [
            { command: "select_component", args: { componentId: componentIds[0] } },
            { command: "refresh_canvas", args: {} },
          ]
        : [],
    };
  }

  // --- Motion Harmonics Engine ---

  // Analyze harmonic structure of the composition.
  if (tool === "analyze_harmonics") {
    const analysis = analyzeHarmonics(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "harmonics_analysis",
        analysis,
        report: formatHarmonicsReport(analysis),
      },
    };
  }

  // Find harmonizing partners for a specific component.
  if (tool === "find_harmonics") {
    const componentId = typeof args.componentId === "string" ? args.componentId : "";
    const result = findHarmonicsForComponent(spec, componentId);
    return {
      ok: true,
      summary: result.target
        ? `${result.compatible.length} consonant, ${result.dissonant.length} dissonant partner(s) for ${componentId}`
        : `Component ${componentId} is not cyclic — no harmonic analysis available`,
      specChanged: false,
      data: {
        kind: "harmonics_partners",
        target: result.target,
        compatible: result.compatible,
        dissonant: result.dissonant,
      },
    };
  }

  // --- Motion Entropy Engine ---

  // Analyze information-theoretic structure.
  if (tool === "analyze_entropy") {
    const analysis = analyzeEntropy(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "entropy_analysis",
        analysis,
        report: formatEntropyReport(analysis),
      },
    };
  }

  // Identify information hotspots.
  if (tool === "identify_information_hotspots") {
    const hotspots = identifyInformationHotspots(spec);
    return {
      ok: true,
      summary: `Hotspots: ${hotspots.mostVaried.length} most varied, ${hotspots.leastVaried.length} least varied, ${hotspots.redundantPairs.length} redundant pair(s)`,
      specChanged: false,
      data: {
        kind: "information_hotspots",
        hotspots,
      },
    };
  }

  // --- Motion Cognition Engine ---

  // Analyze cognitive load.
  if (tool === "analyze_cognitive_load") {
    const analysis = analyzeCognitiveLoad(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "cognitive_load_analysis",
        analysis,
        report: formatCognitionReport(analysis),
      },
    };
  }

  // --- Motion Topology Engine ---

  // Analyze topological structure.
  if (tool === "analyze_topology") {
    const analysis = analyzeTopology(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "topology_analysis",
        analysis,
        report: formatTopologyReport(analysis),
      },
    };
  }

  // Find temporal path between two components.
  if (tool === "find_temporal_path") {
    const fromId = typeof args.fromId === "string" ? args.fromId : "";
    const toId = typeof args.toId === "string" ? args.toId : "";
    const result = findTemporalPath(spec, fromId, toId);
    return {
      ok: true,
      summary: result
        ? `Path found: ${result.path.length} hops, ${result.totalOverlapMs}ms total overlap`
        : `No temporal path between ${fromId} and ${toId}`,
      specChanged: false,
      data: {
        kind: "temporal_path",
        path: result?.path ?? [],
        totalOverlapMs: result?.totalOverlapMs ?? 0,
        found: result !== null,
      },
    };
  }

  // --- Motion Poetics Engine ---

  // Analyze poetic structure.
  if (tool === "analyze_poetics") {
    const analysis = analyzePoetics(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "poetics_analysis",
        analysis,
        report: formatPoeticsReport(analysis),
      },
    };
  }

  // --- Motion Ecology Engine ---

  // Analyze ecosystem structure.
  if (tool === "analyze_ecosystem") {
    const analysis = analyzeEcosystem(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "ecosystem_analysis",
        analysis,
        report: formatEcosystemReport(analysis),
      },
    };
  }

  // --- Motion Calligraphy Engine ---

  // Analyze the composition as calligraphic art.
  if (tool === "analyze_calligraphy") {
    const analysis = analyzeCalligraphy(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "calligraphy_analysis",
        analysis,
        report: formatCalligraphyReport(analysis),
      },
    };
  }

  // --- Motion Mythology Engine ---

  // Interpret the composition through mythological lens.
  if (tool === "analyze_mythology") {
    const analysis = analyzeMythology(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "mythology_analysis",
        analysis,
        report: formatMythologyReport(analysis),
      },
    };
  }

  // --- Motion Weather Engine ---

  // Model the composition as a weather system.
  if (tool === "analyze_weather") {
    const analysis = analyzeWeather(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "weather_analysis",
        analysis,
        report: formatWeatherReport(analysis),
      },
    };
  }

  // --- Motion Alchemy Engine ---

  // Interpret the composition through alchemical transformation.
  if (tool === "analyze_alchemy") {
    const analysis = analyzeAlchemy(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "alchemy_analysis",
        analysis,
        report: formatAlchemyReport(analysis),
      },
    };
  }

  // --- Motion Architecture Engine ---

  // Analyze the composition as a built structure.
  if (tool === "analyze_architecture") {
    const analysis = analyzeArchitecture(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "architecture_analysis",
        analysis,
        report: formatArchitectureReport(analysis),
      },
    };
  }

  // --- Motion Cartography Engine ---

  // Map the composition as cartographic terrain.
  if (tool === "analyze_cartography") {
    const analysis = analyzeCartography(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "cartography_analysis",
        analysis,
        report: formatCartographyReport(analysis),
      },
    };
  }

  // --- Motion Genealogy Engine ---

  // Trace the evolutionary lineage of motion patterns.
  if (tool === "analyze_genealogy") {
    const analysis = analyzeGenealogy(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "genealogy_analysis",
        analysis,
        report: formatGenealogyReport(analysis),
      },
    };
  }

  // --- Motion Astronomy Engine ---

  // Map the composition as celestial phenomena.
  if (tool === "analyze_astronomy") {
    const analysis = analyzeAstronomy(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "astronomy_analysis",
        analysis,
        report: formatAstronomyReport(analysis),
      },
    };
  }

  // --- Motion Chemistry Engine ---

  // Analyze the composition as a chemical system.
  if (tool === "analyze_chemistry") {
    const analysis = analyzeChemistry(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "chemistry_analysis",
        analysis,
        report: formatChemistryReport(analysis),
      },
    };
  }

  // --- Motion Musicology Engine ---

  // Analyze the composition as a musical score.
  if (tool === "analyze_musicology") {
    const analysis = analyzeMusicology(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "musicology_analysis",
        analysis,
        report: formatMusicologyReport(analysis),
      },
    };
  }

  // --- Motion Botany Engine ---

  // Analyze the composition as a botanical system.
  if (tool === "analyze_botany") {
    const analysis = analyzeBotany(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "botany_analysis",
        analysis,
        report: formatBotanyReport(analysis),
      },
    };
  }

  // --- Motion Geology Engine ---

  // Analyze the composition as a geological formation.
  if (tool === "analyze_geology") {
    const analysis = analyzeGeology(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "geology_analysis",
        analysis,
        report: formatGeologyReport(analysis),
      },
    };
  }

  // --- Motion Physics Engine ---

  // Analyze the composition through physics principles.
  if (tool === "analyze_physics") {
    const analysis = analyzePhysics(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "physics_analysis",
        analysis,
        report: formatPhysicsReport(analysis),
      },
    };
  }

  // --- Motion Linguistics Engine ---

  // Analyze the composition as a linguistic utterance.
  if (tool === "analyze_linguistics") {
    const analysis = analyzeLinguistics(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "linguistics_analysis",
        analysis,
        report: formatLinguisticsReport(analysis),
      },
    };
  }

  // --- Motion Cinema Engine ---

  // Analyze the composition as a cinematic sequence.
  if (tool === "analyze_cinema") {
    const analysis = analyzeCinema(spec);
    return {
      ok: true,
      summary: analysis.summary,
      specChanged: false,
      data: {
        kind: "cinema_analysis",
        analysis,
        report: formatCinemaReport(analysis),
      },
    };
  }

  return null;
}

/**
 * The conversation heart: prompt the provider, execute any tool calls, feed
 * results back, and repeat until the provider returns a plain reply. Each
 * spec-mutating tool batch emits a spec_update so the live canvas refreshes.
 */
export async function orchestrate(opts: OrchestrateOptions): Promise<void> {
  const { projectId, userMessage, provider, onEvent, signal } = opts;

  // Cooperative cancellation: a helper that stops further work when the client
  // aborts (e.g. the user clicks Stop). Emits a graceful done so the SSE
  // stream always terminates cleanly instead of leaving the client hanging.
  const cancelled = (): boolean => signal?.aborted === true;
  const finishCancelled = (): void => {
    const text = "Stopped — the run was cancelled before completion.";
    addMemory(projectId, { role: "assistant", content: text });
    addMessage(projectId, { role: "assistant", content: text });
    onEvent({ type: "done", message: text, tokensIn: 0, tokensOut: 0, confidence: 0 });
  };

  // Rehydrate conversation window from DB on the first turn of a fresh session
  // so the agent keeps context across server restarts.
  if (listMemory(projectId).length === 0) {
    restoreMemory(projectId);
  }

  addMemory(projectId, { role: "user", content: userMessage });
  addMessage(projectId, { role: "user", content: userMessage });

  // Compress the conversation window when it grows beyond the threshold.
  compressMemory(projectId);

  // Auto-extract persistent facts from the user message (preference detection)
  autoExtractMemory(projectId, userMessage);

  // Reset the per-turn working-memory scratchpad so notes from the previous
  // turn do not bleed into this one. The scratchpad is surfaced in the system
  // prompt (not the conversation window) to keep the transcript focused.
  resetScratch(projectId);

  // Cross-turn goal continuity: when the user issues a multi-step directive
  // across turns, record the step so the agent retains the broader trajectory.
  const newGoal = recordGoalFromMessage(projectId, userMessage);
  if (newGoal) {
    addScratch(projectId, "decision", `Recorded multi-turn goal: ${newGoal.label}`);
  }

  // Emit a lightweight plan so the user sees the agent's intended steps before
  // tool execution begins. Rule-based so it works in mock mode without an LLM.
  const initialSpec = getProjectSpec(projectId);
  let goalTree: GoalTree | null = null;
  // Snapshot of constraints from the initial thinking trace. Used after spec
  // mutations to detect NEW constraints that appeared as a result of the
  // agent's own edits so the agent can adjust mid-turn.
  let initialConstraints: string[] = [];
  if (initialSpec) {
    // Structured thinking trace: analyze the request, evaluate constraints,
    // consider options, and commit to an approach — all before planning.
    const trace = think(userMessage, initialSpec);
    initialConstraints = trace.constraints;
    onEvent({
      type: "thinking",
      text: trace.text,
      analysis: trace.analysis,
      constraints: trace.constraints,
      options: trace.options,
      chosenApproach: trace.chosenApproach,
    });

    const plan = buildPlan(userMessage, initialSpec);
    onEvent({ type: "plan", steps: plan.steps, summary: plan.summary });

    // Decompose the plan into a goal tree so the user can see intent phases
    // and live progress as each tool call advances a goal.
    goalTree = decomposeGoal(userMessage, plan.steps);
    onEvent({ type: "goal", root: serializeGoal(goalTree) });
  }

  const allToolSpecs = buildToolSpecs();
  // Dynamic tool surface: prune the full tool list down to the subset
  // relevant to the classified intent(s). Falls back to the full list when
  // the intent is unknown or the selector returns null. This reduces prompt
  // size and focuses the model's attention on applicable tools.
  const selectedNames = selectTools(userMessage, allToolSpecs.map((t) => t.name as ToolName));
  const tools = selectedNames
    ? allToolSpecs.filter((t) => selectedNames.includes(t.name as ToolName))
    : allToolSpecs;
  if (selectedNames) {
    logger.info("tool surface pruned by intent", {
      total: allToolSpecs.length,
      selected: tools.length,
      intents: selectedNames.length,
    });
  }
  // Augment the tool surface with any tools from connected external MCP
  // servers. Their names are namespaced ("serverId__toolName") so the LLM
  // can call them like any native tool and the orchestrator routes the call
  // back through routeNamespacedExternalCall in executeToolWithGuardrails.
  try {
    const externalToolSpecs = await describeExternalToolsForOrchestrator();
    for (const spec of externalToolSpecs) {
      tools.push({
        name: spec.name as never,
        description: spec.description,
        inputSchema: spec.inputSchema,
      });
    }
    if (externalToolSpecs.length > 0) {
      logger.info("external mcp tools attached to orchestrator", {
        count: externalToolSpecs.length,
      });
    }
  } catch (err) {
    logger.warn("failed to attach external mcp tools", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  const allToolCalls: LlmToolCall[] = [];
  const allToolResults: ToolResult[] = [];
  // Tracks the most recent success-reflection verdict so the final `done`
  // event can incorporate it into the confidence score. Undefined when no
  // success-reflection has fired (e.g., conversational or failed turns).
  let lastSuccessAchieved: boolean | undefined;
  // Bounded auto self-correction guard: ensures the verification-driven
  // correction pass fires at most once per turn, even when multiple
  // spec-changing iterations occur. Prevents a fix/verify oscillation.
  let autoSelfCorrectedThisTurn = false;
  const componentCountBefore = initialSpec?.components.length ?? 0;

  // Subagent delegation routing: when the user asks for exploration, comparison,
  // or parallel workstreams, delegate to focused subagents with isolated budgets.
  if (initialSpec && shouldDelegate(userMessage)) {
    const subagentTasks = composeSubagentTasks(userMessage, projectId);
    if (subagentTasks.length > 0) {
      logger.info("subagent delegation mode", { tasks: subagentTasks.length });
      for (const task of subagentTasks) {
        onEvent({
          type: "subagent_started",
          goal: task.goal,
          toolCount: task.toolCalls.length,
          maxIterations: task.maxIterations ?? 6,
        });
      }

      const subagentCtx: SubagentContext = {
        projectId,
        goalTree,
        onEvent,
      };
      const results = await runSubagentsParallel(subagentTasks, subagentCtx);

      // Merge subagent results into the parent's tool call history.
      for (const result of results) {
        allToolCalls.push(...result.toolCalls);
        allToolResults.push(...result.toolResults);
        onEvent({
          type: "subagent_completed",
          goal: result.task.goal,
          allSucceeded: result.allSucceeded,
          specChanged: result.specChanged,
          durationMs: result.durationMs,
          iterationsUsed: result.iterationsUsed,
          summary: result.summary,
        });
      }

      const anySpecChanged = results.some((r) => r.specChanged);
      if (anySpecChanged) {
        const fresh = getProjectSpec(projectId);
        if (fresh) {
          onEvent({
            type: "spec_update",
            components: fresh.components,
            project: fresh.project,
          });
        }
      }

      const summaryText = results.map((r) => r.summary).join("\n");
      addMemory(projectId, { role: "assistant", content: summaryText });
      addMessage(projectId, { role: "assistant", content: summaryText });

      if (allToolCalls.length > 0) {
        const freshSpec = getProjectSpec(projectId);
        const componentCountAfter = freshSpec?.components.length ?? componentCountBefore;
        const summary = generateSessionSummary({
          userMessage,
          toolCalls: allToolCalls,
          toolResults: allToolResults,
          goalTree,
          componentCountBefore,
          componentCountAfter,
        });
        onEvent({ type: "session_summary", summary });
      }

      onEvent({ type: "done", message: summaryText, tokensIn: 0, tokensOut: 0, confidence: computeConfidence(allToolResults, null, lastSuccessAchieved) });
      return;
    }
  }

  // Plan-then-Execute routing: for complex multi-step requests, decompose into
  // typed actions and execute them sequentially with reviewable progress and
  // cancel support. This runs BEFORE the composition pre-pass so complex
  // multi-action requests get the full plan treatment (reviewable, cancellable)
  // instead of being shortcut by composition.
  if (initialSpec && shouldUsePlanMode(userMessage, initialSpec)) {
    const structuredPlan = composeStructuredPlan(userMessage, initialSpec);
    if (structuredPlan.totalToolCalls > 0) {
      logger.info("plan-then-execute mode", {
        actions: structuredPlan.actions.length,
        toolCalls: structuredPlan.totalToolCalls,
        mutatesSpec: structuredPlan.mutatesSpec,
      });
      onEvent({
        type: "plan_state",
        planSummary: structuredPlan.summary,
        currentActionIndex: -1,
        completed: 0,
        failed: 0,
        total: structuredPlan.actions.length,
        cancelRequested: false,
      });

      const planResult = await executeStructuredPlan(
        structuredPlan,
        { projectId },
        onEvent,
        allToolCalls,
        allToolResults,
        goalTree,
      );

      const freshSpec = getProjectSpec(projectId);
      const componentCountAfter = freshSpec?.components.length ?? componentCountBefore;

      if (planResult.anySpecChanged && freshSpec) {
        onEvent({
          type: "spec_update",
          components: freshSpec.components,
          project: freshSpec.project,
        });
        const suggestions = suggestProactive({
          spec: freshSpec,
          lastTool: structuredPlan.actions[structuredPlan.actions.length - 1]?.toolCalls[0]?.tool ?? null,
          lastToolOk: true,
          lastComponentId: undefined,
        });
        if (suggestions.length > 0) {
          onEvent({ type: "proactive_suggestion", suggestions });
        }
      }

      // Self-learning: extract a skill from the executed plan.
      if (allToolCalls.length >= 2) {
        const skill = extractSkill(userMessage, allToolCalls, allToolResults, projectId);
        if (skill) {
          logger.info("generated skill from plan execution", { skillId: skill.id, skillName: skill.name });
        }
      }

      const summaryText = structuredPlan.summary;
      addMemory(projectId, { role: "assistant", content: summaryText });
      addMessage(projectId, { role: "assistant", content: summaryText });

      const summary = generateSessionSummary({
        userMessage,
        toolCalls: allToolCalls,
        toolResults: allToolResults,
        goalTree,
        componentCountBefore,
        componentCountAfter,
      });
      onEvent({ type: "session_summary", summary });
      onEvent({ type: "done", message: summaryText, tokensIn: 0, tokensOut: 0, confidence: computeConfidence(allToolResults, null, lastSuccessAchieved) });
      return;
    }
  }

  // Tool composition pre-pass: if the user's message matches a known
  // compound pattern (e.g., "add a bouncy fade with 200ms delay"),
  // synthesize the tool calls directly without an LLM round-trip.
  if (initialSpec) {
    const composition = composeTools(userMessage, projectId, initialSpec.components.length > 0);
    if (composition.matched) {
      logger.info("tool composition matched", { pattern: composition.patternName, tools: composition.tools.length });
      onEvent({
        type: "reasoning",
        text: `Composed ${composition.tools.length} tool calls via pattern: ${composition.patternName}`,
      });

      // Execute the composed tools sequentially, resolving __last__/__first__ placeholders
      const composedCalls = composedToToolCalls(composition.tools);
      let composedSpecChanged = false;
      for (let i = 0; i < composedCalls.length; i++) {
        if (cancelled()) {
          finishCancelled();
          return;
        }
        const call = composedCalls[i];
        const args = call.args as Record<string, unknown>;
        if (args && typeof args === "object") {
          // Resolve __last__ to the most recently created component
          if (args.componentId === "__last__") {
            const freshSpec = getProjectSpec(projectId);
            const lastComponent = freshSpec?.components[freshSpec.components.length - 1];
            if (lastComponent) {
              call.args = { ...args, componentId: lastComponent.id };
            } else {
              continue;
            }
          }
          // Resolve __first__ to the first component in the spec
          if (args.componentId === "__first__") {
            const freshSpec = getProjectSpec(projectId);
            const firstComponent = freshSpec?.components[0];
            if (firstComponent) {
              call.args = { ...args, componentId: firstComponent.id };
            } else {
              continue;
            }
          }
          // Resolve sourceComponentId/targetComponentId placeholders
          if (args.sourceComponentId === "__first__") {
            const freshSpec = getProjectSpec(projectId);
            const firstComponent = freshSpec?.components[0];
            if (firstComponent) {
              call.args = { ...args, sourceComponentId: firstComponent.id };
            } else {
              continue;
            }
          }
          if (args.targetComponentId === "__last__") {
            const freshSpec = getProjectSpec(projectId);
            const lastComponent = freshSpec?.components[freshSpec.components.length - 1];
            if (lastComponent) {
              call.args = { ...args, targetComponentId: lastComponent.id };
            } else {
              continue;
            }
          }
        }

        onEvent({ type: "tool_call", tool: call.tool, args: call.args, callId: call.callId });
        const toolStart = Date.now();

        // Motion Intelligence tools are handled inline (not in the tool registry).
        const miResult = await executeMotionIntelligenceTool(
          call.tool,
          call.args as Record<string, unknown>,
          projectId,
        );
        const result = miResult ?? (await executeToolWithGuardrails(call.tool as string, call.args as Record<string, unknown>, { projectId }, onEvent)).result;
        const toolDurationMs = Date.now() - toolStart;
        recordToolExecution(projectId, call.tool, result.ok, toolDurationMs);
        if (isToolUnreliable(projectId, call.tool)) {
          logger.warn("composed tool is unreliable", { tool: call.tool });
        }
        allToolCalls.push(call);
        allToolResults.push(result);
        if (result.specChanged) composedSpecChanged = true;

        if (goalTree) {
          const gid = startToolGoal(goalTree, call.tool);
          if (gid) onEvent({ type: "goal", root: serializeGoal(goalTree) });
          onEvent({
            type: "tool_result",
            callId: call.callId,
            tool: call.tool,
            result: result.data ?? null,
            summary: result.summary,
            ok: result.ok,
            specChanged: result.specChanged ?? false,
          });
          if (result.editorCommands) {
            for (const cmd of result.editorCommands) {
              onEvent({ type: "editor_command", command: cmd.command, args: cmd.args });
            }
          }
          if (result.ok && gid) {
            completeToolGoal(goalTree, gid);
            onEvent({ type: "goal", root: serializeGoal(goalTree) });
          }
        } else {
          onEvent({
            type: "tool_result",
            callId: call.callId,
            tool: call.tool,
            result: result.data ?? null,
            summary: result.summary,
            ok: result.ok,
            specChanged: result.specChanged ?? false,
          });
          if (result.editorCommands) {
            for (const cmd of result.editorCommands) {
              onEvent({ type: "editor_command", command: cmd.command, args: cmd.args });
            }
          }
        }
      }

      // Emit spec_update so the frontend canvas refreshes after composed tools.
      if (composedSpecChanged) {
        const fresh = getProjectSpec(projectId);
        if (fresh) onEvent({ type: "spec_update", components: fresh.components, project: fresh.project });
      }

      // Generate session summary for the composed execution
      const freshSpec = getProjectSpec(projectId);
      const componentCountAfter = freshSpec?.components.length ?? componentCountBefore;
      const summaryText = composition.tools.map((t: { reason: string }) => t.reason).join("; ");
      addMemory(projectId, { role: "assistant", content: summaryText });
      addMessage(projectId, { role: "assistant", content: summaryText });

      if (allToolCalls.length > 0) {
        const summary = generateSessionSummary({
          userMessage,
          toolCalls: allToolCalls,
          toolResults: allToolResults,
          goalTree,
          componentCountBefore,
          componentCountAfter,
        });
        onEvent({ type: "session_summary", summary });
      }

      // Emit proactive follow-up suggestions for the composed tool path.
      // Without this, toolComposer-matched requests (including all analysis
      // engines) would skip the proactive engine entirely.
      const lastComposedTool = allToolCalls.length > 0 ? allToolCalls[allToolCalls.length - 1].tool : null;
      const lastComposedOk = allToolResults.length > 0 ? allToolResults[allToolResults.length - 1].ok : false;
      if (lastComposedTool) {
        const freshForProactive = getProjectSpec(projectId);
        if (freshForProactive) {
          const lastComp = freshForProactive.components[freshForProactive.components.length - 1];
          const suggestions = suggestProactive({
            spec: freshForProactive,
            lastTool: lastComposedTool as string,
            lastToolOk: lastComposedOk,
            lastComponentId: lastComp?.id,
          });
          if (suggestions.length > 0) {
            onEvent({ type: "proactive_suggestion", suggestions });
          }
        }
      }

      onEvent({ type: "done", message: summaryText, tokensIn: 0, tokensOut: 0, confidence: computeConfidence(allToolResults, null, lastSuccessAchieved) });
      return;
    }
  }

  // Standard ReAct loop with bounded iteration budget.
  const budget = createParentBudget(MAX_ITERATIONS);
  onEvent({
    type: "budget",
    label: budget.label,
    consumed: budget.consumed,
    initial: budget.initial,
    remaining: budget.remaining,
  });

  while (consume(budget)) {
    // Allow one consolidation iteration when the budget is exhausted but
    // spec-changing progress has been made — prevents mid-edit termination.
    if (budget.remaining === 0 && !mayExtendForConsolidation(budget, allToolResults.some((r) => r.specChanged))) {
      break;
    }
    const iter = budget.consumed - 1;
    // Pass userMessage on first iteration so persistent memory can be retrieved
    const ctx = assembleAgentContext(projectId, iter === 0 ? userMessage : undefined, opts.model);
    if (!ctx) {
      onEvent({ type: "error", message: "project not found", recoverable: false });
      return;
    }

    let assistantText = "";
    let toolCalls: LlmToolCall[] = [];
    let tokensIn = 0;
    let tokensOut = 0;

    try {
      const result = await chatWithRetry(provider, {
        messages: ctx.messages,
        tools,
        onToken: (delta) => {
          assistantText += delta;
          onEvent({ type: "token", delta });
        },
      });
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
      assistantText = result.text || assistantText;
      toolCalls = result.toolCalls;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("provider.chat failed", { message });
      const recoverable = err instanceof OpenAIProviderError
        ? err.status === 429 || err.status >= 500
        : true;
      onEvent({ type: "error", message: recoverable ? `model error: ${message}` : message, recoverable });
      return;
    }

    if (toolCalls.length === 0) {
      addMemory(projectId, { role: "assistant", content: assistantText });
      addMessage(projectId, { role: "assistant", content: assistantText, tokensIn, tokensOut });
      // Self-learning: generate a skill from the completed multi-step sequence
      if (allToolCalls.length >= 2) {
        const skill = extractSkill(userMessage, allToolCalls, allToolResults, projectId);
        if (skill) {
          logger.info("generated skill from task", { skillId: skill.id, skillName: skill.name });
        }
      }
      // Generate a session summary when tools were executed, so the user
      // gets a recap of what was accomplished and what to do next.
      if (allToolCalls.length > 0) {
        const freshSpec = getProjectSpec(projectId);
        const componentCountAfter = freshSpec?.components.length ?? componentCountBefore;
        const summary = generateSessionSummary({
          userMessage,
          toolCalls: allToolCalls,
          toolResults: allToolResults,
          goalTree,
          componentCountBefore,
          componentCountAfter,
        });
        onEvent({ type: "session_summary", summary });
      }
      onEvent({ type: "done", message: assistantText, tokensIn, tokensOut, confidence: computeConfidence(allToolResults, budget, lastSuccessAchieved) });
      return;
    }

    // Assistant issued tool calls; record the turn (memory + persisted log) and execute them.
    // Emit any reasoning text the assistant produced before the tool calls.
    if (assistantText.trim()) {
      onEvent({ type: "reasoning", text: assistantText.trim() });
    }
    addMemory(projectId, { role: "assistant", content: assistantText, toolCalls });
    addMessage(projectId, {
      role: "assistant",
      content: assistantText,
      tokensIn,
      tokensOut,
      toolCallsJson: JSON.stringify(toolCalls),
    });

    let anySpecChanged = false;
    let lastSpecTool: string | null = null;
    let lastSuccessfulTool: string | null = null;
    let lastComponentId: string | undefined;
    const failedTools: string[] = [];

    // Execute a single tool call end-to-end: placeholder resolution, goal
    // linking, guardrails, analytics, memory, and event emission. Captures
    // the outer tracking variables by closure so both the sequential and
    // parallel paths share one implementation.
    const runCall = async (call: LlmToolCall): Promise<void> => {
      // Resolve __last__ placeholder to the most recently created component.
      // This lets providers chain create + property-tuning calls (e.g.,
      // set_template followed by set_color targeting the new component).
      const callArgs = call.args as Record<string, unknown> | null;
      if (callArgs && typeof callArgs === "object" && callArgs.componentId === "__last__") {
        const freshSpec = getProjectSpec(projectId);
        const lastComponent = freshSpec?.components[freshSpec.components.length - 1];
        if (lastComponent) {
          call.args = { ...callArgs, componentId: lastComponent.id };
        } else {
          // No component exists yet — skip this tool call gracefully.
          logger.warn("__last__ placeholder could not resolve — no component exists", { tool: call.tool });
          return;
        }
      }
      // Link this tool call to its corresponding goal so progress is visible.
      const activeGoalId = goalTree ? startToolGoal(goalTree, call.tool) : null;
      if (goalTree && activeGoalId) {
        onEvent({ type: "goal", root: serializeGoal(goalTree) });
      }
      onEvent({ type: "tool_call", tool: call.tool, args: call.args, callId: call.callId });
      // Recovery heuristic: warn when a tool has been failing repeatedly
      if (isToolUnreliable(projectId, call.tool)) {
        logger.warn("tool is currently unreliable — recent failures detected", { tool: call.tool });
      }
      const toolStart = Date.now();
      // Motion Intelligence tools are handled inline (not in the tool registry).
      const miResult = await executeMotionIntelligenceTool(
        call.tool,
        call.args as Record<string, unknown>,
        projectId,
      );
      const result = miResult ?? (await executeToolWithGuardrails(call.tool as string, call.args as Record<string, unknown>, { projectId }, onEvent)).result;
      const toolDurationMs = Date.now() - toolStart;
      // Record analytics for observability and recovery heuristics
      recordToolExecution(projectId, call.tool, result.ok, toolDurationMs);
      allToolCalls.push(call);
      allToolResults.push(result);
      if (goalTree) {
        completeToolGoal(goalTree, activeGoalId);
        onEvent({ type: "goal", root: serializeGoal(goalTree) });
      }
      onEvent({
        type: "tool_result",
        callId: call.callId,
        tool: call.tool,
        result: result.data ?? null,
        summary: result.summary,
        ok: result.ok,
        specChanged: result.specChanged ?? false,
      });
      if (result.editorCommands) {
        for (const cmd of result.editorCommands) {
          onEvent({ type: "editor_command", command: cmd.command, args: cmd.args });
        }
      }
      addMemory(projectId, {
        role: "tool",
        content: result.summary,
        toolCallId: call.callId,
        toolName: call.tool,
      });
      addMessage(projectId, {
        role: "tool",
        content: result.summary,
        toolCallId: call.callId,
        toolName: call.tool,
      });
      if (result.specChanged) {
        anySpecChanged = true;
        lastSpecTool = call.tool;
        const data = result.data as { componentId?: string } | null;
        if (data && typeof data.componentId === "string") {
          lastComponentId = data.componentId;
        }
      }
      // Track the last successful tool regardless of spec change so proactive
      // suggestions can fire for analysis, generation, and other non-mutating
      // tools (e.g., generate_image, analyze_principles, describe_motion).
      if (result.ok) {
        lastSuccessfulTool = call.tool;
      }
      if (!result.ok) failedTools.push(call.tool);
    };

    // Group calls into batches: parallelizable independent calls may run
    // concurrently within a batch; sequential batches (spec-mutating tools,
    // __last__ placeholder users, MCP namespaced) run one at a time so spec
    // mutation ordering and placeholder resolution stay deterministic.
    const batches = analyzeToolDependencies(toolCalls);
    for (const batch of batches) {
      if (cancelled()) {
        onEvent({ type: "done", message: "Stopped — the run was cancelled during execution.", tokensIn: 0, tokensOut: 0, confidence: 0 });
        return;
      }
      if (batch.parallel && batch.calls.length > 1) {
        onEvent({
          type: "parallel_tool_batch",
          count: batch.calls.length,
          tools: batch.calls.map((c) => c.tool as string),
        });
        await Promise.all(batch.calls.map(runCall));
      } else {
        for (const call of batch.calls) {
          await runCall(call);
        }
      }
    }

    // Self-reflection: if any tools failed, analyze and suggest a correction
    // before the next iteration so the agent can adjust its approach.
    if (failedTools.length > 0) {
      const reflection = reflectOnFailures(failedTools, allToolCalls, allToolResults);
      onEvent({
        type: "reflection",
        text: reflection.text,
        failedTools,
        suggestion: reflection.suggestion,
      });
      // Inject the reflection into conversation memory so the provider sees it
      addMemory(projectId, {
        role: "system",
        content: `Self-reflection: ${reflection.text} Suggested action: ${reflection.suggestion}`,
      });
      // Episodic failure memory: persist the lesson so future turns and
      // sessions can apply the known recovery instead of repeating the
      // mistake. Then surface any prior (more specific) lesson for the same
      // tool so the agent has the cumulative context in one place.
      const lastFailedTool = failedTools[failedTools.length - 1];
      const lastFailedResult = allToolResults.filter((r) => !r.ok).slice(-1)[0];
      const failureSummary = lastFailedResult?.summary ?? "unknown error";
      recordFailure(lastFailedTool, failureSummary, reflection.suggestion, projectId);
      const prior = searchFailureMemory(lastFailedTool, failureSummary, projectId);
      if (prior && prior.occurrenceCount > 1) {
        addMemory(projectId, {
          role: "system",
          content: `Prior failure lesson for ${lastFailedTool} (seen ${prior.occurrenceCount}x): ${prior.errorPattern}. Recovery: ${prior.suggestion}`,
        });
      }

      // Adaptive replanning: regenerate remaining steps from the current spec
      // plus the failure context. Conservative — only fires when at least one
      // tool failed AND there are >= 2 iterations left to act. Emits a fresh
      // "plan" event so the UI refreshes the adjusted trajectory.
      const successfulToolsThisTurn = allToolCalls
        .filter((_, i) => allToolResults[i]?.ok)
        .map((c) => c.tool as string);
      const freshSpecForReplan = getProjectSpec(projectId);
      const replan = replanAfterFailure({
        userMessage,
        spec: freshSpecForReplan,
        failedTools,
        failureSuggestion: reflection.suggestion,
        budgetRemaining: budget.remaining,
        successfulToolsThisTurn,
      });
      if (replan.replanned && replan.steps.length > 0) {
        onEvent({
          type: "plan",
          steps: replan.steps.map((s) => ({ tool: s.tool, description: s.description })),
          summary: replan.summary,
        });
        addMemory(projectId, {
          role: "system",
          content: `Adaptive replan: ${replan.summary} (${replan.reason})`,
        });
      }
    }

    if (anySpecChanged) {
      const fresh = getProjectSpec(projectId);
      if (fresh) onEvent({ type: "spec_update", components: fresh.components, project: fresh.project });
      // Mid-loop constraint re-evaluation: detect NEW constraints that
      // appeared as a result of the agent's edits this turn. If any are new
      // (not present in the initial thinking trace), surface them as a
      // thinking event so the agent adjusts before the next iteration. Only
      // spec-state constraints fire here — user-intent constraints (gated on
      // the message text) are intentionally silent on re-evaluation.
      if (fresh) {
        const currentConstraints = reevaluateConstraints(fresh);
        const newConstraints = currentConstraints.filter(
          (c: string) => !initialConstraints.includes(c),
        );
        if (newConstraints.length > 0) {
          onEvent({
            type: "thinking",
            text: `Re-evaluated constraints after edits: ${newConstraints.join(" ")}`,
            analysis: "",
            constraints: newConstraints,
            options: [],
            chosenApproach: "",
          });
        }
      }
      // Proactive suggestions: surface 0-3 contextual next-step prompts tied
      // to the just-completed tool and the fresh spec state. Hidden by the UI
      // when empty, so callers see it only when there's something worth saying.
      if (fresh) {
        const suggestions = suggestProactive({
          spec: fresh,
          lastTool: lastSpecTool,
          lastToolOk: failedTools.length === 0 || (lastSpecTool !== null && !failedTools.includes(lastSpecTool)),
          lastComponentId,
        });
        if (suggestions.length > 0) {
          onEvent({ type: "proactive_suggestion", suggestions });
        }
      }
      // Success-reflection: when the turn completed without tool failures and
      // the spec changed, evaluate whether the change actually achieves the
      // user's stated intent. Complements the failure-reflection block above
      // and reuses the existing `reflection` ChatEvent so the UI needs no
      // new wiring. The empty `failedTools` array signals a success-path
      // reflection to clients.
      if (fresh && failedTools.length === 0) {
        const successTools = allToolCalls
          .filter((_, i) => allToolResults[i]?.ok)
          .map((c) => c.tool);
        const successReflection = reflectOnSuccess(userMessage, fresh, successTools);
        lastSuccessAchieved = successReflection.achieved;
        // Structured verification: compile the user's request into testable
        // assertions and evaluate each against the resulting spec. Produces
        // concrete pass/fail evidence the agent can act on, complementing the
        // heuristic success-reflection above.
        let verification = verifyMotion(userMessage, fresh);
        if (verification.assertions.length > 0) {
          addScratch(projectId, "verification", formatVerificationReport(verification));
        }
        // Auto self-correction: when the agent's edits succeeded (no tool
        // failures) yet verification shows required-assertion gaps, the work
        // missed the intent. Close the loop once per turn by applying the
        // concrete remediation patches directly to the live spec, then
        // re-verify so the goal ledger and reflection below report the
        // corrected state. Bounded to a single pass per turn.
        if (
          !verification.achieved &&
          !autoSelfCorrectedThisTurn &&
          verification.assertions.some(
            (a) => a.severity === "required" && a.verdict === "fail" && a.kind.length > 0,
          )
        ) {
          autoSelfCorrectedThisTurn = true;
          try {
            const correction = selfCorrectMotion(userMessage, fresh);
            if (correction.applied.length > 0) {
              for (const fix of correction.applied) {
                patchComponent(projectId, fix.componentId, fix.patch);
              }
              const correctedSpec = getProjectSpec(projectId);
              if (correctedSpec) {
                onEvent({
                  type: "spec_update",
                  components: correctedSpec.components,
                  project: correctedSpec.project,
                });
                addScratch(projectId, "self_correction", formatSelfCorrectionReport(correction));
                addMemory(projectId, {
                  role: "system",
                  content: `Auto self-correction: ${formatSelfCorrectionReport(correction)}`,
                });
                verification = verifyMotion(userMessage, correctedSpec);
              }
            }
          } catch (err) {
            // The self-correction pass is best-effort: if it throws, log the
            // lesson and continue so the turn still completes normally.
            addMemory(projectId, {
              role: "system",
              content: `Auto self-correction skipped due to error: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        }
        // Advance the cross-turn goal ledger: when verification confirms the
        // intent, mark the matching goal as done so the next turn knows the
        // step is complete. Verification covers the same action categories the
        // goal ledger records (easing, timing, loop, color, choreography, etc.)
        // so completing the in-progress goal of the same family is safe.
        if (verification.achieved) {
          const passedClaims = verification.assertions
            .filter((a) => a.verdict === "pass")
            .map((a) => a.claim)
            .join(" ");
          for (const cat of GOAL_CATEGORY_KEYWORDS) {
            if (cat.pattern.test(passedClaims)) {
              completeGoalByCategory(projectId, cat.category);
            }
          }
        }
        // Jury meta-cognition: when the success-reflection could not confirm
        // the intent was achieved, convene a multi-perspective jury to surface
        // the trade-offs a single verdict would hide. Best-effort — never
        // blocks the turn from completing. Re-fetch the spec in case the
        // auto-self-correction pass above patched components in place.
        let jurySummary = "";
        if (!successReflection.achieved) {
          try {
            const latestSpec = getProjectSpec(projectId);
            if (latestSpec) {
              const jury = deliberateMotion(latestSpec, userMessage);
              jurySummary = ` Jury: ${jury.summary}`;
              addScratch(projectId, "finding", formatJuryReport(jury));
            }
          } catch (err) {
            addMemory(projectId, {
              role: "system",
              content: `Jury deliberation skipped due to error: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        }
        // Attention-budget probe: when the success-reflection could not
        // confirm the intent, check whether the composition is over its
        // attention budget — an over-budget composition often reads as
        // incoherent, which is a likely cause of the unmet intent.
        // Best-effort — never blocks the turn from completing.
        let budgetSummary = "";
        if (!successReflection.achieved) {
          try {
            const latestSpec = getProjectSpec(projectId);
            if (latestSpec && latestSpec.components.length > 0) {
              const budget = analyzeBudget(latestSpec);
              if (budget.overBudget) {
                budgetSummary = ` Attention budget exceeded: demand ${budget.totalDemand} / budget ${budget.budget} (${Math.round(budget.utilization * 100)}% utilized). ${budget.reallocations.length} reallocation(s) available.`;
                addScratch(projectId, "finding", formatAttentionBudgetReport(budget));
              }
            }
          } catch (err) {
            addMemory(projectId, {
              role: "system",
              content: `Budget probe skipped due to error: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        }
        if (successReflection.text.length > 0 || verification.summary.length > 0 || jurySummary.length > 0 || budgetSummary.length > 0) {
          const reflectionText = [successReflection.text, verification.summary, jurySummary, budgetSummary].filter((s) => s.length > 0).join(" ");
          onEvent({
            type: "reflection",
            text: reflectionText,
            failedTools: [],
            suggestion: successReflection.suggestion || verification.summary || undefined,
          });
          addMemory(projectId, {
            role: "system",
            content: `Success-reflection: ${successReflection.text}` +
              (verification.summary ? ` Verification: ${verification.summary}` : "") +
              (jurySummary ? jurySummary : "") +
              (budgetSummary ? budgetSummary : "") +
              (successReflection.suggestion ? ` Refinement: ${successReflection.suggestion}` : ""),
          });
        }
      }
    } else if (lastSuccessfulTool) {
      // Non-spec-changing tools (analysis, generation, documentation) still
      // benefit from proactive follow-up suggestions. Emit them against the
      // current spec so the user gets a contextual next step.
      const fresh = getProjectSpec(projectId);
      if (fresh) {
        const suggestions = suggestProactive({
          spec: fresh,
          lastTool: lastSuccessfulTool,
          lastToolOk: !failedTools.includes(lastSuccessfulTool),
          lastComponentId,
        });
        if (suggestions.length > 0) {
          onEvent({ type: "proactive_suggestion", suggestions });
        }
      }
    }
    // Loop back: re-assemble context (system prompt now reflects the new spec).
    onEvent({
      type: "budget",
      label: budget.label,
      consumed: budget.consumed,
      initial: budget.initial,
      remaining: budget.remaining,
    });
  }

  logger.warn("agent budget exhausted", { budget: describeBudget(budget) });
  onEvent({
    type: "error",
    message: `agent exceeded its tool-call budget (${budget.consumed}/${budget.initial} iterations) without a final reply`,
    recoverable: true,
  });
}

/**
 * Compute a 0..1 confidence score for an agent turn. Combines three signals:
 *   1. Tool success ratio — primary indicator.
 *   2. Success-reflection verdict — small boost when intent was confirmed,
 *      small penalty when the reflection engine flagged a mismatch.
 *   3. Remaining iteration budget — small boost for clean exits with headroom.
 *
 * Pure conversational turns (no tool calls) return a neutral 0.5 since there
 * is nothing objective to measure. Rule-based so mock mode stays functional.
 */
function computeConfidence(
  toolResults: ToolResult[],
  budget: { remaining: number; initial: number } | null,
  achieved?: boolean,
): number {
  if (toolResults.length === 0) return 0.5;
  const ok = toolResults.filter((r) => r.ok).length;
  let c = ok / toolResults.length;
  if (achieved === true) c = Math.min(1, c + 0.1);
  else if (achieved === false) c = Math.max(0, c - 0.1);
  if (budget && budget.initial > 0) {
    c = Math.min(1, c + (budget.remaining / budget.initial) * 0.05);
  }
  return Math.round(c * 100) / 100;
}

/**
 * Self-reflection engine — analyzes failed tool calls and produces a
 * correction suggestion. Rule-based so it works in mock mode.
 *
 * The reflection layer does three things:
 *   1. Pattern-matches the error summary against known failure shapes and
 *      emits a targeted recovery suggestion.
 *   2. Inspects which tool failed and emits a tool-specific hint (e.g., if
 *      set_easing failed, list the valid easing preset names).
 *   3. Detects retry loops — when the same tool has failed twice in the
 *      session, it suggests switching to an alternative approach instead of
 *      retrying the same call.
 */
function reflectOnFailures(
  failedTools: string[],
  allCalls: LlmToolCall[],
  allResults: ToolResult[],
): { text: string; suggestion: string } {
  const lastFailed = allResults.filter((r) => !r.ok).slice(-1)[0];
  const summary = lastFailed?.summary ?? "unknown error";

  // Common failure patterns and corrections
  const patterns: Array<{ test: RegExp; text: string; suggestion: string }> = [
    {
      test: /not found|does not exist/i,
      text: `Tool failed: "${summary}". The referenced entity was not found.`,
      suggestion: "Call get_motion_spec to list valid component IDs, then retry with a valid ID.",
    },
    {
      test: /validation|invalid|must be|expected/i,
      text: `Tool failed: "${summary}". The arguments did not pass validation.`,
      suggestion: "Check the argument types and ranges, then retry with corrected values.",
    },
    {
      test: /already exists|duplicate/i,
      text: `Tool failed: "${summary}". A conflicting entity already exists.`,
      suggestion: "Use get_motion_spec to inspect the current state, then modify the existing entity instead of creating a new one.",
    },
    {
      test: /parse error|grammar/i,
      text: `Tool failed: "${summary}". The input could not be parsed.`,
      suggestion: "Try a simpler expression or check the grammar syntax (e.g., fade.in(600ms) then slide.up(400ms)).",
    },
    {
      test: /timeout|timed out/i,
      text: `Tool failed: "${summary}". The operation timed out.`,
      suggestion: "Retry the operation — if it continues to time out, simplify the request or reduce the scope.",
    },
    {
      test: /permission|forbidden|unauthorized/i,
      text: `Tool failed: "${summary}". Permission denied.`,
      suggestion: "Check that the API key has the required permissions, then retry.",
    },
    {
      test: /rate limit|too many requests|429/i,
      text: `Tool failed: "${summary}". Rate limit exceeded.`,
      suggestion: "Wait a moment before retrying — the provider is throttling requests.",
    },
    {
      test: /unsupported|not supported/i,
      text: `Tool failed: "${summary}". The feature is not supported.`,
      suggestion: "Use an alternative approach — check available tools with list_templates or get_motion_spec.",
    },
    {
      test: /out of range|below minimum|above maximum|exceeds/i,
      text: `Tool failed: "${summary}". A numeric argument was out of the allowed range.`,
      suggestion: "Check the allowed ranges in the tool schema and retry with a value inside the bounds.",
    },
    {
      test: /circular|cycle|self.?parent/i,
      text: `Tool failed: "${summary}". A circular reference was detected.`,
      suggestion: "Avoid nesting a component under its own descendant — restructure the hierarchy first.",
    },
    {
      test: /empty|no components|nothing to/i,
      text: `Tool failed: "${summary}". The project has no components to operate on.`,
      suggestion: "Add a layer with add_layer or apply a template with set_template before retrying.",
    },
    {
      test: /missing.*argument|required.*field|argument.*missing/i,
      text: `Tool failed: "${summary}". A required argument was missing.`,
      suggestion: "Re-issue the call with all required fields populated — check the tool schema for details.",
    },
  ];

  for (const p of patterns) {
    if (p.test.test(summary)) {
      return { text: p.text, suggestion: p.suggestion };
    }
  }

  // Tool-specific recovery hints: when a known tool fails, suggest the
  // canonical recovery action for that tool family.
  const failedTool = failedTools[failedTools.length - 1];
  const toolHint = toolSpecificHint(failedTool);
  if (toolHint) {
    return {
      text: `${failedTools.length} tool(s) failed: ${failedTools.join(", ")}. Last error: "${summary}".`,
      suggestion: toolHint,
    };
  }

  // Retry-loop detection: if the same tool has failed 2+ times in this
  // session, recommend switching to an alternative approach instead of
  // retrying the same call.
  const failCounts = new Map<string, number>();
  for (const t of failedTools) failCounts.set(t, (failCounts.get(t) ?? 0) + 1);
  const repeated = [...failCounts.entries()].find(([, n]) => n >= 2);
  if (repeated) {
    return {
      text: `${repeated[0]} has failed ${repeated[1]} times this session — retrying is unlikely to succeed.`,
      suggestion: `Switch to an alternative approach for ${repeated[0]}. Consider get_motion_spec to re-ground, or ask the user for clarification.`,
    };
  }

  return {
    text: `${failedTools.length} tool(s) failed: ${failedTools.join(", ")}. Last error: "${summary}".`,
    suggestion: "Call get_motion_spec to inspect the current state and adjust the approach.",
  };
}

/**
 * Tool-specific recovery hints. When a tool fails, the canonical recovery
 * action varies by tool family — this map gives the agent a targeted next
 * step instead of a generic "inspect state" suggestion.
 */
function toolSpecificHint(tool: string): string | null {
  const hints: Record<string, string> = {
    set_easing: "Valid easing presets: linear, ease, ease-in, ease-out, ease-in-out, ease-in-quad, ease-out-quad, ease-in-out-quad, ease-in-cubic, ease-out-cubic, ease-in-out-cubic, bounce, back, elastic, snappy, smooth, soft. Or use set_spring / set_custom_bezier for custom curves.",
    set_template: "Call list_templates to see available template IDs, then retry with a valid ID.",
    apply_preset: "Valid presets: shake, wiggle, float, glow, heartbeat, typewriter. Check the spelling and retry.",
    apply_style: "Valid style presets: playful, energetic, calm, professional, dramatic, minimal, cinematic, glassy, retro, futuristic, organic, mechanical, luxury.",
    apply_recipe: "Call the recipes endpoint to list available recipe IDs, then retry with a valid ID.",
    apply_choreography: "Valid choreography patterns: cascade, wave, ripple, canon, converge, spiral, explosion, assembly, breathing, domino, scatter.",
    set_shader_effect: "Call the shaders endpoint to list available shader effect IDs, then retry with a valid ID.",
    apply_brand_pack: "Call list_brand_packs to see available brand pack IDs, or seed_brand_packs to create defaults first.",
    apply_motion_profile: "Call list_motion_profiles to see available profile IDs, or suggest_motion_profile to generate one.",
    apply_motion_capture: "Call list_motion_captures to see available capture IDs, or seed_motion_captures to create defaults first.",
    capture_state: "Ensure at least one component exists before capturing a state.",
    apply_state: "Call list_states to see captured state IDs, then retry with a valid ID.",
    add_transition: "Both source and target states must exist before adding a transition — call list_states to verify.",
    set_parent: "The parent component must exist and must not be a descendant of the child — check list_hierarchy for the current tree.",
    add_constraint: "Both components must exist before linking — call get_motion_spec to verify IDs.",
    restore_version: "Call list_versions to see available version IDs, then retry with a valid ID.",
    run_pipeline: "Call list_pipelines to see available pipeline IDs, then retry with a valid ID.",
    compile_grammar: "Check the grammar syntax — valid verbs include fade, slide, scale, rotate, spin. Use 'then' to sequence.",
    parse_motion: "Ensure the grammar expression is compiled first with compile_grammar.",
    synthesize_code: "Specify a valid format: html, css, or react.",
  };
  return hints[tool] ?? null;
}

/**
 * Lightweight preference extraction — detects user style preferences from
 * natural language and persists them as project memory for future sessions.
 * Rule-based so it works in mock mode without an LLM.
 */
function autoExtractMemory(projectId: string, message: string): void {
  const lower = message.toLowerCase();

  // Detect style preferences — covers all 13 style presets
  const stylePrefs: Record<string, string> = {
    "professional": "prefers professional tone",
    "playful": "prefers playful tone",
    "minimal": "prefers minimal aesthetic",
    "dramatic": "prefers dramatic motion",
    "calm": "prefers calm/soft motion",
    "energetic": "prefers energetic motion",
    "cinematic": "prefers cinematic motion",
    "glassy": "prefers glassy aesthetic",
    "retro": "prefers retro aesthetic",
    "futuristic": "prefers futuristic aesthetic",
    "organic": "prefers organic motion",
    "mechanical": "prefers mechanical motion",
    "luxury": "prefers luxury aesthetic",
    "bouncy": "prefers bouncy/spring physics",
    "smooth": "prefers smooth easing",
    "snappy": "prefers snappy/crisp timing",
  };
  for (const [keyword, pref] of Object.entries(stylePrefs)) {
    if (lower.includes(keyword)) {
      remember(projectId, "style-preference", pref, ["preference", "style"], 0.8);
    }
  }

  // Detect easing preferences
  const easingPrefs: Record<string, string> = {
    "elastic": "prefers elastic easing",
    "soft": "prefers soft easing",
    "back": "prefers back/overshoot easing",
    "ease-in": "prefers ease-in acceleration",
    "ease-out": "prefers ease-out deceleration",
  };
  for (const [keyword, pref] of Object.entries(easingPrefs)) {
    if (lower.includes(keyword)) {
      remember(projectId, "easing-preference", pref, ["preference", "easing"], 0.7);
    }
  }

  // Detect duration preferences
  if (lower.includes("slow") || lower.includes("longer")) {
    remember(projectId, "duration-preference", "prefers longer durations", ["preference", "timing"], 0.6);
  }
  if (lower.includes("fast") || lower.includes("quick") || lower.includes("short")) {
    remember(projectId, "duration-preference", "prefers shorter durations", ["preference", "timing"], 0.6);
  }

  // Detect loop preferences
  if (lower.includes("loop") || lower.includes("repeat") || lower.includes("infinite")) {
    remember(projectId, "loop-preference", "comfortable with looping animations", ["preference", "loop"], 0.5);
  }

  // Detect direction preferences
  if (lower.includes("reverse") || lower.includes("backward")) {
    remember(projectId, "direction-preference", "prefers reverse playback", ["preference", "direction"], 0.5);
  }
  if (lower.includes("alternate")) {
    remember(projectId, "direction-preference", "prefers alternate direction", ["preference", "direction"], 0.5);
  }

  // Detect choreography preferences
  const choreoPrefs: Record<string, string> = {
    "cascade": "prefers cascade choreography",
    "wave": "prefers wave choreography",
    "ripple": "prefers ripple choreography",
    "spiral": "prefers spiral choreography",
    "domino": "prefers domino choreography",
  };
  for (const [keyword, pref] of Object.entries(choreoPrefs)) {
    if (lower.includes(keyword)) {
      remember(projectId, "choreography-preference", pref, ["preference", "choreography"], 0.6);
    }
  }

  // Detect export format preferences
  const exportPrefs: Record<string, string> = {
    "export html": "prefers HTML export",
    "export video": "prefers video export",
    "export react": "prefers React export",
    "export lottie": "prefers Lottie export",
    "export code": "prefers code export",
  };
  for (const [keyword, pref] of Object.entries(exportPrefs)) {
    if (lower.includes(keyword)) {
      remember(projectId, "export-preference", pref, ["preference", "export"], 0.7);
    }
  }
}
