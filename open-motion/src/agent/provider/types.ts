import type { ToolName } from "@openmotion/shared";

export interface LlmToolCall {
  callId: string;
  tool: ToolName;
  args: unknown;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: LlmToolCall[];
  toolCallId?: string;
  toolName?: string;
}

export interface LlmToolSpec {
  name: ToolName;
  description: string;
  /** JSON schema describing the tool input. */
  inputSchema: Record<string, unknown>;
}

export interface ChatOptions {
  messages: LlmMessage[];
  tools: LlmToolSpec[];
  onToken?: (delta: string) => void;
}

export interface ChatResult {
  text: string;
  toolCalls: LlmToolCall[];
  tokensIn: number;
  tokensOut: number;
}

export interface LlmProvider {
  readonly name: "mock" | "openai";
  readonly supportsNativeToolCalls: boolean;
  chat(options: ChatOptions): Promise<ChatResult>;
}
