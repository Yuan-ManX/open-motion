import type { ChatOptions, ChatResult, LlmProvider, LlmToolCall } from "./types.js";
import { createId } from "../../utils/id.js";

interface ParsedState {
  componentIds: string[];
  firstComponentId: string | null;
  projectName: string | null;
}

function extractState(messages: ChatOptions["messages"]): ParsedState {
  const sys = messages.find((m) => m.role === "system")?.content ?? "";
  const ids = Array.from(sys.matchAll(/\bc_[a-zA-Z0-9]{4,}\b/g)).map((m) => m[0]);
  return {
    componentIds: ids,
    firstComponentId: ids[0] ?? null,
    projectName: null,
  };
}

interface Intent {
  tool: LlmToolCall["tool"];
  args: (state: ParsedState, userText: string) => Record<string, unknown> | null;
  /** Human summary used in the final reply. */
  reply: string;
}

const INTENTS: { match: RegExp; intent: Intent }[] = [
  {
    match: /\b(bouncy|bounce|bouncier|springy|spring)\b|弹跳|弹性/i,
    intent: {
      tool: "set_easing",
      args: (s) =>
        s.firstComponentId
          ? { componentId: s.firstComponentId, easing: { type: "preset", name: "bounce" } }
          : null,
      reply: "Switched the easing to a bouncy curve so it overshoots with spring.",
    },
  },
  {
    match: /\b(elastic)\b/i,
    intent: {
      tool: "set_easing",
      args: (s) =>
        s.firstComponentId
          ? { componentId: s.firstComponentId, easing: { type: "preset", name: "elastic" } }
          : null,
      reply: "Applied an elastic easing for that stretchy, snappy feel.",
    },
  },
  {
    match: /\b(smooth|smoother|soft)\b|柔和|平滑/i,
    intent: {
      tool: "set_easing",
      args: (s) =>
        s.firstComponentId
          ? { componentId: s.firstComponentId, easing: { type: "preset", name: "smooth" } }
          : null,
      reply: "Smoothed the easing so the motion glides.",
    },
  },
  {
    match: /\b(snappy|sharp|crisp)\b|利落|干脆/i,
    intent: {
      tool: "set_easing",
      args: (s) =>
        s.firstComponentId
          ? { componentId: s.firstComponentId, easing: { type: "preset", name: "snappy" } }
          : null,
      reply: "Made the easing snappy for a crisp start and stop.",
    },
  },
  {
    match: /\b(slower|slow|more time)\b|慢|更慢/i,
    intent: {
      tool: "set_duration",
      args: (s) =>
        s.firstComponentId ? { componentId: s.firstComponentId, durationMs: 1800 } : null,
      reply: "Slowed it down to 1.8s so it takes its time.",
    },
  },
  {
    match: /\b(faster|quicker|quick|speed up)\b|快|更快/i,
    intent: {
      tool: "set_duration",
      args: (s) =>
        s.firstComponentId ? { componentId: s.firstComponentId, durationMs: 400 } : null,
      reply: "Sped it up to 400ms for a quick burst.",
    },
  },
  {
    match: /\b(loop|repeat|forever)\b|循环|重复/i,
    intent: {
      tool: "set_loop",
      args: (s) =>
        s.firstComponentId
          ? { componentId: s.firstComponentId, iterationCount: "infinite" }
          : null,
      reply: "Set it to loop forever.",
    },
  },
  {
    match: /\bred\b|红色/i,
    intent: {
      tool: "set_color",
      args: (s) =>
        s.firstComponentId
          ? { componentId: s.firstComponentId, color: "#ef4444", target: "text" }
          : null,
      reply: "Changed the color to red.",
    },
  },
  {
    match: /\bblue\b|蓝色/i,
    intent: {
      tool: "set_color",
      args: (s) =>
        s.firstComponentId
          ? { componentId: s.firstComponentId, color: "#3b82f6", target: "text" }
          : null,
      reply: "Changed the color to blue.",
    },
  },
  {
    match: /\bgreen\b|绿色/i,
    intent: {
      tool: "set_color",
      args: (s) =>
        s.firstComponentId
          ? { componentId: s.firstComponentId, color: "#22c55e", target: "text" }
          : null,
      reply: "Changed the color to green.",
    },
  },
];

export class MockProvider implements LlmProvider {
  readonly name = "mock";
  readonly supportsNativeToolCalls = true;

  async chat(options: ChatOptions): Promise<ChatResult> {
    const state = extractState(options.messages);
    // The last non-tool message from the user is the current intent.
    const lastUser = [...options.messages].reverse().find((m) => m.role === "user");
    const userText = lastUser?.content ?? "";
    const lastAssistantToolCalls = [...options.messages]
      .reverse()
      .find((m) => m.role === "assistant")?.toolCalls;

    // Phase 1: if we haven't yet issued tool calls for this turn, do so now.
    if (!lastAssistantToolCalls || lastAssistantToolCalls.length === 0) {
      for (const { match, intent } of INTENTS) {
        if (match.test(userText)) {
          const args = intent.args(state, userText);
          if (!args) {
            await streamText(options, `I couldn't find a component to edit. `);
            return {
              text: `I couldn't find a component to edit.`,
              toolCalls: [],
              tokensIn: 0,
              tokensOut: 0,
            };
          }
          const call: LlmToolCall = {
            callId: createId("call_"),
            tool: intent.tool,
            args,
          };
          return { text: "", toolCalls: [call], tokensIn: 0, tokensOut: 0 };
        }
      }

      // No recognized intent — export requests
      if (/(\bexport\b|\bdownload\b|导出|下载).*\bhtml\b/i.test(userText)) {
        const call: LlmToolCall = {
          callId: createId("call_"),
          tool: "export_html",
          args: {},
        };
        return { text: "", toolCalls: [call], tokensIn: 0, tokensOut: 0 };
      }
      if (/\bskill\b|打包/i.test(userText)) {
        const call: LlmToolCall = {
          callId: createId("call_"),
          tool: "export_skill",
          args: { name: "packaged-motion", description: "A motion packaged as a reusable skill." },
        };
        return { text: "", toolCalls: [call], tokensIn: 0, tokensOut: 0 };
      }

      // Fallback: helpful nudge.
      const reply =
        "I can adjust easing (bouncy, smooth, snappy), duration (slower, faster), looping, and colors, or export to HTML / package as a skill. Tell me what you'd like to change.";
      await streamText(options, reply);
      return { text: reply, toolCalls: [], tokensIn: 0, tokensOut: 0 };
    }

    // Phase 2: tool calls were executed; produce a final summary.
    const intentMatched = INTENTS.find((i) => i.match.test(userText));
    const reply = intentMatched
      ? intentMatched.intent.reply
      : "Done — I applied that change. Anything else you'd like to tune?";
    await streamText(options, reply);
    return { text: reply, toolCalls: [], tokensIn: 0, tokensOut: 0 };
  }
}

async function streamText(options: ChatOptions, text: string): Promise<void> {
  if (!options.onToken) return;
  const tokens = text.split(/(\s+)/);
  for (const t of tokens) {
    options.onToken(t);
    await new Promise((r) => setTimeout(r, 8));
  }
}
