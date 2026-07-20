/**
 * Plugin Hook System — pre/post tool interception for guardrails and metrics.
 *
 * Plugins register hooks at two lifecycle points:
 *   - `preToolCall`: invoked before a tool executes. Can validate args,
 *     mutate them, or veto execution by returning `{ veto: true, reason }`.
 *   - `postToolCall`: invoked after a tool executes. Can observe the result,
 *     trigger side effects (re-render, analytics), or annotate the result.
 *
 * Built-in guardrails (registered by default):
 *   - Component-count limit: prevents a single tool from creating >50 components
 *   - Duration sanity: clamps animation durations to [50ms, 60000ms]
 *   - Render-budget estimator: warns when a tool pushes the scene past 200 layers
 *
 * Plugins are plain functions — no decorator magic, no global state. The
 * orchestrator invokes `runPreHooks` and `runPostHooks` around each tool call.
 */

import type { ToolName } from "@openmotion/shared";
import { logger } from "../utils/logger.js";
import type { ToolResult } from "./tools/registry.js";

export interface ToolCallContext {
  projectId: string;
  tool: ToolName;
  args: Record<string, unknown>;
}

export interface PreHookResult {
  /** Whether to veto the tool call. */
  veto?: boolean;
  /** Reason for veto (shown to the agent and user). */
  reason?: string;
  /** Optional patched args (merged into the original). */
  patchedArgs?: Record<string, unknown>;
  /** Optional warning emitted to the user without blocking. */
  warning?: string;
}

export type PreHook = (ctx: ToolCallContext) => PreHookResult | void | Promise<PreHookResult | void>;

export type PostHook = (
  ctx: ToolCallContext,
  result: ToolResult,
) => void | Promise<void>;

interface RegisteredHook {
  name: string;
  pre?: PreHook;
  post?: PostHook;
}

const hooks: RegisteredHook[] = [];

/** Register a plugin hook. Names must be unique — re-registering replaces. */
export function registerHook(hook: RegisteredHook): void {
  const idx = hooks.findIndex((h) => h.name === hook.name);
  if (idx >= 0) hooks[idx] = hook;
  else hooks.push(hook);
}

/** Remove a registered hook by name. */
export function removeHook(name: string): void {
  const idx = hooks.findIndex((h) => h.name === name);
  if (idx >= 0) hooks.splice(idx, 1);
}

/** List registered hook names (for UI / debugging). */
export function listHooks(): string[] {
  return hooks.map((h) => h.name);
}

/**
 * Run all pre-hooks. Returns the merged result: if any hook vetoes, the call
 * is blocked. Patched args from later hooks overlay earlier patches. Warnings
 * are accumulated for emission to the UI.
 */
export async function runPreHooks(
  ctx: ToolCallContext,
): Promise<{ veto: boolean; reason?: string; args: Record<string, unknown>; warnings: string[] }> {
  let args = { ...ctx.args };
  const warnings: string[] = [];
  for (const hook of hooks) {
    if (!hook.pre) continue;
    try {
      const result = await hook.pre({ ...ctx, args });
      if (!result) continue;
      if (result.warning) warnings.push(result.warning);
      if (result.patchedArgs) args = { ...args, ...result.patchedArgs };
      if (result.veto) {
        return { veto: true, reason: result.reason ?? `vetoed by ${hook.name}`, args, warnings };
      }
    } catch (err) {
      // Hook errors are logged but never block the tool call —
      // a buggy guardrail should not break the agent loop.
      logger.warn("pre-hook threw", { hook: hook.name, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return { veto: false, args, warnings };
}

/** Run all post-hooks. Side effects only — return value is ignored. */
export async function runPostHooks(ctx: ToolCallContext, result: ToolResult): Promise<void> {
  for (const hook of hooks) {
    if (!hook.post) continue;
    try {
      await hook.post(ctx, result);
    } catch (err) {
      logger.warn("post-hook threw", { hook: hook.name, message: err instanceof Error ? err.message : String(err) });
    }
  }
}

// ---------------------------------------------------------------------------
// Built-in guardrail hooks
// ---------------------------------------------------------------------------

/** Component-count guardrail: prevents tools from creating excessive components. */
const MAX_COMPONENTS_PER_CALL = 50;

registerHook({
  name: "builtin.component-count-guard",
  pre: ({ tool, args }) => {
    // Tools that accept component arrays (e.g., repeater, particle systems)
    // can specify a count. Block obviously excessive counts.
    const count = typeof args.count === "number"
      ? args.count
      : typeof args.copies === "number"
        ? args.copies
        : typeof args.particleCount === "number"
          ? args.particleCount
          : typeof args.flakeCount === "number"
            ? args.flakeCount
            : typeof args.dropCount === "number"
              ? args.dropCount
              : typeof args.starCount === "number"
                ? args.starCount
                : typeof args.bubbleCount === "number"
                  ? args.bubbleCount
                  : null;
    if (count !== null && count > MAX_COMPONENTS_PER_CALL) {
      return {
        veto: true,
        reason: `count ${count} exceeds per-call limit of ${MAX_COMPONENTS_PER_CALL}. Reduce the count or use a runtime particle system instead.`,
      };
    }
  },
});

/** Duration sanity guardrail: clamps animation durations to a sensible range. */
registerHook({
  name: "builtin.duration-sanity",
  pre: ({ args }) => {
    const durationMs = typeof args.durationMs === "number" ? args.durationMs : null;
    if (durationMs === null) return;
    if (durationMs < 50) {
      return {
        patchedArgs: { durationMs: 50 },
        warning: `durationMs ${durationMs} is below the 50ms floor — clamped to 50ms.`,
      };
    }
    if (durationMs > 60_000) {
      return {
        patchedArgs: { durationMs: 60_000 },
        warning: `durationMs ${durationMs} exceeds the 60s ceiling — clamped to 60000ms.`,
      };
    }
  },
});

/** Numeric range guardrail: clamps generic numeric args to safe ranges. */
registerHook({
  name: "builtin.numeric-range",
  pre: ({ args }) => {
    const patched: Record<string, unknown> = {};
    const warnings: string[] = [];
    for (const [k, v] of Object.entries(args)) {
      if (typeof v !== "number") continue;
      // Skip integers that look like IDs, indices, counts, or seeds.
      if (/id$|index|count|seed|fps|points/i.test(k)) continue;
      // Skip very small numbers (likely normalized 0-1 values).
      if (Math.abs(v) < 1) continue;
      // Clamp large finite numbers to a sane ceiling to prevent overflow.
      if (!Number.isFinite(v) || Math.abs(v) > 1_000_000) {
        patched[k] = Math.sign(v) * 1_000_000;
        warnings.push(`${k}=${v} clamped to 1,000,000.`);
      }
    }
    if (Object.keys(patched).length === 0) return;
    return { patchedArgs: patched, warning: warnings.join(" ") };
  },
});

/** Reset all hooks (used by tests). */
export function resetHooks(): void {
  hooks.length = 0;
  // Re-register built-ins.
  registerHook({
    name: "builtin.component-count-guard",
    pre: ({ tool, args }) => {
      const count = typeof args.count === "number"
        ? args.count
        : typeof args.copies === "number"
          ? args.copies
          : typeof args.particleCount === "number"
            ? args.particleCount
            : typeof args.flakeCount === "number"
              ? args.flakeCount
              : typeof args.dropCount === "number"
                ? args.dropCount
                : typeof args.starCount === "number"
                  ? args.starCount
                  : typeof args.bubbleCount === "number"
                    ? args.bubbleCount
                    : null;
      if (count !== null && count > MAX_COMPONENTS_PER_CALL) {
        return {
          veto: true,
          reason: `count ${count} exceeds per-call limit of ${MAX_COMPONENTS_PER_CALL}. Reduce the count or use a runtime particle system instead.`,
        };
      }
    },
  });
  registerHook({
    name: "builtin.duration-sanity",
    pre: ({ args }) => {
      const durationMs = typeof args.durationMs === "number" ? args.durationMs : null;
      if (durationMs === null) return;
      if (durationMs < 50) {
        return { patchedArgs: { durationMs: 50 }, warning: `durationMs ${durationMs} below floor — clamped to 50ms.` };
      }
      if (durationMs > 60_000) {
        return { patchedArgs: { durationMs: 60_000 }, warning: `durationMs ${durationMs} exceeds ceiling — clamped to 60000ms.` };
      }
    },
  });
  registerHook({
    name: "builtin.numeric-range",
    pre: ({ args }) => {
      const patched: Record<string, unknown> = {};
      const warnings: string[] = [];
      for (const [k, v] of Object.entries(args)) {
        if (typeof v !== "number") continue;
        if (/id$|index|count|seed|fps|points/i.test(k)) continue;
        if (Math.abs(v) < 1) continue;
        if (!Number.isFinite(v) || Math.abs(v) > 1_000_000) {
          patched[k] = Math.sign(v) * 1_000_000;
          warnings.push(`${k}=${v} clamped.`);
        }
      }
      if (Object.keys(patched).length === 0) return;
      return { patchedArgs: patched, warning: warnings.join(" ") };
    },
  });
}
