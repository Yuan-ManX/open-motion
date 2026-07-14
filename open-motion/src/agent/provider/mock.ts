import type { ChatOptions, ChatResult, LlmProvider, LlmToolCall } from "./types.js";
import { createId } from "../../utils/id.js";
import { resolveTemplateId, resolvePresetName } from "../intents.js";

interface ParsedState {
  componentIds: string[];
  firstComponentId: string | null;
  secondComponentId: string | null;
  projectName: string | null;
}

function extractState(messages: ChatOptions["messages"]): ParsedState {
  const sys = messages.find((m) => m.role === "system")?.content ?? "";
  const ids = Array.from(sys.matchAll(/\bc_[a-zA-Z0-9]{4,}\b/g)).map((m) => m[0]);
  return {
    componentIds: ids,
    firstComponentId: ids[0] ?? null,
    secondComponentId: ids[1] ?? null,
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

  // --- Export Lottie ---
  if (/(\bexport\b|导出).*\b(lottie|after\s*effects)\b/i.test(userText)) {
    const fpsM = userText.match(/\b(\d+)\s*fps\b/i);
    push("export_lottie", { fps: fpsM ? parseInt(fpsM[1], 10) : undefined },
      "Exported the animation as a Lottie JSON file — ready for web, mobile, or After Effects.");
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
      `Analyzed motion against Disney's 12 principles — overall score 72/100. Present: slow_in_out, timing, staging. Missing: squash_stretch, anticipation, follow_through. Top suggestion: add anticipation keyframe before the main action.`);
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
  if (/\b(add transition|connect states|transition from)\b/i.test(userText)) {
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
  if (/\b(list|show).*(constraint)\b/i.test(userText)) {
    push("list_constraints", {}, "Here are all constraints in the project.");
  }

  // --- Timeline clips ---
  if (/\b(clip|segment)\b/i.test(userText) && !/\b(list|show|remove|delete|play)\b/i.test(userText)) {
    push("add_clip", { name: "Clip 1", startMs: 0, endMs: 1000 },
      "Created a new timeline clip from 0ms to 1000ms.");
  }
  if (/\b(list|show).*(clip)\b/i.test(userText)) {
    push("list_clips", {}, "Here are all timeline clips.");
  }
  if (/\bplay.*(clip)\b/i.test(userText)) {
    push("play_clip", { clipId: "clip_demo" }, "Playing the timeline clip.");
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

  // --- Restraint analysis ---
  if (/\b(too much|too many|restraint|density|overwhelm\w*|clutter\w*|visual noise|competing for attention|is this too busy)\b/i.test(userText)) {
    push("analyze_restraint", {}, "Analyzed motion density — here's the restraint score and recommendations.");
  }

  // --- Motion recipes: browse or apply ---
  if (/\b(recipe|recipes)\b/i.test(userText) && !/\b(apply|use|try)\b/i.test(userText) && !/\b(save|seed|project|my|delete|remove)\b/i.test(userText)) {
    const catM = userText.match(/\b(entrance|playful|transition|feedback|ambient|text|interaction)\b/i);
    push("list_recipes", catM ? { category: catM[1].toLowerCase() } : {},
      catM ? `Here are the ${catM[1].toLowerCase()} recipes available.` : "Here are all available motion recipes with their avoidance conditions.");
  }
  if (/\b(apply|use|try)\s+(?:the\s+)?([\w\s-]+?)\s+recipe\b|apply.*recipe/i.test(userText) && state.firstComponentId) {
    const recipeNameM = userText.match(/(?:apply|use|try)\s+(?:the\s+)?([\w\s-]+?)\s+recipe/i);
    const recipeId = recipeNameM ? `recipe-${recipeNameM[1].trim().toLowerCase().replace(/\s+/g, "-")}` : "recipe-gentle-entrance";
    push("apply_recipe", { componentId: state.firstComponentId, recipeId },
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

  // --- Motion captures: save, list, apply, seed, delete ---
  if (/\b(seed.*captures?|example.*captures?|example.*path|captures?.*example)/i.test(userText)) {
    push("seed_motion_captures", {},
      "Seeded the project with 3 example motion captures: Sine Wave Path, Spiral Inward, and Bounce Trail.");
  }
  if (/\b(list.*captures?|show.*captures?|list.*path|what.*captures?)/i.test(userText) && !/\b(apply|delete|seed|save)\b/i.test(userText)) {
    push("list_motion_captures", {},
      "Here are your saved motion captures with sample counts and durations.");
  }
  if (/\b(save.*captures?|record.*cursor|record.*path|captures?.*gesture|captures?.*trajectory|draw.*path|draw.*motion)/i.test(userText)) {
    // Generate a synthetic sine-wave capture as the recorded trajectory.
    const samples: Array<{ t: number; x: number; y: number }> = [];
    for (let i = 0; i <= 24; i++) {
      const t = (i / 24) * 1800;
      const x = (i / 24) * 200 - 100;
      const y = Math.sin((i / 24) * Math.PI * 3) * 60;
      samples.push({ t, x, y });
    }
    const nameM = userText.match(/(?:save|record|capture|draw)\s+(?:the\s+|this\s+|a\s+)?(.+)/i);
    const name = nameM ? nameM[1].trim().slice(0, 60) : "Recorded Path";
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
  if (/\b(check.*accessibility|accessibility.*check|is.*safe|vestibular|seizure.*risk|flashing.*risk|strobing|reduced.*motion|WCAG|a11y|motion.*safety|safe.*motion|accessibility)/i.test(userText)) {
    push("check_accessibility", {},
      "Accessibility report: 2 warnings (large displacement on hero, infinite loop without reduced-motion alternative), 1 info (inconsistent timing). Score: 76/100. Remediation: reduce hero translation, add reduced-motion media query, and align timing to 400ms/800ms tiers.");
  }

  // --- Performance check ---
  if (/\b(check.*performance|performance.*check|frame.*budget|is.*performant|fps|jank|optimize.*performance|performance.*issue|perf.*check|render.*cost|animation.*cost)/i.test(userText)) {
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
  if (/\b(grammar|compile.*motion)\b/i.test(userText) && state.firstComponentId) {
    const sourceM = userText.match(/grammar[:\s]+(.+)/i);
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
  if (/\b(shader|glitch effect|chromatic aberration|neon glow|plasma|pixelate|vignette|film grain|ripple effect|gradient shift|aurora|vortex)\b/i.test(userText) && state.firstComponentId) {
    const effectMap: Record<string, string> = {
      "chromatic": "shader-chromatic",
      "glitch": "shader-glitch",
      "plasma": "shader-plasma",
      "noise": "shader-noise",
      "grain": "shader-noise",
      "ripple": "shader-ripple",
      "vignette": "shader-vignette",
      "neon": "shader-neon-glow",
      "pixelate": "shader-pixelate",
      "pixel": "shader-pixelate",
      "gradient": "shader-gradient-shift",
      "invert": "shader-invert-pulse",
      "aurora": "shader-aurora",
      "vortex": "shader-vortex",
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
  if (/\b(list|show|view)\s+(?:versions?|snapshots?|history)\b/i.test(userText)) {
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
  if (/\b(list|show|view)\s+(?:tokens?|design\s+tokens?)\b/i.test(userText)) {
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

  // --- Tool pipelines: save, list, run, delete reusable sequences ---
  if (/\b(save|record|create)\s+(?:a\s+)?(?:pipeline|workflow|sequence|macro)\b/i.test(userText)) {
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
  if (/\b(list|show|view)\s+(?:pipelines?|workflows?|sequences?|macros?)\b/i.test(userText)) {
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
  const moodMatch = userText.match(/\b(make|set|give|apply)\s+(?:it|everything|this|all)?\s*(?:feel|vibe|mood)?\s*(premium|playful|calm|energetic|dramatic|minimal|confident|gentle|urgent|nostalgic)\b/i);
  if (moodMatch) {
    push("set_mood", { mood: moodMatch[2].toLowerCase(), scope: "project" },
      `Applied ${moodMatch[2].toLowerCase()} mood to all components — easing, duration, and direction adjusted for a ${moodMatch[2].toLowerCase()} aesthetic.`);
  }

  // --- Creative suggestions ---
  if (/\b(surprise|creative|inspire)\s*(?:me\s+)?/i.test(userText) || /\bwhat\s+(?:should|could|would|can)\s+i\b/i.test(userText)) {
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

    if (listSm) {
      push("list_state_machines", {},
        "Here are the state machines in this project — each has states, transitions, and inputs.");
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
  "browse/apply motion recipes (gentle entrance, impact reveal, elastic bounce, cinematic fade, data pulse, ambient float, typewriter reveal, magnetic hover) with avoidance checks, " +
  "save/recall persistent project memory (cross-session knowledge), " +
  "list auto-generated skills (learned from past task sequences), " +
  "compile motion grammar expressions (fade.in(600ms) then slide.up(400ms) with easing(spring)), " +
  "parse natural language motion descriptions ('make it bounce in playfully with spring physics'), " +
  "apply WebGL shader effects (chromatic aberration, glitch, plasma, neon glow, pixelate, vignette, noise, ripple, gradient shift), " +
  "save/list/restore/delete version snapshots (time-travel through project states), " +
  "manage design tokens (duration, easing, color, spacing, radius — reusable $name references), " +
  "save/list/run/delete tool pipelines (reusable sequences of tool calls — record a workflow once, replay it on any project), " +
  "analyze mood (emotional character of motion — premium, playful, calm, energetic, dramatic, minimal, confident, gentle, urgent, nostalgic) and set mood (translate emotional language into motion parameters), " +
  "suggest creative ideas (context-aware next steps with surprise mode for unexpected but aesthetically valid combinations), " +
  "analyze visual context (canvas layout balance, spacing consistency, hierarchy, color palette, overlaps, alignment — 0-100 visual quality score), " +
  "synthesize standalone animation code from natural language (CSS, React, HTML, or vanilla JS — copy-pasteable snippets), " +
  "compose Rive-inspired state machines (hover-press, toggle, loading-sequence, carousel, tab-switch presets with states, transitions, and inputs), " +
  "list and trigger state machine transitions, " +
  "list/switch templates (fade, bounce, slide, scale, flip, spin, pulse, spring, resize, logo-reveal, squash-stretch, " +
  "flip-card, typewriter, shimmer, morph, notification, progress, ripple, marquee, orbit, wave, confetti, " +
  "parallax, kinetic-text, particle-burst, liquid-morph, elastic-collapse, glitch, reveal-3d, gradient-shift, " +
  "elastic-scale, text-scramble, aurora, hologram, prismatic, liquid-metal, neon-flicker, depth-card, " +
  "glassmorphism, kinetic-ribbon, magnetic-pull), export (HTML, CSS, JSON, React, Lottie, video, skill), or show a preview. " +
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
