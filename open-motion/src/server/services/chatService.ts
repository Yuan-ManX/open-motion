import type { ChatEvent } from "@openmotion/shared";
import { HttpError } from "../middleware/error.js";
import { ensureProjectExists } from "./projectService.js";
import { getProjectSpec } from "../../db/repositories/projects.js";
import { listMessages, clearMessages } from "../../db/repositories/messages.js";
import { clearMemory } from "../../agent/memory/store.js";
import { orchestrate } from "../../agent/orchestrator.js";
import { getProvider, getProviderForModel } from "../../agent/provider/index.js";
import { runQualityPipeline } from "../../agent/qualityPipeline.js";

interface CollectedSummary {
  headline: string;
  intent: string;
  actions: string[];
  outcomes: string[];
  metrics: {
    toolCalls: number;
    successes: number;
    failures: number;
    goalsTotal: number;
    goalsCompleted: number;
  };
  nextSteps: string[];
}

export interface ChatResult {
  provider: string;
  message: string;
  toolCalls: { tool: string; args: unknown; callId: string }[];
  toolResults: { callId: string; tool: string; summary: string }[];
  tokensIn: number;
  tokensOut: number;
  spec: ReturnType<typeof getProjectSpec>;
  summary?: CollectedSummary;
}

/** Resolve the provider, honouring a user-selected model when provided. */
async function resolveProvider(model?: string) {
  if (model) {
    const specific = await getProviderForModel(model);
    if (specific) return specific;
  }
  return getProvider();
}

export async function chat(
  projectId: string,
  message: string,
  onEvent?: (event: ChatEvent) => void,
  model?: string,
  signal?: AbortSignal,
): Promise<ChatResult> {
  ensureProjectExists(projectId);
  const provider = await resolveProvider(model);

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
  let sessionSummary: CollectedSummary | undefined;

  await orchestrate({
    projectId,
    userMessage: message,
    provider,
    model,
    signal,
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
        case "session_summary":
          sessionSummary = event.summary;
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

  // Run the quality pipeline when the spec was mutated and emit a
  // quality_report event so the frontend can surface the grade immediately.
  const finalSpec = getProjectSpec(projectId);
  const specChanged = collected.toolResults.some((r) =>
    r.summary.includes("created") || r.summary.includes("applied") || r.summary.includes("set") || r.summary.includes("updated"),
  );
  if (finalSpec && finalSpec.components.length > 0 && specChanged) {
    try {
      const report = runQualityPipeline(finalSpec.components);
      const qualityEvent: ChatEvent = {
        type: "quality_report",
        overall: report.overall,
        grade: report.grade,
        pass: report.pass,
        autofixCount: report.autofixCount,
        dimensions: report.dimensions.map((d) => ({
          key: d.key,
          score: d.score,
          passed: d.passed,
          findingCount: d.findings.length,
        })),
        suggestedNext: report.suggestedNext,
      };
      if (onEvent) onEvent(qualityEvent);
    } catch {
      // Quality pipeline failure should never break the chat flow.
    }
  }

  return {
    provider: collected.provider,
    message: finalMessage || collected.text,
    toolCalls: collected.toolCalls,
    toolResults: collected.toolResults,
    tokensIn: collected.tokensIn,
    tokensOut: collected.tokensOut,
    spec: finalSpec,
    ...(sessionSummary ? { summary: sessionSummary } : {}),
  };
}

export async function chatStream(
  projectId: string,
  message: string,
  onMeta: (providerName: string) => void,
  onEvent: (event: ChatEvent) => void,
  model?: string,
  signal?: AbortSignal,
): Promise<void> {
  ensureProjectExists(projectId);
  const provider = await resolveProvider(model);
  onMeta(provider.name);

  let hadSpecChange = false;
  const wrappedEvent: (event: ChatEvent) => void = (event) => {
    if (event.type === "tool_result" && event.specChanged) hadSpecChange = true;
    onEvent(event);
  };

  await orchestrate({ projectId, userMessage: message, provider, model, signal, onEvent: wrappedEvent });

  // After orchestration completes, if the spec was mutated, run the quality
  // pipeline and emit a report so the frontend can render the grade.
  if (hadSpecChange && !signal?.aborted) {
    const spec = getProjectSpec(projectId);
    if (spec && spec.components.length > 0) {
      try {
        const report = runQualityPipeline(spec.components);
        onEvent({
          type: "quality_report",
          overall: report.overall,
          grade: report.grade,
          pass: report.pass,
          autofixCount: report.autofixCount,
          dimensions: report.dimensions.map((d) => ({
            key: d.key,
            score: d.score,
            passed: d.passed,
            findingCount: d.findings.length,
          })),
          suggestedNext: report.suggestedNext,
        });
      } catch {
        // Quality pipeline failure should never break the chat stream.
      }
    }
  }
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
