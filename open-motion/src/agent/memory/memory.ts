import type { LlmMessage } from "../provider/types.js";
import { listMemory, type MemoryEntry } from "./store.js";

/** Flatten the in-memory transcript into LLM messages, prefixed by the system prompt. */
export function buildMessages(projectId: string, systemPrompt: string): LlmMessage[] {
  const messages: LlmMessage[] = [{ role: "system", content: systemPrompt }];
  for (const entry of listMemory(projectId)) {
    messages.push(toLlmMessage(entry));
  }
  return messages;
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
