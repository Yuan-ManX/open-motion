import type { MotionProject, MotionSpec } from "@openmotion/shared";
import { getProject, getProjectSpec } from "../db/repositories/projects.js";
import { buildSystemPrompt } from "./prompts/system.js";
import { buildMessages } from "./memory/memory.js";
import { assembleMemoryContext } from "./memory/persistentMemory.js";
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
 */
export function assembleAgentContext(projectId: string, userMessage?: string): AgentContext | null {
  const project = getProject(projectId);
  if (!project) return null;
  const spec = getProjectSpec(projectId);
  if (!spec) return null;

  // Inject persistent memory (project facts + learned skills) into the system prompt
  const memoryContext = userMessage
    ? assembleMemoryContext(projectId, userMessage)
    : null;
  const basePrompt = buildSystemPrompt(spec);
  const systemPrompt = memoryContext && (memoryContext.projectMemory || memoryContext.relevantSkills)
    ? basePrompt + memoryContext.projectMemory + memoryContext.relevantSkills
    : basePrompt;

  const messages = buildMessages(projectId, systemPrompt);
  return { project, spec, messages, systemPrompt };
}
