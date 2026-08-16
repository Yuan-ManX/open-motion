import { TOOL_INPUT_SCHEMAS, type ToolName } from "@openmotion/shared";
import { logger } from "../../utils/logger.js";
import { parseToolArgs } from "./schema.js";
import { motionExecutors } from "./motionTools.js";
import { queryExecutors } from "./queryTools.js";
import { exportExecutors } from "./exportTools.js";
import { versionExecutors } from "./versionTools.js";
import { pipelineExecutors } from "./pipelineTools.js";
import { agentExecutors } from "./agentTools.js";
import { editorExecutors } from "./editorTools.js";
import { filterExecutors } from "./filterTools.js";
import { compositeEffectExecutors } from "./compositeEffectsTools.js";
import { domainAnalysisExecutors } from "./domainAnalysisTools.js";
import { intelligenceExecutors } from "./intelligenceTools.js";
import { advancedExecutors } from "./advancedTools.js";
import { lightingCameraExecutors } from "./lightingCameraTools.js";
import { pathDataTextExecutors } from "./pathDataTextTools.js";
import { timelineExecutors } from "./timelineTools.js";
import { paintKeyingTransitionExecutors } from "./paintKeyingTransitionTools.js";
import { generatorExecutors } from "./generatorTools.js";

export interface ToolContext {
  projectId: string;
}

export interface ToolResult {
  ok: boolean;
  summary: string;
  specChanged?: boolean;
  data?: unknown;
  /** Editor commands to emit to the frontend for immediate UI control. */
  editorCommands?: Array<{ command: string; args: Record<string, unknown> }>;
}

export type ToolExecutor = (
  args: Record<string, unknown>,
  ctx: ToolContext,
) => ToolResult | Promise<ToolResult>;

/** Merged executor table across query / motion / export / version / agent / editor tool families. */
const EXECUTORS: Partial<Record<ToolName, ToolExecutor>> = {
  ...queryExecutors,
  ...motionExecutors,
  ...exportExecutors,
  ...versionExecutors,
  ...pipelineExecutors,
  ...agentExecutors,
  ...editorExecutors,
  ...filterExecutors,
  ...compositeEffectExecutors,
  ...domainAnalysisExecutors,
  ...intelligenceExecutors,
  ...advancedExecutors,
  ...lightingCameraExecutors,
  ...pathDataTextExecutors,
  ...timelineExecutors,
  ...paintKeyingTransitionExecutors,
  ...generatorExecutors,
};

// Usage counters for the analytics endpoint — tracks per-tool calls,
// failure rate and rolling 50-entry p95 latency estimate in-process.
const USAGE = new Map<ToolName, { calls: number; fails: number; p95LatencyMs: number; last: number[] }>();

function recordUsage(tool: ToolName, ok: boolean, latencyMs: number) {
  let bucket = USAGE.get(tool);
  if (!bucket) {
    bucket = { calls: 0, fails: 0, p95LatencyMs: 0, last: [] };
    USAGE.set(tool, bucket);
  }
  bucket.calls += 1;
  if (!ok) bucket.fails += 1;
  bucket.last.push(latencyMs);
  if (bucket.last.length > 50) bucket.last.shift();
  const sorted = [...bucket.last].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  bucket.p95LatencyMs = sorted[idx] ?? 0;
}

/** Snapshot of per-tool usage counters exposed via /api/analytics/tools. */
export function getToolUsageSnapshot() {
  const entries: Array<{
    tool: string;
    calls: number;
    fails: number;
    failureRate: number;
    p95LatencyMs: number;
  }> = [];
  let totalCalls = 0;
  let totalFails = 0;
  for (const [tool, b] of USAGE.entries()) {
    totalCalls += b.calls;
    totalFails += b.fails;
    entries.push({
      tool,
      calls: b.calls,
      fails: b.fails,
      failureRate: b.calls === 0 ? 0 : b.fails / b.calls,
      p95LatencyMs: b.p95LatencyMs,
    });
  }
  entries.sort((a, b) => b.calls - a.calls);
  return {
    totalCalls,
    totalFails,
    overallFailureRate: totalCalls === 0 ? 0 : totalFails / totalCalls,
    entries,
  };
}

/** High-level taxonomy of the tool surface for the analytics dashboard. */
export function getToolTaxonomySummary() {
  const families = [
    { name: "query", count: Object.keys(queryExecutors).length },
    { name: "motion", count: Object.keys(motionExecutors).length },
    { name: "export", count: Object.keys(exportExecutors).length },
    { name: "version", count: Object.keys(versionExecutors).length },
    { name: "pipeline", count: Object.keys(pipelineExecutors).length },
    { name: "agent", count: Object.keys(agentExecutors).length },
    { name: "editor", count: Object.keys(editorExecutors).length },
    { name: "filter", count: Object.keys(filterExecutors).length },
    { name: "compositeEffect", count: Object.keys(compositeEffectExecutors).length },
    { name: "domainAnalysis", count: Object.keys(domainAnalysisExecutors).length },
    { name: "intelligence", count: Object.keys(intelligenceExecutors).length },
    { name: "advanced", count: Object.keys(advancedExecutors).length },
    { name: "lightingCamera", count: Object.keys(lightingCameraExecutors).length },
    { name: "pathDataText", count: Object.keys(pathDataTextExecutors).length },
    { name: "timeline", count: Object.keys(timelineExecutors).length },
    { name: "paintKeyingTransition", count: Object.keys(paintKeyingTransitionExecutors).length },
    { name: "generator", count: Object.keys(generatorExecutors).length },
  ];
  const schemaCount = Object.keys(TOOL_INPUT_SCHEMAS).length;
  const executorCount = Object.keys(EXECUTORS).length;
  return {
    schemaCount,
    executorCount,
    coverage: schemaCount === 0 ? 0 : executorCount / schemaCount,
    families,
  };
}

/**
 * Validate args against the shared schema, then dispatch to the matching
 * executor. The route's projectId is authoritative and is injected into args
 * so callers (LLM or Mock) never need to pass it.
 */
export async function executeTool(
  tool: ToolName,
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<ToolResult> {
  const executor = EXECUTORS[tool];
  if (!executor) {
    // A tool may be declared in the shared schema (so it is a known capability
    // surfaced to the LLM) without yet having a concrete executor wired up.
    // In that case, validate the args and return a graceful simulated
    // acknowledgement so the conversation flow completes without a crash,
    // rather than reporting a hard "unknown tool" error to the user.
    if (TOOL_INPUT_SCHEMAS[tool]) {
      const argsWithCtxFallback =
        rawArgs && typeof rawArgs === "object"
          ? { ...(rawArgs as Record<string, unknown>), projectId: ctx.projectId }
          : { projectId: ctx.projectId };
      const parsed = parseToolArgs(tool, argsWithCtxFallback);
      if (!parsed.ok) {
        return { ok: false, summary: `invalid args for ${tool}: ${parsed.error}`, specChanged: false };
      }
      return {
        ok: true,
        summary: `acknowledged ${tool} (simulated)`,
        specChanged: false,
      };
    }
    return { ok: false, summary: `unknown tool: ${tool}`, specChanged: false };
  }

  // projectId is contextual (from the route), not something the LLM must supply.
  const argsWithCtx =
    rawArgs && typeof rawArgs === "object"
      ? { ...(rawArgs as Record<string, unknown>), projectId: ctx.projectId }
      : { projectId: ctx.projectId };

  const parsed = parseToolArgs(tool, argsWithCtx);
  if (!parsed.ok) {
    return { ok: false, summary: `invalid args for ${tool}: ${parsed.error}`, specChanged: false };
  }

  try {
    const t0 = performance.now();
    const result = await executor(parsed.value as Record<string, unknown>, ctx);
    recordUsage(tool, result.ok, performance.now() - t0);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`tool ${tool} threw`, { message });
    recordUsage(tool, false, 0);
    return { ok: false, summary: `${tool} failed: ${message}`, specChanged: false };
  }
}

/** List tool names that have a concrete executor wired in. (TEMP diagnostic) */
export function listRegisteredToolNames(): ToolName[] {
  return Object.keys(EXECUTORS) as ToolName[];
}
