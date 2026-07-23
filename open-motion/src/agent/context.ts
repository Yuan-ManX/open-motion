import type { MotionProject, MotionSpec } from "@openmotion/shared";
import { getProject, getProjectSpec } from "../db/repositories/projects.js";
import { buildSystemPrompt } from "./prompts/system.js";
import { buildMessages } from "./memory/memory.js";
import { assembleMemoryContext } from "./memory/persistentMemory.js";
import { listMemory } from "./memory/store.js";
import { semanticSearch, formatRelevantMemory } from "./memory/semanticSearch.js";
import { formatAnalyticsContext } from "./analytics.js";
import { getModelContextWindow } from "./provider/registry.js";
import type { LlmMessage } from "./provider/types.js";

export interface AgentContext {
  project: MotionProject;
  spec: MotionSpec;
  messages: LlmMessage[];
  systemPrompt: string;
}

/**
 * Read the live project + spec from the DB, rebuild the system prompt against
 * the current components, assemble persistent memory context, and build the
 * LLM message list. Called at the start of each orchestrator iteration so
 * spec changes and memory updates are reflected.
 *
 * When a userMessage is provided (first iteration), semantic search retrieves
 * the most topically relevant past conversation entries across the entire
 * memory history — including entries compressed out of the active window —
 * and injects them into the system prompt for contextual awareness.
 *
 * Token-aware context windowing: when a model is specified, the context
 * window size is looked up and messages are selected to fit within budget.
 * Long tool results are truncated to prevent context overflow.
 */
export function assembleAgentContext(projectId: string, userMessage?: string, model?: string): AgentContext | null {
  const project = getProject(projectId);
  if (!project) return null;
  const spec = getProjectSpec(projectId);
  if (!spec) return null;

  // Inject persistent memory (project facts + learned skills) into the system prompt
  const memoryContext = userMessage
    ? assembleMemoryContext(projectId, userMessage)
    : null;
  let basePrompt = buildSystemPrompt(spec);

  if (memoryContext && (memoryContext.projectMemory || memoryContext.relevantSkills)) {
    basePrompt += memoryContext.projectMemory + memoryContext.relevantSkills;
  }

  // Semantic memory search: find relevant past conversation entries
  if (userMessage) {
    const entries = listMemory(projectId);
    if (entries.length > 3) {
      const results = semanticSearch(entries, userMessage, 3, 0.08);
      const relevant = formatRelevantMemory(results);
      if (relevant) {
        basePrompt += "\n" + relevant;
      }
    }
  }

  // Inject tool execution analytics for observability
  const analyticsCtx = formatAnalyticsContext(projectId);
  if (analyticsCtx) {
    basePrompt += "\n" + analyticsCtx;
  }

  // Look up context window for token-aware message selection
  const contextWindow = model ? getModelContextWindow(model) : undefined;
  const messages = buildMessages(projectId, basePrompt, contextWindow);
  return { project, spec, messages, systemPrompt: basePrompt };
}
