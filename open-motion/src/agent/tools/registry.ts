import type { ToolName } from "@openmotion/shared";
import { logger } from "../../utils/logger.js";
import { parseToolArgs } from "./schema.js";
import { motionExecutors } from "./motionTools.js";
import { queryExecutors } from "./queryTools.js";
import { exportExecutors } from "./exportTools.js";

export interface ToolContext {
  projectId: string;
}

export interface ToolResult {
  ok: boolean;
  summary: string;
  specChanged?: boolean;
  data?: unknown;
}

export type ToolExecutor = (
  args: Record<string, unknown>,
  ctx: ToolContext,
) => ToolResult | Promise<ToolResult>;

/** Merged executor table across query / motion / export tool families. */
const EXECUTORS: Partial<Record<ToolName, ToolExecutor>> = {
  ...queryExecutors,
  ...motionExecutors,
  ...exportExecutors,
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
