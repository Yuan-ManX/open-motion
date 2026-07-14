import { getProviderConfigs, type ProviderConfig } from "../../config.js";
import { createId } from "../../utils/id.js";
import type { ChatOptions, ChatResult, LlmProvider, LlmToolCall, LlmMessage } from "./types.js";
import { extractText } from "./types.js";

/** Anthropic Claude provider — supports Claude 3.5/4 models with vision and tool use. */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic" as const;
  readonly supportsNativeToolCalls = true;
  readonly supportsVision = true;
  readonly supportsStreaming = true;

  private providerConfig: ProviderConfig;

  constructor(providerConfig?: ProviderConfig) {
    this.providerConfig = providerConfig ?? getProviderConfigs().find((p) => p.type === "anthropic") ?? {
      type: "anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-sonnet-4-20250514",
      apiKey: undefined,
    };
  }

  private get baseUrl(): string {
    return this.providerConfig.baseUrl;
  }

  private get model(): string {
    return this.providerConfig.model;
  }

  private get apiKey(): string | undefined {
    return this.providerConfig.apiKey;
  }

  async chat(options: ChatOptions): Promise<ChatResult> {
    const stream = Boolean(options.onToken);
    const { systemPrompt, messages } = toAnthropicMessages(options.messages);
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 4096,
      messages,
      stream,
    };
    if (systemPrompt) {
      body.system = systemPrompt;
    }
    if (options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }));
    }

    const url = `${this.baseUrl}/messages`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey ?? "",
      "anthropic-version": "2023-06-01",
    };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Anthropic API error ${res.status}: ${errText}`);
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
        let chunk: Record<string, unknown>;
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue;
        }

        const type = chunk.type as string;
        if (type === "content_block_delta") {
          const delta = chunk.delta as Record<string, unknown>;
          if (delta?.type === "text_delta" && delta.text) {
            text += delta.text;
            options.onToken?.(delta.text as string);
          }
          if (delta?.type === "input_json_delta" && delta.partial_json) {
            const index = (chunk.index as number) ?? 0;
            const existing = toolAccum.get(index) ?? { id: "", name: "", args: "" };
            existing.args += delta.partial_json as string;
            toolAccum.set(index, existing);
          }
        } else if (type === "content_block_start") {
          const block = chunk.content_block as Record<string, unknown>;
          if (block?.type === "tool_use") {
            const index = (chunk.index as number) ?? 0;
            toolAccum.set(index, {
              id: (block.id as string) ?? "",
              name: (block.name as string) ?? "",
              args: "",
            });
          }
        } else if (type === "message_delta") {
          const usage = chunk.usage as Record<string, unknown> | undefined;
          if (usage?.output_tokens) {
            tokensOut = usage.output_tokens as number;
          }
        } else if (type === "message_start") {
          const message = chunk.message as Record<string, unknown> | undefined;
          const usage = message?.usage as Record<string, unknown> | undefined;
          if (usage?.input_tokens) {
            tokensIn = usage.input_tokens as number;
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

  private parseJson(completion: Record<string, unknown>): ChatResult {
    const content = (completion.content as Array<Record<string, unknown>>) ?? [];
    let text = "";
    const toolCalls: LlmToolCall[] = [];

    for (const block of content) {
      if (block.type === "text") {
        text += block.text as string;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          callId: (block.id as string) ?? createId("call_"),
          tool: block.name as LlmToolCall["tool"],
          args: block.input ?? {},
        });
      }
    }

    const usage = completion.usage as Record<string, unknown> | undefined;
    return {
      text,
      toolCalls,
      tokensIn: (usage?.input_tokens as number) ?? 0,
      tokensOut: (usage?.output_tokens as number) ?? 0,
      provider: this.name,
      model: this.model,
    };
  }
}

/** Convert unified messages to Anthropic's format. Anthropic separates system prompt. */
function toAnthropicMessages(messages: LlmMessage[]): {
  systemPrompt: string;
  messages: unknown[];
} {
  let systemPrompt = "";
  const result: unknown[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      const text = typeof m.content === "string" ? m.content : extractText(m.content);
      systemPrompt += (systemPrompt ? "\n" : "") + text;
      continue;
    }

    const textContent = typeof m.content === "string" ? m.content : extractText(m.content);
    const multimodalParts = typeof m.content === "string" ? null : m.content
      .filter((p) => p.type !== "text")
      .map((p) => {
        if (p.type === "image_url") {
          return { type: "image", source: { type: "url", url: p.image_url.url } };
        }
        if (p.type === "image_base64") {
          return { type: "image", source: { type: "base64", media_type: p.media_type, data: p.data } };
        }
        return null;
      })
      .filter(Boolean);

    if (m.role === "tool") {
      result.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: m.toolCallId, content: textContent }],
      });
    } else if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      const blocks: unknown[] = [];
      if (textContent) blocks.push({ type: "text", text: textContent });
      for (const tc of m.toolCalls) {
        blocks.push({
          type: "tool_use",
          id: tc.callId,
          name: tc.tool,
          input: tc.args ?? {},
        });
      }
      result.push({ role: "assistant", content: blocks });
    } else if (m.role === "user" && multimodalParts && multimodalParts.length > 0) {
      const parts: unknown[] = [{ type: "text", text: textContent }];
      parts.push(...multimodalParts);
      result.push({ role: "user", content: parts });
    } else {
      result.push({ role: m.role, content: textContent });
    }
  }

  return { systemPrompt, messages: result };
}
