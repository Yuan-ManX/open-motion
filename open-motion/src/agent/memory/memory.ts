import type { LlmMessage } from "../provider/types.js";
import { listMemory, type MemoryEntry } from "./store.js";
import { estimateTokens, estimateMessageTokens, selectMessagesForBudget, truncateToolResult, CONTEXT_WINDOW_DEFAULTS } from "./tokenEstimator.js";

/**
 * Flatten the in-memory transcript into LLM messages, prefixed by the system prompt.
 * When contextWindow is provided, applies token-aware selection to fit within budget.
 * Long tool results are truncated to prevent context overflow.
 */
export function buildMessages(projectId: string, systemPrompt: string, contextWindow?: number): LlmMessage[] {
  const systemMessage: LlmMessage = { role: "system", content: systemPrompt };
  const entries = listMemory(projectId);

  // Truncate excessively long tool results (max 2000 tokens per tool result)
  const processedEntries = entries.map((entry) => {
    if (entry.role === "tool" && entry.content) {
      const maxToolTokens = 2000;
      const tokens = estimateTokens(entry.content);
      if (tokens > maxToolTokens) {
        return { ...entry, content: truncateToolResult(entry.content, maxToolTokens) };
      }
    }
    return entry;
  });

  const conversationMessages = processedEntries.map(toLlmMessage);

  if (!contextWindow || conversationMessages.length === 0) {
    return [systemMessage, ...conversationMessages];
  }

  // Compute budget for conversation history
  const systemTokens = estimateMessageTokens(systemMessage);
  const budget = contextWindow - systemTokens - 4096; // Reserve 4096 for completion

  if (budget <= 0) {
    // System prompt alone exceeds budget — just return system + last message
    return [systemMessage, conversationMessages[conversationMessages.length - 1]];
  }

  // Select messages that fit within the token budget
  const selected = selectMessagesForBudget(conversationMessages, budget);
  return [systemMessage, ...selected];
}

function toLlmMessage(entry: MemoryEntry): LlmMessage {
  return {
    role: entry.role,
    content: entry.content,
    toolCalls: entry.toolCalls,
    toolCallId: entry.toolCallId,
    toolName: entry.toolName,
  };
}
