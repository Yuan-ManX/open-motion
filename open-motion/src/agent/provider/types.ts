import type { ToolName } from "@openmotion/shared";

export interface LlmToolCall {
  callId: string;
  tool: ToolName;
  args: unknown;
}

/** Multimodal content part for vision, audio, and video inputs. */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }
  | { type: "image_base64"; media_type: string; data: string }
  | { type: "audio_url"; audio_url: { url: string } }
  | { type: "audio_base64"; media_type: string; data: string }
  | { type: "video_url"; video_url: { url: string } };

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
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
  /** Optional modality hint for multimodal routing. */
  modality?: "text" | "vision" | "audio" | "video" | "3d";
}

export interface ChatResult {
  text: string;
  toolCalls: LlmToolCall[];
  tokensIn: number;
  tokensOut: number;
  /** Provider that handled this request. */
  provider?: string;
  /** Model that was used. */
  model?: string;
}

export type ProviderName = "mock" | "openai" | "anthropic" | "gemini" | "ollama" | "router";

export interface LlmProvider {
  readonly name: ProviderName;
  readonly supportsNativeToolCalls: boolean;
  readonly supportsVision: boolean;
  readonly supportsStreaming: boolean;
  chat(options: ChatOptions): Promise<ChatResult>;
}

/** Helper: extract plain text from a message content (string or content parts). */
export function extractText(content: string | ContentPart[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/** Helper: check if a message contains multimodal content. */
export function hasMultimodalContent(content: string | ContentPart[]): boolean {
  if (typeof content === "string") return false;
  return content.some((p) => p.type !== "text");
}
