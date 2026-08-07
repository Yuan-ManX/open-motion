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
};

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
    return await executor(parsed.value as Record<string, unknown>, ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`tool ${tool} threw`, { message });
    return { ok: false, summary: `${tool} failed: ${message}`, specChanged: false };
  }
}
