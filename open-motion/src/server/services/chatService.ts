import type { ChatEvent } from "@openmotion/shared";
import { HttpError } from "../middleware/error.js";
import { ensureProjectExists } from "./projectService.js";
import { getProjectSpec } from "../../db/repositories/projects.js";
import { listMessages, clearMessages } from "../../db/repositories/messages.js";
import { clearMemory } from "../../agent/memory/store.js";
import { orchestrate } from "../../agent/orchestrator.js";
import { getProvider } from "../../agent/provider/index.js";

export interface ChatResult {
  provider: string;
  message: string;
  toolCalls: { tool: string; args: unknown; callId: string }[];
  toolResults: { callId: string; tool: string; summary: string }[];
  tokensIn: number;
  tokensOut: number;
  spec: ReturnType<typeof getProjectSpec>;
}

export async function chat(
  projectId: string,
  message: string,
  onEvent?: (event: ChatEvent) => void,
): Promise<ChatResult> {
  ensureProjectExists(projectId);
  const provider = await getProvider();

  const collected = {
    provider: provider.name,
    text: "",
    toolCalls: [] as { tool: string; args: unknown; callId: string }[],
    toolResults: [] as { callId: string; tool: string; summary: string }[],
    tokensIn: 0,
    tokensOut: 0,
  };
  let finalMessage = "";
  let errored: string | null = null;

  await orchestrate({
    projectId,
    userMessage: message,
    provider,
    onEvent: (event) => {
      if (onEvent) onEvent(event);
      switch (event.type) {
        case "token":
          collected.text += event.delta;
          break;
        case "tool_call":
          collected.toolCalls.push({ tool: event.tool, args: event.args, callId: event.callId });
          break;
        case "tool_result":
          collected.toolResults.push({ callId: event.callId, tool: event.tool, summary: event.summary });
          break;
        case "done":
          finalMessage = event.message;
          collected.tokensIn = event.tokensIn;
          collected.tokensOut = event.tokensOut;
          break;
        case "error":
          errored = event.message;
          break;
        default:
          break;
      }
    },
  });

  if (errored) throw new HttpError(500, errored);

  return {
    provider: collected.provider,
    message: finalMessage || collected.text,
    toolCalls: collected.toolCalls,
    toolResults: collected.toolResults,
    tokensIn: collected.tokensIn,
    tokensOut: collected.tokensOut,
    spec: getProjectSpec(projectId),
  };
}

export async function chatStream(
  projectId: string,
  message: string,
  onMeta: (providerName: string) => void,
  onEvent: (event: ChatEvent) => void,
): Promise<void> {
  ensureProjectExists(projectId);
  const provider = await getProvider();
  onMeta(provider.name);
  await orchestrate({ projectId, userMessage: message, provider, onEvent });
}

export function listProjectMessages(projectId: string) {
  ensureProjectExists(projectId);
  return listMessages(projectId);
}

export function clearProjectMessages(projectId: string): void {
  ensureProjectExists(projectId);
  clearMessages(projectId);
  clearMemory(projectId);
}
