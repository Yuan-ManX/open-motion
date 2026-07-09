import type { ChatEvent } from "@openmotion/shared";
import type { ChatOptions, ChatResult, LlmProvider, LlmToolCall } from "./provider/types.js";
import { OpenAIProviderError } from "./provider/openai.js";
import { assembleAgentContext } from "./context.js";
import { buildToolSpecs } from "./tools/schema.js";
import { executeTool } from "./tools/registry.js";
import { addMemory, listMemory, restoreMemory, compressMemory } from "./memory/store.js";
import { buildPlan } from "./planner.js";
import { addMessage } from "../db/repositories/messages.js";
import { getProjectSpec } from "../db/repositories/projects.js";
import { logger } from "../utils/logger.js";

const MAX_ITERATIONS = 8;

export interface OrchestrateOptions {
  projectId: string;
  userMessage: string;
  provider: LlmProvider;
  onEvent: (event: ChatEvent) => void;
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
 * The conversation heart: prompt the provider, execute any tool calls, feed
 * results back, and repeat until the provider returns a plain reply. Each
 * spec-mutating tool batch emits a spec_update so the live canvas refreshes.
 */
export async function orchestrate(opts: OrchestrateOptions): Promise<void> {
  const { projectId, userMessage, provider, onEvent } = opts;

  // Rehydrate conversation window from DB on the first turn of a fresh session
  // so the agent keeps context across server restarts.
  if (listMemory(projectId).length === 0) {
    restoreMemory(projectId);
  }

  addMemory(projectId, { role: "user", content: userMessage });
  addMessage(projectId, { role: "user", content: userMessage });

  // Compress the conversation window when it grows beyond the threshold.
  compressMemory(projectId);

  // Emit a lightweight plan so the user sees the agent's intended steps before
  // tool execution begins. Rule-based so it works in mock mode without an LLM.
  const initialSpec = getProjectSpec(projectId);
  if (initialSpec) {
    const plan = buildPlan(userMessage, initialSpec);
    onEvent({ type: "plan", steps: plan.steps, summary: plan.summary });
  }

  const tools = buildToolSpecs();

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const ctx = assembleAgentContext(projectId);
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
      onEvent({ type: "done", message: assistantText, tokensIn, tokensOut });
      return;
    }

    // Assistant issued tool calls; record the turn (memory + persisted log) and execute them.
    addMemory(projectId, { role: "assistant", content: assistantText, toolCalls });
    addMessage(projectId, {
      role: "assistant",
      content: assistantText,
      tokensIn,
      tokensOut,
      toolCallsJson: JSON.stringify(toolCalls),
    });

    let anySpecChanged = false;
    for (const call of toolCalls) {
      onEvent({ type: "tool_call", tool: call.tool, args: call.args, callId: call.callId });
      const result = await executeTool(call.tool, call.args, { projectId });
      onEvent({
        type: "tool_result",
        callId: call.callId,
        tool: call.tool,
        result: result.data ?? null,
        summary: result.summary,
      });
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
      if (result.specChanged) anySpecChanged = true;
    }

    if (anySpecChanged) {
      const fresh = getProjectSpec(projectId);
      if (fresh) onEvent({ type: "spec_update", components: fresh.components, project: fresh.project });
    }
    // Loop back: re-assemble context (system prompt now reflects the new spec).
  }

  onEvent({
    type: "error",
    message: "agent exceeded its tool-call budget without a final reply",
    recoverable: true,
  });
}
