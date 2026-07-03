import type { MotionProject, MotionSpec } from "@openmotion/shared";
import { getProject, getProjectSpec } from "../db/repositories/projects.js";
import { buildSystemPrompt } from "./prompts/system.js";
import { buildMessages } from "./memory/memory.js";
import type { LlmMessage } from "./provider/types.js";

export interface AgentContext {
  project: MotionProject;
  spec: MotionSpec;
  messages: LlmMessage[];
  systemPrompt: string;
}

/**
 * Read the live project + spec from the DB, rebuild the system prompt against
 * the current components, and assemble the LLM message list. Called at the
 * start of each orchestrator iteration so spec changes are reflected.
 */
export function assembleAgentContext(projectId: string): AgentContext | null {
  const project = getProject(projectId);
  if (!project) return null;
  const spec = getProjectSpec(projectId);
  if (!spec) return null;
  const systemPrompt = buildSystemPrompt(spec);
  const messages = buildMessages(projectId, systemPrompt);
  return { project, spec, messages, systemPrompt };
}
