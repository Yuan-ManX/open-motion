import { config, getProviderConfigs, type ProviderConfig } from "../../config.js";
import { createId } from "../../utils/id.js";
import type { ChatOptions, ChatResult, ChatStreamChunk, LlmProvider, LlmToolCall, LlmMessage, ProviderName } from "./types.js";
import { extractText } from "./types.js";

/** Errors from the OpenAI API with status code context for targeted handling. */
export class OpenAIProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "OpenAIProviderError";
  }
}

/** Request timeout for non-streaming chat completions (ms). */
const CHAT_TIMEOUT_MS = 120_000;
/** Request timeout for streaming chat completions (ms). */
const STREAM_TIMEOUT_MS = 300_000;

/** Create an AbortController that aborts after the specified duration. */
function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Allow the Node.js process to exit even if the timer is still pending
  if (typeof timer === "object" && "unref" in timer) {
    (timer as { unref: () => void }).unref();
  }
  return controller;
}

interface OpenAiToolCallDelta {
  index: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface OpenAiStreamChoice {
  delta?: { content?: string | null; tool_calls?: OpenAiToolCallDelta[] };
  finish_reason?: string | null;
}

interface OpenAiChatCompletion {
  choices: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function toOpenAiMessages(messages: LlmMessage[]): unknown[] {
  return messages.map((m) => {
    const textContent = typeof m.content === "string" ? m.content : extractText(m.content);
    const multimodalParts = typeof m.content === "string" ? null : m.content
      .filter((p) => p.type !== "text")
      .map((p) => {
        if (p.type === "image_url") {
          return { type: "image_url", image_url: p.image_url };
        }
        if (p.type === "image_base64") {
          return { type: "image_url", image_url: { url: `data:${p.media_type};base64,${p.data}` } };
        }
        if (p.type === "audio_url") {
          return { type: "input_audio", input_audio: { data: p.audio_url.url, format: "wav" } };
        }
        if (p.type === "audio_base64") {
          return { type: "input_audio", input_audio: { data: p.data, format: p.media_type.split("/")[1] ?? "wav" } };
        }
        return null;
      })
      .filter(Boolean);

    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.toolCallId, content: textContent };
    }
    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: "assistant",
        content: textContent || null,
        tool_calls: m.toolCalls.map((c) => ({
          id: c.callId,
          type: "function" as const,
          function: { name: c.tool, arguments: JSON.stringify(c.args ?? {}) },
        })),
      };
    }
    // Build multimodal content for user messages
    if (m.role === "user" && multimodalParts && multimodalParts.length > 0) {
      const parts: unknown[] = [{ type: "text", text: textContent }];
      parts.push(...multimodalParts);
      return { role: m.role, content: parts };
    }
    return { role: m.role, content: textContent };
  });
}

function toOpenAiTools(tools: ChatOptions["tools"]): unknown[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

/**
 * OpenAI-compatible provider. Serves any API that implements the
 * /chat/completions endpoint (OpenAI, Groq, Together, DeepSeek, Mistral, etc.).
 * The providerName field controls how this provider appears in monitoring.
 */
export class OpenAIProvider implements LlmProvider {
  readonly name: ProviderName;
  readonly supportsNativeToolCalls = true;
  readonly supportsVision = true;
  readonly supportsStreaming = true;

  protected providerConfig: ProviderConfig;

  constructor(providerConfig?: ProviderConfig) {
    this.providerConfig = providerConfig ?? getProviderConfigs().find((p) => p.type === "openai") ?? {
      type: "openai",
      baseUrl: (config.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
      model: config.MODEL || "gpt-4o-mini",
      apiKey: config.OPENAI_API_KEY,
    };
    this.name = (this.providerConfig.providerName as ProviderName) ?? "openai";
  }

  protected get baseUrl(): string {
    return this.providerConfig.baseUrl;
  }

  protected get model(): string {
    return this.providerConfig.model;
  }

  protected get apiKey(): string | undefined {
    return this.providerConfig.apiKey;
  }

  async chat(options: ChatOptions): Promise<ChatResult> {
    const stream = Boolean(options.onToken);
    const body: Record<string, unknown> = {
      model: this.model,
      messages: toOpenAiMessages(options.messages),
      stream,
    };
    if (stream) {
      body.stream_options = { include_usage: true };
    }
    if (options.tools.length > 0) {
      body.tools = toOpenAiTools(options.tools);
      body.tool_choice = "auto";
    }

    const url = `${this.baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };

    const controller = createTimeoutController(CHAT_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new OpenAIProviderError(`${this.name} request timed out after ${CHAT_TIMEOUT_MS}ms`, 408);
      }
      throw err;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      const retryAfter = res.headers.get("retry-after");
      const retryAfterSec = retryAfter ? Number(retryAfter) : undefined;

      let message: string;
      if (res.status === 401) {
        message = `Invalid API key — check your ${this.name.toUpperCase()}_API_KEY configuration.`;
      } else if (res.status === 403) {
        message = "API key lacks permission for this model or endpoint.";
      } else if (res.status === 429) {
        message = retryAfterSec
          ? `Rate limited — retry after ${retryAfterSec}s.`
          : "Rate limited — too many requests. Please slow down.";
      } else if (res.status >= 500) {
        message = `${this.name} server error (${res.status}): ${errText}`;
      } else {
        message = `${this.name} API error ${res.status}: ${errText}`;
      }
      throw new OpenAIProviderError(message, res.status, retryAfterSec);
    }

    if (stream && res.body) {
      return this.parseStream(res.body, options);
    }
    return this.parseJson(await res.json());
  }

  /** Stream chat completions as an async iterator of chunks. */
  async *streamChat(options: ChatOptions): AsyncIterable<ChatStreamChunk> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: toOpenAiMessages(options.messages),
      stream: true,
      stream_options: { include_usage: true },
    };
    if (options.tools.length > 0) {
      body.tools = toOpenAiTools(options.tools);
      body.tool_choice = "auto";
    }

    const url = `${this.baseUrl}/chat/completions`;
    const controller = createTimeoutController(STREAM_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new OpenAIProviderError(`${this.name} stream timed out after ${STREAM_TIMEOUT_MS}ms`, 408);
      }
      throw err;
    }

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => res.statusText);
      throw new OpenAIProviderError(`${this.name} API error ${res.status}: ${errText}`, res.status);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const toolAccum = new Map<number, { id: string; name: string; args: string }>();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        let chunk: { choices?: OpenAiStreamChoice[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue;
        }
        const choice = chunk.choices?.[0];
        const delta = choice?.delta;
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolAccum.get(tc.index) ?? { id: "", name: "", args: "" };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name += tc.function.name;
            if (tc.function?.arguments) existing.args += tc.function.arguments;
            toolAccum.set(tc.index, existing);
          }
        }
        yield {
          delta: delta?.content ?? undefined,
          tokensIn: chunk.usage?.prompt_tokens,
          tokensOut: chunk.usage?.completion_tokens,
        };
      }
    }

    const toolCalls: LlmToolCall[] = [];
    for (const [, acc] of [...toolAccum.entries()].sort((a, b) => a[0] - b[0])) {
      let parsedArgs: unknown = {};
      if (acc.args) {
        try {
          parsedArgs = JSON.parse(acc.args);
        } catch {
          parsedArgs = { _raw: acc.args };
        }
      }
      toolCalls.push({
        callId: acc.id || createId("call_"),
        tool: acc.name as LlmToolCall["tool"],
        args: parsedArgs,
      });
    }
    yield { toolCalls: toolCalls.length > 0 ? toolCalls : undefined, done: true };
  }

  protected async parseStream(
    stream: ReadableStream<Uint8Array>,
    options: ChatOptions,
  ): Promise<ChatResult> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    const toolAccum = new Map<number, { id: string; name: string; args: string }>();
    let tokensIn = 0;
    let tokensOut = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        let chunk: { choices?: OpenAiStreamChoice[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue;
        }
        if (chunk.usage) {
          tokensIn = chunk.usage.prompt_tokens ?? tokensIn;
          tokensOut = chunk.usage.completion_tokens ?? tokensOut;
        }
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta;
        if (delta?.content) {
          text += delta.content;
          options.onToken?.(delta.content);
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolAccum.get(tc.index) ?? { id: "", name: "", args: "" };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name += tc.function.name;
            if (tc.function?.arguments) existing.args += tc.function.arguments;
            toolAccum.set(tc.index, existing);
          }
        }
      }
    }

    const toolCalls: LlmToolCall[] = [];
    for (const [, acc] of [...toolAccum.entries()].sort((a, b) => a[0] - b[0])) {
      let parsedArgs: unknown = {};
      if (acc.args) {
        try {
          parsedArgs = JSON.parse(acc.args);
        } catch {
          parsedArgs = { _raw: acc.args };
        }
      }
      toolCalls.push({
        callId: acc.id || createId("call_"),
        tool: acc.name as LlmToolCall["tool"],
        args: parsedArgs,
      });
    }

    return { text, toolCalls, tokensIn, tokensOut, provider: this.name, model: this.model };
  }

  protected parseJson(completion: OpenAiChatCompletion): ChatResult {
    const choice = completion.choices?.[0];
    const text = choice?.message?.content ?? "";
    const toolCalls: LlmToolCall[] = (choice?.message?.tool_calls ?? []).map((tc) => {
      let parsedArgs: unknown = {};
      try {
        parsedArgs = JSON.parse(tc.function.arguments);
      } catch {
        parsedArgs = { _raw: tc.function.arguments };
      }
      return {
        callId: tc.id,
        tool: tc.function.name as LlmToolCall["tool"],
        args: parsedArgs,
      };
    });
    return {
      text,
      toolCalls,
      tokensIn: completion.usage?.prompt_tokens ?? 0,
      tokensOut: completion.usage?.completion_tokens ?? 0,
      provider: this.name,
      model: this.model,
    };
  }
}
