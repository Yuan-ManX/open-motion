import type { ChatOptions, ChatResult, LlmProvider, LlmToolCall } from "./types.js";
import { createId } from "../../utils/id.js";
import { resolveTemplateId, resolvePresetName } from "../intents.js";

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
    const createBareM = userText.match(
      /\b(?:create|make|build|generate|design)\s+(?:a\s+|an\s+|the\s+)?([\w][\w\s-]+)\s*$/i,
    );
    if (createBareM) {
      const raw = createBareM[1].trim();
      if (resolveTemplateId(raw)) createRaw = raw;
    }
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
    const raw = (tplM[1] || tplM[2] || "").trim();
    const resolved = resolveTemplateId(raw);
    if (resolved) {
      push("set_template", { templateId: resolved }, `Switched to the ${resolved} template.`);
    } else {
      push("set_template", { templateId: `tpl-${raw.toLowerCase().replace(/\s+/g, "-")}` }, `Switched to the ${raw} template.`);
    }
  }

  // --- Apply preset (shake, wiggle, float, glow, heartbeat, typewriter) ---
  const presetM = userText.match(/\b(?:apply|use)\s+(?:the\s+)?(shake|wiggle|float|glow|heartbeat|type[\s-]?writer)\s+(?:preset|effect|animation)?\b/i);
  if (presetM && state.firstComponentId) {
    const name = resolvePresetName(presetM[1]);
    if (name) {
      push("apply_preset", { componentId: state.firstComponentId, preset: name },
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

  // --- Set motion path (orbit, circle, ellipse, line, bezier) ---
  if (/\b(orbit|circle|ellipse|along.*path|trajectory|fly across|move in a)\b/i.test(userText) && state.firstComponentId) {
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
  if (/\b(stagger|cascade|sequence|one by one|sequential)\b|错开|依次|逐个/i.test(userText)) {
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

  // --- Create variant ---
  if (/\b(variant|variation|alternative|try.*different|what.*look.*with)\b|变体|变奏|试试/i.test(userText)) {
    if (state.firstComponentId) {
      const variantEasing = /smooth|平滑/.test(userText) ? { type: "preset", name: "ease-in-out" } : /snappy|干脆/.test(userText) ? { type: "preset", name: "ease-in" } : undefined;
      const variantDur = parseDuration(userText, 0) || undefined;
      push("create_variant", { componentId: state.firstComponentId, easing: variantEasing, durationMs: variantDur }, "Created a variation so you can compare side by side.");
    }
  }

  // --- Style presets: apply coordinated aesthetic across all components ---
  const styleM = userText.match(/\b(playful|energetic|calm|professional|dramatic|minimal)\b/i);
  if (styleM && state.firstComponentId) {
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
  if (/\b(choreograph|orchestrat|wave pattern|ripple effect|cascade|canon|converge)\b/i.test(userText) && state.firstComponentId) {
    const patternM = userText.match(/\b(cascade|wave|ripple|canon|converge)\b/i);
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
  if (/\b(zoom\s*(in|out)|fit.*screen|frame.*select|reset.*view|pan\s*canvas)\b/i.test(userText)) {
    const args: Record<string, unknown> = {};
    if (/\bfit.*screen|reset.*view\b/i.test(userText)) args.fit = true;
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
  if (/\b(ruler|toggle.*ruler|show.*ruler|hide.*ruler)\b/i.test(userText)) {
    const show = !/\b(hide|off|disable)\b/i.test(userText);
    push("set_rulers", { show },
      show ? "Showing canvas rulers." : "Hiding canvas rulers.");
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
  "list/remove scenes, describe motion (Motion DNA), analyze motion (quality, timing, accessibility), suggest next steps, " +
  "set motion paths (orbit, circle, ellipse, line, bezier), " +
  "stagger components (cascade, sequence, one by one), " +
  "match template (find closest fit), create variant (try different easing/duration), " +
  "apply presets (shake, wiggle, float, glow, heartbeat, typewriter), " +
  "apply style presets (playful, energetic, calm, professional, dramatic, minimal) across all components, " +
  "recognize patterns (easing monotony, timing uniformity, incomplete lifecycle, motion overload), " +
  "harmonize colors (complementary, analogous, triadic, monochrome), " +
  "choreograph components (cascade, wave, ripple, canon, converge), " +
  "refine motion (snappier, smoother, more dramatic, calmer, subtler, more energetic, bouncier, softer), " +
  "set custom bezier easing curves, set keyframe interpolation (linear, ease, hold), " +
  "add/remove per-property keyframes, " +
  "set triggers (onLoad, onClick, onHover, onScroll, afterDelay), toggle onion skinning, open fullscreen preview, " +
  "batch updates, duplicate, reorder, pause/play, " +
  "list/switch templates (fade, bounce, slide, scale, flip, spin, pulse, spring, resize, logo-reveal, squash-stretch, " +
  "flip-card, typewriter, shimmer, morph, notification, progress, ripple, marquee, orbit, wave, confetti, " +
  "parallax, kinetic-text, particle-burst, liquid-morph, elastic-collapse), export (HTML, CSS, JSON, React, video, skill), or show a preview. " +
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
        // Emit a reasoning trace so the user sees the agent's plan before tools run.
        // The replies describe each planned action; join them into a single trace.
        const reasoning = replies.length > 0
          ? replies.join(" ")
          : `I'll use ${calls.map((c) => c.tool).join(", ")} to handle that.`;
        await streamText(options, reasoning);
        return { text: reasoning, toolCalls: calls, tokensIn: 0, tokensOut: 0 };
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
