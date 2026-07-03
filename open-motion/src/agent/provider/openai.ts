import { config } from "../../config.js";
import { createId } from "../../utils/id.js";
import type { ChatOptions, ChatResult, LlmProvider, LlmToolCall, LlmMessage } from "./types.js";

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
    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
    }
    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((c) => ({
          id: c.callId,
          type: "function" as const,
          function: { name: c.tool, arguments: JSON.stringify(c.args ?? {}) },
        })),
      };
    }
    return { role: m.role, content: m.content };
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

export class OpenAIProvider implements LlmProvider {
  readonly name = "openai";
  readonly supportsNativeToolCalls = true;

  private get baseUrl(): string {
    return (config.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  }

  private get model(): string {
    return config.MODEL || "gpt-4o-mini";
  }

  async chat(options: ChatOptions): Promise<ChatResult> {
    const stream = Boolean(options.onToken);
    const body: Record<string, unknown> = {
      model: this.model,
      messages: toOpenAiMessages(options.messages),
      stream,
    };
    if (options.tools.length > 0) {
      body.tools = toOpenAiTools(options.tools);
      body.tool_choice = "auto";
    }

    const url = `${this.baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.OPENAI_API_KEY}`,
    };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`OpenAI API error ${res.status}: ${errText}`);
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

    return { text, toolCalls, tokensIn, tokensOut };
  }

  private parseJson(completion: OpenAiChatCompletion): ChatResult {
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
    };
  }
}
