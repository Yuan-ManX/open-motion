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

/** Parse a duration-like value: "500ms", "1.5s", "2 seconds" → ms. */
function parseDuration(text: string, fallback: number): number {
  const ms = text.match(/(\d+(?:\.\d+)?)\s*ms\b/);
  if (ms) return Math.round(Number(ms[1]));
  const s = text.match(/(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?\b/i);
  if (s) return Math.round(Number(s[1]) * 1000);
  const bare = text.match(/\b(\d{3,5})\s*(?:duration|long)?\b/i);
  if (bare) return Number(bare[1]);
  return fallback;
}

function parseRepeatCount(text: string): number | "infinite" {
  if (/\b(forever|infinite|always|endless)\b|无限/i.test(text)) return "infinite";
  const m = text.match(/\b(?:repeat|loop|times)\s*(\d+)\b|(\d+)\s*(?:times|loops?)\b/i);
  if (m) return Math.max(1, Number(m[1] || m[2]));
  return "infinite";
}

const EASING_INTENTS: { match: RegExp; preset: string; reply: string }[] = [
  { match: /\b(bouncy|bounce|bouncier|springy)\b|弹跳|弹性/i, preset: "bounce", reply: "Switched to a bouncy easing so it overshoots with spring." },
  { match: /\b(elastic)\b/i, preset: "elastic", reply: "Applied an elastic easing for that stretchy, snappy feel." },
  { match: /\b(smooth|smoother|soft|gentle)\b|柔和|平滑/i, preset: "smooth", reply: "Smoothed the easing so the motion glides." },
  { match: /\b(snappy|sharp|crisp)\b|利落|干脆/i, preset: "snappy", reply: "Made the easing snappy for a crisp start and stop." },
  { match: /\b(ease-in)\b/i, preset: "ease-in", reply: "Set easing to ease-in — slow start, fast finish." },
  { match: /\b(ease-out|ease out)\b/i, preset: "ease-out", reply: "Set easing to ease-out — fast start, slow finish." },
  { match: /\b(linear)\b/i, preset: "linear", reply: "Set easing to linear — constant speed throughout." },
  { match: /\b(back|overshoot)\b/i, preset: "back", reply: "Applied a back easing for a slight overshoot." },
];

const COLOR_MAP: { match: RegExp; hex: string; name: string }[] = [
  { match: /\bred\b|红色/i, hex: "#ef4444", name: "red" },
  { match: /\bblue\b|蓝色/i, hex: "#3b82f6", name: "blue" },
  { match: /\bgreen\b|绿色/i, hex: "#22c55e", name: "green" },
  { match: /\bpurple\b|紫色/i, hex: "#a855f7", name: "purple" },
  { match: /\borange\b|橙色/i, hex: "#f97316", name: "orange" },
  { match: /\byellow\b|黄色/i, hex: "#eab308", name: "yellow" },
  { match: /\bpink\b|粉色/i, hex: "#ec4899", name: "pink" },
  { match: /\bwhite\b|白色/i, hex: "#ffffff", name: "white" },
  { match: /\bblack\b|黑色/i, hex: "#111111", name: "black" },
  { match: /\b(gray|grey)\b|灰色/i, hex: "#6b7280", name: "gray" },
];

function matchIntents(state: ParsedState, userText: string): { calls: LlmToolCall[]; replies: string[] } {
  const calls: LlmToolCall[] = [];
  const replies: string[] = [];
  const push = (tool: LlmToolCall["tool"], args: Record<string, unknown> | null, reply: string) => {
    if (!args) return false;
    calls.push({ callId: createId("call_"), tool, args });
    replies.push(reply);
    return true;
  };

  // --- Easing presets (skip when user is referencing a template by name) ---
  const wantsTemplate = /\btemplate\b|模板/i.test(userText);
  if (!wantsTemplate) {
    for (const e of EASING_INTENTS) {
      if (e.match.test(userText)) {
        push("set_easing", state.firstComponentId
          ? { componentId: state.firstComponentId, easing: { type: "preset", name: e.preset } }
          : null, e.reply);
        break;
      }
    }
  }

  // --- Spring physics: "spring with stiffness 200, damping 15" ---
  if (/\bspring\b|弹簧/i.test(userText) && state.firstComponentId) {
    const stiffM = userText.match(/stiffness\s*(\d+)/i);
    const dampM = userText.match(/damping\s*(\d+)/i);
    const massM = userText.match(/mass\s*(\d+(?:\.\d+)?)/i);
    const stiffness = stiffM ? Number(stiffM[1]) : 180;
    const damping = dampM ? Number(dampM[1]) : 14;
    const mass = massM ? Number(massM[1]) : 1;
    push("set_spring", state.firstComponentId
      ? { componentId: state.firstComponentId, stiffness, damping, mass }
      : null, `Tuned spring physics: stiffness ${stiffness}, damping ${damping}, mass ${mass}.`);
  }

  // --- Global timing (project-level duration, takes priority over component duration) ---
  let globalTimingMatched = false;
  if (/\b(global|total|overall|project)\b.*\b(duration|timing|length)\b|全局.*时长/i.test(userText)) {
    const ms = parseDuration(userText, 0);
    if (ms > 0) {
      push("set_global_timing", { totalDurationMs: ms }, `Set project total duration to ${ms}ms.`);
      globalTimingMatched = true;
    }
  }

  // --- Duration: slower/faster/specific ---
  if (!globalTimingMatched) {
    if (/\b(slower|slow|more time)\b|慢|更慢/i.test(userText) && state.firstComponentId) {
      push("set_duration", { componentId: state.firstComponentId, durationMs: 1800 }, "Slowed it down to 1.8s.");
    } else if (/\b(faster|quicker|quick|speed up)\b|快|更快/i.test(userText) && state.firstComponentId) {
      push("set_duration", { componentId: state.firstComponentId, durationMs: 400 }, "Sped it up to 400ms.");
    } else if (/\b(\d+)\s*ms\b|\b(\d+(?:\.\d+)?)\s*s\b/i.test(userText) && /\b(duration|long|lasts?)\b/i.test(userText) && state.firstComponentId) {
      const ms = parseDuration(userText, 800);
      push("set_duration", { componentId: state.firstComponentId, durationMs: ms }, `Set duration to ${ms}ms.`);
    }
  }

  // --- Delay ---
  if (/\bdelay\b|延迟/i.test(userText) && state.firstComponentId) {
    const ms = parseDuration(userText, 200);
    push("set_delay", { componentId: state.firstComponentId, delayMs: ms }, `Added a ${ms}ms delay before it starts.`);
  }

  // --- Loop ---
  if (/\b(loop|repeat|forever)\b|循环|重复/i.test(userText) && state.firstComponentId) {
    const count = parseRepeatCount(userText);
    push("set_loop", { componentId: state.firstComponentId, iterationCount: count },
      count === "infinite" ? "Set it to loop forever." : `Set it to repeat ${count} times.`);
  }

  // --- Fill mode ---
  const fillM = userText.match(/\b(fill\s*mode|fillmode)\s*(forwards|backwards|both|none)\b/i);
  if (fillM && state.firstComponentId) {
    push("set_fill_mode", { componentId: state.firstComponentId, fillMode: fillM[1].toLowerCase() },
      `Set fill mode to ${fillM[1].toLowerCase()}.`);
  }

  // --- Colors (text + background) ---
  for (const c of COLOR_MAP) {
    if (c.match.test(userText)) {
      const isBg = /\b(background|bg|fill)\b|背景/i.test(userText);
      push("set_color", state.firstComponentId
        ? { componentId: state.firstComponentId, color: c.hex, target: isBg ? "background" : "text" }
        : null, `Changed ${isBg ? "background" : "text"} color to ${c.name}.`);
      break;
    }
  }

  // --- Static styles (borderRadius, width, height, fontSize, padding, margin) ---
  if (state.firstComponentId && !/\b(from|animate|keyframe|transform)\b/i.test(userText)) {
    const styles: Record<string, string> = {};

    if (/\b(round|radius|corner)\b|圆角/i.test(userText)) {
      const rM = userText.match(/(\d+)\s*(?:px)?\s*(?:radius|corner|round)/i) || userText.match(/圆角\s*(\d+)/i);
      const r = rM ? Number(rM[1]) : 16;
      styles.borderRadius = `${r}px`;
    }

    const wM = userText.match(/\b(?:width|宽)\s*(?::|to|=)?\s*(\d+(?:\.\d+)?)\s*(px)?/i);
    if (wM) styles.width = `${wM[1]}px`;

    const hM = userText.match(/\b(?:height|高)\s*(?::|to|=)?\s*(\d+(?:\.\d+)?)\s*(px)?/i);
    if (hM) styles.height = `${hM[1]}px`;

    const fsM = userText.match(/\b(?:font[\s-]?size|字号)\s*(?::|to|=)?\s*(\d+(?:\.\d+)?)\s*(px)?/i);
    if (fsM) styles.fontSize = `${fsM[1]}px`;

    const pM = userText.match(/\b(?:padding|内边距)\s*(?::|to|=)?\s*(\d+(?:\.\d+)?)\s*(px)?/i);
    if (pM) styles.padding = `${pM[1]}px`;

    const mM = userText.match(/\b(?:margin|外边距)\s*(?::|to|=)?\s*(\d+(?:\.\d+)?)\s*(px)?/i);
    if (mM) styles.margin = `${mM[1]}px`;

    const keys = Object.keys(styles);
    if (keys.length > 0) {
      push("set_static_style", { componentId: state.firstComponentId, style: styles },
        `Updated ${keys.join(", ")}.`);
    }
  }

  // --- Set transform track (animate a property from → to) ---
  const txM = userText.match(/\b(translateX|translateY|scale|scaleX|scaleY|rotate|skewX|skewY|opacity)\b/i);
  if (txM && /\b(from|to|animate|transform)\b/i.test(userText) && state.firstComponentId) {
    const prop = txM[1];
    const fromM = userText.match(/\bfrom\s*(-?\d+(?:\.\d+)?)/i);
    const toM = userText.match(/\bto\s*(-?\d+(?:\.\d+)?)/i);
    const from = fromM ? Number(fromM[1]) : 0;
    const to = toM ? Number(toM[1]) : 100;
    push("set_transform", state.firstComponentId
      ? { componentId: state.firstComponentId, property: prop, keyframes: [
          { offset: 0, value: from },
          { offset: 1, value: to },
        ] }
      : null, `Animated ${prop} from ${from} to ${to}.`);
  }

  // --- Set keyframe (single keyframe at offset) ---
  if (/\b(?:add|set)\s+(?:a\s+)?keyframe\b|添加.*关键帧/i.test(userText) && state.firstComponentId) {
    const propM = userText.match(/\b(translateX|translateY|scale|scaleX|scaleY|rotate|skewX|skewY|opacity|blur|color|backgroundColor|width|height|borderRadius|fontSize)\b/i);
    const offsetM = userText.match(/\bat\s*(\d+(?:\.\d+)?)\s*%/i) || userText.match(/\boffset\s*(\d+(?:\.\d+)?)\b/i);
    const valM = userText.match(/\b(?:value|to)\s*(-?\d+(?:\.\d+)?)\b/i);
    const property = propM ? propM[1] : "opacity";
    let offset = 0.5;
    if (offsetM) {
      const v = Number(offsetM[1]);
      offset = v > 1 ? v / 100 : v;
    }
    const value = valM ? Number(valM[1]) : 1;
    push("set_keyframe", state.firstComponentId
      ? { componentId: state.firstComponentId, property, offset: Math.min(1, Math.max(0, offset)), value }
      : null, `Set a ${property} keyframe at offset ${offset.toFixed(2)} → ${value}.`);
  }

  // --- Add layer ---
  if (/\b(add|create|new)\s+(?:a\s+|an\s+)?(layer|element|component)\b|添加(?:图层|元素)/i.test(userText)) {
    const nameM = userText.match(/(?:called|named|名[为叫])\s*["']?(\w+)/i);
    push("add_layer", { name: nameM ? nameM[1] : "New Layer" }, "Added a new layer.");
  }

  // --- Add scene ---
  if (/\b(add|create|new)\s+(?:a\s+)?scene\b|添加.*场景/i.test(userText)) {
    const nameM = userText.match(/(?:called|named|名[为叫])\s*["']?(\w+)/i);
    push("add_scene", { name: nameM ? nameM[1] : "Scene 1" }, `Added a new scene${nameM ? ` called ${nameM[1]}` : ""}.`);
  }

  // --- Remove component ---
  if (/\b(remove|delete|drop)\s+(layer|element|component|this)\b|删除(?:图层|元素)/i.test(userText) && state.firstComponentId) {
    push("remove_component", { componentId: state.firstComponentId }, "Removed the selected layer.");
  }

  // --- List templates ---
  if (/\b(list|show|browse|available|what)\b.*\btemplates?\b|列出.*模板|有哪些模板/i.test(userText)) {
    push("list_templates", {}, "Here are the available motion templates.");
  }

  // --- Template ---
  const tplM = userText.match(/\b(?:use|apply|switch to)\s+(?:the\s+)?([\w\s-]+?)\s+template\b|使用\s*([\w\s-]+?)\s*模板/i);
  if (tplM) {
    const raw = (tplM[1] || tplM[2] || "").trim().toLowerCase().replace(/\s+/g, "-");
    push("set_template", { templateId: `tpl-${raw}` }, `Switched to the ${raw} template.`);
  }

  // --- Export HTML ---
  if (/(\bexport\b|\bdownload\b|导出|下载).*\bhtml\b/i.test(userText)) {
    push("export_html", {}, "Exported the project as a standalone HTML file.");
  }

  // --- Export code ---
  if (/(\bexport\b|导出).*\b(css|样式)\b/i.test(userText)) {
    push("export_code", { format: "css" }, "Exported the animation as CSS code.");
  } else if (/(\bexport\b|导出).*\b(json)\b/i.test(userText)) {
    push("export_code", { format: "json" }, "Exported the MotionSpec as JSON.");
  } else if (/(\bexport\b|导出).*\b(react|tsx|component)\b/i.test(userText)) {
    push("export_code", { format: "react" }, "Exported the animation as a React component.");
  }

  // --- Export video ---
  if (/(\bexport\b|导出).*\b(video|mp4|gif|webm)\b/i.test(userText)) {
    const fmtM = userText.match(/\b(mp4|gif|webm)\b/i);
    push("export_video", { format: fmtM ? fmtM[1] : "mp4" }, `Started video export as ${fmtM ? fmtM[1] : "mp4"}.`);
  }

  // --- Export skill ---
  if (/\bskill\b|打包/i.test(userText)) {
    push("export_skill", { name: "packaged-motion", description: "A motion packaged as a reusable skill." },
      "Packaged the motion as a reusable AI skill.");
  }

  // --- Preview ---
  if (/\bpreview\b|预览/i.test(userText)) {
    push("preview_url", {}, "Here's the preview URL — open it in a new tab.");
  }

  // --- Get spec ---
  if (/\b(spec|state|current|what.*status)\b|当前状态|规格/i.test(userText)) {
    push("get_motion_spec", {}, "Here's the current MotionSpec.");
  }

  return { calls, replies };
}

const FALLBACK_REPLY =
  "I can adjust easing (bouncy, smooth, snappy, elastic, back, linear), spring physics (stiffness/damping/mass), " +
  "duration (slower, faster, specific ms), global timing, delay, loop (forever, N times), fill mode, colors (text + background), " +
  "border radius, transform tracks (translateX/scale/rotate/opacity from→to), keyframes, add/remove layers, add scenes, " +
  "list/switch templates, export (HTML, CSS, JSON, React, video, skill), or show a preview. " +
  "Tell me what you'd like to do.";

export class MockProvider implements LlmProvider {
  readonly name = "mock";
  readonly supportsNativeToolCalls = true;

  async chat(options: ChatOptions): Promise<ChatResult> {
    const state = extractState(options.messages);
    const lastUser = [...options.messages].reverse().find((m) => m.role === "user");
    const userText = lastUser?.content ?? "";
    const lastAssistantToolCalls = [...options.messages]
      .reverse()
      .find((m) => m.role === "assistant")?.toolCalls;

    // Phase 1: issue tool calls for this turn.
    if (!lastAssistantToolCalls || lastAssistantToolCalls.length === 0) {
      const { calls, replies } = matchIntents(state, userText);

      if (calls.length > 0) {
        return { text: "", toolCalls: calls, tokensIn: 0, tokensOut: 0 };
      }

      await streamText(options, FALLBACK_REPLY);
      return { text: FALLBACK_REPLY, toolCalls: [], tokensIn: 0, tokensOut: 0 };
    }

    // Phase 2: tool calls were executed; produce a final summary.
    const { replies } = matchIntents(state, userText);
    const reply = replies.length > 0
      ? replies.join(" ")
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
