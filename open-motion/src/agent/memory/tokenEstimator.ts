import type { LlmMessage } from "../provider/types.js";
import type { MemoryEntry } from "./store.js";

/**
 * Lightweight token estimator for context window management.
 * Uses character-based heuristic (≈4 chars per token for English/code,
 * ≈2 chars per token for CJK) with adjustments for tool calls.
 */

const ASCII_CHARS_PER_TOKEN = 4;
const CJK_CHARS_PER_TOKEN = 2;

/** Estimate the token count of a string. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let asciiChars = 0;
  let cjkChars = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x3000 && code <= 0x9fff) {
      cjkChars++;
    } else if (code >= 0xac00 && code <= 0xd7af) {
      cjkChars++;
    } else {
      asciiChars++;
    }
  }
  return Math.ceil(asciiChars / ASCII_CHARS_PER_TOKEN + cjkChars / CJK_CHARS_PER_TOKEN);
}

/** Estimate tokens for a single message including role overhead. */
export function estimateMessageTokens(message: LlmMessage | MemoryEntry): number {
  const roleOverhead = 4; // <|role|>content<|end|>
  let contentTokens = 0;

  if (typeof message.content === "string") {
    contentTokens = estimateTokens(message.content);
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === "text") {
        contentTokens += estimateTokens(part.text);
      } else {
        // Non-text parts (images, audio) have a fixed overhead
        contentTokens += 85;
      }
    }
  }

  let toolCallTokens = 0;
  if (message.toolCalls) {
    for (const tc of message.toolCalls) {
      const argsStr = typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args ?? {});
      toolCallTokens += estimateTokens(tc.tool) + estimateTokens(argsStr) + 8;
    }
  }

  return roleOverhead + contentTokens + toolCallTokens;
}

/** Estimate total tokens for a list of messages. */
export function estimateConversationTokens(messages: Array<LlmMessage | MemoryEntry>): number {
  return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
}

/** Default context window sizes by provider tier (in tokens). */
export const CONTEXT_WINDOW_DEFAULTS = {
  small: 8_000,    // Older models, small context
  medium: 32_000,  // Standard models
  large: 128_000,  // Long context models (GPT-4o, Claude, etc.)
  xlarge: 200_000, // Claude 3.5 Sonnet, Gemini 1.5 Pro
  unlimited: 1_000_000, // Gemini 1.5 Pro max
} as const;

/** Budget allocation for context window components. */
export interface ContextBudget {
  /** Maximum total tokens including system prompt. */
  maxTotal: number;
  /** Tokens reserved for the system prompt. */
  systemReserve: number;
  /** Tokens reserved for the model's response. */
  completionReserve: number;
  /** Available tokens for conversation history. */
  availableForHistory: number;
}

/** Compute the context budget given a model's context window. */
export function computeContextBudget(
  contextWindow: number,
  systemPromptTokens: number,
  maxCompletionTokens = 4_096,
): ContextBudget {
  const maxTotal = Math.min(contextWindow, 200_000);
  const systemReserve = Math.min(systemPromptTokens, Math.floor(maxTotal * 0.3));
  const completionReserve = Math.min(maxCompletionTokens, Math.floor(maxTotal * 0.25));
  const availableForHistory = maxTotal - systemReserve - completionReserve;
  return { maxTotal, systemReserve, completionReserve, availableForHistory };
}

/**
 * Select messages to fit within a token budget, preserving:
 * 1. The system prompt (always kept)
 * 2. The most recent messages (highest priority)
 * 3. The first user message (original intent)
 * 4. Tool results for pending tool calls (required for API correctness)
 *
 * Older messages in the middle are dropped first. If a single message
 * exceeds the budget, it is truncated with a marker.
 */
export function selectMessagesForBudget(
  messages: Array<LlmMessage | MemoryEntry>,
  budget: number,
): Array<LlmMessage | MemoryEntry> {
  if (messages.length === 0) return [];
  const totalTokens = estimateConversationTokens(messages);
  if (totalTokens <= budget) return [...messages];

  // Always keep the first message (usually system or first user)
  const first = messages[0];
  const firstTokens = estimateMessageTokens(first);

  // Always keep the last few messages (recent context)
  const recentCount = Math.min(6, messages.length - 1);
  const recent = messages.slice(-recentCount);
  const recentTokens = recent.reduce((s, m) => s + estimateMessageTokens(m), 0);

  const remainingBudget = budget - firstTokens - recentTokens;
  if (remainingBudget <= 0) {
    // Even first + recent exceeds budget — just return recent
    return recent;
  }

  // Fill the middle with as many messages as possible, newest first
  const middle = messages.slice(1, messages.length - recentCount);
  const selectedMiddle: Array<LlmMessage | MemoryEntry> = [];
  let middleTokens = 0;

  for (let i = middle.length - 1; i >= 0; i--) {
    const msg = middle[i];
    const msgTokens = estimateMessageTokens(msg);
    if (middleTokens + msgTokens > remainingBudget) break;
    selectedMiddle.unshift(msg);
    middleTokens += msgTokens;
  }

  return [first, ...selectedMiddle, ...recent];
}

/**
 * Truncate a tool result message to fit within a token limit.
 * Preserves the beginning and end of the result with a truncation marker.
 */
export function truncateToolResult(content: string, maxTokens: number): string {
  const tokens = estimateTokens(content);
  if (tokens <= maxTokens) return content;

  // Keep 60% from the start, 40% from the end
  const charsPerToken = ASCII_CHARS_PER_TOKEN;
  const keepChars = Math.floor(maxTokens * charsPerToken);
  const startChars = Math.floor(keepChars * 0.6);
  const endChars = keepChars - startChars;

  const start = content.slice(0, startChars);
  const end = content.slice(-endChars);
  return `${start}\n\n[... truncated ${tokens - maxTokens} tokens ...]\n\n${end}`;
}
