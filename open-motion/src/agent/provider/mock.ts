import type { ChatOptions, ChatResult, LlmProvider, LlmToolCall } from "./types.js";
import { extractText } from "./types.js";
import { createId } from "../../utils/id.js";
import { resolveTemplateId, resolvePresetName } from "../intents.js";

interface ParsedState {
  componentIds: string[];
  firstComponentId: string | null;
  secondComponentId: string | null;
  projectName: string | null;
}

function extractState(messages: ChatOptions["messages"]): ParsedState {
  const sysMsg = messages.find((m) => m.role === "system");
  const sys = sysMsg ? extractText(sysMsg.content) : "";
  const ids = Array.from(sys.matchAll(/\bc_[a-zA-Z0-9]{4,}\b/g)).map((m) => m[0]);
  return {
    componentIds: ids,
    firstComponentId: ids[0] ?? null,
    secondComponentId: ids[1] ?? null,
    projectName: null,
  };
}

/** Parse a duration-like value: "500ms", "1.5s", "2 seconds", "500毫秒", "2秒" → ms. */
function parseDuration(text: string, fallback: number): number {
  const ms = text.match(/(\d+(?:\.\d+)?)\s*ms\b/);
  if (ms) return Math.round(Number(ms[1]));
  const cnMs = text.match(/(\d+(?:\.\d+)?)\s*毫秒/);
  if (cnMs) return Math.round(Number(cnMs[1]));
  const s = text.match(/(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?\b/i);
  if (s) return Math.round(Number(s[1]) * 1000);
  const cnS = text.match(/(\d+(?:\.\d+)?)\s*秒/);
  if (cnS) return Math.round(Number(cnS[1]) * 1000);
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
  { match: /\b(smooth|smoother|gentle)\b|柔和|平滑/i, preset: "smooth", reply: "Smoothed the easing so the motion glides." },
  { match: /\b(soft)\b/i, preset: "soft", reply: "Applied a soft easing for a gentle, natural deceleration." },
  { match: /\b(snappy|sharp|crisp)\b|利落|干脆/i, preset: "snappy", reply: "Made the easing snappy for a crisp start and stop." },
  // Compound ease patterns must come before simpler ones (longest match first)
  { match: /\bease[-\s]in[-\s]out[-\s]quad\b/i, preset: "ease-in-out-quad", reply: "Set easing to ease-in-out-quad — symmetric quad acceleration." },
  { match: /\bease[-\s]in[-\s]out[-\s]cubic\b/i, preset: "ease-in-out-cubic", reply: "Set easing to ease-in-out-cubic — smooth cubic S-curve." },
  { match: /\bease[-\s]in[-\s]quad\b/i, preset: "ease-in-quad", reply: "Set easing to ease-in-quad — gentle quad acceleration." },
  { match: /\bease[-\s]out[-\s]quad\b/i, preset: "ease-out-quad", reply: "Set easing to ease-out-quad — gentle quad deceleration." },
  { match: /\bease[-\s]in[-\s]cubic\b/i, preset: "ease-in-cubic", reply: "Set easing to ease-in-cubic — strong cubic acceleration." },
  { match: /\bease[-\s]out[-\s]cubic\b/i, preset: "ease-out-cubic", reply: "Set easing to ease-out-cubic — strong cubic deceleration." },
  { match: /\bease[-\s]in[-\s]out\b/i, preset: "ease-in-out", reply: "Set easing to ease-in-out — slow start and finish, fast middle." },
  { match: /\b(ease-in)\b/i, preset: "ease-in", reply: "Set easing to ease-in — slow start, fast finish." },
  { match: /\b(ease-out|ease out)\b/i, preset: "ease-out", reply: "Set easing to ease-out — fast start, slow finish." },
  { match: /\b(ease)\b/i, preset: "ease", reply: "Set easing to ease — the default CSS smooth curve." },
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

  // Auto-create a default component when the project is empty so property-tuning
  // intents (color, duration, easing, etc.) work on fresh projects. Returns the
  // first component ID if one exists, or "__last__" to target the just-created
  // component (resolved by the orchestrator after set_template executes).
  let autoCreated = false;
  function ensureComponent(): string {
    if (state.firstComponentId) return state.firstComponentId;
    if (!autoCreated) {
      push("set_template", { templateId: "tpl-fade-in" },
        "Created a default fade-in component to apply your change.");
      autoCreated = true;
    }
    return "__last__";
  }

  // --- Create animation / layer by name (runs first so names like "bounce"
  // resolve to a template instead of no-op'ing the easing intent below) ---
  let createdFromName = false;
  // Try "create/make/build/add a [name] animation/effect/motion/layer" first.
  let createRaw: string | null = null;
  const createWithNounM = userText.match(
    /\b(?:create|make|build|generate|design|add)\s+(?:a\s+|an\s+|the\s+)?([\w][\w\s-]*?)\s+(?:animation|effect|motion|transition|layer|element|component)\b/i,
  );
  if (createWithNounM) {
    createRaw = createWithNounM[1].trim();
  } else {
    // Fall back to "create/make/build a [name]" with no trailing noun — only
    // fires when [name] resolves to a known template alias so we don't hijack
    // phrases like "make a decision".
    // Skip the bare-create fallback when the message is clearly about another
    // tool (docs, beats, storyboard, similarity, documentation, narrative) so
    // phrases like "Generate motion docs" don't get hijacked by create logic.
    const wantsOtherTool = /\b(beat|storyboard|similar|docs?|documentation|narrative|lineage|capture|recipe|brand|profile|memory|accessibility|performance)\b/i.test(userText);
    const createBareM = userText.match(
      /\b(?:create|make|build|generate|design)\s+(?:a\s+|an\s+|the\s+)?([\w][\w\s-]+)\s*$/i,
    );
    if (createBareM && !wantsOtherTool) {
      const raw = createBareM[1].trim();
      if (resolveTemplateId(raw)) createRaw = raw;
    }
  }
  // Guard: when the regex backtracks and captures a bare article ("a", "an",
  // "the") as the name — e.g. "Add a layer called Title" — discard it so the
  // dedicated add_layer handler below can extract the real name.
  if (createRaw && /^(a|an|the)$/i.test(createRaw)) {
    createRaw = null;
  }
  // Guard: when the name matches an animation preset (shake, wiggle, float, glow,
  // heartbeat, typewriter), skip the create handler so apply_preset can handle it.
  if (createRaw && /\b(shake|wiggle|float|glow|heartbeat|type[\s-]?writer)\b/i.test(createRaw)) {
    createRaw = null;
  }
  // Guard: when the name matches a professional effect/operation (motion blur,
  // null object, trim path, repeater, echo, time remap, drop shadow, etc.),
  // skip the create handler so dedicated intent handlers below can fire.
  if (createRaw && /\b(motion[\s-]?blur|null(?:[\s-]?object)?|trim[\s-]?path|repeater|echo|time[\s-]?remap|drop[\s-]?shadow|outer[\s-]?glow|inner[\s-]?shadow|layer[\s-]?effect|trail|afterimage|freeze(?:[\s-]?frame)?|null|mask|track[\s-]?matte|alpha[\s-]?matte|luma[\s-]?matte|posterize|stop[\s-]?motion|text[\s-]?animator|character[\s-]?by[\s-]?character|word[\s-]?by[\s-]?word|hold[\s-]?keyframe|roving[\s-]?keyframe|polygon|star|shape[\s-]?layer|gradient[\s-]?(?:fill|stroke)|wiggle|jitter|tremble|particle|emitter|burst|sparks|snow|confetti|camera|3d[\s-]?camera|multi[\s-]?plane|parallax|dolly|audio[\s-]?reactive|beat[\s-]?detect|music[\s-]?sync|sound[\s-]?reactive|puppet|mesh[\s-]?warp|liquid[\s-]?effect|organic[\s-]?deform)\b/i.test(createRaw)) {
    createRaw = null;
  }
  if (createRaw) {
    const resolved = resolveTemplateId(createRaw);
    if (resolved) {
      push("set_template", { templateId: resolved },
        `Created a ${createRaw} animation using the ${resolved} template.`);
      createdFromName = true;
    } else {
      push("add_layer", { name: createRaw.charAt(0).toUpperCase() + createRaw.slice(1) },
        `Added a new layer called "${createRaw}".`);
      createdFromName = true;
    }
  }

  // --- Easing presets (skip when referencing a template or already created from name) ---
  const wantsTemplate = /\btemplate\b|模板/i.test(userText);
  if (!wantsTemplate && !createdFromName) {
    for (const e of EASING_INTENTS) {
      if (e.match.test(userText)) {
        const cid = ensureComponent();
        push("set_easing", { componentId: cid, easing: { type: "preset", name: e.preset } }, e.reply);
        break;
      }
    }
  }

  // --- Spring physics: "spring with stiffness 200, damping 15" ---
  if (/\bspring\b|弹簧/i.test(userText)) {
    const stiffM = userText.match(/stiffness\s*(\d+)/i);
    const dampM = userText.match(/damping\s*(\d+)/i);
    const massM = userText.match(/mass\s*(\d+(?:\.\d+)?)/i);
    const stiffness = stiffM ? Number(stiffM[1]) : 180;
    const damping = dampM ? Number(dampM[1]) : 14;
    const mass = massM ? Number(massM[1]) : 1;
    const cid = ensureComponent();
    push("set_spring", { componentId: cid, stiffness, damping, mass },
      `Tuned spring physics: stiffness ${stiffness}, damping ${damping}, mass ${mass}.`);
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
    if (/\b(slower|slow|more time)\b|慢|更慢/i.test(userText)) {
      const cid = ensureComponent();
      push("set_duration", { componentId: cid, durationMs: 1800 }, "Slowed it down to 1.8s.");
    } else if (/\b(faster|quicker|quick|speed up)\b|快|更快/i.test(userText)) {
      const cid = ensureComponent();
      push("set_duration", { componentId: cid, durationMs: 400 }, "Sped it up to 400ms.");
    } else if (/\b(\d+)\s*ms\b|\b(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?\b|时长.*\d|时长.*秒|\d+\s*毫秒|\d+\s*秒/i.test(userText) && !/\bdelay\b|延迟/i.test(userText)) {
      const ms = parseDuration(userText, 800);
      const cid = ensureComponent();
      push("set_duration", { componentId: cid, durationMs: ms }, `Set duration to ${ms}ms.`);
    }
  }

  // --- Delay ---
  if (/\bdelay\b|延迟/i.test(userText)) {
    const ms = parseDuration(userText, 200);
    const cid = ensureComponent();
    push("set_delay", { componentId: cid, delayMs: ms }, `Added a ${ms}ms delay before it starts.`);
  }

  // --- Loop (with optional direction) ---
  // Guard: skip when the user clearly means a pattern repeater (pattern
  // duplication) rather than iteration count — that is handled by a dedicated
  // add_repeater intent further below.
  if (/\b(loop|repeat|forever)\b|循环|重复/i.test(userText)
      && !/\b(?:repeater|repeat\s+this|repeat\s+in\s+(?:a\s+)?(?:radial|circular|grid|pattern|linear)|copies|instances|tile|cascade)\b/i.test(userText)) {
    const count = parseRepeatCount(userText);
    // Parse optional direction from phrases like "loop with alternate direction".
    // Order longer alternatives (alternate-reverse) before shorter ones (alternate)
    // so the regex engine captures the full compound direction token.
    const dirM = userText.match(/\b(normal|reverse|alternate-reverse|alternate)\b/i);
    const direction = dirM ? dirM[1].toLowerCase() : undefined;
    const cid = ensureComponent();
    const args: Record<string, unknown> = { componentId: cid, iterationCount: count };
    if (direction) args.direction = direction;
    push("set_loop", args,
      count === "infinite"
        ? `Set it to loop forever${direction ? ` (${direction})` : ""}.`
        : `Set it to repeat ${count} times${direction ? ` (${direction})` : ""}.`);
  }

  // --- Direction-only change (uses batch_update for a single component).
  // projectId is injected by the tool executor from the session context, so
  // we omit it here — matching the convention used by set_easing/set_loop. ---
  if (/\b(direction|play.*backward|play.*reverse|alternate.*direction|reverse.*direction|reverse.*animation|reverse.*motion|reverse.*play|reverse.*it)\b/i.test(userText)
      && !/\b(loop|repeat|forever)\b/i.test(userText)) {
    const dirM = userText.match(/\b(normal|reverse|alternate-reverse|alternate)\b/i);
    const direction = dirM ? dirM[1].toLowerCase() : "reverse";
    const cid = ensureComponent();
    push("batch_update",
      { componentIds: [cid], direction },
      `Set animation direction to ${direction}.`);
  }

  // --- Fill mode ---
  const fillM = userText.match(/\b(fill\s*mode|fillmode)\s*(?:to\s+)?(forwards|backwards|both|none)\b/i);
  if (fillM) {
    const fillMode = fillM[2].toLowerCase();
    const cid = ensureComponent();
    push("set_fill_mode", { componentId: cid, fillMode },
      `Set fill mode to ${fillMode}.`);
  }

  // --- Colors (text + background) ---
  // Hex colors (#rgb, #rrggbb, #rrggbbaa) and functional notations (rgb()/hsl())
  // take precedence over named colors so explicit values are honoured exactly.
  const hexM = userText.match(/#([0-9a-fA-F]{3,8})\b/);
  const rgbM = !hexM ? userText.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)/i) : null;
  const hslM = !hexM && !rgbM ? userText.match(/hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?\s*(?:,\s*([\d.]+)\s*)?\)/i) : null;
  const explicitColor = hexM
    ? `#${hexM[1]}`
    : rgbM
      ? `rgb(${rgbM[1]}, ${rgbM[2]}, ${rgbM[3]})`
      : hslM
        ? `hsl(${hslM[1]}, ${hslM[2]}%, ${hslM[3]}%)`
        : null;
  if (explicitColor) {
    const isBg = /\b(background|bg|fill)\b|背景/i.test(userText);
    const cid = ensureComponent();
    push("set_color", { componentId: cid, color: explicitColor, target: isBg ? "background" : "text" },
      `Changed ${isBg ? "background" : "text"} color to ${explicitColor}.`);
  } else {
    for (const c of COLOR_MAP) {
      if (c.match.test(userText)) {
        const isBg = /\b(background|bg|fill)\b|背景/i.test(userText);
        const cid = ensureComponent();
        push("set_color", { componentId: cid, color: c.hex, target: isBg ? "background" : "text" },
          `Changed ${isBg ? "background" : "text"} color to ${c.name}.`);
        break;
      }
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

  // --- Add layer (skip if mentioning listener/state/keyframe to avoid false positive) ---
  if (!/\blistener\b/i.test(userText) && /\b(add|create|new)\s+(?:a\s+|an\s+)?(layer|element|component)\b|添加(?:图层|元素)/i.test(userText)) {
    const nameM = userText.match(/(?:called|named|名[为叫])\s*["']?(\w+)/i);
    push("add_layer", { name: nameM ? nameM[1] : "New Layer" }, "Added a new layer.");
  }

  // --- Add scene ---
  if (/\b(add|create|new)\s+(?:a\s+)?scene\b|添加.*场景/i.test(userText)) {
    const nameM = userText.match(/(?:called|named|名[为叫])\s*["']?(\w+)/i);
    push("add_scene", { name: nameM ? nameM[1] : "Scene 1" }, `Added a new scene${nameM ? ` called ${nameM[1]}` : ""}.`);
  }

  // --- Scene transitions ---
  if (/\b(?:add|create|insert)\s+(?:a\s+)?scene\s+transition\b|\b(?:add|create|insert)\s+(?:a\s+)?(?:fade|slide|wipe|dissolve|zoom|push|morph|flip)?\s*transition\s*(?:between|across|to|from)\s+scenes?\b|过渡|转场/i.test(userText)) {
    const typeM = userText.match(/\b(fade|slide|wipe|dissolve|zoom|push|morph|flip)\b/i);
    const type = typeM ? typeM[1].toLowerCase() : "fade";
    const durM = userText.match(/(\d+)\s*(?:ms|millisecond|s\b)/);
    const durationMs = durM ? (durM[0].includes("s") && !durM[0].includes("ms") ? Number(durM[1]) * 1000 : Number(durM[1])) : 500;
    push("add_scene_transition", { type, durationMs },
      `Added a ${type} scene transition (${durationMs}ms).`);
  }

  // --- Camera moves ---
  if (/\b(?:camera\s+(?:move|pan|zoom|tilt|dolly|truck|orbit)|pan\s+camera|zoom\s+camera)\b|摄像机|镜头移动/i.test(userText)) {
    const typeM = userText.match(/\b(pan|zoom|tilt|dolly|truck|orbit|shake|follow)\b/i);
    const type = typeM ? typeM[1].toLowerCase() : "pan";
    const durM = userText.match(/(\d+)\s*(?:ms|millisecond|s\b)/);
    const durationMs = durM ? (durM[0].includes("s") && !durM[0].includes("ms") ? Number(durM[1]) * 1000 : Number(durM[1])) : 1000;
    push("add_camera_move", { type, durationMs, intensity: 0.6 },
      `Added a ${type} camera move (${durationMs}ms).`);
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
  const tplM = userText.match(/\b(?:use|apply|switch to|start with|begin with|try)\s+(?:the\s+)?([\w\s-]+?)\s+template\b|使用\s*([\w\s-]+?)\s*模板/i);
  if (tplM) {
    const raw = (tplM[1] || tplM[2] || "").trim();
    const resolved = resolveTemplateId(raw);
    if (resolved) {
      push("set_template", { templateId: resolved }, `Switched to the ${resolved} template.`);
    } else {
      push("set_template", { templateId: `tpl-${raw.toLowerCase().replace(/\s+/g, "-")}` }, `Switched to the ${raw} template.`);
    }
  }

  // --- Apply preset (shake, wiggle, float, glow, heartbeat, typewriter) ---
  const presetM = userText.match(/\b(?:apply|use|add)\s+(?:a\s+|an\s+|the\s+)?(shake|wiggle|float|glow|heartbeat|type[\s-]?writer)\s+(?:preset|effect|animation)?\b/i);
  if (presetM) {
    const name = resolvePresetName(presetM[1]);
    if (name) {
      const cid = ensureComponent();
      push("apply_preset", { componentId: cid, preset: name },
        `Applied the ${name} preset.`);
    }
  }

  // --- Batch update (all components / everything) ---
  if (/\b(all components|every component|everything|all layers|each layer)\b/i.test(userText) && state.componentIds.length > 1) {
    // Detect what to apply to all: easing, duration, color, etc.
    const patches: Record<string, unknown> = {};
    if (/\bbouncy\b/i.test(userText)) patches.easing = { type: "preset", name: "bounce" };
    else if (/\bsmooth\b/i.test(userText)) patches.easing = { type: "preset", name: "smooth" };
    else if (/\bsnappy\b/i.test(userText)) patches.easing = { type: "preset", name: "snappy" };
    if (Object.keys(patches).length > 0) {
      push("batch_update", { componentIds: state.componentIds, ...patches },
        `Applied ${Object.keys(patches).join(", ")} to all ${state.componentIds.length} components.`);
    }
  }

  // --- Duplicate component ---
  if (/\b(duplicate|copy|clone)\b/i.test(userText) && state.firstComponentId) {
    push("duplicate_component", { componentId: state.firstComponentId },
      "Duplicated the selected component.");
  }

  // --- Reorder components ---
  if (/\b(reorder|reorder|move to front|move to back|bring to front|send to back)\b/i.test(userText) && state.componentIds.length > 1) {
    const reversed = /\b(back|end|last)\b/i.test(userText) ? [...state.componentIds].reverse() : state.componentIds;
    push("reorder_components", { componentIds: reversed },
      "Reordered the component layers.");
  }

  // --- Set play state (pause / play / stop) ---
  if (/\bpause\b|暂停/i.test(userText) && state.firstComponentId) {
    push("set_play_state", { componentId: state.firstComponentId, playState: "paused" },
      "Paused the animation.");
  } else if (/\b(play|resume)\b|播放|继续/i.test(userText) && state.firstComponentId) {
    push("set_play_state", { componentId: state.firstComponentId, playState: "running" },
      "Resumed playback.");
  }

  // --- Export HTML ---
  if (/(\bexport\b|\bdownload\b|导出|下载).*\bhtml\b/i.test(userText)) {
    push("export_html", {}, "Exported the project as a standalone HTML file.");
  }

  // --- Export code ---
  if (/(?:\bexport\b|\bgenerate\b|导出|生成).*\b(css|样式)\b/i.test(userText)) {
    push("export_code", { format: "css" }, "Exported the animation as CSS code.");
  } else if (/(?:\bexport\b|\bgenerate\b|导出|生成).*\b(json)\b/i.test(userText)) {
    push("export_code", { format: "json" }, "Exported the MotionSpec as JSON.");
  } else if (/(?:\bexport\b|\bgenerate\b|导出|生成).*\b(react|tsx|component)\b/i.test(userText)) {
    push("export_code", { format: "react" }, "Exported the animation as a React component.");
  }

  // --- Export video ---
  if (/(\bexport\b|导出).*\b(video|mp4|gif|webm)\b/i.test(userText)) {
    const fmtM = userText.match(/\b(mp4|gif|webm)\b/i);
    push("export_video", { format: fmtM ? fmtM[1] : "mp4" }, `Started video export as ${fmtM ? fmtM[1] : "mp4"}.`);
  }

  // --- Export Lottie ---
  if (/(\bexport\b|导出).*\b(lottie|after\s*effects)\b/i.test(userText)) {
    const fpsM = userText.match(/\b(\d+)\s*fps\b/i);
    push("export_lottie", { fps: fpsM ? parseInt(fpsM[1], 10) : undefined },
      "Exported the animation as a Lottie JSON file — ready for web, mobile, and animation tools.");
  }

  // --- Export skill ---
  if (/\bskill\b|打包/i.test(userText)) {
    push("export_skill", { name: "packaged-motion", description: "A motion packaged as a reusable skill." },
      "Packaged the motion as a reusable AI skill.");
  }

  // --- Preview (skip if fullscreen preview is requested — handled separately) ---
  if (/\bpreview\b|预览/i.test(userText) && !/\bfullscreen|full screen|present mode\b/i.test(userText)) {
    push("preview_url", {}, "Here's the preview URL — open it in a new tab.");
  }

  // --- Describe motion (Motion DNA) ---
  if (/\b(describe|what.*look|explain|dna|characterize)\b|描述|什么样/i.test(userText)) {
    push("describe_motion", {}, "Here's the Motion DNA and description for your current animation.");
  }

  // --- Analyze motion (quality, timing, accessibility) ---
  if (/\b(analyze|review|critique|quality|is this good|score|insight)\b/i.test(userText)) {
    push("analyze_motion", {}, "Here's my analysis of your motion design — timing, easing, accessibility, and composition.");
  }

  // --- Suggest next steps ---
  if (/\b(suggest|ideas?|what next|what should i|what now)\b/i.test(userText)) {
    push("suggest_next", {}, "Here are some context-aware suggestions for what to do next.");
  }

  // --- Set motion path (orbit, circle, ellipse, line, bezier, SVG path syntax) ---
  if (/\b(orbit|circle|ellipse|along.*path|trajectory|fly across|move in a|motion\s+path|path\s*[:=])\b/i.test(userText) && state.firstComponentId) {
    // Detect explicit SVG path data (M/L/Q/C/Z commands with coordinates).
    const svgPathM = userText.match(/(?:path\s*[:=]\s*)?([MLCQZmlcqz][\d\s,.\-+eE]+)/);
    if (svgPathM) {
      push("set_motion_path",
        { componentId: state.firstComponentId, pathType: "bezier", svgPath: svgPathM[1].trim() },
        `Set the component on a custom SVG motion path: ${svgPathM[1].trim()}.`);
    } else {
      const pathType = /\bellipse\b/i.test(userText) ? "ellipse"
        : /\bcircle\b|orbit/i.test(userText) ? "circle"
        : /\bbezier|curve\b/i.test(userText) ? "bezier"
        : "line";
      const args: Record<string, unknown> = { componentId: state.firstComponentId, pathType };
      if (pathType === "circle" || pathType === "ellipse") {
        args.centerX = 0;
        args.centerY = 0;
        args.radiusX = pathType === "ellipse" ? 150 : 100;
        if (pathType === "ellipse") args.radiusY = 80;
      }
      push("set_motion_path", args, `Set the component on a ${pathType} path.`);
    }
  }

  // --- List scenes ---
  if (/\b(list|show|what)\b.*\bscenes?\b|列出.*场景|有哪些场景/i.test(userText)) {
    push("list_scenes", {}, "Here are the scenes in this project.");
  }

  // --- Remove scene ---
  const rmSceneM = userText.match(/\b(?:remove|delete|drop)\s+(?:the\s+)?scene\s+(\w+)|删除.*场景\s*(\w+)/i);
  if (rmSceneM) {
    push("remove_scene", { sceneId: rmSceneM[1] || rmSceneM[2] }, `Removed scene ${rmSceneM[1] || rmSceneM[2]}.`);
  }

  // --- Stagger components ---
  // Guard: when the user clearly means per-character text animation (text
  // animator context), defer to the dedicated add_text_animator intent.
  if (/\b(stagger|cascade|sequence|one by one|sequential)\b|错开|依次|逐个/i.test(userText)
      && !/\b(?:text|character|word|char)\b/i.test(userText)) {
    const stepM = userText.match(/(\d+(?:\.\d+)?)\s*(ms|s)?/);
    let stepMs = 100;
    if (stepM) {
      stepMs = stepM[2] === "s" ? Math.round(Number(stepM[1]) * 1000) : Number(stepM[1]);
    }
    const dir = /reverse|backward|反向/.test(userText) ? "reverse" : /center|middle|中间/.test(userText) ? "center" : "forward";
    push("stagger_components", { stepMs, direction: dir }, `Staggered all components with ${stepMs}ms steps (${dir}).`);
  }

  // --- Match template ---
  if (/\b(find|match|suggest|recommend|which)\b.*\btemplate\b|find.*template|什么模板|匹配模板/i.test(userText)) {
    push("match_template", { hint: userText }, "Here are the closest matching templates based on your current motion.");
  }

  // --- Find similar motion (cross-project DNA search) ---
  if (/\b(find.*similar|similar.*motion|what.*else.*like|search.*similar|are.*there.*other.*like|motion.*like.*this|dna.*search|similar.*dna)\b/i.test(userText)) {
    if (state.firstComponentId) {
      push("find_similar_motion", { componentId: state.firstComponentId, limit: 8, threshold: 40 },
        "Found 5 similar motions — top match: 'Hero Bounce' from the Marketing Launch project (78% match, easing+properties+duration). 3 from templates, 2 from other projects.");
    } else {
      push("find_similar_motion", { limit: 8, threshold: 40 },
        "Searched across all projects and templates for similar motions. Add a component first to anchor the DNA search.");
    }
  }

  // --- Generate motion documentation ---
  if (/\b(generate.*docs?|motion.*docs?|spec.*document|documentation|document.*project|export.*spec|motion.*spec)\b/i.test(userText)) {
    const asJson = /json/i.test(userText);
    push("generate_motion_docs", { format: asJson ? "json" : "markdown" },
      `Generated ${asJson ? "JSON" : "Markdown"} motion specification — includes component inventory with DNA signatures, easing distribution, trigger philosophy, accessibility summary, performance budget, and storyboard beats.`);
  }

  // --- Analyze animation principles ---
  if (/\b(animation.*principles?|motion.*principles?|disney.*principles?|12.*principles?|check.*principles?|analyze.*principles?|principle.*score)\b/i.test(userText)) {
    push("analyze_principles", state.firstComponentId ? { componentId: state.firstComponentId } : {},
      `Analyzed motion against the 12 fundamental principles of animation — overall score 72/100. Present: slow_in_out, timing, staging. Missing: squash_stretch, anticipation, follow_through. Top suggestion: add anticipation keyframe before the main action.`);
  }

  // --- Apply animation principle ---
  const principleM = userText.match(/\b(add|apply|use)\s+(?:the\s+)?(squash.?and.?stretch|squash.?stretch|anticipation|follow.?through|overlapping.?action|slow.?in.?out|arcs?|secondary.?action|staging|solid.?drawing|appeal|exaggeration)\b/i);
  if (principleM && state.firstComponentId) {
    const principleMap: Record<string, string> = {
      "squash and stretch": "squash_stretch", "squash stretch": "squash_stretch",
      "anticipation": "anticipation", "follow through": "follow_through",
      "overlapping action": "overlapping_action", "slow in out": "slow_in_out",
      "arcs": "arcs", "arc": "arcs", "secondary action": "secondary_action",
      "staging": "staging", "solid drawing": "solid_drawing",
      "appeal": "appeal", "exaggeration": "exaggeration",
    };
    const principle = principleMap[principleM[2].toLowerCase()] ?? "anticipation";
    push("apply_principle", { componentId: state.firstComponentId, principle },
      `Applied ${principle} — modified keyframes to embody the principle. The motion now has richer animation quality.`);
  }

  // --- Synthesize easing curve ---
  if (/\b(synthesize.*easing|feel.*weighty|feel.*light|feel.*dramatic|feel.*playful|feather.?light|weighty.*easing|snappy.*easing|dramatic.*curve|playful.*easing|elegant.*easing|organic.*easing|mechanical.*easing|custom.*bezier|make.*feel.*like)\b/i.test(userText)) {
    push("synthesize_easing", { description: userText.slice(0, 200), format: "bezier" },
      `Synthesized easing curve from description — detected qualities: playful, bouncy. Result: cubic-bezier(0.68, -0.55, 0.265, 1.55). Low damping with high stiffness creates joyful overshoot energy.`);
  }

  // --- Apply choreography pattern ---
  const choreoM = userText.match(/\b(cascade|call.?and.?response|unison|counterpoint|wave.*pattern|canon|stagger.?grid|ripple.?out)\b/i);
  if (choreoM) {
    const patternMap: Record<string, string> = {
      "cascade": "cascade", "call and response": "call_response", "call-and-response": "call_response",
      "unison": "unison", "counterpoint": "counterpoint", "wave": "wave",
      "canon": "canon", "stagger grid": "stagger_grid", "stagger-grid": "stagger_grid",
      "ripple out": "ripple_out", "ripple-out": "ripple_out",
    };
    const pattern = patternMap[choreoM[1].toLowerCase()] ?? "cascade";
    push("apply_choreography", { pattern },
      `Applied ${pattern} choreography — coordinated timing across all components with staggered delays. The group now moves as a cohesive ensemble.`);
  }

  // --- Blend two motions ---
  if (/\b(blend|cross.?fade|mix|hybrid)\b.*\b(motions?|animations?|components?)\b/i.test(userText) && state.firstComponentId && state.secondComponentId) {
    const ratioM = userText.match(/\b(\d+(?:\.\d+)?)\s*(?:%|percent|ratio)(?=\s|$)/i);
    const ratio = ratioM ? Number(ratioM[1]) / 100 : 0.5;
    push("blend_motions",
      { sourceComponentId: state.firstComponentId, targetComponentId: state.secondComponentId, ratio, applyTo: "new" },
      `Blended the two motions at ratio ${ratio.toFixed(2)} — created a new hybrid component.`);
  }

  // --- Interpolate between motions ---
  if (/\b(interpolat\w*|tween|steps?\s*between|intermediate)\b/i.test(userText) && state.firstComponentId && state.secondComponentId) {
    const stepsM = userText.match(/\b(\d+)\s*(?:steps?|frames?)\b/i);
    const steps = stepsM ? Number(stepsM[1]) : 5;
    push("interpolate_motion",
      { sourceComponentId: state.firstComponentId, targetComponentId: state.secondComponentId, steps },
      `Generated ${steps} interpolation steps between the two components.`);
  }

  // --- Merge properties ---
  if (/\b(merge|combine|union|layer together)\b.*\b(properties?|animations?|keyframes?|motions?)\b/i.test(userText) && state.firstComponentId && state.secondComponentId) {
    push("merge_properties",
      { sourceComponentId: state.firstComponentId, targetComponentId: state.secondComponentId, applyTo: "source" },
      `Merged animated properties from both components into one.`);
  }

  // --- Motion Intelligence: emotion, rhythm, narrative ---
  if (/\b(emotion|emotional|how.*feel|what.*feel|convey.*emotion|mood.*impact|emotional.*impact)\b/i.test(userText)) {
    push("analyze_emotion", { projectId: "" },
      "Analyzed the emotional impact of the motion composition.");
  }
  if (/\b(rhythm|tempo|\bbeat\b|groove|cadence|\bpulse\b|syncopat|accelerando|decelerando|\bbpm\b)\b/i.test(userText)) {
    push("analyze_rhythm", { projectId: "" },
      "Analyzed the visual rhythm of the motion composition.");
  }
  if (/\b(narrative|story.*arc|storytelling|pacing|story.*beat|act.*structure|climax|\bplot\b|coherence)\b/i.test(userText)) {
    push("analyze_narrative", { projectId: "" },
      "Analyzed the narrative coherence of the motion composition.");
  }

  // --- Adaptive Motion: adapt for device/viewport, preview, responsive CSS ---
  if (/\b(responsive.*css|css.*responsive|generate.*css|export.*css|media.*query|@media)\b/i.test(userText)) {
    push("generate_responsive_css", { projectId: "" },
      "Generated responsive CSS with media queries for all breakpoints.");
  } else if (/\b(preview.*adapt|how.*look.*mobile|what.*change.*tablet|responsive.*preview|adapt.*preview)\b/i.test(userText)) {
    push("preview_adaptations", { projectId: "" },
      "Previewed motion adaptations across desktop, tablet, mobile, and small breakpoints.");
  } else if (/\b(adapt|responsive|mobile|tablet|viewport|breakpoint|reduce.*motion|accessibility.*motion|degrade|device|performance.*tier)\b/i.test(userText)) {
    const device = /\bmobile\b/i.test(userText) ? "mobile" : /\btablet\b/i.test(userText) ? "tablet" : /\btv\b/i.test(userText) ? "tv" : "desktop";
    const w = device === "mobile" ? 375 : device === "tablet" ? 768 : device === "tv" ? 1920 : 1440;
    const h = device === "mobile" ? 667 : device === "tablet" ? 1024 : device === "tv" ? 1080 : 900;
    const perf = /\blow\b/i.test(userText) ? "low" : /\bmedium\b/i.test(userText) ? "medium" : "high";
    const access = /\breduce/i.test(userText) ? "reduced" : /\bminimal/i.test(userText) ? "minimal" : "full";
    const apply = /\bapply\b/i.test(userText);
    push("adapt_motion", {
      projectId: "", device, viewportWidth: w, viewportHeight: h,
      performance: perf, accessibility: access, connectionSpeed: "fast", batteryLevel: 1, apply,
    }, `Adapted the motion for ${device} (${w}x${h}), ${access} motion, ${perf} performance.`);
  }

  // --- Motion Synthesis: generative patterns, morphing, custom waveforms ---
  if (/\b(morph.*to|morph.*into|transition.*into|gradually.*become)\b/i.test(userText)) {
    const patternM = userText.match(/\b(heartbeat|breathing|walk.?cycle|bounce.?ball|pendulum|ocean.?wave|tremor|fidget|shake.?violent|sway.?gentle|orbit.?elliptical)\b/i);
    const pattern = patternM ? patternM[1].replace(/\s+/g, "-").toLowerCase() : "heartbeat";
    push("morph_to_pattern", { projectId: "", targetPattern: pattern, morphSteps: 5 },
      `Morphed the existing motion toward the ${pattern} pattern in 5 steps.`);
  } else if (/\b(sine|square|triangle|sawtooth|pulse|noise)\s*wave\b|custom.*waveform/i.test(userText)) {
    const wfM = userText.match(/\b(sine|square|triangle|sawtooth|pulse|noise)\s*wave\b/i);
    const wf = wfM ? wfM[1].toLowerCase() : "sine";
    const propM = userText.match(/\b(translateX|translateY|scale|rotate|opacity)\b/i);
    const prop = propM ? propM[1] : "translateY";
    const ampM = userText.match(/amplitude\s*(\d+(?:\.\d+)?)/i);
    const freqM = userText.match(/frequency\s*(\d+(?:\.\d+)?)/i);
    push("synthesize_waveform", {
      projectId: "", waveform: wf, amplitude: ampM ? Number(ampM[1]) : 20,
      frequency: freqM ? Number(freqM[1]) : 1, property: prop, durationMs: 1000,
    }, `Synthesized a ${wf} wave on ${prop}.`);
  } else if (/\b(synthesize|generative.*pattern|heartbeat|breathing|walk.?cycle|bounce.?ball|pendulum|ocean.?wave|tremor|fidget|sway|orbit.*elliptical|shake.*violent)\b/i.test(userText)) {
    const patternM = userText.match(/\b(heartbeat|breathing|walk.?cycle|bounce.?ball|pendulum|ocean.?wave|tremor|fidget|shake.?violent|sway.?gentle|orbit.?elliptical)\b/i);
    const pattern = patternM ? patternM[1].replace(/\s+/g, "-").toLowerCase() : "heartbeat";
    push("synthesize_motion", { projectId: "", pattern },
      `Synthesized a ${pattern} motion pattern.`);
  }

  // --- Storytelling: story arcs, pacing analysis, plan application ---
  if (/\b(pacing.*analysis|tempo.*curve|check.*pacing|pacing.*review|story.*rhythm|dramatic.*timing)\b/i.test(userText)) {
    push("analyze_pacing", { projectId: "" },
      "Analyzed the pacing of the story arc — tempo curve, slow/fast segments, and recommendations.");
  } else if (/\b(apply.*story|align.*story.*beat|time.*component.*arc|apply.*hero.*journey|apply.*story.*plan)\b/i.test(userText)) {
    const genreM = userText.match(/\b(hero|mystery|romance|comedy|thriller|documentary|fantasy|horror)\b/i);
    const genre = genreM ? genreM[1].toLowerCase() : "hero";
    const apply = /\bapply\b/i.test(userText);
    push("apply_story_plan", { projectId: "", genre, totalDurationMs: 10000, apply },
      `Applied the ${genre} story plan to align component timing with story beats.`);
  } else if (/\b(story.*arc|storytelling|hero.*journey|narrative.*structure|genre.*template|romance.*arc|comedy.*rhythm|mystery.*unfolding|fantasy.*quest|horror.*descent|documentary.*flow)\b/i.test(userText)) {
    const genreM = userText.match(/\b(hero|mystery|romance|comedy|thriller|documentary|fantasy|horror)\b/i);
    const genre = genreM ? genreM[1].toLowerCase() : "hero";
    push("create_story_arc", { projectId: "", genre, totalDurationMs: 10000 },
      `Created a ${genre} story arc with beats, emotional tones, and pacing analysis.`);
  }

  // --- Create variant ---
  if (/\b(variant|variation|alternative|try.*different|what.*look.*with)\b|变体|变奏|试试/i.test(userText)) {
    if (state.firstComponentId) {
      const variantEasing = /smooth|平滑/.test(userText) ? { type: "preset", name: "ease-in-out" } : /snappy|干脆/.test(userText) ? { type: "preset", name: "ease-in" } : undefined;
      const variantDur = parseDuration(userText, 0) || undefined;
      push("create_variant", { componentId: state.firstComponentId, easing: variantEasing, durationMs: variantDur }, "Created a variation so you can compare side by side.");
    }
  }

  // --- Style presets: apply coordinated aesthetic across all components ---
  const styleM = userText.match(/\b(playful|energetic|calm|professional|dramatic|minimal|cinematic|glassy|retro|futuristic|organic|mechanical|luxury|industrial|neon|vintage|athletic)\b/i);
  if (styleM) {
    // Auto-create a component on empty projects so style application has a target.
    ensureComponent();
    push("apply_style", { styleId: styleM[1].toLowerCase() },
      `Applied the ${styleM[1].toLowerCase()} style across all components for a coherent feel.`);
  }

  // --- Pattern recognition: identify design patterns ---
  if (/\b(patterns?|composition balanced|what.s missing|monoton\w*|balance|coherent)\b/i.test(userText) && state.firstComponentId) {
    push("recognize_pattern", {}, "Here are the motion design patterns I detected in your project.");
  }

  // --- Color harmony: apply color theory ---
  if (/\b(harmoniz\w*|color scheme|colors work together|palette|color theory)\b/i.test(userText) && state.firstComponentId) {
    const schemeM = userText.match(/\b(complementary|analogous|triadic|monochrome)\b/i);
    const scheme = schemeM ? schemeM[1].toLowerCase() : "analogous";
    push("harmonize_colors", { scheme },
      `Harmonized all component colors using a ${scheme} color scheme.`);
  }

  // --- Choreography: multi-component sequencing ---
  if (/\b(choreograph|orchestrat|wave pattern|ripple effect|cascade|canon|converge|spiral|explosion|assembly|breathing|domino|scatter)\b/i.test(userText) && state.firstComponentId) {
    const patternM = userText.match(/\b(cascade|wave|ripple|canon|converge|spiral|explosion|assembly|breathing|domino|scatter)\b/i);
    const pattern = patternM ? patternM[1].toLowerCase() : "cascade";
    const stepM = userText.match(/(\d+)\s*ms/);
    const stepMs = stepM ? Number(stepM[1]) : 150;
    push("choreograph", { pattern, stepMs },
      `Choreographed all components with a ${pattern} pattern.`);
  }

  // --- Motion refinement: qualitative descriptors ---
  const refineM = userText.match(/\b(snappier|smoother|more dramatic|calmer|subtler|more energetic|bouncier|softer)\b/i);
  if (refineM && state.firstComponentId) {
    const refinement = refineM[1].toLowerCase().replace(/\s+/g, "-");
    push("refine_motion", { refinement },
      `Refined the motion to be ${refinement}.`);
  }

  // --- Custom bezier easing ---
  const bezierM = userText.match(/\b(?:custom.*easing|bezier|cubic.bezier)\b/i);
  if (bezierM && state.firstComponentId) {
    const nums = userText.match(/-?\d+\.?\d*/g);
    const x1 = nums && nums.length >= 4 ? Number(nums[0]) : 0.4;
    const y1 = nums && nums.length >= 4 ? Number(nums[1]) : 0;
    const x2 = nums && nums.length >= 4 ? Number(nums[2]) : 0.2;
    const y2 = nums && nums.length >= 4 ? Number(nums[3]) : 1;
    push("set_custom_bezier", { componentId: state.firstComponentId, x1, y1, x2, y2 },
      `Set custom bezier easing (${x1}, ${y1}, ${x2}, ${y2}).`);
  }

  // --- Keyframe interpolation ---
  if (/\b(hold|linear interpolation|step.*keyframe)\b/i.test(userText) && state.firstComponentId) {
    const interp = /hold/i.test(userText) ? "hold" : "linear";
    push("set_interpolation", { componentId: state.firstComponentId, keyframeIndex: 0, interpolation: interp },
      `Set keyframe 0 interpolation to ${interp}.`);
  }

  // --- Add property keyframe ---
  const addKfM = userText.match(/\b(?:add|keyframe)\s+(?:a\s+)?keyframe\s+(?:for\s+)?(\w+)/i);
  if (addKfM && state.firstComponentId) {
    const property = addKfM[1].toLowerCase();
    const offsetM = userText.match(/(\d+)%/) ?? userText.match(/offset\s+(\d+\.?\d*)/);
    const offset = offsetM ? Number(offsetM[1]) / 100 : 0.5;
    push("add_property_keyframe",
      { componentId: state.firstComponentId, property, offset, value: 0 },
      `Added ${property} keyframe at offset ${offset}.`);
  }

  // --- Remove keyframe ---
  if (/\b(remove|delete)\s+keyframe\b/i.test(userText) && state.firstComponentId) {
    const idxM = userText.match(/keyframe\s+(\d+)/i);
    const keyframeIndex = idxM ? Number(idxM[1]) : 0;
    push("remove_keyframe", { componentId: state.firstComponentId, keyframeIndex },
      `Removed keyframe ${keyframeIndex}.`);
  }

  // --- Trigger settings ---
  const triggerM = userText.match(/\b(on click|on hover|on scroll|on load|after delay)\b/i);
  if (triggerM && state.firstComponentId) {
    const triggerMap: Record<string, string> = {
      "on click": "onClick",
      "on hover": "onHover",
      "on scroll": "onScroll",
      "on load": "onLoad",
      "after delay": "afterDelay",
    };
    const trigger = triggerMap[triggerM[1].toLowerCase()];
    if (trigger) {
      push("set_trigger", { componentId: state.firstComponentId, trigger },
        `Set the animation to trigger ${triggerM[1].toLowerCase()}.`);
    }
  }

  // --- Onion skinning ---
  if (/\b(onion.*skins?|ghost frame|motion trail|show.*trail)/i.test(userText)) {
    const enabled = !/\b(off|disable|turn off|hide)\b/i.test(userText);
    push("set_onion_skin", { enabled, frames: 3, opacity: 0.25 },
      enabled ? "Enabled onion skinning — ghost frames are now visible on the canvas." : "Disabled onion skinning.");
  }

  // --- Fullscreen preview ---
  if (/\b(fullscreen|full screen|present|present mode|big preview)\b/i.test(userText)) {
    push("preview_fullscreen", {},
      "Opening fullscreen preview — press Esc or click outside to exit.");
  }

  // --- Canvas view control ---
  // Accept "zoom to fit", "fit to screen", "zoom in/out", "reset view", etc.
  if (/\b(zoom\s*(in|out|to\s*fit)|fit\s*(?:to\s*)?(?:screen|view)|frame.*select|reset.*view|pan\s*canvas)\b/i.test(userText)) {
    const args: Record<string, unknown> = {};
    if (/\bfit\b/i.test(userText) || /\breset.*view\b/i.test(userText)) args.fit = true;
    const zoomM = userText.match(/zoom\s*(?:to)?\s*(\d+(?:\.\d+)?)\s*%?/i);
    if (zoomM) args.zoom = Number(zoomM[1]) / 100;
    if (/\bzoom\s*in\b/i.test(userText) && !zoomM) args.zoom = 1.5;
    if (/\bzoom\s*out\b/i.test(userText) && !zoomM) args.zoom = 0.5;
    push("set_canvas_view", args,
      args.fit ? "Reset the canvas to fit the screen." : `Adjusted canvas zoom to ${Math.round((args.zoom as number ?? 1) * 100)}%.`);
  }

  // --- Layer lock ---
  if (/\block\b/i.test(userText) && state.firstComponentId) {
    const locked = !/\bunlock\b/i.test(userText);
    push("lock_layer", { componentId: state.firstComponentId, locked },
      locked ? "Locked the selected layer — it can't be selected or edited." : "Unlocked the layer.");
  }

  // --- Z-order ---
  if (/\b(bring.*front|send.*back|move.*forward|move.*backward|to.?front|to.?back)\b/i.test(userText) && state.firstComponentId) {
    let action = "forward";
    if (/\bbring.*front|to.?front\b/i.test(userText)) action = "to-front";
    else if (/\bsend.*back|to.?back\b/i.test(userText)) action = "to-back";
    else if (/\bforward\b/i.test(userText)) action = "forward";
    else if (/\bbackward\b/i.test(userText)) action = "backward";
    push("set_z_order", { componentId: state.firstComponentId, action },
      `Moved the layer ${action.replace("-", " ")}.`);
  }

  // --- Transform props ---
  if (/\b(set.*position|set.*x\b|set.*y\b|set.*width|set.*height|rotate.*\d+|resize.*to)\b/i.test(userText) && state.firstComponentId) {
    const args: Record<string, unknown> = { componentId: state.firstComponentId };
    const xM = userText.match(/\bx\s*(?::|to|=)?\s*(-?\d+(?:\.\d+)?)/i);
    if (xM) args.x = Number(xM[1]);
    const yM = userText.match(/\by\s*(?::|to|=)?\s*(-?\d+(?:\.\d+)?)/i);
    if (yM) args.y = Number(yM[1]);
    const wM = userText.match(/\b(?:width|w)\s*(?::|to|=)?\s*(\d+(?:\.\d+)?)/i);
    if (wM) args.width = Number(wM[1]);
    const hM = userText.match(/\b(?:height|h)\s*(?::|to|=)?\s*(\d+(?:\.\d+)?)/i);
    if (hM) args.height = Number(hM[1]);
    const rotM = userText.match(/(?:rotate|rotation)\s*(?::|to|=)?\s*(-?\d+(?:\.\d+)?)\s*deg/i);
    if (rotM) args.rotation = Number(rotM[1]);
    push("set_transform_props", args,
      `Updated transform properties (${Object.keys(args).filter((k) => k !== "componentId").join(", ")}).`);
  }

  // --- Align components ---
  if (/\b(align|distribute)\b/i.test(userText) && state.componentIds.length >= 2) {
    let align = "left";
    if (/\bright\b/i.test(userText)) align = "right";
    else if (/\bcenter\b/i.test(userText)) align = "center";
    else if (/\btop\b/i.test(userText)) align = "top";
    else if (/\bmiddle\b/i.test(userText)) align = "middle";
    else if (/\bbottom\b/i.test(userText)) align = "bottom";
    else if (/\bdistribute.*h|distribute.*horizontal/i.test(userText)) align = "distribute-h";
    else if (/\bdistribute.*v|distribute.*vertical/i.test(userText)) align = "distribute-v";
    push("align_components", { componentIds: state.componentIds, align },
      `Aligned ${state.componentIds.length} components ${align}.`);
  }

  // --- Playback range ---
  if (/\b(playback.*range|set.*range|trim|loop.*range|clear.*range)\b/i.test(userText)) {
    if (/\bclear.*range\b/i.test(userText)) {
      push("set_playback_range", { clear: true }, "Cleared the playback range.");
    } else {
      const msMatches = userText.match(/(\d+)\s*ms/g);
      const startMs = msMatches && msMatches.length >= 1 ? Number(msMatches[0].replace(/\s*ms/, "")) : 0;
      const endMs = msMatches && msMatches.length >= 2 ? Number(msMatches[1].replace(/\s*ms/, "")) : 2000;
      push("set_playback_range", { startMs, endMs },
        `Set playback range from ${startMs}ms to ${endMs}ms.`);
    }
  }

  // --- Select components ---
  if (/\b(select.*all|select.*everything|multi.?select)\b/i.test(userText) && state.componentIds.length > 0) {
    push("select_components", { componentIds: state.componentIds, clear: true },
      `Selected all ${state.componentIds.length} components.`);
  }

  // --- Toggle snap ---
  if (/\b(snap.*grid|toggle.*snap|magnet)\b/i.test(userText)) {
    const enabled = !/\b(off|disable|turn off)\b/i.test(userText);
    const sizeM = userText.match(/(?:size|grid)\s*(\d+)/i);
    push("toggle_snap", { enabled, ...(sizeM ? { size: Number(sizeM[1]) } : {}) },
      enabled ? "Enabled snap-to-grid." : "Disabled snap-to-grid.");
  }

  // --- Add shape ---
  const shapeM = userText.match(/\b(?:add|create)\s+(?:a\s+)?(rectangle|circle|text|triangle|star|pentagon|polygon|line|arrow)\b/i);
  if (shapeM) {
    const shape = shapeM[1].toLowerCase() === "pentagon" ? "polygon" : shapeM[1].toLowerCase();
    push("add_shape", { shape },
      `Added a ${shape} shape to the canvas.`);
  }

  // --- Add image / video / audio media layers ---
  if (/\b(?:add|insert|place|drop)\s+(?:an?\s+)?image\b|添加.*图片/i.test(userText)) {
    const srcM = userText.match(/(?:src|url|from)\s*[:=]?\s*(\S+)/i);
    push("add_image", { src: srcM ? srcM[1] : "https://example.com/image.png", alt: "Image" },
      "Added an image layer to the canvas.");
  }
  if (/\b(?:add|insert|place|drop)\s+(?:a\s+|an\s+)?video\b|添加.*视频/i.test(userText)) {
    const srcM = userText.match(/(?:src|url|from)\s*[:=]?\s*(\S+)/i);
    push("add_video", { src: srcM ? srcM[1] : "https://example.com/video.mp4", autoplay: false, muted: true },
      "Added a video layer to the canvas.");
  }
  if (/\b(?:add|insert|place)\s+(?:an?\s+)?audio\b|添加.*音频|添加.*音乐/i.test(userText)) {
    const srcM = userText.match(/(?:src|url|from)\s*[:=]?\s*(\S+)/i);
    push("add_audio", { src: srcM ? srcM[1] : "https://example.com/audio.mp3", autoplay: false, loop: false },
      "Added an audio track to the timeline.");
  }
  if (/\b(?:typewriter|type.?writer)\s+(?:text|effect|animation)\b|打字机/i.test(userText)) {
    const textM = userText.match(/(?:text|saying|reading)\s*["']([^"']+)["']/i);
    push("add_typewriter_text", { text: textM ? textM[1] : "Typewriter text", speedMs: 80 },
      "Added a typewriter text effect.");
  }

  // --- Set blend mode ---
  const blendM = userText.match(/\b(?:set\s+)?(?:blend\s+mode|mix.*blend|blend\s+with)\s+(?:to\s+)?(normal|multiply|screen|overlay|darken|lighten|color.?dodge|color.?burn|hard.?light|soft.?light|difference|exclusion|hue|saturation|color|luminosity)\b/i);
  if (blendM && state.firstComponentId) {
    const mode = blendM[1].toLowerCase().replace(/\s/g, "-");
    push("set_blend_mode", { componentId: state.firstComponentId, blendMode: mode },
      `Set blend mode to ${mode}.`);
  } else if (/\b(blend.*mode|mix.*blend)\b/i.test(userText) && state.firstComponentId) {
    const modeM = userText.match(/\b(normal|multiply|screen|overlay|darken|lighten|difference|exclusion|hue|saturation|color|luminosity)\b/i);
    if (modeM) {
      push("set_blend_mode", { componentId: state.firstComponentId, blendMode: modeM[1].toLowerCase() },
        `Set blend mode to ${modeM[1].toLowerCase()}.`);
    }
  }

  // --- Set artboard ---
  if (/\b(canvas|artboard)\b/i.test(userText)) {
    const sizeM = userText.match(/(\d{3,4})\s*[x×by]\s*(\d{3,4})/i);
    const wM = userText.match(/(?:width|wide|wider)\s*(\d{3,4})/i);
    const hM = userText.match(/(?:height|tall|taller)\s*(\d{3,4})/i);
    const bgM = userText.match(/(?:background|bg)\s*(?:to\s+)?(#[0-9a-f]{3,8}|black|white|red|green|blue|gray|grey|transparent)/i);
    const patch: Record<string, number | string> = {};
    if (sizeM) { patch.width = Number(sizeM[1]); patch.height = Number(sizeM[2]); }
    if (wM) patch.width = Number(wM[1]);
    if (hM) patch.height = Number(hM[1]);
    if (bgM) {
      const bg = bgM[1].toLowerCase();
      patch.background = bg === "black" ? "#0a0a0a" : bg === "white" ? "#ffffff" : bg === "transparent" ? "transparent" : bg;
    }
    if (Object.keys(patch).length > 0) {
      push("set_artboard", patch, `Updated artboard: ${Object.entries(patch).map(([k,v]) => `${k}=${v}`).join(", ")}.`);
    }
  }

  // --- Layer opacity ---
  if (/\b(set.*opacity|layer.*opacity|opacity.*to|make.*transparent|make.*opaque)\b/i.test(userText) && state.firstComponentId) {
    const pctM = userText.match(/(\d+(?:\.\d+)?)\s*%/);
    const decM = userText.match(/opacity\s*(?::|to|=)?\s*(0?\.\d+|1\.0|0|1)/i);
    const opacity = pctM ? Number(pctM[1]) / 100 : decM ? Number(decM[1]) : 0.5;
    push("set_layer_opacity", { componentId: state.firstComponentId, opacity },
      `Set layer opacity to ${Math.round(opacity * 100)}%.`);
  }

  // --- Rulers ---
  // Accept both singular "ruler" and plural "rulers".
  if (/\b(rulers?|toggle.*rulers?|show.*rulers?|hide.*rulers?)\b/i.test(userText)) {
    const show = !/\b(hide|off|disable)\b/i.test(userText);
    push("set_rulers", { show },
      show ? "Showing canvas rulers." : "Hiding canvas rulers.");
  }

  // --- Nudge component ---
  if (/\b(nudge|move by|shift by|pixel.*move)\b/i.test(userText) && state.firstComponentId) {
    let dx = 0;
    let dy = 0;
    const nudgeM = userText.match(/(-?\d+)\s*px\s*(right|left|down|up|→|←|↓|↑)/i)
      || userText.match(/(right|left|down|up|→|←|↓|↑)\s*(-?\d+)\s*px/i)
      || userText.match(/\bby\s*(-?\d+)\s*(?:px)?\s*(right|left|down|up)/i);
    if (nudgeM) {
      const val = Number(nudgeM[1]);
      const dir = (nudgeM[2] || "").toLowerCase();
      if (dir === "right" || dir === "→") dx = val;
      else if (dir === "left" || dir === "←") dx = -val;
      else if (dir === "down" || dir === "↓") dy = val;
      else if (dir === "up" || dir === "↑") dy = -val;
    } else {
      if (/\bright\b|→/i.test(userText)) dx = 10;
      else if (/\bleft\b|←/i.test(userText)) dx = -10;
      else if (/\bdown\b|↓/i.test(userText)) dy = 10;
      else if (/\bup\b|↑/i.test(userText)) dy = -10;
      const numM = userText.match(/(-?\d+)/);
      if (numM && (dx !== 0 || dy !== 0)) {
        const n = Number(numM[1]);
        if (dx !== 0) dx = Math.sign(dx) * Math.abs(n);
        if (dy !== 0) dy = Math.sign(dy) * Math.abs(n);
      }
    }
    if (dx !== 0 || dy !== 0) {
      push("nudge_component", { componentId: state.firstComponentId, dx, dy },
        `Nudged the component by (${dx}, ${dy}) pixels.`);
    }
  }

  // --- Copy to clipboard ---
  if (/\b(copy to clipboard|copy selection|copy this|copy the selection)\b/i.test(userText)) {
    push("copy_to_clipboard", {},
      "Copied the selection to the clipboard.");
  }

  // --- Paste from clipboard ---
  if (/\b(paste from clipboard|paste here|paste a copy|paste it)\b/i.test(userText)) {
    const xM = userText.match(/\bx\s*(?::|to|=)?\s*(\d+)/i);
    const yM = userText.match(/\by\s*(?::|to|=)?\s*(\d+)/i);
    const args: Record<string, unknown> = {};
    if (xM) args.x = Number(xM[1]);
    if (yM) args.y = Number(yM[1]);
    push("paste_from_clipboard", args,
      "Pasted from the clipboard.");
  }

  // --- Capture state ---
  if (/\b(capture.*state|save.*state|snapshot)\b/i.test(userText)) {
    const nameM = userText.match(/(?:called|named|as)\s*["']?(\w+)/i) || userText.match(/snapshot\s+(\w+)/i);
    const name = nameM ? nameM[1] : "State 1";
    push("capture_state", { name },
      `Captured the current state as "${name}".`);
  }

  // --- Apply state ---
  if (/\b(apply.*state|go to state|switch to state|restore state)\b/i.test(userText)) {
    push("apply_state", { stateId: "st_placeholder" },
      "Applied the requested state. (Use list_states to see available state IDs.)");
  }

  // --- Add transition ---
  if (/\b(add\s+(?:a\s+)?transition|connect states|transition from)\b/i.test(userText)) {
    const trigM = userText.match(/\b(on click|on hover|on load|manual)\b/i);
    const triggerMap: Record<string, string> = {
      "on click": "onClick",
      "on hover": "onHover",
      "on load": "onLoad",
      "manual": "manual",
    };
    const trigger = trigM ? triggerMap[trigM[1].toLowerCase()] : "manual";
    const durM = userText.match(/(\d+)\s*ms/);
    const durationMs = durM ? Number(durM[1]) : 500;
    push("add_transition", { fromStateId: "st_placeholder", toStateId: "st_placeholder2", trigger, durationMs },
      `Added a transition (${trigger}, ${durationMs}ms).`);
  }

  // --- List states ---
  if (/\b(list states|show states|what states|state machine info)\b/i.test(userText)) {
    push("list_states", {},
      "Here are the states and transitions in the state machine.");
  }

  // --- Remove state ---
  if (/\b(remove state|delete state)\b/i.test(userText)) {
    push("remove_state", { stateId: "st_placeholder" },
      "Removed the state from the state machine.");
  }

  // --- Auto-keyframe ---
  if (/\b(auto.?keyframe|auto.?key|keyframe.*mode|record.*keyframe)\b/i.test(userText)) {
    const enabled = !/\b(off|disable|turn off|stop)\b/i.test(userText);
    push("toggle_auto_keyframe", { enabled },
      enabled ? "Auto-keyframe enabled — property changes will create keyframes at the playhead." : "Auto-keyframe disabled.");
  }

  // --- Add listener ---
  if (/\b(add|create|attach).*listener\b/i.test(userText) && state.firstComponentId) {
    const evtM = userText.match(/\b(click|hover|pointer enter|pointer leave|pointer down|pointer up|enter|leave|down|up)\b/i);
    const evtMap: Record<string, string> = {
      click: "click", hover: "pointerEnter", enter: "pointerEnter", leave: "pointerLeave",
      down: "pointerDown", up: "pointerUp",
      "pointer enter": "pointerEnter", "pointer leave": "pointerLeave",
      "pointer down": "pointerDown", "pointer up": "pointerUp",
    };
    const eventType = evtM ? (evtMap[evtM[1].toLowerCase()] ?? "click") : "click";
    let actionType = "setProperty";
    if (/\bplay/i.test(userText) && /\banim/i.test(userText)) actionType = "playAnimation";
    else if (/\bapply\b.*\bstate\b/i.test(userText)) actionType = "applyState";
    else if (/\bset\b.*\bprop/i.test(userText)) actionType = "setProperty";
    push("add_listener", { componentId: state.firstComponentId, eventType, actionType, target: state.firstComponentId },
      `Added a ${eventType} listener that triggers ${actionType}.`);
  }

  // --- Remove listener ---
  if (/\b(remove|delete).*listeners?\b/i.test(userText)) {
    push("remove_listener", { listenerId: "ls_placeholder" }, "Removed the listener.");
  }

  // --- List listeners ---
  if (/\b(list|show|what).*listeners?\b/i.test(userText)) {
    push("list_listeners", {}, "Here are the event listeners in the project.");
  }

  // --- Set keyframe offset ---
  if (/\b(move.*keyframe|retime.*keyframe|keyframe.*offset|shift.*keyframe)\b/i.test(userText) && state.firstComponentId) {
    const idxM = userText.match(/keyframe\s+(\d+)/i);
    const keyframeIndex = idxM ? Number(idxM[1]) : 0;
    const offsetM = userText.match(/(?:to|at)\s*(\d+(?:\.\d+)?)\s*%?/i);
    const offset = offsetM ? Math.min(1, Math.max(0, Number(offsetM[1]) / 100)) : 0.5;
    push("set_keyframe_offset", { componentId: state.firstComponentId, keyframeIndex, offset },
      `Moved keyframe ${keyframeIndex} to offset ${offset.toFixed(2)}.`);
  }

  // --- Add marker ---
  if (/\b(add.*marker|mark.*position|bookmark|flag.*time)\b/i.test(userText)) {
    const timeM = userText.match(/(\d+(?:\.\d+)?)\s*(?:ms|millisecond)?/i);
    const timeMs = timeM ? Number(timeM[1]) : 500;
    const labelM = userText.match(/(?:called|named|label)\s*["']?(\w+)/i);
    push("add_marker", { timeMs, label: labelM ? labelM[1] : undefined },
      `Added a marker at ${timeMs}ms.`);
  }

  // --- Remove marker ---
  if (/\b(remove|delete).*markers?\b/i.test(userText)) {
    push("remove_marker", { markerId: "mk_placeholder" }, "Removed the marker.");
  }

  // --- List markers ---
  if (/\b(list|show|what).*markers?\b/i.test(userText)) {
    push("list_markers", {}, "Here are the timeline markers.");
  }

  // --- Reverse keyframes ---
  if (/\b(reverse.*keyframes?|play.*backward|flip.*keyframes?|mirror.*keyframes?)\b/i.test(userText) && state.firstComponentId) {
    push("reverse_keyframes", { componentId: state.firstComponentId },
      "Reversed the keyframe order so the animation plays backward.");
  }

  // --- Z-index ---
  if (/\b(bring.*forward|send.*backward|bring.*front|send.*back|move.*front|move.*back)\b/i.test(userText) && state.firstComponentId) {
    const act = /\bfront\b/i.test(userText) && !/\bforward\b/i.test(userText) ? "to-front"
      : /\bback\b/i.test(userText) && !/\bbackward\b/i.test(userText) ? "to-back"
      : /\bforward\b/i.test(userText) ? "forward" : "backward";
    push("set_z_order", { componentId: state.firstComponentId, action: act },
      act === "to-front" ? "Brought the layer to the front." : act === "to-back" ? "Sent the layer to the back." : act === "forward" ? "Brought the layer forward." : "Sent the layer backward.");
  }

  // --- Solo layer ---
  if (/\b(solo|isolate)\b/i.test(userText) && state.firstComponentId) {
    push("solo_layer", { componentId: state.firstComponentId },
      "Soloed the layer — all others are hidden.");
  }

  // --- Hierarchy: parent/child/rig ---
  if (/\b(parent|rig|bone|attach|nest)\b/i.test(userText) && !/\b(list|show|tree|detach|remove)\b/i.test(userText)) {
    if (state.firstComponentId && state.secondComponentId) {
      push("set_parent", { componentId: state.secondComponentId, parentId: state.firstComponentId },
        `Nested the second layer under the first — transforms now inherit from the parent.`);
    }
  }
  if (/\b(detach|remove parent|orphan)\b/i.test(userText) && state.firstComponentId) {
    push("remove_parent", { componentId: state.firstComponentId },
      "Detached the layer from its parent.");
  }
  if (/\b(list|show).*(hierarchy|tree|parent)\b/i.test(userText)) {
    push("list_hierarchy", {}, "Here's the current layer hierarchy tree.");
  }

  // --- Constraints ---
  if (/\b(constraint|constrain|pin|look.?at)\b/i.test(userText) && !/\b(list|show|remove|delete)\b/i.test(userText)) {
    if (state.firstComponentId && state.secondComponentId) {
      const ctype = /look.?at/i.test(userText) ? "look-at" : /rotation/i.test(userText) ? "rotation" : /scale/i.test(userText) ? "scale" : "position";
      push("add_constraint", { componentId: state.firstComponentId, targetId: state.secondComponentId, type: ctype, strength: 1, axis: "both" },
        `Added a ${ctype} constraint linking the two layers.`);
    }
  }
  if (/\b(list|show).*(constraints?)\b/i.test(userText)) {
    push("list_constraints", {}, "Here are all constraints in the project.");
  }
  if (/\b(remove|delete|clear)\s+(?:the\s+)?(?:constraint|pin)\b|删除.*约束/i.test(userText)) {
    push("remove_constraint", { componentId: state.firstComponentId ?? "", targetId: state.secondComponentId ?? "" },
      "Removed the constraint between the selected layers.");
  }

  // --- Timeline clips ---
  if (/\b(clip|segment)\b/i.test(userText) && !/\b(list|show|remove|delete|play)\b/i.test(userText)) {
    push("add_clip", { name: "Clip 1", startMs: 0, endMs: 1000 },
      "Created a new timeline clip from 0ms to 1000ms.");
  }
  if (/\b(list|show).*(clips?)\b/i.test(userText)) {
    push("list_clips", {}, "Here are all timeline clips.");
  }
  if (/\bplay.*(clips?)\b/i.test(userText)) {
    push("play_clip", { clipId: "clip_demo" }, "Playing the timeline clip.");
  }
  if (/\b(remove|delete|clear)\s+(?:the\s+)?(?:clip|segment)\b|删除.*剪辑/i.test(userText)) {
    push("remove_clip", { clipId: "clip_demo" },
      "Removed the timeline clip.");
  }

  // --- CSS filters / shader effects ---
  if (/\b(blur|brightness|contrast|hue.?rotate|saturate|grayscale|sepia)\b/i.test(userText) && state.firstComponentId) {
    const filterName = /blur/i.test(userText) ? "blur"
      : /brightness/i.test(userText) ? "brightness"
      : /contrast/i.test(userText) ? "contrast"
      : /hue/i.test(userText) ? "hue-rotate"
      : /saturate/i.test(userText) ? "saturate"
      : /grayscale/i.test(userText) ? "grayscale" : "sepia";
    const val = filterName === "blur" ? "4px" : filterName === "hue-rotate" ? "90deg" : "1.5";
    push("set_filter", { componentId: state.firstComponentId, filter: filterName, value: val },
      `Applied ${filterName}(${val}) to the layer.`);
  }

  // --- 3D transforms ---
  if (/\b(3d|perspective|rotateX|rotateY|rotateZ|translateZ)\b/i.test(userText) && state.firstComponentId) {
    push("set_3d_transform", {
      componentId: state.firstComponentId,
      perspective: 800,
      rotateX: /rotateX/i.test(userText) ? 45 : undefined,
      rotateY: /rotateY/i.test(userText) ? 45 : undefined,
      rotateZ: /rotateZ/i.test(userText) ? 30 : undefined,
      translateZ: /translateZ/i.test(userText) ? 50 : undefined,
    }, "Applied a 3D transform to the layer.");
  }

  // ---Motion Blur ---
  // Recognises "enable motion blur", "add motion blur", "turn on motion blur",
  // "blur the motion", "motion blur the layer", and "streak".
  if (/\b(?:enable|add|turn\s+on|apply|use)\s+(?:a\s+)?(?:motion[\s-]?blur|streak)|motion[\s-]?blur\b/i.test(userText)) {
    const target = ensureComponent();
    // Allow intensity overrides like "heavy motion blur" / "subtle motion blur".
    let intensity = 4;
    if (/\b(?:heavy|strong|extreme|max(?:imum)?)\b/i.test(userText)) intensity = 10;
    else if (/\b(?:subtle|light|gentle|min(?:imal)?)\b/i.test(userText)) intensity = 2;
    let shutterAngle: number | undefined;
    if (/\b360\b/.test(userText)) shutterAngle = 360;
    else if (/\b180\b/.test(userText)) shutterAngle = 180;
    else if (/\b45\b/.test(userText)) shutterAngle = 45;
    push("enable_motion_blur", {
      componentId: target,
      intensity,
      ...(shutterAngle != null ? { shutterAngle } : {}),
      enabled: true,
    }, `Enabled motion blur on the layer (intensity=${intensity}px${shutterAngle != null ? `, shutter=${shutterAngle}°` : ""}).`);
  } else if (/\b(?:disable|turn\s+off|remove)\s+(?:the\s+)?(?:motion[\s-]?blur|streak)\b/i.test(userText) && state.firstComponentId) {
    push("enable_motion_blur", { componentId: state.firstComponentId, enabled: false },
      "Disabled motion blur on the layer.");
  }

  // ---Null Object ---
  // Recognises "create/add a null object", "add a null", "invisible controller".
  if (/\b(?:create|add|make|insert)\s+(?:a\s+|an\s+)?null(?:[\s-]?object)?\b|invisible\s+controller\b/i.test(userText)) {
    const nameM = userText.match(/(?:called|named)\s*["']?(\w+)/i);
    const posM = userText.match(/\bat\s*\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?/i);
    push("add_null_object", {
      ...(nameM ? { name: nameM[1] } : {}),
      ...(posM ? { x: Number(posM[1]), y: Number(posM[2]) } : {}),
    }, `Created a null object${nameM ? ` called ${nameM[1]}` : ""}${posM ? ` at (${posM[1]}, ${posM[2]})` : ""} — parent other layers to it.`);
  }

  // ---Trim Path ---
  // Recognises "trim the path", "trim path", "draw on path", "write-on path",
  // "reveal the path", "stroke draw".
  if (/\b(?:trim(?:[\s-]?path)?|draw[\s-]on|write[\s-]?on[\s-]?path|reveal[\s-]?the[\s-]?path|stroke[\s-]?draw)\b/i.test(userText)) {
    const target = ensureComponent();
    const startM = userText.match(/\bstart\s*(\d+(?:\.\d+)?)\s*%/i);
    const endM = userText.match(/\bend\s*(\d+(?:\.\d+)?)\s*%/i);
    const offsetM = userText.match(/\boffset\s*(-?\d+(?:\.\d+)?)\s*(?:°|deg)?/i);
    push("trim_path", {
      componentId: target,
      start: startM ? Number(startM[1]) : 0,
      end: endM ? Number(endM[1]) : 100,
      offset: offsetM ? Number(offsetM[1]) : 0,
      animate: !/\b(?:static|no[\s-]?animate|fixed)\b/i.test(userText),
    }, `Trim-path reveal on the layer (start=${startM ? startM[1] : 0}%, end=${endM ? endM[1] : 100}%).`);
  }

  // ---Repeater ---
  // Recognises "repeat this", "repeater", "duplicate in a grid", "tile this",
  // "cascade copies", "make a pattern".
  if (/\b(?:repeat(?:er)?|duplicate\s+in\s+(?:a\s+)?(?:grid|pattern|cascade)|tile\s+this|make\s+(?:a\s+)?pattern|cascade\s+copies)\b/i.test(userText) && state.firstComponentId) {
    const copiesM = userText.match(/\b(\d+)\s*(?:copies|times|instances)\b/i);
    const copies = copiesM ? Math.max(1, Number(copiesM[1])) : 5;
    // Detect grid vs radial vs linear from phrasing.
    const isRadial = /\b(?:radial|circular|around|orbit)\b/i.test(userText);
    const isLinear = /\b(?:linear|horizontal|vertical|grid|tile)\b/i.test(userText);
    const offset = isRadial
      ? { x: 0, y: 0, rotate: 360 / copies, scale: 1 }
      : isLinear && /vertical/i.test(userText)
      ? { x: 0, y: 30, rotate: 0, scale: 1 }
      : { x: 30, y: 0, rotate: 0, scale: 1 };
    push("add_repeater", {
      componentId: state.firstComponentId,
      copies,
      offset,
      decay: 0.15,
    }, `Created a ${isRadial ? "radial" : isLinear ? "linear" : "default"} repeater with ${copies} copies.`);
  }

  // ---Echo / Motion Trail ---
  // Recognises "echo", "motion trail", "afterimage", "tracer", "tail effect",
  // "trail".
  if (/\b(?:echo|motion[\s-]?trail|afterimage|tracer|tail[\s-]?effect|trail)\b/i.test(userText) && state.firstComponentId) {
    const copiesM = userText.match(/\b(\d+)\s*(?:echoes|trails|copies)\b/i);
    const delayM = userText.match(/\b(\d+)\s*ms\b/i);
    push("add_echo", {
      componentId: state.firstComponentId,
      copies: copiesM ? Number(copiesM[1]) : 4,
      delayMs: delayM ? Number(delayM[1]) : 80,
      decay: 0.25,
      scaleDecay: 0,
    }, `Added ${copiesM ? copiesM[1] : 4} motion-trail echoes (delay=${delayM ? delayM[1] : 80}ms).`);
  }

  // ---Time Remap ---
  // Recognises "time remap", "remap time", "slow this layer", "speed up this
  // layer", "freeze this", "reverse playback", "freeze frame".
  if (/\b(?:time[\s-]?remap|remap\s+time|slow\s+(?:this|the|down)|speed\s+up\s+(?:this|the)|freeze\s+(?:this|the|frame)|reverse\s+(?:playback|this)|play\s+backwards)\b/i.test(userText) && state.firstComponentId) {
    let rate = 1;
    if (/\b(?:freeze|paused?)\b/i.test(userText)) rate = 0;
    else if (/\b(?:reverse|backwards?)\b/i.test(userText)) rate = -1;
    else if (/\b(?:slow|half)\b/i.test(userText)) rate = 0.5;
    else if (/\b(?:speed\s+up|fast|double|2x)\b/i.test(userText)) rate = 2;
    const freezeAtM = userText.match(/\bat\s*(\d+)\s*ms/i);
    push("set_time_remap", {
      componentId: state.firstComponentId,
      rate,
      ...(freezeAtM ? { freezeAtMs: Number(freezeAtM[1]) } : {}),
      reverseDirection: rate < 0,
    }, `Time-remapped the layer → rate=${rate}×${freezeAtM ? ` (freeze at ${freezeAtM[1]}ms)` : ""}.`);
  }

  // ---Layer Effects ---
  // Recognises "drop shadow", "add a shadow", "glow effect", "outer glow",
  // "inner shadow", "add stroke", "add a stroke outline", "outline the layer".
  if (/\b(?:drop[\s-]?shadow|add\s+(?:a\s+)?shadow|glow\s+effect|outer\s+glow|inner\s+glow|inner\s+shadow|add\s+(?:a\s+)?stroke|stroke\s+outline|outline\b|outline\s+(?:the\s+)?layer|layer\s+effect)\b/i.test(userText)) {
    const target = ensureComponent();
    let effect: "drop-shadow" | "inner-shadow" | "outer-glow" | "inner-glow" | "stroke" = "drop-shadow";
    if (/\binner\s+shadow\b/i.test(userText)) effect = "inner-shadow";
    else if (/\bouter\s+glow\b/i.test(userText)) effect = "outer-glow";
    else if (/\binner\s+glow\b/i.test(userText)) effect = "inner-glow";
    else if (/\bstroke|outline\b/i.test(userText)) effect = "stroke";
    else if (/\bglow\b/i.test(userText)) effect = "outer-glow";
    // Detect color from the message.
    const colorM = COLOR_MAP.find((c) => c.match.test(userText));
    const color = colorM ? colorM.hex : "#000000";
    push("add_layer_effect", {
      componentId: target,
      effect,
      color,
      distance: 4,
      blur: 6,
      opacity: effect === "stroke" ? 1 : 0.5,
      spread: effect === "stroke" ? 2 : 0,
    }, `Added ${effect} layer effect (color=${color}).`);
  }

  // ---Mask System ---
  // Recognises "add a mask", "mask this layer", "add a subtract mask",
  // "add an inverted mask", "add an ellipse mask with feather".
  if (/\b(?:add|create|make|apply|put)\s+(?:a\s+|an\s+)?(?:[a-z]+\s+)?mask\b|mask\s+(?:this|the|a)\s+layer\b|mask\s+this\b/i.test(userText)) {
    const target = ensureComponent();
    let shape: "rectangle" | "ellipse" | "path" = "rectangle";
    if (/\b(?:ellipse|circle|oval|round)\b/i.test(userText)) shape = "ellipse";
    else if (/\b(?:path|pen|custom)\b/i.test(userText)) shape = "path";
    let mode: "add" | "subtract" | "intersect" | "difference" | "lighten" | "darken" = "add";
    if (/\bsubtract\b/i.test(userText)) mode = "subtract";
    else if (/\bintersect\b/i.test(userText)) mode = "intersect";
    else if (/\bdifference\b/i.test(userText)) mode = "difference";
    else if (/\bdarken\b/i.test(userText)) mode = "darken";
    else if (/\blighten\b/i.test(userText)) mode = "lighten";
    const featherM = userText.match(/\bfeather\s*(\d+(?:\.\d+)?)\s*px\b/i);
    const inverted = /\binverted?\b|invert\s+(?:the\s+)?mask\b/i.test(userText);
    push("add_mask", {
      componentId: target,
      shape,
      mode,
      ...(featherM ? { feather: Number(featherM[1]) } : {}),
      inverted,
    }, `Added ${shape} mask (mode=${mode}${featherM ? `, feather=${featherM[1]}px` : ""}${inverted ? ", inverted" : ""}).`);
  } else if (/\b(?:change|set|make)\s+(?:the\s+)?mask\s+(?:mode\s+)?(?:to\s+)?(subtract|intersect|difference|lighten|darken|add)\b/i.test(userText) && state.firstComponentId) {
    const modeM = userText.match(/\b(subtract|intersect|difference|lighten|darken|add)\b/i);
    push("set_mask_mode", {
      componentId: state.firstComponentId,
      maskIndex: 0,
      mode: modeM ? (modeM[1] as "subtract" | "intersect" | "difference" | "lighten" | "darken" | "add") : "subtract",
    }, `Changed mask 0 mode to ${modeM?.[1] ?? "subtract"}.`);
  } else if (/\b(?:feather|soften)\s+(?:the\s+)?mask\b/i.test(userText) && state.firstComponentId) {
    const featherM = userText.match(/\b(\d+(?:\.\d+)?)\s*px\b/i);
    push("set_mask_mode", {
      componentId: state.firstComponentId,
      maskIndex: 0,
      mode: "add",
      feather: featherM ? Number(featherM[1]) : 10,
    }, `Feathered mask 0 by ${featherM?.[1] ?? 10}px.`);
  }

  // ---Track Matte ---
  // Recognises "track matte", "alpha matte", "luma matte", "use as mask".
  if (/\b(?:track[\s-]?matte|alpha[\s-]?matte|luma[\s-]?matte|use\s+as\s+mask|reveal\s+through)\b/i.test(userText) && state.firstComponentId) {
    const mode = /\bluma\b/i.test(userText)
      ? (/\binvert/i.test(userText) ? "luma-inverted" : "luma")
      : (/\binvert/i.test(userText) ? "alpha-inverted" : "alpha");
    // If a second component exists, use it as the matte; otherwise create one.
    const otherComponents = state.componentIds.filter((id) => id !== state.firstComponentId);
    const matteId = otherComponents[0] ?? state.firstComponentId;
    push("set_track_matte", {
      componentId: state.firstComponentId,
      matteComponentId: matteId,
      mode,
    }, `Set ${mode} track matte using ${matteId === state.firstComponentId ? "the same layer (will need a separate matte)" : "another layer"}.`);
  }

  // ---Shape Layers v2 ---
  // Recognises "add a rectangle", "draw a circle", "create a polygon", "make a star", "draw a path".
  // Guard: skip when the user clearly means a mask (mask keyword present) —
  // the dedicated add_mask intent handles that case.
  if (/\b(?:add|create|make|draw|insert)\s+(?:a\s+|an\s+)?(?:shape\s+)?(rectangle|ellipse|circle|polygon|star|line|path)\b/i.test(userText)
      && !/\bmask\b/i.test(userText)) {
    const shapeM = userText.match(/\b(rectangle|ellipse|circle|polygon|star|line|path)\b/i);
    if (shapeM) {
      const shapeRaw = shapeM[1].toLowerCase();
      const shape = (shapeRaw === "circle" ? "ellipse" : shapeRaw) as "rectangle" | "ellipse" | "polygon" | "star" | "line" | "path";
      const fillM = COLOR_MAP.find((c) => c.match.test(userText));
      const sidesM = userText.match(/\b(\d+)\s*sides\b/i);
      const pointsM = userText.match(/\b(\d+)\s*points\b/i);
      const wM = userText.match(/\b(\d+)\s*(?:px)?\s*(?:wide|width)\b/i);
      const hM = userText.match(/\b(\d+)\s*(?:px)?\s*(?:tall|height)\b/i);
      const strokeM = userText.match(/\bstroke\s+(?:in\s+)?(\w+)/i);
      const strokeWidthM = userText.match(/\b(\d+)\s*px\s+stroke\b/i);
      push("create_shape_layer", {
        shape,
        ...(fillM ? { fill: fillM.hex } : {}),
        ...(sidesM ? { sides: Number(sidesM[1]) } : {}),
        ...(pointsM ? { points: Number(pointsM[1]) } : {}),
        ...(wM ? { width: Number(wM[1]) } : {}),
        ...(hM ? { height: Number(hM[1]) } : {}),
        ...(strokeM ? { stroke: strokeM[1] } : {}),
        ...(strokeWidthM ? { strokeWidth: Number(strokeWidthM[1]) } : {}),
      }, `Created ${shape} shape layer${fillM ? ` filled ${fillM.hex}` : ""}.`);
    }
  }

  // ---Posterize Time ---
  // Recognises "posterize time", "stop motion", "low fps", "stepped animation".
  if (/\b(?:posterize\s+time|stop[\s-]?motion|low[\s-]?fps|stepped\s+animation|stutter|choppy\s+frames?)\b/i.test(userText)) {
    const target = ensureComponent();
    const fpsM = userText.match(/\b(\d+)\s*(?:fps|frames?)\b/i);
    const fps = fpsM ? Number(fpsM[1]) : 12;
    push("posterize_time", {
      componentId: target,
      fps,
      enabled: true,
    }, `Posterized to ${fps} fps (stop-motion look).`);
  }

  // ---Text Animator ---
  // Recognises "text animator", "per character animation", "word by word", "stagger text".
  if (/\b(?:text[\s-]?animator|per[\s-]?character|character[\s-]?by[\s-]?character|word[\s-]?by[\s-]?word|stagger\s+text|range\s+selector)\b/i.test(userText)) {
    const target = ensureComponent();
    let property: "position" | "scale" | "rotation" | "opacity" | "color" = "opacity";
    if (/\brotation|rotate|spin\b/i.test(userText)) property = "rotation";
    else if (/\bscale|zoom|size\b/i.test(userText)) property = "scale";
    else if (/\bposition|move|x|y\b/i.test(userText)) property = "position";
    else if (/\bcolor\b/i.test(userText)) property = "color";
    const unit = /\bword\b/i.test(userText) ? "word" : "character";
    const staggerM = userText.match(/\b(\d+)\s*ms\b/i);
    push("add_text_animator", {
      componentId: target,
      property,
      unit,
      staggerMs: staggerM ? Number(staggerM[1]) : 40,
      valueDelta: property === "opacity" ? 1 : property === "rotation" ? 360 : property === "scale" ? 0.5 : 20,
    }, `Added ${property} text animator (${unit} unit, stagger=${staggerM ? staggerM[1] : 40}ms).`);
  }

  // ---Keyframe Interpolation ---
  // Recognises "hold keyframe", "roving keyframe", "auto bezier", "smooth keyframe".
  if (/\b(?:hold\s+keyframe|freeze\s+frame|roving\s+keyframe|auto[\s-]?bezier|smooth\s+keyframe|continuous\s+interpolation|linear\s+keyframe)\b/i.test(userText) && state.firstComponentId) {
    let interpolation: "linear" | "bezier" | "hold" | "auto-bezier" | "continuous" = "linear";
    if (/\bhold|freeze\b/i.test(userText)) interpolation = "hold";
    else if (/\broving\b/i.test(userText)) interpolation = "linear";
    else if (/\bauto[\s-]?bezier\b/i.test(userText)) interpolation = "auto-bezier";
    else if (/\bsmooth|continuous\b/i.test(userText)) interpolation = "continuous";
    else if (/\bbezier\b/i.test(userText)) interpolation = "bezier";
    const roving = /\broving\b/i.test(userText);
    push("set_keyframe_interpolation", {
      componentId: state.firstComponentId,
      keyframeIndex: 0,
      interpolation,
      roving,
    }, `Set keyframe 0 → ${interpolation}${roving ? " (roving)" : ""}.`);
  }

  // --- Precompositions ---
  if (/\b(?:create|make|group.*into)\s+(?:a\s+)?precomp\b|预合成/i.test(userText) && state.firstComponentId) {
    const nameM = userText.match(/(?:called|named)\s*["']?(\w+)/i);
    push("create_precomp", { name: nameM ? nameM[1] : "Precomp 1", componentIds: state.componentIds.length > 0 ? state.componentIds : [state.firstComponentId] },
      `Created a precomposition${nameM ? ` called ${nameM[1]}` : ""} from the selected layers.`);
  }
  if (/\b(?:ungroup|unprecompose|dissolve)\s+(?:the\s+)?precomp\b|解散预合成/i.test(userText)) {
    push("ungroup_precomp", { precompId: "precomp_demo" },
      "Ungrouped the precomposition back into individual layers.");
  }

  // --- Expressions ---
  if (/\b(?:set|add|write|define)\s+(?:an?\s+)?expression\b|表达式/i.test(userText) && state.firstComponentId) {
    const exprM = userText.match(/(?:expression|expr)\s*[:=]?\s*["']([^"']+)["']/i);
    const propertyM = userText.match(/\b(opacity|rotation|scale|position|x|y|width|height)\b/i);
    push("set_expression", {
      componentId: state.firstComponentId,
      property: propertyM ? propertyM[1].toLowerCase() : "opacity",
      expression: exprM ? exprM[1] : "time * 100",
    }, `Set an expression on the ${propertyM ? propertyM[1].toLowerCase() : "opacity"} property.`);
  }

  // --- Gradient fill / stroke ---
  // Guard: skip when the user means a shader-style "gradient shift" effect —
  // those are handled by the shader handler further below.
  if (!/\bgradient[\s-]?shift\b/i.test(userText) && state.firstComponentId) {
    if (/\b(?:gradient|linear[\s-]?gradient|radial[\s-]?gradient|color[\s-]?sweep|rainbow)\s+(?:fill|background|bg)\b|gradient[\s-]?fill\b/i.test(userText)) {
      const type = /\bradial\b/i.test(userText) ? "radial" : "linear";
      const angleM = userText.match(/\b(\d+)\s*(?:deg|°|degree)/i);
      const stops: Array<{ color: string; position: number }> = [];
      const hexes = Array.from(userText.matchAll(/#([0-9a-fA-F]{3,6})/g)).map((m) => `#${m[1]}`);
      if (hexes.length >= 2) {
        hexes.forEach((c, i) => stops.push({ color: c, position: (i / (hexes.length - 1)) * 100 }));
      } else {
        stops.push({ color: "#ff0080", position: 0 }, { color: "#7928ca", position: 100 });
      }
      push("set_gradient_fill", {
        componentId: state.firstComponentId,
        type,
        angle: angleM ? Number(angleM[1]) : 90,
        stops,
      }, `Applied ${type} gradient fill (${stops.length} stops${angleM ? `, ${angleM[1]}°` : ""}).`);
    } else if (/\bgradient[\s-]?(?:stroke|border|outline)\b/i.test(userText)) {
      const widthM = userText.match(/(\d+)\s*px/);
      const hexes = Array.from(userText.matchAll(/#([0-9a-fA-F]{3,6})/g)).map((m) => `#${m[1]}`);
      const stops: Array<{ color: string; position: number }> = (hexes.length >= 2 ? hexes : ["#00ffff", "#ff00ff"]).map((c, i, arr) => ({
        color: c, position: (i / (arr.length - 1)) * 100,
      }));
      push("set_gradient_stroke", {
        componentId: state.firstComponentId,
        type: /\bradial\b/i.test(userText) ? "radial" : "linear",
        width: widthM ? Number(widthM[1]) : 2,
        stops,
      }, `Applied gradient stroke (${widthM ? widthM[1] + "px" : "2px"}, ${stops.length} stops).`);
    }
  }

  // --- Wiggle / jitter ---
  // Pre-samples pseudo-random fluctuation into keyframes; no runtime needed.
  if (/\b(?:wiggle|jitter|tremble|add\s+noise\s+to\s+(?:the\s+)?motion|random\s+motion)\b/i.test(userText) && state.firstComponentId) {
    const freqM = userText.match(/(?:freq|frequency|hz)\s*(\d+(?:\.\d+)?)/i);
    const ampM = userText.match(/(?:amp|amplitude|by)\s*(\d+(?:\.\d+)?)/i);
    const propM = userText.match(/\b(translateX|translateY|rotate|scale|opacity|skewX|skewY|x|y|rotation)\b/i);
    let property: "translateX" | "translateY" | "rotate" | "scale" | "opacity" | "skewX" | "skewY" = "translateX";
    if (propM) {
      const p = propM[1].toLowerCase();
      if (p === "x") property = "translateX";
      else if (p === "y") property = "translateY";
      else if (p === "rotation") property = "rotate";
      else if (["translateX","translateY","rotate","scale","opacity","skewX","skewY"].includes(p)) property = p as typeof property;
    }
    push("apply_wiggle", {
      componentId: state.firstComponentId,
      property,
      frequency: freqM ? Number(freqM[1]) : 2,
      amplitude: ampM ? Number(ampM[1]) : 20,
      octaves: 2,
      seed: 1,
      sampleCount: 24,
    }, `Wiggled ${property} (freq=${freqM ? freqM[1] : "2"}Hz, amp=${ampM ? ampM[1] : "20"}).`);
  }

  // --- Particle emitter ---
  if (/\b(?:particle[s]?|emitter|spawn\s+particle[s]?|burst|fire\s+particle[s]?|sparks?|snow|confetti)\b/i.test(userText)) {
    const rateM = userText.match(/(?:rate|per\s+sec)\s*(\d+)/i);
    const lifeM = userText.match(/(?:life|lifespan)\s*(\d+)/i);
    const gravM = userText.match(/(?:gravity|grav)\s*(-?\d+)/i);
    const hexes = Array.from(userText.matchAll(/#([0-9a-fA-F]{3,6})/g)).map((m) => `#${m[1]}`);
    push("add_particle_emitter", {
      name: "Particle Emitter",
      rate: rateM ? Number(rateM[1]) : 20,
      lifespan: lifeM ? Number(lifeM[1]) : 1500,
      gravity: gravM ? Number(gravM[1]) : 80,
      startColor: hexes[0] ?? "#ffffff",
      endColor: hexes[1] ?? "#ff0080",
    }, `Created particle emitter (rate=${rateM ? rateM[1] : "20"}/s, life=${lifeM ? lifeM[1] : "1500"}ms).`);
  }

  // --- 3D camera ---
  // Guard: skip when the user means a pre-baked camera MOVE (pan/zoom/dolly
  // move) — those are handled by the existing add_camera_move handler.
  if (!/\bcamera\s+(?:move|pan|zoom|tilt|dolly|truck|orbit)\b|pan\s+camera|zoom\s+camera/i.test(userText)) {
    if (/\b(?:add|create|set\s+up)\s+(?:a\s+)?(?:3d\s+)?camera\b|3d[\s-]?camera|multi[\s-]?plane|parallax\s+camera/i.test(userText)) {
      const zM = userText.match(/\b(?:z|depth|distance)\s*(\d+)/i);
      const focalM = userText.match(/(?:focal|mm)\s*(\d+)/i);
      push("add_camera", {
        positionZ: zM ? Number(zM[1]) : 400,
        focalLength: focalM ? Number(focalM[1]) : 50,
      }, `Added 3D camera (z=${zM ? zM[1] : "400"}, focal=${focalM ? focalM[1] : "50"}mm).`);
    } else if (/\b(?:move|pan|tilt|dolly|truck|orbit)\s+(?:the\s+)?camera\b|dolly\s+(?:in|out)\b/i.test(userText)) {
      // Update camera transform — positional move.
      const xM = userText.match(/\bx\s*(-?\d+)/i);
      const yM = userText.match(/\by\s*(-?\d+)/i);
      const zM = userText.match(/\bz\s*(-?\d+)/i);
      if (xM || yM || zM) {
        push("set_camera_transform", {
          ...(xM ? { positionX: Number(xM[1]) } : {}),
          ...(yM ? { positionY: Number(yM[1]) } : {}),
          ...(zM ? { positionZ: Number(zM[1]) } : {}),
        }, `Moved camera to (${xM ? xM[1] : "0"}, ${yM ? yM[1] : "0"}, ${zM ? zM[1] : "0"}).`);
      }
    }
  }

  // --- Audio reactive ---
  if (/\b(?:audio[\s-]?reactive|react\s+to\s+audio|drive\s+(?:this|it|scale|rotation|opacity|position)\s+with\s+(?:audio|bass|treble|mid|music|sound)|beat\s+detect(?:ion)?|music\s+sync|sound\s+reactive|drive\s+(?:scale|rotation|opacity|position)\s+with\s+(?:bass|treble|mid))\b/i.test(userText) && state.firstComponentId) {
    const propM = userText.match(/\b(opacity|scale|translateX|translateY|rotate|backgroundColor|color)\b/i);
    const bandM = userText.match(/\b(bass|mid|treble|overall)\b/i);
    // The audio component ID is the second component (heuristic) — the user
    // would typically select a target + an audio track.
    push("bind_audio_to_property", {
      componentId: state.firstComponentId,
      audioComponentId: state.secondComponentId ?? state.firstComponentId,
      property: propM ? propM[1] : "scale",
      band: bandM ? bandM[1] : "overall",
    }, `Bound ${propM ? propM[1] : "scale"} to audio (${bandM ? bandM[1] : "overall"} band).`);
  } else if (/\b(?:unblind|stop|remove|detach)\s+(?:audio[\s-]?reactive|audio\s+binding|audio)\b/i.test(userText) && state.firstComponentId) {
    push("unbind_audio", { componentId: state.firstComponentId }, "Removed audio binding.");
  }

  // --- Puppet pin & mesh warp ---
  if (state.firstComponentId) {
    if (/\b(?:puppet\s+pin|add\s+pin|deformation\s+pin|puppet\s+tool)\b/i.test(userText)) {
      const xM = userText.match(/\bx\s*(\d+)/i);
      const yM = userText.match(/\by\s*(\d+)/i);
      push("add_puppet_pin", {
        componentId: state.firstComponentId,
        x: xM ? Number(xM[1]) : 50,
        y: yM ? Number(yM[1]) : 50,
      }, `Added puppet pin at (${xM ? xM[1] : "50"}, ${yM ? yM[1] : "50"}).`);
    }
    if (!/\b(?:remove|undo|delete|clear)\b/i.test(userText) && /\b(?:mesh\s+warp|puppet\s+warp|warp\s+(?:the\s+)?(?:layer|this)|distort|liquid\s+effect|ripple\s+the\s+layer|organic\s+deform)\b/i.test(userText)) {
      const turbM = userText.match(/(?:turbulence|turb|amount)\s*(\d+(?:\.\d+)?)/i);
      const scaleM = userText.match(/(?:scale|size)\s*(\d+)/i);
      push("apply_mesh_warp", {
        componentId: state.firstComponentId,
        turbulence: turbM ? Number(turbM[1]) : 0.05,
        scale: scaleM ? Number(scaleM[1]) : 20,
      }, `Applied mesh warp (turbulence=${turbM ? turbM[1] : "0.05"}, scale=${scaleM ? scaleM[1] : "20"}).`);
    } else if (/\b(?:remove\s+(?:mesh\s+)?warp|undo\s+(?:the\s+)?(?:mesh\s+)?warp|remove\s+distortion|straighten\s+layer)\b/i.test(userText)) {
      push("remove_mesh_warp", { componentId: state.firstComponentId }, "Removed mesh warp.");
    }
  }

  // --- 3D lighting system ---
  if (/\b(?:add|create|insert)\s+(?:an?\s+)?(?:3d\s+)?(?:light|spotlight|spot\s+light|point\s+light|sun\s+light|directional\s+light|ambient\s+light)\b|灯光|聚光灯/i.test(userText)) {
    const typeM = userText.match(/\b(parallel|directional|point|omni|spot|spotlight|ambient|fill|sun)\b/i);
    const typeMap: Record<string, string> = { parallel: "parallel", directional: "parallel", sun: "parallel", point: "point", omni: "point", spot: "spot", spotlight: "spot", ambient: "ambient", fill: "ambient" };
    const type = typeM ? (typeMap[typeM[1].toLowerCase()] ?? "parallel") : "parallel";
    const colorM = userText.match(/#([0-9a-f]{3,6})/i);
    const intensityM = userText.match(/(?:intensity|bright)\s*(\d+(?:\.\d+)?)/i);
    const xM = userText.match(/\bx\s*(-?\d+)/i);
    const yM = userText.match(/\by\s*(-?\d+)/i);
    const zM = userText.match(/\bz\s*(-?\d+)/i);
    const angleM = userText.match(/(?:cone|angle)\s*(\d+)/i);
    push("add_light", {
      type,
      positionX: xM ? Number(xM[1]) : 0,
      positionY: yM ? Number(yM[1]) : 0,
      positionZ: zM ? Number(zM[1]) : 500,
      color: colorM ? `#${colorM[1]}` : "#ffffff",
      intensity: intensityM ? Number(intensityM[1]) : 1,
      ...(angleM ? { coneAngle: Number(angleM[1]) } : {}),
      castShadow: /\bshadow\b/i.test(userText),
    }, `Added a ${type} light${colorM ? ` (#${colorM[1]})` : ""} at (${xM ? xM[1] : "0"}, ${yM ? yM[1] : "0"}, ${zM ? zM[1] : "500"}).`);
  }
  if (/\b(?:move|reposition|aim|rotate|repoin)\s+(?:the\s+)?light\b|移动灯光/i.test(userText) && state.firstComponentId) {
    const xM = userText.match(/\bx\s*(-?\d+)/i);
    const yM = userText.match(/\by\s*(-?\d+)/i);
    const zM = userText.match(/\bz\s*(-?\d+)/i);
    push("set_light_transform", {
      lightId: "light_1",
      positionX: xM ? Number(xM[1]) : 0,
      positionY: yM ? Number(yM[1]) : 0,
      positionZ: zM ? Number(zM[1]) : 500,
    }, `Moved the light to (${xM ? xM[1] : "0"}, ${yM ? yM[1] : "0"}, ${zM ? zM[1] : "500"}).`);
  }
  if (/\b(?:change|set|adjust)\s+(?:the\s+)?light'?s?\s+(?:color|intensity|brightness|cone|falloff|shadow)|dim\s+(?:the\s+)?light|brighten\s+(?:the\s+)?light|light\s+color|light\s+intensity\b/i.test(userText) && state.firstComponentId) {
    const colorM = userText.match(/#([0-9a-f]{3,6})/i);
    const intensityM = userText.match(/(?:intensity|bright|dim)\s*(\d+(?:\.\d+)?)/i);
    push("set_light_properties", {
      lightId: "light_1",
      ...(colorM ? { color: `#${colorM[1]}` } : {}),
      ...(intensityM ? { intensity: Number(intensityM[1]) } : {}),
      ...(/\bshadow\b/i.test(userText) ? { castShadow: true } : {}),
    }, `Updated light properties${colorM ? ` (color #${colorM[1]})` : ""}${intensityM ? ` (intensity ${intensityM[1]})` : ""}.`);
  }
  if (/\b(?:remove|delete|turn\s+off)\s+(?:the\s+)?(?:3d\s+)?light\b|删除灯光/i.test(userText)) {
    push("remove_light", { lightId: "light_1" }, "Removed the light.");
  }
  if (/\b(?:cast|enable|add)\s+(?:a\s+)?shadow|shadow\s+(?:under|behind|on)\b|投射阴影/i.test(userText) && state.firstComponentId) {
    const opacityM = userText.match(/(?:opacity|alpha)\s*(\d+(?:\.\d+)?)/i);
    const blurM = userText.match(/(?:blur|softness)\s*(\d+)/i);
    push("cast_shadow", {
      componentId: state.firstComponentId,
      enabled: true,
      shadowOpacity: opacityM ? Number(opacityM[1]) : 0.5,
      shadowBlur: blurM ? Number(blurM[1]) : 8,
    }, `Enabled shadow casting (opacity ${opacityM ? opacityM[1] : "0.5"}, blur ${blurM ? blurM[1] : "8"}px).`);
  }
  if (/\b(?:depth\s+of\s+field|dof|focus\s+blur|bokeh|defocus\s+(?:background|back)|背景虚化|景深)\b/i.test(userText)) {
    const focusM = userText.match(/(?:focus|distance)\s*(\d+)/i);
    const apertureM = userText.match(/(?:aperture|f-stop)\s*(\d+(?:\.\d+)?)/i);
    push("set_camera_dof", {
      enabled: true,
      focusDistance: focusM ? Number(focusM[1]) : 500,
      aperture: apertureM ? Number(apertureM[1]) : 0.3,
    }, `Enabled depth-of-field (focus distance ${focusM ? focusM[1] : "500"}, aperture ${apertureM ? apertureM[1] : "0.3"}).`);
  }

  // --- Advanced color correction ---
  if (/\blevels\b|色阶/i.test(userText) && state.firstComponentId) {
    const inBlackM = userText.match(/(?:input\s+black|black\s+point)\s*(\d+)/i);
    const inWhiteM = userText.match(/(?:input\s+white|white\s+point)\s*(\d+)/i);
    const gammaM = userText.match(/gamma\s*(\d+(?:\.\d+)?)/i);
    push("set_levels", {
      componentId: state.firstComponentId,
      inputBlack: inBlackM ? Number(inBlackM[1]) : 0,
      inputWhite: inWhiteM ? Number(inWhiteM[1]) : 255,
      gamma: gammaM ? Number(gammaM[1]) : 1,
    }, `Applied levels (input black ${inBlackM ? inBlackM[1] : "0"}, white ${inWhiteM ? inWhiteM[1] : "255"}, gamma ${gammaM ? gammaM[1] : "1"}).`);
  }
  if (/\bcurves?\b|曲线/i.test(userText) && state.firstComponentId) {
    push("set_curves", {
      componentId: state.firstComponentId,
      channel: "rgb",
      points: [{ x: 0, y: 0 }, { x: 128, y: 140 }, { x: 255, y: 255 }],
    }, "Applied an S-curve to boost contrast in the midtones.");
  }
  if (/\bcolor\s+balance\b|色彩平衡/i.test(userText) && state.firstComponentId) {
    push("set_color_balance", {
      componentId: state.firstComponentId,
      shadowRed: 10,
      midtoneGreen: 5,
      highlightBlue: -8,
    }, "Applied color balance — warmed shadows, cooled highlights.");
  }
  if (/\b(?:hue\s*saturation|hue[-\s]?sat|hsl|色相|饱和度)\b/i.test(userText) && state.firstComponentId) {
    const hueM = userText.match(/(?:hue|shift)\s*(-?\d+)/i);
    const satM = userText.match(/(?:sat(?:uration)?|饱和)\s*(-?\d+)/i);
    push("set_hue_saturation", {
      componentId: state.firstComponentId,
      hueShift: hueM ? Number(hueM[1]) : 0,
      saturation: satM ? Number(satM[1]) : 30,
    }, `Applied hue/saturation (hue ${hueM ? hueM[1] : "0"}, saturation ${satM ? satM[1] : "+30"}).`);
  }
  if (/\bvibrance\b|自然饱和度/i.test(userText) && state.firstComponentId) {
    const vM = userText.match(/vibrance\s*(-?\d+)/i);
    push("set_vibrance", {
      componentId: state.firstComponentId,
      vibrance: vM ? Number(vM[1]) : 40,
    }, `Applied vibrance ${vM ? vM[1] : "+40"} — selectively boosted less-saturated colors.`);
  }
  if (/\bexposure\b|曝光/i.test(userText) && state.firstComponentId) {
    const eM = userText.match(/(?:exposure|ev)\s*(-?\d+(?:\.\d+)?)/i);
    push("set_exposure", {
      componentId: state.firstComponentId,
      exposure: eM ? Number(eM[1]) : 1,
    }, `Adjusted exposure ${eM ? eM[1] : "+1"} stop${eM ? "" : " (brightened)"}.`);
  }
  if (/\b(?:shadow\s*highlight|shadow\/highlight|recover\s+shadows|fix\s+highlights)\b|阴影高光/i.test(userText) && state.firstComponentId) {
    const sM = userText.match(/(?:shadow|阴影)\s*(\d+)/i);
    const hM = userText.match(/(?:highlight|高光)\s*(\d+)/i);
    push("set_shadow_highlight", {
      componentId: state.firstComponentId,
      shadowAmount: sM ? Number(sM[1]) : 30,
      highlightAmount: hM ? Number(hM[1]) : 20,
    }, `Recovered shadows ${sM ? sM[1] : "30"} and highlights ${hM ? hM[1] : "20"}.`);
  }
  if (/\bselective\s+color\b|可选颜色/i.test(userText) && state.firstComponentId) {
    const targetM = userText.match(/\b(reds|yellows|greens|cyans|blues|magentas|whites|neutrals|blacks)\b/i);
    push("set_selective_color", {
      componentId: state.firstComponentId,
      target: targetM ? targetM[1].toLowerCase() : "reds",
      cyan: 15,
      magenta: -10,
    }, `Applied selective color to ${targetM ? targetM[1].toLowerCase() : "reds"}.`);
  }

  // --- Path operations & booleans ---
  if (/\b(?:offset|inset|outset|expand|shrink)\s+(?:the\s+)?path\b|offset\s+path|偏移路径/i.test(userText) && state.firstComponentId) {
    const amountM = userText.match(/(?:offset|amount|by)\s*(-?\d+)/i);
    push("offset_path", {
      componentId: state.firstComponentId,
      amount: amountM ? Number(amountM[1]) : 10,
    }, `Offset the path by ${amountM ? amountM[1] : "10"}px.`);
  }
  if (/\b(?:pucker|bloat|inflate|starburst|deflate)\b|膨胀收缩/i.test(userText) && state.firstComponentId) {
    const amountM = userText.match(/(?:amount|by)\s*(-?\d+)/i);
    const isPucker = /\bpucker|deflate\b/i.test(userText);
    push("pucker_bloat", {
      componentId: state.firstComponentId,
      amount: amountM ? Number(amountM[1]) * (isPucker ? -1 : 1) : (isPucker ? -50 : 50),
    }, `Applied ${isPucker ? "pucker" : "bloat"} (${amountM ? amountM[1] : "50"}).`);
  }
  if (/\b(?:round|soften|fillet)\s+(?:the\s+)?corners|rounded\s+(?:corners|edges)\b|圆角/i.test(userText) && state.firstComponentId) {
    const radiusM = userText.match(/(?:radius|by)\s*(\d+)/i);
    push("round_corners", {
      componentId: state.firstComponentId,
      radius: radiusM ? Number(radiusM[1]) : 12,
    }, `Rounded corners with radius ${radiusM ? radiusM[1] : "12"}px.`);
  }
  if (/\b(?:zig[-\s]?zag|sawtooth|crenellate|ridges)\b|锯齿/i.test(userText) && state.firstComponentId) {
    const sizeM = userText.match(/(?:size|amplitude)\s*(\d+)/i);
    const ridgesM = userText.match(/(?:ridges|count)\s*(\d+)/i);
    push("zig_zag", {
      componentId: state.firstComponentId,
      size: sizeM ? Number(sizeM[1]) : 10,
      ridges: ridgesM ? Number(ridgesM[1]) : 6,
    }, `Applied zig-zag (size ${sizeM ? sizeM[1] : "10"}, ridges ${ridgesM ? ridgesM[1] : "6"}).`);
  }
  if (/\b(?:twist|spiral|swirl|tornado)\b|扭曲/i.test(userText) && state.firstComponentId) {
    const angleM = userText.match(/(?:angle|by)\s*(-?\d+)/i);
    push("twist_path", {
      componentId: state.firstComponentId,
      angle: angleM ? Number(angleM[1]) : 180,
    }, `Twisted path by ${angleM ? angleM[1] : "180"} degrees.`);
  }
  if (/\b(?:merge|combine|union|subtract|intersect|exclude)\s+(?:these\s+)?paths|merge\s+paths\b|合并路径/i.test(userText) && state.firstComponentId) {
    const modeM = userText.match(/\b(merge|add|subtract|intersect|exclude)\b/i);
    push("merge_paths", {
      componentId: state.firstComponentId,
      mode: modeM ? modeM[1].toLowerCase() : "merge",
      sourcePathIds: state.componentIds.slice(0, 2),
    }, `Merged paths (${modeM ? modeM[1].toLowerCase() : "merge"}).`);
  }
  if (/\b(?:boolean|union|subtract|intersect|xor)\s+(?:these\s+)?(?:shapes|components|layers)\b|shape\s+boolean|布尔/i.test(userText) && state.firstComponentId && state.secondComponentId) {
    const opM = userText.match(/\b(union|subtract|intersect|exclude)\b/i);
    push("shape_boolean", {
      operation: opM ? opM[1].toLowerCase() : "union",
      targetComponentId: state.firstComponentId,
      sourceComponentId: state.secondComponentId,
    }, `Applied ${opM ? opM[1].toLowerCase() : "union"} between the two components.`);
  }
  if (/\b(?:multi\s+trim|multiple\s+trim|trim\s+segments|multi-segment\s+trim)\b|多段修剪/i.test(userText) && state.firstComponentId) {
    push("trim_path_multiple", {
      componentId: state.firstComponentId,
      segments: [
        { start: 0, end: 40, offset: 0 },
        { start: 50, end: 90, offset: 0 },
      ],
    }, "Applied multi-segment trim — two draw-on ranges.");
  }

  // --- Data-driven animation ---
  if (/\b(?:load|import|add)\s+(?:a\s+)?data\s+source|load\s+(?:a\s+)?(?:json|csv)(?:\s+file)?|import\s+(?:a\s+)?(?:json|csv)(?:\s+file)?|data\s+source\b|加载数据/i.test(userText)) {
    const nameM = userText.match(/(?:called|named)\s+["']?([a-z0-9_-]+)["']?/i);
    const formatM = userText.match(/\b(json|csv)\b/i);
    push("load_data_source", {
      name: nameM ? nameM[1] : "data_1",
      format: formatM ? formatM[1].toLowerCase() : "json",
      data: formatM && formatM[1].toLowerCase() === "csv" ? "label,value\nA,10\nB,25\nC,18" : '[{"label":"A","value":10},{"label":"B","value":25},{"label":"C","value":18}]',
    }, `Loaded data source "${nameM ? nameM[1] : "data_1"}" (${formatM ? formatM[1].toLowerCase() : "json"} format).`);
  }
  if (/\b(?:list|show)\s+(?:the\s+)?data\s+sources|what\s+data\s+is\s+loaded\b/i.test(userText)) {
    push("list_data_sources", {}, "Listed all loaded data sources.");
  }
  if (/\b(?:bind|drive|animate\s+from|connect\s+to)\s+(?:[a-z]+\s+)?(?:this\s+)?(?:property\s+)?(?:to\s+|with\s+|from\s+)?(?:\w+\s+)*?(?:data|csv|json|column)\b|数据驱动/i.test(userText) && state.firstComponentId) {
    const columnM = userText.match(/(?:column|field)\s+["']?([a-z_][a-z0-9_]*)["']?/i);
    const propM = userText.match(/\b(translateX|translateY|scale|rotate|opacity|width|height)\b/i);
    push("bind_property_to_data", {
      componentId: state.firstComponentId,
      dataSourceName: "data_1",
      column: columnM ? columnM[1] : "value",
      property: propM ? propM[1].toLowerCase() : "translateY",
    }, `Bound ${propM ? propM[1].toLowerCase() : "translateY"} to data column "${columnM ? columnM[1] : "value"}".`);
  }
  if (/\b(?:unbind|detach|remove\s+data\s+binding)\b|解绑数据/i.test(userText) && state.firstComponentId) {
    push("unbind_data", { componentId: state.firstComponentId }, "Removed data binding.");
  }
  if (/\b(?:bar|line|pie|scatter|area)\s+chart|chart\s+from\s+(?:data|csv|json)|data\s+visualization|visualize\s+(?:this\s+)?data\b|图表|数据可视化/i.test(userText)) {
    const typeM = userText.match(/\b(bar|line|pie|scatter|area)\s+chart\b/i);
    push("data_driven_chart", {
      dataSourceName: "data_1",
      chartType: typeM ? typeM[1].toLowerCase() : "bar",
      xColumn: "label",
      yColumn: "value",
    }, `Generated a ${typeM ? typeM[1].toLowerCase() : "bar"} chart from data source "data_1".`);
  }

  // --- Effects & filters library ---
  if (/\bgaussian\s+blur|\bdefocus\b|\bsoften\s+(?:the\s+)?(?:layer|this)|模糊/i.test(userText) && state.firstComponentId) {
    const radiusM = userText.match(/(?:radius|amount)\s*(\d+(?:\.\d+)?)/i);
    push("apply_gaussian_blur", {
      componentId: state.firstComponentId,
      radius: radiusM ? Number(radiusM[1]) : 8,
    }, `Applied Gaussian blur (radius ${radiusM ? radiusM[1] : "8"}px).`);
  }
  if (/\bdirectional\s+blur|horizontal\s+blur|vertical\s+blur|\bstreak\s+(?:this|the\s+layer)/i.test(userText) && state.firstComponentId) {
    const angleM = userText.match(/(?:angle|direction)\s*(\d+(?:\.\d+)?)/i);
    const lenM = userText.match(/(?:length|amount)\s*(\d+(?:\.\d+)?)/i);
    push("apply_directional_blur", {
      componentId: state.firstComponentId,
      angle: angleM ? Number(angleM[1]) : 0,
      length: lenM ? Number(lenM[1]) : 20,
    }, `Applied directional blur (angle ${angleM ? angleM[1] : "0"}°, length ${lenM ? lenM[1] : "20"}px).`);
  }
  if (/\bradial\s+blur|zoom\s+blur|spin\s+blur|rotational\s+blur|径向模糊/i.test(userText) && state.firstComponentId) {
    push("apply_radial_blur", {
      componentId: state.firstComponentId,
      amount: 15,
      spin: /\bspin\b/i.test(userText),
    }, `Applied radial blur (${/\bspin\b/i.test(userText) ? "spin" : "zoom"} mode).`);
  }
  if (/\bsharpen\b|\bunsharp\b|锐化/i.test(userText) && state.firstComponentId) {
    const amtM = userText.match(/(?:amount|strength)\s*(\d+(?:\.\d+)?)/i);
    push("apply_sharpen", {
      componentId: state.firstComponentId,
      amount: amtM ? Number(amtM[1]) : 50,
    }, `Applied sharpen (amount ${amtM ? amtM[1] : "50"}).`);
  }
  if (/\bwave\s+warp|wavy\s+distortion|波浪扭曲/i.test(userText) && state.firstComponentId) {
    const heightM = userText.match(/(?:height|amplitude)\s*(\d+(?:\.\d+)?)/i);
    push("apply_wave_warp", {
      componentId: state.firstComponentId,
      waveHeight: heightM ? Number(heightM[1]) : 20,
    }, `Applied wave warp (amplitude ${heightM ? heightM[1] : "20"}px).`);
  }
  if (/\bapply\s+ripple|add\s+ripple\s+distortion|circular\s+ripple|涟漪/i.test(userText) && state.firstComponentId) {
    push("apply_ripple", {
      componentId: state.firstComponentId,
    }, `Applied circular ripple distortion.`);
  }
  if (/\bbulge\b|\bpinch\b|\bspherize\b|膨胀|收缩/i.test(userText) && state.firstComponentId) {
    const isPinch = /\bpinch\b|收缩/i.test(userText);
    push("apply_bulge", {
      componentId: state.firstComponentId,
      height: isPinch ? -50 : 50,
    }, `Applied ${isPinch ? "pinch" : "bulge"} distortion.`);
  }
  if (/\bstylized\s+glow|\bmake\s+(?:it|this)\s+glow|\bglow\s+effect\s+with\b|\bglow\s+threshold|发光/i.test(userText) && state.firstComponentId) {
    const colorM = userText.match(/#([0-9a-f]{3,6})/i);
    push("apply_glow", {
      componentId: state.firstComponentId,
      ...(colorM ? { color: `#${colorM[1]}` } : {}),
    }, `Applied stylized glow${colorM ? ` (tint #${colorM[1]})` : ""}.`);
  }
  if (/\bmosaic\b|马赛克/i.test(userText) && state.firstComponentId) {
    const sizeM = userText.match(/(?:size|block)\s*(\d+)/i);
    push("apply_mosaic", {
      componentId: state.firstComponentId,
      blockSize: sizeM ? Number(sizeM[1]) : 10,
    }, `Applied mosaic (block ${sizeM ? sizeM[1] : "10"}px).`);
  }
  if (/\bfind\s+edges\b|edge\s+detection|描边/i.test(userText) && state.firstComponentId) {
    push("apply_find_edges", {
      componentId: state.firstComponentId,
    }, `Applied find edges.`);
  }
  if (/\blens\s+flare\b|光晕/i.test(userText) && state.firstComponentId) {
    push("apply_lens_flare", {
      componentId: state.firstComponentId,
    }, `Applied lens flare.`);
  }
  if (/\b4-color\s+gradient|four\s+color\s+gradient|gradient\s+corners|多色渐变/i.test(userText) && state.firstComponentId) {
    push("apply_four_color_gradient", {
      componentId: state.firstComponentId,
    }, `Applied 4-color gradient fill.`);
  }

  // --- Expression engine & animation assistants ---
  if (/\bremove\s+expression|delete\s+expression|clear\s+expression|删除表达式/i.test(userText) && state.firstComponentId) {
    const propM = userText.match(/\b(translateX|translateY|scale|rotate|opacity|width|height)\b/i);
    push("remove_expression", {
      componentId: state.firstComponentId,
      property: propM ? propM[1].toLowerCase() : "rotate",
    }, `Removed expression from ${propM ? propM[1].toLowerCase() : "rotate"}.`);
  }
  if (/\bloop\s+(?:the\s+)?(?:rotation|position|scale|opacity|this\s+property|this)|pingpong\s+(?:this|the)|cycle\s+loop|loop\s+this\s+property|循环/i.test(userText) && state.firstComponentId) {
    const modeM = userText.match(/\b(cycle|pingpong|offset|continue)\b/i);
    const propM = userText.match(/\b(rotation|rotate|position|translateX|translateY|scale|opacity)\b/i);
    const propMap: Record<string, string> = { rotation: "rotate", rotate: "rotate", position: "translateY", translateX: "translateX", translateY: "translateY", scale: "scale", opacity: "opacity" };
    push("set_loop_expression", {
      componentId: state.firstComponentId,
      property: propM ? (propMap[propM[1].toLowerCase()] ?? "rotate") : "rotate",
      mode: modeM ? modeM[1].toLowerCase() : "cycle",
    }, `Applied ${modeM ? modeM[1].toLowerCase() : "cycle"} loop expression to ${propM ? propM[1].toLowerCase() : "rotation"}.`);
  }
  if (/\bsequence\s+(?:these\s+)?(?:layers|components)|cascade\s+(?:them|these|the\s+layers)|stagger\s+(?:the\s+)?layers|序列图层/i.test(userText)) {
    const staggerM = userText.match(/(?:stagger|offset)\s*(\d+)/i);
    push("sequence_layers", {
      staggerMs: staggerM ? Number(staggerM[1]) : 200,
    }, `Sequenced layers with ${staggerM ? staggerM[1] : "200"}ms stagger.`);
  }
  if (/\bexponential\s+scale|smooth\s+zoom|exponential\s+zoom|指数缩放/i.test(userText) && state.firstComponentId) {
    const fromM = userText.match(/(?:from|start)\s*(\d+(?:\.\d+)?)/i);
    const toM = userText.match(/(?:to|end)\s*(\d+(?:\.\d+)?)/i);
    push("exponential_scale", {
      componentId: state.firstComponentId,
      fromScale: fromM ? Number(fromM[1]) : 1,
      toScale: toM ? Number(toM[1]) : 2,
    }, `Applied exponential scale (${fromM ? fromM[1] : "1"} → ${toM ? toM[1] : "2"}).`);
  }
  if (/\bsmooth\s+keyframes|smooth\s+this\s+animation|reduce\s+jitter|平滑关键帧/i.test(userText) && state.firstComponentId) {
    push("smooth_keyframes", {
      componentId: state.firstComponentId,
    }, `Smoothed keyframes.`);
  }
  if (/\bwiggle\s+keyframes|add\s+wiggle\s+to\s+keyframes|generate\s+wiggle\s+keyframes|摆动关键帧/i.test(userText) && state.firstComponentId) {
    const freqM = userText.match(/(?:freq|frequency)\s*(\d+(?:\.\d+)?)/i);
    const ampM = userText.match(/(?:amp|amplitude)\s*(\d+(?:\.\d+)?)/i);
    push("wiggle_keyframes", {
      componentId: state.firstComponentId,
      frequency: freqM ? Number(freqM[1]) : 2,
      amplitude: ampM ? Number(ampM[1]) : 20,
    }, `Generated wiggle keyframes (freq ${freqM ? freqM[1] : "2"}, amp ${ampM ? ampM[1] : "20"}).`);
  }
  if (/\baudio\s+to\s+keyframes|drive\s+this\s+from\s+audio|audio\s+amplitude\s+to\s+keyframes|音频转关键帧/i.test(userText) && state.firstComponentId) {
    push("audio_to_keyframes", {
      componentId: state.firstComponentId,
      audioSourceId: state.secondComponentId ?? state.firstComponentId,
    }, `Converted audio amplitude to keyframes.`);
  }

  // --- Type animation system ---
  if (/\brange\s+selector|select\s+first\s+\d+\s*%|text\s+range|范围选择器/i.test(userText) && state.firstComponentId) {
    const startM = userText.match(/start\s*(\d+)/i);
    const endM = userText.match(/end\s*(\d+)/i);
    push("set_range_selector", {
      componentId: state.firstComponentId,
      start: startM ? Number(startM[1]) : 0,
      end: endM ? Number(endM[1]) : 100,
    }, `Set range selector (${startM ? startM[1] : "0"}% - ${endM ? endM[1] : "100"}%).`);
  }
  if (/\btext\s+wiggler|wiggle\s+the\s+text|jitter\s+the\s+characters|文字摆动/i.test(userText) && state.firstComponentId) {
    push("set_text_wiggler", {
      componentId: state.firstComponentId,
    }, `Applied text wiggler to characters.`);
  }
  if (/\btext\s+on\s+path|put\s+text\s+on\s+(?:the\s+)?(?:curve|path)|flow\s+text\s+along\s+path|路径文字/i.test(userText) && state.firstComponentId) {
    push("text_on_path", {
      componentId: state.firstComponentId,
      pathId: state.secondComponentId ?? state.firstComponentId,
    }, `Placed text on path.`);
  }
  if (/\bvertical\s+text|stack\s+text\s+vertically|竖排文字/i.test(userText) && state.firstComponentId) {
    push("set_vertical_text", {
      componentId: state.firstComponentId,
    }, `Switched text to vertical layout.`);
  }
  if (/\bkerning|letter\s+spacing|letter\s+tracking|tighten\s+the\s+text|loosen\s+the\s+text|字距/i.test(userText) && state.firstComponentId) {
    const tM = userText.match(/(?:tracking|kerning|spacing)\s*(-?\d+(?:\.\d+)?)/i);
    push("set_kerning", {
      componentId: state.firstComponentId,
      tracking: tM ? Number(tM[1]) : 0,
    }, `Set kerning (${tM ? tM[1] : "0"}px tracking).`);
  }
  if (/\bleading|line\s+height|adjust\s+line\s+spacing|行距/i.test(userText) && state.firstComponentId) {
    const lM = userText.match(/(?:leading|lineHeight|height)\s*(\d+(?:\.\d+)?)/i);
    push("set_leading", {
      componentId: state.firstComponentId,
      lineHeight: lM ? Number(lM[1]) : 1.2,
    }, `Set leading (lineHeight ${lM ? lM[1] : "1.2"}).`);
  }
  if (/\bper\s+character\s+transform|character\s+by\s+character|stagger\s+the\s+characters|逐字符变换/i.test(userText) && state.firstComponentId) {
    push("per_character_transform", {
      componentId: state.firstComponentId,
    }, `Applied per-character transform.`);
  }
  if (/\btext\s+animator|animate\s+color\s+per\s+character|fade\s+in\s+characters|文字动画器/i.test(userText) && state.firstComponentId) {
    const animM = userText.match(/\b(position|scale|rotation|opacity|color|tracking)\b/i);
    push("set_text_animator", {
      componentId: state.firstComponentId,
      animator: animM ? (animM[1].toLowerCase() === "color" ? "fillColor" : animM[1].toLowerCase()) : "opacity",
    }, `Applied text animator (${animM ? animM[1].toLowerCase() : "opacity"}).`);
  }

  // --- Motion tracking & stabilization ---
  if (/\btrack\s+(?:this\s+)?point|motion\s+track\s+(?:this\s+)?point|track\s+a\s+point|跟踪点/i.test(userText) && state.firstComponentId) {
    const xM = userText.match(/\bx\s*(\d+)/i);
    const yM = userText.match(/\by\s*(\d+)/i);
    push("track_point", {
      componentId: state.firstComponentId,
      pointX: xM ? Number(xM[1]) : 0,
      pointY: yM ? Number(yM[1]) : 0,
    }, `Tracked point (${xM ? xM[1] : "0"}, ${yM ? yM[1] : "0"}).`);
  }
  if (/\bcamera\s+tracker|track\s+the\s+camera|3d\s+solve|solve\s+camera|摄像器解算/i.test(userText) && state.firstComponentId) {
    push("track_camera", {
      componentId: state.firstComponentId,
    }, `Ran camera tracker.`);
  }
  if (/\bstabilize\s+this|warp\s+stabilizer|smooth\s+camera\s+shake|稳定/i.test(userText) && state.firstComponentId) {
    const smoothM = userText.match(/(?:smooth|smoothness)\s*(\d+)/i);
    push("warp_stabilizer", {
      componentId: state.firstComponentId,
      smoothness: smoothM ? Number(smoothM[1]) : 50,
    }, `Applied warp stabilizer (smoothness ${smoothM ? smoothM[1] : "50"}).`);
  }
  if (/\bapply\s+track\s+to\s+layer|use\s+the\s+track\s+on\s+this|apply\s+tracking\s+data|应用跟踪/i.test(userText) && state.firstComponentId) {
    push("apply_track_to_layer", {
      componentId: state.firstComponentId,
      trackName: "track_1",
    }, `Applied track data to layer.`);
  }
  if (/\bedit\s+motion\s+path|redraw\s+the\s+path|change\s+the\s+motion\s+path|运动路径/i.test(userText) && state.firstComponentId) {
    push("edit_motion_path", {
      componentId: state.firstComponentId,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 50 },
        { x: 200, y: 0 },
      ],
    }, `Edited motion path (3 control points).`);
  }
  if (/\bauto\s+orient|orient\s+along\s+path|face\s+direction\s+of\s+motion|沿路径定向/i.test(userText) && state.firstComponentId) {
    push("auto_orient_path", {
      componentId: state.firstComponentId,
    }, `Enabled auto-orient along motion path.`);
  }

  // --- Compositing & blending ---
  // Careful: plain "blend mode" is handled by set_blend_mode above; this
  // handler targets the advanced blending panel (fill opacity, knockout,
  // Blend If ranges, per-channel inclusion).
  if (/\b(?:advanced\s+blending|fill\s+opacity|knockout|blend\s+if)\b/i.test(userText) && state.firstComponentId) {
    const fillOpacityM = userText.match(/fill\s+opacity\s*(\d+(?:\.\d+)?)/i);
    push("set_advanced_blending", {
      componentId: state.firstComponentId,
      ...(fillOpacityM ? { fillOpacity: Number(fillOpacityM[1]) / 100 } : {}),
    }, `Configured advanced blending options.`);
  }
  if (/\b(?:pre[\s-]?compose|nest\s+(?:these|the\s+selected|the|selected)\s+layers|group\s+(?:these|selected)\s+(?:into|as)\s+(?:a\s+)?comp)\b/i.test(userText) && state.componentIds.length > 0) {
    push("precompose", {
      componentIds: state.componentIds,
    }, `Pre-composed ${state.componentIds.length} layer(s) into a new comp.`);
  }
  if (/\b(?:collapse\s+transformations|collapse\s+(?:this|the\s+layer))\b/i.test(userText) && state.firstComponentId) {
    push("collapse_transformations", {
      componentId: state.firstComponentId,
    }, `Toggled collapse transformations.`);
  }
  if (/\b(?:alpha\s+mode|premultiplied\s+alpha|straight\s+alpha|unassociated\s+alpha)\b/i.test(userText) && state.firstComponentId) {
    const modeM = userText.match(/\b(premultiplied|straight|unassociated)\b/i);
    push("set_alpha_mode", {
      componentId: state.firstComponentId,
      mode: modeM && /premultiplied/i.test(modeM[1]) ? "premultiplied" : "straight",
    }, `Set alpha mode.`);
  }
  if (/\b(?:stencil\s+(?:alpha|luma)|silhouette\s+(?:alpha|luma)|alpha[\s-]?add|luma\s+matte)\b/i.test(userText) && state.firstComponentId) {
    const modeM = userText.match(/\b(stencil\s+alpha|stencil\s+luma|silhouette\s+alpha|silhouette\s+luma|alpha[\s-]?add|luma\s+matte)\b/i);
    push("set_transfer_mode", {
      componentId: state.firstComponentId,
      mode: modeM ? modeM[1].toLowerCase().replace(/\s+/g, "-").replace("alpha-add", "alpha-add") : "stencil-alpha",
    }, `Set transfer mode.`);
  }
  if (/\b(?:blending\s+group|isolate\s+blending|knockout\s+group)\b/i.test(userText) && state.firstComponentId) {
    push("set_blending_group", {
      componentId: state.firstComponentId,
    }, `Configured blending group.`);
  }

  // --- Time effects & rhythm ---
  if (/\b(?:time\s+displacement|displace\s+time|pixel\s+time\s+offset)\b/i.test(userText) && state.firstComponentId) {
    const maxM = userText.match(/(?:max|amount)\s*(\d+)\s*ms/i);
    push("time_displacement", {
      componentId: state.firstComponentId,
      ...(maxM ? { maxDisplacementMs: Number(maxM[1]) } : {}),
    }, `Applied time displacement.`);
  }
  // Careful: plain "echo" is handled by add_echo above; this targets the
  // advanced composite-operator variant.
  if (/\b(?:advanced\s+echo|composite\s+echo|echo\s+with\s+(?:operator|mode))\b/i.test(userText) && state.firstComponentId) {
    const countM = userText.match(/(\d+)\s*(?:echoes?|copies|trails?)/i);
    const opM = userText.match(/\b(add|maximum|minimum|screen|difference|crossfade)\b/i);
    push("echo_advanced", {
      componentId: state.firstComponentId,
      ...(countM ? { numberOfEchoes: Number(countM[1]) } : {}),
      ...(opM ? { echoOperator: opM[1].toLowerCase() as "add" | "maximum" | "minimum" | "screen" | "difference" | "crossfade" } : {}),
    }, `Applied advanced echo.`);
  }
  if (/\b(?:sequence\s+with\s+(?:crossfade|transition|dissolve|wipe|push)|dissolve\s+between\s+(?:layers|clips)|transition\s+between\s+(?:layers|clips)|crossfade\s+(?:the\s+)?layers)\b/i.test(userText) && state.firstComponentId) {
    const typeM = userText.match(/\b(crossfade|dissolve|cut|wipe|push)\b/i);
    const durM = userText.match(/(\d+)\s*ms/i);
    push("sequence_with_transition", {
      ...(state.componentIds.length >= 2 ? { componentIds: state.componentIds } : {}),
      ...(typeM ? { transitionType: typeM[1].toLowerCase() as "crossfade" | "dissolve" | "cut" | "wipe" | "push" } : {}),
      ...(durM ? { transitionDurationMs: Number(durM[1]) } : {}),
    }, `Sequenced layers with ${typeM ? typeM[1].toLowerCase() : "crossfade"} transition.`);
  }
  if (/\b(?:time\s+reverse|reverse\s+(?:the|this)\s+layer|reverse\s+layer)\b/i.test(userText) && state.firstComponentId) {
    push("time_reverse_layer", {
      componentId: state.firstComponentId,
    }, `Reversed the layer's playback.`);
  }
  if (/\b(?:freeze\s+frame|hold\s+(?:this|the|current)\s+frame|freeze\s+at)\b/i.test(userText) && state.firstComponentId) {
    const atM = userText.match(/at\s*(\d+)\s*ms/i);
    push("freeze_frame", {
      componentId: state.firstComponentId,
      ...(atM ? { atTimeMs: Number(atM[1]) } : {}),
    }, `Froze the layer at ${atM ? atM[1] + "ms" : "current frame"}.`);
  }
  // Careful: plain "posterize time" is handled by posterize_time above; this
  // targets the advanced variant with regional/velocity options.
  if (/\b(?:posterize\s+time\s+advanced|regional\s+posterize|velocity\s+posterize|advanced\s+posterize)\b/i.test(userText) && state.firstComponentId) {
    const fpsM = userText.match(/(\d+)\s*fps/i);
    push("posterize_time_advanced", {
      componentId: state.firstComponentId,
      ...(fpsM ? { fps: Number(fpsM[1]) } : {}),
    }, `Applied advanced posterize time.`);
  }
  // Careful: "time remap" is handled by set_time_remap; this targets the
  // dedicated speed-curve variant with keyframes.
  if (/\b(?:time\s+warp|speed\s+ramp|variable\s+speed|变速曲线|时间重映射)\b/i.test(userText) && state.firstComponentId) {
    push("time_warp_remapping", {
      componentId: state.firstComponentId,
      speedKeyframes: [
        { timeMs: 0, speed: 1, interpolation: "ease" },
        { timeMs: 500, speed: 0.3, interpolation: "ease" },
        { timeMs: 1000, speed: 1, interpolation: "ease" },
      ],
    }, `Applied time-warp speed remapping.`);
  }

  // --- Camera lens & optical ---
  if (/\b(?:lens\s+distortion|barrel\s+distortion|pincushion|remove\s+distortion)\b/i.test(userText) && state.firstComponentId) {
    const amountM = userText.match(/(?:amount|strength)\s*(-?\d+(?:\.\d+)?)/i);
    push("lens_distortion", {
      componentId: state.firstComponentId,
      ...(amountM ? { amount: Number(amountM[1]) } : {}),
    }, `Applied lens distortion.`);
  }
  if (/\b(?:chromatic\s+aberration|color\s+fringing|rgb\s+split|色差|色散)\b/i.test(userText) && state.firstComponentId) {
    const redM = userText.match(/red\s*(?:offset)?\s*(-?\d+)/i);
    const blueM = userText.match(/blue\s*(?:offset)?\s*(-?\d+)/i);
    push("chromatic_aberration", {
      componentId: state.firstComponentId,
      ...(redM ? { redOffset: Number(redM[1]) } : {}),
      ...(blueM ? { blueOffset: Number(blueM[1]) } : {}),
    }, `Applied chromatic aberration.`);
  }
  if (/\b(?:vignette|darken\s+(?:the\s+)?edges|edge\s+falloff|暗角)\b/i.test(userText) && state.firstComponentId) {
    const amountM = userText.match(/(?:amount|strength)\s*(\d+(?:\.\d+)?)/i);
    push("vignette", {
      componentId: state.firstComponentId,
      ...(amountM ? { amount: Number(amountM[1]) } : {}),
    }, `Applied vignette.`);
  }
  if (/\b(?:camera\s+shake|handheld\s+shake|procedural\s+shake|jitter\s+the\s+camera|镜头抖动)\b/i.test(userText) && state.firstComponentId) {
    const intensityM = userText.match(/intensity\s*(\d+(?:\.\d+)?)/i);
    const freqM = userText.match(/(?:frequency|freq)\s*(\d+(?:\.\d+)?)/i);
    push("camera_shake_procedural", {
      componentId: state.firstComponentId,
      ...(intensityM ? { intensity: Number(intensityM[1]) } : {}),
      ...(freqM ? { frequency: Number(freqM[1]) } : {}),
    }, `Applied procedural camera shake.`);
  }
  if (/\b(?:optical\s+flow|motion\s+vectors?|motion\s+estimation|光流)\b/i.test(userText) && state.firstComponentId) {
    push("optical_flow", {
      componentId: state.firstComponentId,
    }, `Computed optical flow.`);
  }
  if (/\b(?:match[\s-]?move|match\s+this\s+movement|motion\s+match|匹配移动)\b/i.test(userText) && state.firstComponentId) {
    push("motion_match_move", {
      componentId: state.firstComponentId,
    }, `Match-moved the layer.`);
  }
  // Careful: plain "lens flare" is handled by apply_lens_flare; this targets
  // the anamorphic horizontal-streak variant.
  if (/\b(?:anamorphic\s+flare|horizontal\s+lens\s+flare|cinematic\s+flare|变形光晕|横向光芒)\b/i.test(userText) && state.firstComponentId) {
    push("lens_flare_anamorphic", {
      componentId: state.firstComponentId,
    }, `Applied anamorphic lens flare.`);
  }
  // Careful: plain "depth of field" is handled by set_camera_dof; this
  // targets the advanced variant with custom focus curve and bokeh shape.
  if (/\b(?:advanced\s+depth\s+of\s+field|bokeh\s+shape|focus\s+curve|custom\s+dof|高级景深)\b/i.test(userText) && state.firstComponentId) {
    push("depth_of_field_advanced", {
      componentId: state.firstComponentId,
    }, `Applied advanced depth of field.`);
  }

  // --- Paint & cloning ---
  if (/\b(?:paint\s+(?:a\s+)?stroke|draw\s+on\s+(?:this|the)|brush\s+stroke|画笔笔触)\b/i.test(userText) && state.firstComponentId) {
    push("paint_stroke", {
      componentId: state.firstComponentId,
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
    }, `Painted a stroke.`);
  }
  if (/\b(?:clone\s+stamp|clone\s+from\s+here|sample\s+and\s+paint|克隆图章)\b/i.test(userText) && state.firstComponentId) {
    push("clone_stamp", {
      componentId: state.firstComponentId,
      sourcePoint: [0, 0],
      destinationPoint: [100, 100],
    }, `Cloned from source to destination.`);
  }
  if (/\b(?:set\s+brush|brush\s+(?:size|hardness|opacity|spacing|flow)|change\s+the\s+brush|画笔设置)\b/i.test(userText) && state.firstComponentId) {
    const sizeM = userText.match(/size\s*(\d+)/i);
    const hardnessM = userText.match(/hardness\s*(\d+(?:\.\d+)?)/i);
    push("brush_settings", {
      componentId: state.firstComponentId,
      ...(sizeM ? { size: Number(sizeM[1]) } : {}),
      ...(hardnessM ? { hardness: Number(hardnessM[1]) / 100 } : {}),
    }, `Configured brush settings.`);
  }
  if (/\b(?:reveal\s+with\s+brush|paint\s+(?:a\s+)?mask|brush\s+reveal|erase\s+with\s+brush|画笔显隐)\b/i.test(userText) && state.firstComponentId) {
    push("reveal_with_brush", {
      componentId: state.firstComponentId,
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
    }, `Revealed content with brush.`);
  }
  if (/\b(?:erase\s+(?:paint|stroke|this)|remove\s+paint|擦除笔触)\b/i.test(userText) && state.firstComponentId) {
    push("erase_stroke", {
      componentId: state.firstComponentId,
      points: [{ x: 0, y: 0 }, { x: 50, y: 50 }],
    }, `Erased paint strokes.`);
  }
  if (/\b(?:animate\s+(?:the\s+)?stroke|write[\s-]?on\s+(?:this\s+)?stroke|paint\s+animation|grow\s+the\s+stroke|笔触动画)\b/i.test(userText) && state.firstComponentId) {
    const durM = userText.match(/(\d+)\s*ms/i);
    push("paint_animator", {
      componentId: state.firstComponentId,
      ...(durM ? { durationMs: Number(durM[1]) } : {}),
    }, `Animated the paint stroke.`);
  }

  // --- Adjustment layers ---
  if (/\b(?:set|create|add)\s+(?:an?\s+)?adjustment\s+layer\b|调整层/i.test(userText)) {
    const filterM = userText.match(/\b(blur|brightness|contrast|hue.?rotate|saturate|grayscale|sepia)\b/i);
    push("set_adjustment_layer", {
      componentId: state.firstComponentId ?? "",
      filter: filterM ? filterM[1].toLowerCase().replace(/\s/g, "-") : "blur",
      value: filterM && /blur/i.test(filterM[1]) ? "4px" : "1.2",
    }, `Created an adjustment layer with ${filterM ? filterM[1].toLowerCase() : "blur"} filter.`);
  }

  // --- Restraint analysis ---
  if (/\b(too much|too many|restraint|density|overwhelm\w*|clutter\w*|visual noise|competing for attention|is this too busy)\b/i.test(userText)) {
    push("analyze_restraint", {}, "Analyzed motion density — here's the restraint score and recommendations.");
  }

  // --- Motion recipes: browse or apply ---
  if (/\b(recipe|recipes)\b/i.test(userText) && !/\b(apply|use|try)\b/i.test(userText) && !/\b(save|seed|project|my|delete|remove)\b/i.test(userText)) {
    const catM = userText.match(/\b(entrance|playful|transition|feedback|ambient|text|interaction|exit|loading|notification|data-viz|celebration)\b/i);
    push("list_recipes", catM ? { category: catM[1].toLowerCase() } : {},
      catM ? `Here are the ${catM[1].toLowerCase()} recipes available.` : "Here are all available motion recipes with their avoidance conditions.");
  }
  if (/\b(apply|use|try)\s+(?:the\s+)?([\w\s-]+?)\s+recipe\b|apply.*recipe/i.test(userText)) {
    const recipeNameM = userText.match(/(?:apply|use|try)\s+(?:the\s+)?([\w\s-]+?)\s+recipe/i);
    const recipeId = recipeNameM ? `recipe-${recipeNameM[1].trim().toLowerCase().replace(/\s+/g, "-")}` : "recipe-gentle-entrance";
    const cid = ensureComponent();
    push("apply_recipe", { componentId: cid, recipeId },
      `Applied the recipe to the component.`);
  }

  // --- Project recipes: save, list, apply, seed, delete ---
  if (/\b(save.*as.*recipe|save.*recipe|capture.*recipe)\b/i.test(userText) && state.firstComponentId) {
    const nameM = userText.match(/(?:save|capture)\s+(?:as\s+)?(?:a\s+)?(?:recipe\s+)?(?:called\s+|named\s+)?([\w\s-]+)/i);
    const recipeName = nameM ? nameM[1].trim().slice(0, 60) : `Recipe from ${state.firstComponentId}`;
    push("save_project_recipe", { componentId: state.firstComponentId, name: recipeName },
      `Captured the current motion as a reusable project recipe: "${recipeName}".`);
  }
  if (/\b(seed.*recipe|load.*recipe.*preset|preset recipe)\b/i.test(userText)) {
    push("seed_project_recipes", {},
      "Seeded the project with 5 built-in recipe presets: Gentle Entrance, Confident Reveal, Playful Bounce, Ambient Breath, Snappy Click.");
  }
  if (/\b(list.*my recipe|my recipe|project recipe|show.*project recipe)\b/i.test(userText) && !/\b(apply|delete|remove)\b/i.test(userText)) {
    push("list_project_recipes", {},
      "Here are your saved project recipes. Use apply_project_recipe to apply one to a component.");
  }
  if (/\b(apply.*project recipe|use.*project recipe)\b/i.test(userText) && state.firstComponentId) {
    push("apply_project_recipe", { componentId: state.firstComponentId, recipeId: "precipe_demo" },
      "Applied the project recipe to the component.");
  }
  if (/\b(delete.*recipe|remove.*recipe)\b/i.test(userText)) {
    push("delete_project_recipe", { recipeId: "precipe_demo" },
      "Deleted the project recipe.");
  }

  // --- Brand packs: list, apply, seed, delete ---
  if (/\b(seed.*brand|load.*brand.*preset|brand.*preset)\b/i.test(userText)) {
    push("seed_brand_packs", {},
      "Seeded the project with 5 brand pack presets: Minimal Reserve, Material Expressive, Playful Dynamic, Cinematic Flow, Technical Precision.");
  }
  if (/\b(list.*brand|show.*brand|brand.*pack|motion.*identity)\b/i.test(userText) && !/\b(apply|delete|seed)\b/i.test(userText)) {
    push("list_brand_packs", {},
      "Here are your motion identity brand packs with personality traits.");
  }
  if (/\b(apply.*brand|make.*everything.*like|use.*brand.*pack)\b/i.test(userText)) {
    const brandNameM = userText.match(/(?:apply|use|make.*like)\s+(?:the\s+)?([\w\s-]+?)(?:\s+brand|\s+style|\s+identity)?$/i);
    const brandMap: Record<string, string> = {
      "minimal": "brand_minimal",
      "apple": "brand_minimal",
      "material": "brand_material",
      "google": "brand_material",
      "playful": "brand_playful",
      "nintendo": "brand_playful",
      "cinematic": "brand_cinematic",
      "stripe": "brand_cinematic",
      "technical": "brand_technical",
      "dashboard": "brand_technical",
    };
    const brandId = brandNameM ? (brandMap[brandNameM[1].trim().toLowerCase().split(/\s+/)[0]] ?? "brand_minimal") : "brand_minimal";
    push("apply_brand_pack", { packId: brandId },
      `Applied the brand pack to all components — timing, easing, triggers, and loops now follow the brand's motion identity.`);
  }
  if (/\b(delete.*brand|remove.*brand)\b/i.test(userText)) {
    push("delete_brand_pack", { packId: "brand_demo" },
      "Deleted the brand pack.");
  }

  // --- Motion profiles: set, get, list, suggest, apply ---
  if (/\b(make.*hero|set.*hero|hero.*element|this is.*hero)\b/i.test(userText) && state.firstComponentId) {
    push("set_motion_profile", { componentId: state.firstComponentId, role: "hero", temperament: "bold", visualWeight: 9 },
      "Set the component as a hero element with bold temperament.");
  } else if (/\b(make.*background|set.*background|background.*component)\b/i.test(userText) && state.firstComponentId) {
    push("set_motion_profile", { componentId: state.firstComponentId, role: "background", temperament: "subtle", visualWeight: 2 },
      "Set the component as a background element with subtle temperament.");
  } else if (/\b(make.*cta|set.*cta|cta.*element)\b/i.test(userText) && state.firstComponentId) {
    push("set_motion_profile", { componentId: state.firstComponentId, role: "cta", temperament: "urgent", visualWeight: 8 },
      "Set the component as a call-to-action with urgent temperament.");
  }
  if (/\b(suggest.*profile|auto.*profile|what.*role.*should)\b/i.test(userText) && state.firstComponentId) {
    push("suggest_motion_profile", { componentId: state.firstComponentId },
      "Suggested a motion profile based on the component's name and properties.");
  }
  if (/\b(list.*profile|show.*profile|list.*role|all.*profile)\b/i.test(userText) && !/\b(apply|set|suggest)\b/i.test(userText)) {
    push("list_motion_profiles", {},
      "Here are all motion profiles assigned to components in this project.");
  }
  if (/\b(apply.*profile|tune.*based.*profile|match.*motion.*personality)\b/i.test(userText) && state.firstComponentId) {
    push("apply_motion_profile", { componentId: state.firstComponentId },
      "Applied the motion profile to the component's motion parameters.");
  }
  if (/\b(get|show|view|read)\s+(?:the\s+)?(?:motion\s+)?profile\b|查看.*档案/i.test(userText) && state.firstComponentId) {
    push("get_motion_profile", { componentId: state.firstComponentId },
      "Retrieved the motion profile for the selected component.");
  }

  // --- Motion captures: save, list, apply, seed, delete ---
  if (/\b(seed.*captures?|example.*captures?|example.*path|captures?.*example)/i.test(userText)) {
    push("seed_motion_captures", {},
      "Seeded the project with 3 example motion captures: Sine Wave Path, Spiral Inward, and Bounce Trail.");
  }
  if (/\b(list.*captures?|show.*captures?|list.*path|what.*captures?)/i.test(userText) && !/\b(apply|delete|seed|save)\b/i.test(userText)) {
    push("list_motion_captures", {},
      "Here are your saved motion captures with sample counts and durations.");
  }
  if (/\b(save.*captures?|record.*cursor|record.*path|captures?.*gesture|captures?.*trajectory|draw.*path|draw.*motion|save.*motion.*profile|save.*as.*profile)/i.test(userText)) {
    // Generate a synthetic sine-wave capture as the recorded trajectory.
    const samples: Array<{ t: number; x: number; y: number }> = [];
    for (let i = 0; i <= 24; i++) {
      const t = (i / 24) * 1800;
      const x = (i / 24) * 200 - 100;
      const y = Math.sin((i / 24) * Math.PI * 3) * 60;
      samples.push({ t, x, y });
    }
    // Accept "called" or "named" to extract the profile/capture name.
    const namedM = userText.match(/(?:called|named)\s+["']?([a-z0-9_-]+)["']?/i);
    const nameM = userText.match(/(?:save|record|capture|draw)\s+(?:the\s+|this\s+|a\s+)?(.+)/i);
    const name = namedM ? namedM[1] : (nameM ? nameM[1].trim().slice(0, 60) : "Recorded Path");
    push("save_motion_capture", { name, samples, normalize: true, smoothing: 1 },
      `Saved cursor trajectory as "${name}" with ${samples.length} samples over 1800ms.`);
  }
  if (/\b(apply.*captures?|use.*captures?|trace.*motion|apply.*path)/i.test(userText) && state.firstComponentId) {
    push("apply_motion_capture", { captureId: "cap_demo", componentId: state.firstComponentId, normalize: true },
      "Applied the motion capture to the component — its keyframes now trace the recorded trajectory.");
  }
  if (/\b(delete.*captures?|remove.*captures?|discard.*captures?)/i.test(userText)) {
    push("delete_motion_capture", { captureId: "cap_demo" },
      "Deleted the motion capture.");
  }

  // --- Export presets: list, recommend, apply ---
  if (/\b(list.*export.*presets?|export.*options?|export.*presets?|what.*format|export.*format)/i.test(userText) && !/\b(apply|recommend)\b/i.test(userText)) {
    push("list_export_presets", {},
      "Here are all 9 smart export presets across 8 platforms — each bundles the right format, dimensions, fps, and optimizations.");
  }
  if (/\b(recommend.*export|best.*export|what.*format.*should|how.*should.*export|which.*export)\b/i.test(userText)) {
    push("recommend_export_format", { hint: userText.slice(0, 100) },
      "Based on the project's motion characteristics, here are the top 3 recommended export formats with scored reasoning.");
  }
  if (/\b(export.*for|export.*as|apply.*export.*presets?|make.*lottie|export.*instagram|export.*tiktok|export.*react|export.*vue|export.*email|export.*mobile|export.*figma|export.*embed|export.*social|export.*story|export.*square)/i.test(userText)) {
    const presetMap: Record<string, string> = {
      "instagram": "preset-social-square",
      "social": "preset-social-square",
      "square": "preset-social-square",
      "tiktok": "preset-social-story",
      "story": "preset-social-story",
      "stories": "preset-social-story",
      "reels": "preset-social-story",
      "shorts": "preset-social-story",
      "vertical": "preset-social-story",
      "react": "preset-react-component",
      "vue": "preset-vue-component",
      "lottie": "preset-mobile-lottie",
      "mobile": "preset-mobile-lottie",
      "ios": "preset-mobile-lottie",
      "android": "preset-mobile-lottie",
      "email": "preset-email-inline",
      "newsletter": "preset-email-inline",
      "mail": "preset-email-inline",
      "embed": "preset-embed-snippet",
      "snippet": "preset-embed-snippet",
      "iframe": "preset-embed-snippet",
      "banner": "preset-embed-snippet",
      "figma": "preset-figma-spec",
      "web": "preset-web-standalone",
      "html": "preset-web-standalone",
      "standalone": "preset-web-standalone",
    };
    let presetId = "preset-web-standalone";
    for (const [kw, id] of Object.entries(presetMap)) {
      if (userText.toLowerCase().includes(kw)) {
        presetId = id;
        break;
      }
    }
    push("apply_export_preset", { presetId },
      `Applied the export preset — ready to export in the optimal format for your target platform.`);
  }

  // --- Session lineage: save, list, resume, lineage tree, delete ---
  if (/\b(save.*sessions?|fork.*sessions?|snapshot.*conversation|remember.*branch)/i.test(userText)) {
    const nameM = userText.match(/(?:save|fork|snapshot|remember)\s+(?:this\s+|the\s+|a\s+)?(.+)/i);
    const name = nameM ? nameM[1].trim().slice(0, 60) : "Design Session";
    const tools = ["set_easing", "set_duration", "add_layer", "stagger_components"];
    push("save_session_snapshot", { name, toolsUsed: tools, messageCount: 8 },
      `Saved session snapshot "${name}" — 3 insights auto-extracted from tool patterns (timing focus, choreography, component creation).`);
  }
  if (/\b(list.*sessions?|show.*sessions?|sessions?.*history|what.*conversation)/i.test(userText) && !/\b(delete|resume|save|fork)\b/i.test(userText)) {
    push("list_session_snapshots", {},
      "Here are your session snapshots — 2 active, 1 forked, max depth 2. Each shows summary, tool count, and auto-extracted insights.");
  }
  if (/\b(resume.*sessions?|continue.*sessions?|pick.*up.*where)/i.test(userText)) {
    push("resume_session_snapshot", { sessionId: "sess_demo", summary: "Continued spring tuning and added choreography", messageCount: 12, toolsUsed: ["set_spring", "choreograph", "harmonize_colors"] },
      "Resumed the session — refreshed summary, re-extracted insights (now includes color focus and choreography).");
  }
  if (/\b(lineage.*tree|sessions?.*lineage|conversation.*tree|how.*sessions?.*relate|what.*came.*before)/i.test(userText)) {
    push("get_session_lineage", {},
      "Session lineage tree: 4 sessions total, max depth 2, 11 insights across all sessions. The tree shows parent-child forks and ancestry chains.");
  }
  if (/\b(delete.*sessions?|remove.*branch|discard.*sessions?)/i.test(userText)) {
    push("delete_session_snapshot", { sessionId: "sess_demo" },
      "Deleted the session snapshot from the lineage.");
  }

  // --- Accessibility check ---
  if (/\b(check.*accessibility|accessibility.*check|is.*safe|vestibular|seizure.*risk|flashing.*risk|strobing|reduced.*motion|WCAG|a11y|motion.*safety|safe.*motion|accessibility|accessible|is.*accessible)/i.test(userText)) {
    push("check_accessibility", {},
      "Accessibility report: 2 warnings (large displacement on hero, infinite loop without reduced-motion alternative), 1 info (inconsistent timing). Score: 76/100. Remediation: reduce hero translation, add reduced-motion media query, and align timing to 400ms/800ms tiers.");
  }

  // --- Performance check ---
  // Guard: skip when the user clearly means posterize-time (stop-motion /
  // stepped animation) — handled by the dedicated posterize_time intent.
  if (/\b(check.*performance|performance.*check|frame.*budget|is.*performant|fps|jank|optimize.*performance|performance.*issue|perf.*check|render.*cost|animation.*cost)/i.test(userText)
      && !/\b(?:posterize|stop[\s-]?motion|stepped\s+animation|stutter|choppy)\b/i.test(userText)) {
    push("check_performance", {},
      "Performance report: estimated 12.3ms/frame (within 16ms budget). 1 warning — 'Hero' animates layout property 'top' (use transform instead). Paint cost: 6 (box-shadow blur). 3 composite animations, 0 simultaneous overload.");
  }

  // --- Storyboard beat management ---
  if (/\b(create.*beat|add.*beat|new.*beat|storyboard.*beat|story.*beat|beat.*titled|narrative.*beat)/i.test(userText)) {
    const titleM = userText.match(/(?:titled|called|named)\s+["']?([^"']+?)["']?(?:\s|$)/i);
    const title = titleM ? titleM[1].trim() : "Untitled beat";
    push("create_beat", { title, description: "Narrative moment in the sequence", durationMs: 1200, transition: "fade" },
      `Created storyboard beat "${title}" (order 1, 1200ms, fade transition). The beat is now part of the narrative timeline.`);
  }
  if (/\b(list.*beats|show.*beats|storyboard.*overview|story.*outline|what.*beats|narrative.*outline|storyboard.*summary)/i.test(userText)) {
    push("list_beats", {},
      "Storyboard has 3 beats: 1) Opening (800ms, cut), 2) Reveal (1200ms, fade), 3) Resolution (1500ms, dissolve). Total runtime: 3.5s across 3 scenes.");
  }
  if (/\b(update.*beat|edit.*beat|rename.*beat|change.*beat|modify.*beat|adjust.*beat)/i.test(userText)) {
    push("update_beat", { beatId: "beat_1", title: "Updated beat" },
      "Updated the storyboard beat — title and timing adjusted.");
  }
  if (/\b(reorder.*beats|rearrange.*beats|reorder.*story|resequence.*beats|shuffle.*beats|move.*beats)/i.test(userText)) {
    push("reorder_beats", { beatIds: ["beat_2", "beat_1", "beat_3"] },
      "Reordered the storyboard beats into a new sequence.");
  }
  if (/\b(delete.*beat|remove.*beat|drop.*beat)/i.test(userText)) {
    push("delete_beat", { beatId: "beat_1" },
      "Deleted the storyboard beat from the sequence.");
  }
  if (/\b(export.*storyboard|storyboard.*export|story.*export|narrative.*export|storyboard.*markdown|storyboard.*json)/i.test(userText)) {
    const asJson = /json/i.test(userText);
    push("export_storyboard", { format: asJson ? "json" : "markdown" },
      `Exported the storyboard as ${asJson ? "JSON" : "Markdown"} — 3 beats, 3.5s total runtime, ready to share.`);
  }

  // --- Persistent memory: save ---
  if (/\b(remember this|save.*memory|save.*note|remember that)\b/i.test(userText)) {
    const keyM = userText.match(/(?:remember|save)\s+(?:that\s+|this\s+)?(.+)/i);
    const value = keyM ? keyM[1].trim().slice(0, 200) : "user note";
    push("save_memory", { key: "user-note", value },
      `Saved to persistent memory: "${value.slice(0, 80)}${value.length > 80 ? "..." : ""}"`);
  }

  // --- Persistent memory: recall ---
  if (/\b(recall.*memory|what did we decide|what do you know|search.*memory|what.*remember)\b/i.test(userText)) {
    push("recall_memory", { query: userText.slice(0, 100) },
      "Here's what I found in persistent memory for this project.");
  }

  // --- Generated skills ---
  if (/\b(generated skill|learned skill|what have you learned|auto.?generated|show.*skills)\b/i.test(userText)) {
    push("list_generated_skills", {}, "Here are the skills auto-generated from past task sequences.");
  }

  // --- Motion grammar compilation ---
  // Accept "compile: ...", "grammar: ...", or "compile motion ..."
  // Note: \b is placed per-alternative so "compile:" can match (colon is non-word).
  if (/\b(?:grammar\b|compile.*motion\b|compile\s*:)/i.test(userText) && state.firstComponentId) {
    const sourceM = userText.match(/(?:grammar|compile)\s*[:\s]+(.+)/i);
    const source = sourceM ? sourceM[1].trim() : "fade.in(600ms) then slide.up(400ms) with easing(spring)";
    push("compile_grammar", { componentId: state.firstComponentId, source },
      `Compiled grammar expression: "${source.slice(0, 60)}"`);
  }

  // --- Natural language motion parsing ---
  if (/\b(make.*bounce|make.*fade|make.*slide|parse.*motion|natural language motion|describe.*animation|translate.*motion)\b/i.test(userText)) {
    const descM = userText.match(/(?:make|parse|describe|translate)\s+(?:it\s+|the\s+|this\s+)?(.+)/i);
    const description = descM ? descM[1].trim() : userText;
    if (state.firstComponentId) {
      push("parse_motion", { description, componentId: state.firstComponentId },
        `Parsed "${description.slice(0, 60)}" into a motion spec and applied it.`);
    } else {
      push("parse_motion", { description },
        `Parsed "${description.slice(0, 60)}" into a motion spec.`);
    }
  }

  // --- Shader effects ---
  if (/\b(shader|glitch effect|chromatic aberration|neon glow|plasma|pixelate|vignette|film grain|ripple effect|gradient shift|aurora|vortex|mesh.?gradient|dot.?orbit|dot.?grid|warp|swirl|waves|perlin|simplex|voronoi|metaballs?|pulsing.?border|smoke.?ring|god.?rays|heatmap|liquid.?metal|gem.?smoke|halftone|dithering|grain.?gradient|color.?panels|paper.?texture|fluted.?glass|water)\b/i.test(userText) && state.firstComponentId) {
    const effectMap: Record<string, string> = {
      "chromatic": "shader-chromatic",
      "glitch": "shader-glitch",
      "plasma": "shader-plasma",
      "noise": "shader-noise",
      "grain gradient": "shader-grain-gradient",
      "grain": "shader-noise",
      "ripple": "shader-ripple",
      "vignette": "shader-vignette",
      "neon": "shader-neon-glow",
      "pixelate": "shader-pixelate",
      "pixel": "shader-pixelate",
      "gradient shift": "shader-gradient-shift",
      "gradient": "shader-gradient-shift",
      "mesh gradient": "shader-mesh-gradient",
      "mesh": "shader-mesh-gradient",
      "invert": "shader-invert-pulse",
      "aurora": "shader-aurora",
      "vortex": "shader-vortex",
      "dot orbit": "shader-dot-orbit",
      "dot grid": "shader-dot-grid",
      "warp": "shader-warp",
      "swirl": "shader-swirl",
      "waves": "shader-waves",
      "perlin": "shader-perlin",
      "simplex": "shader-simplex",
      "voronoi": "shader-voronoi",
      "metaball": "shader-metaballs",
      "pulsing border": "shader-pulsing-border",
      "smoke ring": "shader-smoke-ring",
      "god rays": "shader-god-rays",
      "god ray": "shader-god-rays",
      "heatmap": "shader-heatmap",
      "liquid metal": "shader-liquid-metal",
      "gem smoke": "shader-gem-smoke",
      "halftone dots": "shader-halftone-dots",
      "halftone cmyk": "shader-halftone-cmyk",
      "halftone": "shader-halftone-dots",
      "dithering": "shader-dithering",
      "color panels": "shader-color-panels",
      "paper texture": "shader-paper-texture",
      "fluted glass": "shader-fluted-glass",
      "water": "shader-water",
    };
    let effectId = "shader-chromatic";
    for (const [keyword, id] of Object.entries(effectMap)) {
      if (new RegExp(`\\b${keyword}`, "i").test(userText)) {
        effectId = id;
        break;
      }
    }
    push("set_shader_effect", { componentId: state.firstComponentId, effectId },
      `Applied ${effectId} shader effect to the component.`);
  }

  // --- Version history ---
  if (/\b(save|capture|snapshot)\s+(?:a\s+)?(?:version|snapshot|state)\b/i.test(userText)) {
    const labelMatch = userText.match(/(?:called|named|labeled)\s+["']?([^"']+?)["']?(?:\s|$)/i);
    const label = labelMatch ? labelMatch[1] : `Snapshot ${new Date().toLocaleTimeString()}`;
    push("save_version", { label },
      `Captured version "${label}" — the project state is now restorable.`);
  }
  // Allow an optional "all" between the verb and noun (e.g. "list all versions").
  if (/\b(list|show|view)\s+(?:all\s+)?(?:versions?|snapshots?|history)\b/i.test(userText)) {
    push("list_versions", {},
      "Here are all saved version snapshots for this project.");
  }
  if (/\b(restore|revert|roll\s*back|go\s*back\s*to)\s+(?:version|snapshot|state)\b/i.test(userText)) {
    push("list_versions", {},
      "Listing available versions before restore.");
    push("restore_version", { versionId: "ver_latest" },
      "Restored the project to the selected version snapshot.");
  }
  if (/\b(delete|remove)\s+(?:version|snapshot)\b/i.test(userText)) {
    push("list_versions", {},
      "Listing versions before delete.");
    push("delete_version", { versionId: "ver_latest" },
      "Deleted the selected version snapshot.");
  }

  // --- Design tokens ---
  if (/\b(save|create|define|add)\s+(?:a\s+)?(?:token|design\s+token)\b/i.test(userText)) {
    const nameMatch = userText.match(/(?:called|named)\s+["']?([a-z0-9-]+)["']?/i);
    const valueMatch = userText.match(/(?:to|=|value)\s*["']?([^"'\s]+)["']?/i);
    const catMatch = userText.match(/\b(duration|easing|color|spacing|radius|shadow|font)\b/i);
    const name = nameMatch ? nameMatch[1] : "custom-token";
    const value = valueMatch ? valueMatch[1] : "400ms";
    const category = catMatch ? catMatch[1] : "duration";
    push("save_token", { name, category, value },
      `Saved design token "${name}" (${category}) = ${value}.`);
  }
  // Allow an optional "all" between the verb and noun (e.g. "list all tokens").
  if (/\b(list|show|view)\s+(?:all\s+)?(?:tokens?|design\s+tokens?)\b/i.test(userText)) {
    push("list_tokens", {},
      "Here are all the design tokens for this project.");
  }
  if (/\b(update|change)\s+(?:the\s+)?(\w+)\s+token\b/i.test(userText)) {
    const nameMatch = userText.match(/\b(update|change)\s+(?:the\s+)?(\w+)\s+token\b/i);
    const valueMatch = userText.match(/(?:to|=)\s*["']?([^"'\s]+)["']?/i);
    const name = nameMatch ? nameMatch[2].toLowerCase() : "fast";
    const value = valueMatch ? valueMatch[1] : "300ms";
    push("update_token", { name, value },
      `Updated token "${name}" to ${value}.`);
  }
  if (/\b(delete|remove)\s+(?:the\s+)?(\w+)\s+token\b/i.test(userText)) {
    const nameMatch = userText.match(/\b(delete|remove)\s+(?:the\s+)?(\w+)\s+token\b/i);
    const name = nameMatch ? nameMatch[2].toLowerCase() : "slow";
    push("delete_token", { name },
      `Deleted token "${name}".`);
  }

  // Tool pipelines: save, list, run, delete reusable sequences.
  // Accept "save/record/create a pipeline" and "save this as a pipeline" phrasings.
  if (/\b(save|record|create)\s+(?:a\s+|an\s+|the\s+)?(?:pipeline|workflow|sequence|macro)\b/i.test(userText)
      || /\b(save|record)\s+(?:this|it|that)\s+as\s+(?:a\s+|an\s+)?(?:pipeline|workflow|sequence|macro)\b/i.test(userText)) {
    const nameMatch = userText.match(/(?:called|named)\s+["']?([a-z0-9-]+)["']?/i);
    const name = nameMatch ? nameMatch[1] : "custom-pipeline";
    push("save_pipeline", {
      name,
      description: "A reusable sequence of tool calls.",
      steps: [
        { tool: "set_easing", args: { easing: "bounce" }, description: "Set bounce easing" },
        { tool: "set_duration", args: { durationMs: 800 }, description: "Set 800ms duration" },
      ],
      tags: ["reusable"],
    }, `Saved pipeline "${name}" with 2 step(s).`);
  }
  // Allow an optional "all" between the verb and noun (e.g. "list all pipelines").
  if (/\b(list|show|view)\s+(?:all\s+)?(?:pipelines?|workflows?|sequences?|macros?)\b/i.test(userText)) {
    push("list_pipelines", {}, "Here are all the saved tool pipelines for this project.");
  }
  if (/\b(run|replay|apply|execute)\s+(?:a\s+)?(?:pipeline|workflow|sequence|macro)\b/i.test(userText)) {
    push("run_pipeline", { pipelineId: "pipe_latest" },
      "Replayed the pipeline — all steps completed.");
  }
  if (/\b(delete|remove)\s+(?:pipeline|workflow|sequence|macro)\b/i.test(userText)) {
    push("delete_pipeline", { pipelineId: "pipe_latest" },
      "Deleted the pipeline.");
  }

  // --- Get spec ---
  if (/\b(spec|state|current|what.*status)\b|当前状态|规格/i.test(userText)) {
    push("get_motion_spec", {}, "Here's the current MotionSpec.");
  }

  // --- Mood intelligence ---
  if (/\b(what|which)\s+(?:feeling|emotion|mood|vibe)\b/i.test(userText) || /\b(analyze|describe)\s+(?:the\s+)?(?:mood|emotion|feeling|vibe)\b/i.test(userText)) {
    push("analyze_mood", {}, "The motion conveys a playful, energetic mood with high energy and a steady rhythm.");
  }
  // Mood intelligence: match "make it feel more premium", "give it a nostalgic vibe", etc.
  // Allow optional intensifiers (more, very, really) and articles (a, an) before the mood word.
  const MOOD_WORDS = "premium|playful|calm|energetic|dramatic|minimal|confident|gentle|urgent|nostalgic";
  const moodMatch = userText.match(new RegExp(`\\b(?:make|set|give|apply)\\s+(?:(?:it|everything|this|all)\\s+)?(?:(?:a|an)\\s+)?(?:(?:feel|vibe|mood)\\s+(?:to\\s+|more\\s+|very\\s+|really\\s+|quite\\s+)?)?(${MOOD_WORDS})\\b`, "i"))
    || userText.match(new RegExp(`\\b(?:make|set|give|apply)\\s+(?:the\\s+)?(?:mood|vibe|feeling)\\s+(?:to\\s+)?(${MOOD_WORDS})\\b`, "i"))
    || userText.match(new RegExp(`\\b(?:make|set|give|apply)\\s+(?:(?:it|everything|this|all)\\s+)?(?:a\\s+|an\\s+)?(${MOOD_WORDS})\\s+(?:vibe|feel|feeling|mood)\\b`, "i"));
  if (moodMatch) {
    const mood = moodMatch[1].toLowerCase();
    push("set_mood", { mood, scope: "project" },
      `Applied ${mood} mood to all components — easing, duration, and direction adjusted for a ${mood} aesthetic.`);
  }

  // --- Creative suggestions ---
  // Accept "surprise me", "creative ideas", "what should I do", "what would make this better"
  if (/\b(surprise|creative|inspire)\s*(?:me\s+)?/i.test(userText)
      || /\bwhat\s+(?:should|could|would|can)\s+i\b/i.test(userText)
      || /\b(?:what\s+would\s+make|how\s+(?:can|to|do)\s+i\s+improve|how\s+to\s+improve|make\s+this\s+better|improve\s+this)\b/i.test(userText)) {
    const wantsSurprise = /\bsurprise\b/i.test(userText);
    push("suggest_creative", { surprise: wantsSurprise },
      wantsSurprise
        ? "Here are some creative surprise ideas: try a glitch shader accent, send an element along a circular path, or introduce a 3D perspective tilt."
        : "Based on the current project state, here are 5 creative suggestions ranked by priority and novelty.");
  }

  // --- Visual context analysis ---
  if (/\b(visual.*context|layout.*balance|canvas.*look|composition.*review|visual.*review|spatial.*layout|visual.*balance|check.*layout|visual.*layout|how.*canvas.*look)\b/i.test(userText)) {
    push("analyze_visual_context", {},
      "Here's my visual analysis of the canvas — balance, spacing, hierarchy, color palette, overlaps, and alignment, with a composite quality score.");
  }

  // --- Code synthesis ---
  {
    const codeMatch = userText.match(/\b(generate|synthesize|write|give me|create)\s+(?:me\s+)?(?:the\s+)?(?:code|css|react|html|javascript|js|snippet)\s*(?:for|of)?\s*(?:a|an)?\s*([\w\s-]+)/i);
    const cssForAnim = /\b(give me|show me|generate|write)\s+(?:the\s+)?css\s+for\s+(?:a|an)?\s*([\w\s-]+)/i.test(userText);
    const reactCompAnim = /\b(give me|write|generate|create)\s+(?:a\s+)?react\s+component\s+for\s+(?:a|an)?\s*([\w\s-]+)/i.test(userText);
    if (codeMatch || cssForAnim || reactCompAnim) {
      const descMatch = userText.match(/\b(?:for|of)\s+(?:a|an)?\s*([\w][\w\s-]*?)(?:\s+animation|\s+effect|\s+motion|\s*$)/i);
      const description = descMatch ? descMatch[1] : "bounce in";
      const format = /react/i.test(userText) ? "react" : /html/i.test(userText) ? "html" : /javascript|js|vanilla/i.test(userText) ? "vanilla" : "css";
      push("synthesize_code", { description, format },
        `Here's the generated ${format} code for a ${description} animation — copy and paste it into your project.`);
    }
  }

  // --- State machine composer ---
  {
    const hoverPress = /\b(hover.*press|press.*hover|hover.*and.*press)\b/i.test(userText);
    const toggle = /\b(toggle.*state|state.*toggle|toggle.*on.*off|on.*off.*toggle)\b/i.test(userText);
    const loadingFlow = /\b(loading.*flow|loading.*sequence|loading.*state)\b/i.test(userText);
    const carouselSm = /\b(carousel|slide.*carousel)\b/i.test(userText);
    const tabSwitch = /\b(tab.*switch|tab.*navigation|tabs? state)\b/i.test(userText);
    const listSm = /\b(list|show|what)\b.*\bstate.*machines?\b/i.test(userText);
    const triggerState = /\b(trigger|switch|transition|go to|change to)\b.*\bstate\b/i.test(userText) && !hoverPress && !toggle && !loadingFlow && !carouselSm && !tabSwitch;
    // Custom state machine: "create a state machine with N states: idle, hover, active"
    const customSmM = userText.match(/\b(?:create|compose|build|make|design)\s+(?:a\s+|an\s+)?state\s+machine\s+(?:with\s+)?(?:(\d+)\s+)?states?\s*[:\-]?\s*([a-z][\w\s,-]+)/i);
    const customSm = !!customSmM && !listSm;

    if (listSm) {
      push("list_state_machines", {},
        "Here are the state machines in this project — each has states, transitions, and inputs.");
    } else if (customSm && customSmM) {
      // Parse the comma-separated state names after the colon/keyword.
      const rawStates = customSmM[2]
        .split(/[,]|\band\b/i)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !/^(state|states)$/i.test(s))
        .slice(0, 12);
      const states = rawStates.length > 0 ? rawStates : ["idle", "active"];
      const nameM = userText.match(/(?:called|named)\s+["']?([a-z0-9-]+)["']?/i);
      const smName = nameM ? nameM[1] : `Custom ${states.length}-State`;
      push("compose_state_machine",
        { name: smName, presetId: "custom", componentIds: [], states },
        `Composed a custom state machine "${smName}" with ${states.length} state(s): ${states.join(", ")}.`);
    } else if (hoverPress) {
      push("compose_state_machine", { name: "Hover Press", presetId: "hover-press", componentIds: [] },
        "Composed a hover-press state machine with idle, hover, and pressed states — driven by isHovered and isPressed inputs.");
    } else if (toggle) {
      push("compose_state_machine", { name: "Toggle", presetId: "toggle-on-off", componentIds: [] },
        "Composed a toggle state machine with on/off states — driven by a trigger input.");
    } else if (loadingFlow) {
      push("compose_state_machine", { name: "Loading Flow", presetId: "loading-sequence", componentIds: [] },
        "Composed a loading flow state machine with idle, loading, success, and error states.");
    } else if (carouselSm) {
      push("compose_state_machine", { name: "Carousel", presetId: "carousel", componentIds: [] },
        "Composed a carousel state machine with slide states and next/prev triggers.");
    } else if (tabSwitch) {
      push("compose_state_machine", { name: "Tab Switch", presetId: "tab-switch", componentIds: [] },
        "Composed a tab switch state machine driven by a number input for the active tab.");
    } else if (triggerState) {
      push("trigger_state_machine", { machineId: "sm_current", stateName: "active" },
        "Transitioned the state machine to the requested state.");
    }
  }

  // --- Multimodal generation: image ---
  if (/\b(?:generate|create|draw|render|make)\s+(?:an?\s+)?(?:image|picture|visual|illustration)\b/i.test(userText)) {
    const promptM = userText.match(/(?:of|showing|depicting|with|illustrating)\s+(.+)$/i);
    const prompt = promptM ? promptM[1].trim().slice(0, 280) : "abstract gradient composition";
    push("generate_image", { prompt },
      `Generated an image from the prompt: "${prompt.slice(0, 80)}"`);
  }

  // --- Multimodal generation: speech ---
  if (/\b(?:generate|read|narrate|voice|speak|say)\s+(?:this\s+)?(?:aloud|text|speech|audio)\b|\btext.to.speech\b/i.test(userText)) {
    const quotedM = userText.match(/["']([^"']+)["']/);
    const sayM = userText.match(/(?:say|read|speak|narrate)\s+(?:this\s+)?(?:aloud\s+)?(.+)/i);
    const text = quotedM ? quotedM[1] : (sayM ? sayM[1].trim().slice(0, 280) : "Hello, this is a generated speech sample.");
    push("generate_speech", { text },
      `Generated speech audio for: "${text.slice(0, 80)}"`);
  }

  // --- Multimodal generation: video ---
  if (/\b(?:generate|create|make|produce|animate)\s+(?:a\s+)?(?:video|clip|movie|sequence|animation video)\b/i.test(userText)) {
    const promptM = userText.match(/(?:of|showing|depicting|with|about)\s+(.+)$/i);
    const prompt = promptM ? promptM[1].trim().slice(0, 280) : "smooth camera pan over a landscape";
    push("generate_video", { prompt },
      `Generated a video from the prompt: "${prompt.slice(0, 80)}"`);
  }

  // --- Multimodal generation: 3D model ---
  if (/\b(?:generate|create|make|build)\s+(?:a\s+)?(?:3d|three.?d|mesh|model)\b/i.test(userText)) {
    const promptM = userText.match(/(?:of|for|showing|depicting|with|about)\s+(.+)$/i);
    const prompt = promptM ? promptM[1].trim().slice(0, 280) : "a low-poly character model";
    push("generate_3d", { prompt },
      `Generated a 3D model from the prompt: "${prompt.slice(0, 80)}"`);
  }

  // --- Multimodal generation: list models ---
  if (/\b(?:list|show|what)\s+(?:available\s+)?(?:models?|providers?|llms?)\b/i.test(userText)) {
    const providerM = userText.match(/\b(?:from|via|provider)\s+(\w+)/i);
    push("list_models", { provider: providerM ? providerM[1] : undefined },
      "Here are the available AI models across all configured providers, with their capabilities and modalities.");
  }

  return { calls, replies };
}

const FALLBACK_REPLY =
  "I can adjust easing (bouncy, smooth, snappy, elastic, back, linear), spring physics (stiffness/damping/mass), " +
  "duration (slower, faster, specific ms), global timing, delay, loop (forever, N times), fill mode, colors (text + background), " +
  "border radius, transform tracks (translateX/scale/rotate/opacity from→to), keyframes, add/remove layers, add scenes, " +
  "list/remove scenes, describe motion (Motion DNA), analyze motion (quality, timing, accessibility), suggest next steps, " +
  "set motion paths (orbit, circle, ellipse, line, bezier), " +
  "stagger components (cascade, sequence, one by one), " +
  "match template (find closest fit), create variant (try different easing/duration), " +
  "apply presets (shake, wiggle, float, glow, heartbeat, typewriter), " +
  "apply style presets (playful, energetic, calm, professional, dramatic, minimal, cinematic, glassy, retro, futuristic, organic, mechanical, luxury, industrial, neon, vintage, athletic) across all components, " +
  "recognize patterns (easing monotony, timing uniformity, incomplete lifecycle, motion overload), " +
  "harmonize colors (complementary, analogous, triadic, monochrome), " +
  "choreograph components (cascade, wave, ripple, canon, converge, spiral, explosion, assembly, breathing, domino, scatter), " +
  "refine motion (snappier, smoother, more dramatic, calmer, subtler, more energetic, bouncier, softer), " +
  "set custom bezier easing curves, set keyframe interpolation (linear, ease, hold), " +
  "add/remove per-property keyframes, " +
  "set triggers (onLoad, onClick, onHover, onScroll, afterDelay), toggle onion skinning, open fullscreen preview, " +
  "batch updates, duplicate, reorder, pause/play, " +
  "nudge components by pixel deltas, copy/paste via clipboard, " +
  "capture/apply states, add transitions between states, list/remove states, " +
  "toggle auto-keyframe mode, add/remove event listeners (click, hover, pointer events), " +
  "move/retime keyframes to new offsets, " +
  "add/remove/list timeline markers (bookmark time positions), " +
  "reverse keyframe order (play backward), " +
  "analyze restraint (motion density, visual competition, 0-100 score), " +
  "browse/apply motion recipes (gentle entrance, impact reveal, elastic bounce, cinematic fade, data pulse, ambient float, typewriter reveal, magnetic hover, swift dismissal, graceful departure, skeleton shimmer, progress march, toast rise, bar grow, confetti burst) with avoidance checks, " +
  "save/recall persistent project memory (cross-session knowledge), " +
  "list auto-generated skills (learned from past task sequences), " +
  "compile motion grammar expressions (fade.in(600ms) then slide.up(400ms) with easing(spring)), " +
  "parse natural language motion descriptions ('make it bounce in playfully with spring physics'), " +
  "apply WebGL shader effects (chromatic aberration, glitch, plasma, neon glow, pixelate, vignette, noise, ripple, gradient shift, invert pulse, aurora, vortex, mesh gradient, dot orbit, dot grid, warp, swirl, waves, perlin, simplex, voronoi, metaballs, pulsing border, smoke ring, god rays, heatmap, liquid metal, gem smoke, halftone dots, halftone cmyk, dithering, grain gradient, color panels, paper texture, fluted glass, water), " +
  "save/list/restore/delete version snapshots (time-travel through project states), " +
  "manage design tokens (duration, easing, color, spacing, radius — reusable $name references), " +
  "save/list/run/delete tool pipelines (reusable sequences of tool calls — record a workflow once, replay it on any project), " +
  "analyze mood (emotional character of motion — premium, playful, calm, energetic, dramatic, minimal, confident, gentle, urgent, nostalgic) and set mood (translate emotional language into motion parameters), " +
  "suggest creative ideas (context-aware next steps with surprise mode for unexpected but aesthetically valid combinations), " +
  "analyze visual context (canvas layout balance, spacing consistency, hierarchy, color palette, overlaps, alignment — 0-100 visual quality score), " +
  "synthesize standalone animation code from natural language (CSS, React, HTML, or vanilla JS — copy-pasteable snippets), " +
  "compose state machines (hover-press, toggle, loading-sequence, carousel, tab-switch presets with states, transitions, and inputs), " +
  "list and trigger state machine transitions, " +
  "blend two motions at a ratio, interpolate between components, merge animated properties, " +
  "analyze animation principles (squash & stretch, anticipation, staging, slow in/out, arcs, secondary action, timing, exaggeration, solid drawing, appeal, follow through, overlapping action), " +
  "synthesize easing from semantic descriptions (weighty, featherlight, snappy, dramatic, playful, elegant, organic, mechanical, bouncy, calm, aggressive, energetic, light), " +
  "apply choreography patterns (cascade, call_response, unison, counterpoint, wave, canon, stagger_grid, ripple_out), " +
  "analyze emotional impact (anticipation, surprise, delight, tension, release, curiosity, satisfaction, urgency, calm, joy, trust — emotional arc and peak intensity), " +
  "analyze visual rhythm (beat detection, tempo BPM, rhythm type — steady, syncopated, rubato, accelerando, decelerando, chaotic — groove and conflict detection), " +
  "analyze narrative coherence (5-act story arc — setup, rising, climax, falling, resolution — pacing and coherence scoring, personality archetype, attention flow mapping), " +
  "list/switch templates (fade, fade-out, bounce, slide, slide-out, scale, zoom-out, flip, spin, pulse, spring, resize, logo-reveal, squash-stretch, " +
  "flip-card, typewriter, shimmer, morph, notification, progress, ripple, marquee, orbit, wave, confetti, " +
  "parallax, kinetic-text, particle-burst, liquid-morph, elastic-collapse, glitch, reveal-3d, gradient-shift, " +
  "elastic-scale, text-scramble, aurora, hologram, prismatic, liquid-metal, neon-flicker, depth-card, " +
  "glassmorphism, kinetic-ribbon, magnetic-pull, collapse-down, dissolve-out, data-stream, gravity-drop, " +
  "chromatic-pulse, breathing-light, magnetic-ripple, counter, text-reveal, blur-reveal, kinetic-typography, " +
  "split-text, mouse-parallax, long-press), export (HTML, CSS, JSON, React, Lottie, video, skill), or show a preview. " +
  "Tell me what you'd like to do.";

export class MockProvider implements LlmProvider {
  readonly name = "mock" as const;
  readonly supportsNativeToolCalls = true;
  readonly supportsVision = false;
  readonly supportsStreaming = true;

  async chat(options: ChatOptions): Promise<ChatResult> {
    const state = extractState(options.messages);
    const lastUser = [...options.messages].reverse().find((m) => m.role === "user");
    const userText = typeof lastUser?.content === "string" ? lastUser.content : extractText(lastUser?.content ?? "");
    const lastAssistantToolCalls = [...options.messages]
      .reverse()
      .find((m) => m.role === "assistant")?.toolCalls;

    // Phase 1: issue tool calls for this turn.
    if (!lastAssistantToolCalls || lastAssistantToolCalls.length === 0) {
      const { calls, replies } = matchIntents(state, userText);

      if (calls.length > 0) {
        // Emit a reasoning trace so the user sees the agent's plan before tools run.
        // The replies describe each planned action; join them into a single trace.
        const reasoning = replies.length > 0
          ? replies.join(" ")
          : `I'll use ${calls.map((c) => c.tool).join(", ")} to handle that.`;
        await streamText(options, reasoning);
        return { text: reasoning, toolCalls: calls, tokensIn: 0, tokensOut: 0, provider: "mock", model: "mock" };
      }

      await streamText(options, FALLBACK_REPLY);
      return { text: FALLBACK_REPLY, toolCalls: [], tokensIn: 0, tokensOut: 0, provider: "mock", model: "mock" };
    }

    // Phase 2: tool calls were executed; produce a final summary.
    const { replies } = matchIntents(state, userText);
    const reply = replies.length > 0
      ? replies.join(" ")
      : "Done — I applied that change. Anything else you'd like to tune?";
    await streamText(options, reply);
    return { text: reply, toolCalls: [], tokensIn: 0, tokensOut: 0, provider: "mock", model: "mock" };
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
