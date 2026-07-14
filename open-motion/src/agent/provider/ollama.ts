import { getProviderConfigs, type ProviderConfig } from "../../config.js";
import { createId } from "../../utils/id.js";
import type { ChatOptions, ChatResult, LlmProvider, LlmToolCall, LlmMessage } from "./types.js";
import { extractText } from "./types.js";

/** Ollama provider — runs local open-source models (Llama, Mistral, Phi, etc.) via Ollama API. */
export class OllamaProvider implements LlmProvider {
  readonly name = "ollama" as const;
  readonly supportsNativeToolCalls = true;
  readonly supportsVision = false;
  readonly supportsStreaming = true;

  private providerConfig: ProviderConfig;

  constructor(providerConfig?: ProviderConfig) {
    this.providerConfig = providerConfig ?? getProviderConfigs().find((p) => p.type === "ollama") ?? {
      type: "ollama",
      baseUrl: "http://localhost:11434",
      model: "llama3.2",
    };
  }

  private get baseUrl(): string {
    return this.providerConfig.baseUrl;
  }

  private get model(): string {
    return this.providerConfig.model;
  }

  async chat(options: ChatOptions): Promise<ChatResult> {
    const stream = Boolean(options.onToken);
    const messages = toOllamaMessages(options.messages);
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream,
    };
    if (options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
    }

    const url = `${this.baseUrl}/api/chat`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Ollama API error ${res.status}: ${errText}`);
    }

    if (stream && res.body) {
      return this.parseStream(res.body, options);
    }
    return this.parseJson(await res.json());
  }

  private async parseStream(
    stream: ReadableStream<Uint8Array>,
    options: ChatOptions,
  ): Promise<ChatResult> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    const toolCalls: LlmToolCall[] = [];
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
        if (!trimmed) continue;
        let chunk: Record<string, unknown>;
        try {
          chunk = JSON.parse(trimmed);
        } catch {
          continue;
        }

        const msg = chunk.message as Record<string, unknown> | undefined;
        if (msg?.content) {
          text += msg.content as string;
          options.onToken?.(msg.content as string);
        }
        if (msg?.tool_calls) {
          const calls = msg.tool_calls as Array<Record<string, unknown>>;
          for (const tc of calls) {
            const fn = tc.function as Record<string, unknown> | undefined;
            if (fn) {
              let parsedArgs: unknown = {};
              if (fn.arguments) {
                try {
                  parsedArgs = typeof fn.arguments === "string" ? JSON.parse(fn.arguments) : fn.arguments;
                } catch {
                  parsedArgs = { _raw: fn.arguments };
                }
              }
              toolCalls.push({
                callId: createId("call_"),
                tool: fn.name as LlmToolCall["tool"],
                args: parsedArgs,
              });
            }
          }
        }
        if (chunk.done) {
          tokensIn = (chunk.prompt_eval_count as number) ?? tokensIn;
          tokensOut = (chunk.eval_count as number) ?? tokensOut;
        }
      }
    }

    return { text, toolCalls, tokensIn, tokensOut, provider: this.name, model: this.model };
  }

  private parseJson(completion: Record<string, unknown>): ChatResult {
    const msg = completion.message as Record<string, unknown> | undefined;
    let text = "";
    const toolCalls: LlmToolCall[] = [];

    if (msg?.content) {
      text = msg.content as string;
    }
    if (msg?.tool_calls) {
      const calls = msg.tool_calls as Array<Record<string, unknown>>;
      for (const tc of calls) {
        const fn = tc.function as Record<string, unknown> | undefined;
        if (fn) {
          let parsedArgs: unknown = {};
          if (fn.arguments) {
            try {
              parsedArgs = typeof fn.arguments === "string" ? JSON.parse(fn.arguments) : fn.arguments;
            } catch {
              parsedArgs = { _raw: fn.arguments };
            }
          }
          toolCalls.push({
            callId: createId("call_"),
            tool: fn.name as LlmToolCall["tool"],
            args: parsedArgs,
          });
        }
      }
    }

    return {
      text,
      toolCalls,
      tokensIn: (completion.prompt_eval_count as number) ?? 0,
      tokensOut: (completion.eval_count as number) ?? 0,
      provider: this.name,
      model: this.model,
    };
  }
}

/** Convert unified messages to Ollama's format (OpenAI-compatible). */
function toOllamaMessages(messages: LlmMessage[]): unknown[] {
  return messages.map((m) => {
    const textContent = typeof m.content === "string" ? m.content : extractText(m.content);

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
    // Ollama doesn't support multimodal in all models — extract text only
    return { role: m.role, content: textContent };
  });
}
