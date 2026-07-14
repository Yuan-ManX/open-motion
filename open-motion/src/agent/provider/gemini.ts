import { getProviderConfigs, type ProviderConfig } from "../../config.js";
import { createId } from "../../utils/id.js";
import type { ChatOptions, ChatResult, LlmProvider, LlmToolCall, LlmMessage } from "./types.js";
import { extractText } from "./types.js";

/** Google Gemini provider — supports Gemini 2.0 Flash/Pro with vision and function calling. */
export class GeminiProvider implements LlmProvider {
  readonly name = "gemini" as const;
  readonly supportsNativeToolCalls = true;
  readonly supportsVision = true;
  readonly supportsStreaming = true;

  private providerConfig: ProviderConfig;

  constructor(providerConfig?: ProviderConfig) {
    this.providerConfig = providerConfig ?? getProviderConfigs().find((p) => p.type === "gemini") ?? {
      type: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-2.0-flash",
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
    const { systemInstruction, contents } = toGeminiContents(options.messages);
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.7,
      },
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    if (options.tools.length > 0) {
      body.tools = [{
        functionDeclarations: options.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        })),
      }];
    }

    const method = stream ? "streamGenerateContent" : "generateContent";
    const url = `${this.baseUrl}/models/${this.model}:${method}?key=${this.apiKey ?? ""}${stream ? "&alt=sse" : ""}`;
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
      throw new Error(`Gemini API error ${res.status}: ${errText}`);
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
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        let chunk: Record<string, unknown>;
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue;
        }

        const candidates = chunk.candidates as Array<Record<string, unknown>> | undefined;
        const content = candidates?.[0]?.content as Record<string, unknown> | undefined;
        const parts = content?.parts as Array<Record<string, unknown>> | undefined;
        if (parts) {
          for (const part of parts) {
            if (part.text) {
              text += part.text as string;
              options.onToken?.(part.text as string);
            }
            if (part.functionCall) {
              const fc = part.functionCall as Record<string, unknown>;
              toolCalls.push({
                callId: createId("call_"),
                tool: fc.name as LlmToolCall["tool"],
                args: fc.args ?? {},
              });
            }
          }
        }
        const usage = chunk.usageMetadata as Record<string, unknown> | undefined;
        if (usage) {
          tokensIn = (usage.promptTokenCount as number) ?? tokensIn;
          tokensOut = (usage.candidatesTokenCount as number) ?? tokensOut;
        }
      }
    }

    return { text, toolCalls, tokensIn, tokensOut, provider: this.name, model: this.model };
  }

  private parseJson(completion: Record<string, unknown>): ChatResult {
    const candidates = (completion.candidates as Array<Record<string, unknown>>) ?? [];
    let text = "";
    const toolCalls: LlmToolCall[] = [];

    const content = candidates[0]?.content as Record<string, unknown> | undefined;
    const parts = content?.parts as Array<Record<string, unknown>> | undefined;
    if (parts) {
      for (const part of parts) {
        if (part.text) {
          text += part.text as string;
        }
        if (part.functionCall) {
          const fc = part.functionCall as Record<string, unknown>;
          toolCalls.push({
            callId: createId("call_"),
            tool: fc.name as LlmToolCall["tool"],
            args: fc.args ?? {},
          });
        }
      }
    }

    const usage = completion.usageMetadata as Record<string, unknown> | undefined;
    return {
      text,
      toolCalls,
      tokensIn: (usage?.promptTokenCount as number) ?? 0,
      tokensOut: (usage?.candidatesTokenCount as number) ?? 0,
      provider: this.name,
      model: this.model,
    };
  }
}

/** Convert unified messages to Gemini's format. Gemini uses roles "user" and "model". */
function toGeminiContents(messages: LlmMessage[]): {
  systemInstruction: string;
  contents: unknown[];
} {
  let systemInstruction = "";
  const contents: unknown[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      const text = typeof m.content === "string" ? m.content : extractText(m.content);
      systemInstruction += (systemInstruction ? "\n" : "") + text;
      continue;
    }

    const textContent = typeof m.content === "string" ? m.content : extractText(m.content);
    const multimodalParts = typeof m.content === "string" ? null : m.content
      .filter((p) => p.type !== "text")
      .map((p) => {
        if (p.type === "image_url") {
          return { inlineData: { mimeType: "image/jpeg", url: p.image_url.url } };
        }
        if (p.type === "image_base64") {
          return { inlineData: { mimeType: p.media_type, data: p.data } };
        }
        return null;
      })
      .filter(Boolean);

    const role = m.role === "assistant" ? "model" : m.role === "tool" ? "user" : "user";

    if (m.role === "tool") {
      // Tool result as a functionResponse part
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: m.toolName ?? "", response: { result: textContent } } }],
      });
    } else if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      const parts: unknown[] = [];
      if (textContent) parts.push({ text: textContent });
      for (const tc of m.toolCalls) {
        parts.push({ functionCall: { name: tc.tool, args: tc.args ?? {} } });
      }
      contents.push({ role, parts });
    } else if (m.role === "user" && multimodalParts && multimodalParts.length > 0) {
      const parts: unknown[] = [{ text: textContent }];
      parts.push(...multimodalParts);
      contents.push({ role, parts });
    } else {
      contents.push({ role, parts: [{ text: textContent }] });
    }
  }

  return { systemInstruction, contents };
}
