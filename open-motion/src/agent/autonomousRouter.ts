/**
 * Autonomous Task Router — decomposes high-level user requests into
 * executable tool-selection plans with a fallback chain so the Agent
 * always converges on a solution, even when the primary path fails.
 *
 * The router performs three passes:
 *   1. Intent classification — maps the request into one of 16 intent buckets.
 *   2. Tool-path expansion — each bucket produces a ranked list of tools.
 *   3. Fallback chaining — when primary tools fail, the next strategy runs.
 */

import { TOOL_NAMES, type ToolName } from "@openmotion/shared";
import { executeTool, type ToolContext, type ToolResult } from "./tools/registry.js";
import { inferIntent } from "./motionSemantics.js";
import { listCollaborationModules, planCollaboration, executeCollaboration } from "./motionCollaboration.js";
import { detectEmotionFromText, synthesizeFromEmotion } from "./motionEmotion.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntentBucket =
  | "create_component"
  | "apply_template"
  | "apply_preset"
  | "modify_properties"
  | "tune_easing"
  | "choreograph_timeline"
  | "run_collaboration"
  | "analyze_project"
  | "export_output"
  | "manage_project"
  | "query_catalog"
  | "run_pipeline"
  | "accessibility_tuning"
  | "performance_tuning"
  | "style_and_branding"
  | "free_form_conversation";

export interface ToolStep {
  /** The tool to call. */
  tool: ToolName;
  /** Static arg overrides for this step (template ids, preset names, etc.). */
  staticArgs?: Record<string, unknown>;
  /** Text fragments from the request that should be forwarded to this step. */
  forwardFields?: string[];
  /** Human-readable explanation for the choice. */
  rationale: string;
  /** Confidence for this step being the correct one. */
  confidence: number;
  /** How many times this step can be retried before moving to the fallback. */
  maxRetries: number;
}

export interface RouterPlan {
  /** The primary intent inferred for the request. */
  intent: IntentBucket;
  /** Key concepts surfaced from semantic analysis. */
  concepts: Array<{ label: string; confidence: number }>;
  /** Emotion tag if one was detected. */
  emotion: string | null;
  /** Ordered list of steps; first one that succeeds wins. */
  steps: ToolStep[];
  /** If every step fails, these collaboration modules are still worth trying. */
  collaborationFallbackModules: string[];
  /** Text explanation of the routing decision for UI transparency. */
  reasoning: string;
}

export interface RouterExecution {
  plan: RouterPlan;
  results: Array<{ stepIndex: number; tool: ToolName; ok: boolean; summary: string }>;
  /** Final resolved tool result (the successful one, or the last failure). */
  finalResult: ToolResult | null;
  /** Which strategy produced the result: "tool" | "collaboration" | "simulated". */
  strategy: "tool" | "collaboration" | "simulated";
}

// ---------------------------------------------------------------------------
// Intent Classification
// ---------------------------------------------------------------------------

const BUCKET_KEYWORDS: Record<IntentBucket, string[]> = {
  create_component: ["create", "add", "new", "make", "build", "generate", "生成", "新建", "创建", "添加"],
  apply_template: ["template", "preset", "use", "apply", "模板", "预设", "套用", "use template"],
  apply_preset: ["preset", "run preset", "recipe", "effect", "效果", "特效", "预设效果"],
  modify_properties: ["change", "modify", "set", "update", "tweak", "adjust", "修改", "调整", "改变", "设置"],
  tune_easing: ["easing", "curve", "slow", "fast", "spring", "smooth", "缓动", "曲线", "动画曲线"],
  choreograph_timeline: ["timeline", "sequence", "order", "stagger", "delay", "时间轴", "序列", "顺序", "交错"],
  run_collaboration: ["collaborate", "multi-engine", "all modules", "comprehensive", "deep", "全面", "综合", "协作", "深度"],
  analyze_project: ["analyze", "inspect", "check", "review", "audit", "health", "gaze", "chronopath", "attention", "eye", "context", "session", "direction", "creative", "style", "pattern", "debate", "polish", "self-check", "reflect", "quality", "verdict", "judge", "critique", "heuristic", "principle", "flow", "momentum", "how am i doing", "what next", "stuck", "atelier", "manifesto", "workflow", "stage", "progress", "wrap up", "summarize", "retrospective", "synesthesia", "harmonic", "topology", "alchemy", "cinema", "cross-sensory", "cross-modal", "topological", "alchemical", "cinematic", "harmony", "frequency", "resonance", "camera", "shot", "film", "movie", "framing", "目光", "分析", "检查", "审查", "健康度", "创意", "方向", "辩论", "打磨", "自检", "质量", "启发式", "原则", "心流", "动量", "卡住", "工作室", "宣言", "工作流", "阶段", "总结", "联觉", "通感", "谐波", "拓扑", "炼金术", "电影", "镜头", "跨感官", "谐波", "频率", "共振"],
  export_output: ["export", "render", "output", "download", "导出", "渲染", "输出", "下载"],
  manage_project: ["project", "rename", "delete", "save", "clone", "项目", "重命名", "删除", "保存"],
  query_catalog: ["search", "find", "list", "catalog", "browse", "搜索", "查找", "浏览", "目录"],
  run_pipeline: ["pipeline", "batch", "workflow", "process", "流水线", "批量", "流程", "处理"],
  accessibility_tuning: ["accessible", "accessibility", "a11y", "reduced", "quiet", "safe", "wcag", "无障碍", "易访问", "安全"],
  performance_tuning: ["performance", "fast", "optimize", "fps", "lightweight", "性能", "优化", "流畅", "轻量"],
  style_and_branding: ["style", "brand", "theme", "palette", "color", "look", "风格", "品牌", "主题", "配色", "色彩"],
  free_form_conversation: [],
};

function classifyIntent(text: string): { bucket: IntentBucket; score: number; secondary: IntentBucket | null } {
  const lower = text.toLowerCase();
  const scored: Array<{ bucket: IntentBucket; score: number }> = [];

  for (const [bucketRaw, keywords] of Object.entries(BUCKET_KEYWORDS)) {
    const bucket = bucketRaw as IntentBucket;
    if (keywords.length === 0) continue;
    let hits = 0;
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) hits += 1;
    }
    if (hits > 0) scored.push({ bucket, score: hits / keywords.length });
  }

  scored.sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { bucket: "free_form_conversation", score: 0, secondary: null };
  }
  if (scored.length === 1) {
    return { bucket: scored[0].bucket, score: scored[0].score, secondary: null };
  }
  return {
    bucket: scored[0].bucket,
    score: scored[0].score,
    secondary: scored[1].bucket,
  };
}

// ---------------------------------------------------------------------------
// Tool-Path Expansion
// ---------------------------------------------------------------------------

/**
 * Produce a ranked list of ToolStep candidates for a given intent bucket.
 * Each entry has its own rationale and confidence so the frontend can show
 * why the router chose a given path and when a fallback kicked in.
 */
function expandIntentToSteps(bucket: IntentBucket, request: string): ToolStep[] {
  const lower = request.toLowerCase();

  switch (bucket) {
    case "create_component": {
      const steps: ToolStep[] = [
        {
          tool: "generate_motion_code" as ToolName,
          forwardFields: ["request"],
          rationale: "Use the generator to translate natural language into a new component with initial styling and a draft keyframe curve.",
          confidence: 0.92,
          maxRetries: 2,
        },
      ];
      // If the request implies a specific template, route through apply_template first.
      if (lower.includes("float") || lower.includes("card") || lower.includes("button")) {
        steps.unshift({
          tool: "set_template",
          staticArgs: { templateId: resolveTemplateFromRequest(request) ?? "tpl-float" },
          rationale: "Request appears to target a common component archetype — start from a template for a quicker build.",
          confidence: 0.85,
          maxRetries: 1,
        });
      }
      steps.push({
        tool: "add_layer",
        forwardFields: ["request"],
        rationale: "Simple add-component is always available as a conservative fallback.",
        confidence: 0.6,
        maxRetries: 1,
      });
      return steps;
    }

    case "apply_template": {
      const tplId = resolveTemplateFromRequest(request);
      return [
        {
          tool: "set_template",
          staticArgs: tplId ? { templateId: tplId } : undefined,
          forwardFields: tplId ? [] : ["request"],
          rationale: tplId ? `Direct template match: ${tplId}.` : "Search templates by name and apply the best match.",
          confidence: tplId ? 0.95 : 0.78,
          maxRetries: 2,
        },
        {
          tool: "generate_motion_code" as ToolName,
          forwardFields: ["request"],
          rationale: "Template lookup can always fall back to a full generator pass.",
          confidence: 0.7,
          maxRetries: 1,
        },
      ];
    }

    case "apply_preset": {
      const preset = resolvePresetFromRequest(request);
      return [
        {
          tool: "apply_preset",
          staticArgs: preset ? { presetName: preset } : undefined,
          forwardFields: preset ? [] : ["request"],
          rationale: preset ? `Preset matched: "${preset}".` : "Search preset library by keyword.",
          confidence: preset ? 0.93 : 0.76,
          maxRetries: 2,
        },
        {
          tool: "set_static_style",
          forwardFields: ["request"],
          rationale: "Fallback: apply direct property changes that approximate the preset intent.",
          confidence: 0.55,
          maxRetries: 1,
        },
      ];
    }

    case "modify_properties":
      return [
        {
          tool: "set_static_style",
          forwardFields: ["request"],
          rationale: "Direct property mutation is the standard path for modify requests.",
          confidence: 0.88,
          maxRetries: 2,
        },
        {
          tool: "batch_update",
          forwardFields: ["request"],
          rationale: "Bulk-set is a good fallback when multiple components need tuning.",
          confidence: 0.7,
          maxRetries: 1,
        },
      ];

    case "tune_easing":
      return [
        {
          tool: "set_easing",
          forwardFields: ["request"],
          rationale: "Use the easing setter with keyword-to-easing lookup.",
          confidence: 0.9,
          maxRetries: 2,
        },
        {
          tool: "set_static_style",
          staticArgs: { property: "easing" },
          forwardFields: ["request"],
          rationale: "Fallback to generic property assignment targeting the easing field.",
          confidence: 0.6,
          maxRetries: 1,
        },
      ];

    case "choreograph_timeline":
      return [
        {
          tool: "stagger_components",
          forwardFields: ["request"],
          rationale: "Dedicated timeline choreographer handles ordering, staggering and delay grids.",
          confidence: 0.87,
          maxRetries: 2,
        },
        {
          tool: "set_static_style",
          staticArgs: { property: "delayMs" },
          forwardFields: ["request"],
          rationale: "When arrangement fails, still adjust individual delays as a best-effort.",
          confidence: 0.52,
          maxRetries: 1,
        },
      ];

    case "run_collaboration":
      return [
        {
          tool: "plan_collaboration",
          forwardFields: ["request"],
          rationale: "Delegates the full multi-engine collaboration pipeline directly.",
          confidence: 0.96,
          maxRetries: 1,
        },
      ];

    case "analyze_project":
      return [
        {
          tool: "get_atelier_report",
          forwardFields: ["request"],
          rationale: "Atelier report provides holistic session view across all quality and flow dimensions.",
          confidence: 0.96,
          maxRetries: 1,
        },
        {
          tool: "run_heuristics",
          forwardFields: ["request"],
          rationale: "Design heuristics evaluation checks 7 quality principles with actionable suggestions.",
          confidence: 0.94,
          maxRetries: 1,
        },
        {
          tool: "get_flow_state",
          forwardFields: ["request"],
          rationale: "Creative flow state reveals momentum, focus, and phase-based guidance.",
          confidence: 0.88,
          maxRetries: 1,
        },
        {
          tool: "run_motion_debate",
          forwardFields: ["request"],
          rationale: "Adversarial three-judge design debate provides deep quality review with concrete revision tasks.",
          confidence: 0.92,
          maxRetries: 1,
        },
        {
          tool: "run_reflection_loop",
          forwardFields: ["request"],
          rationale: "Automatic post-turn reflection loop critiques and polishes the spec across four quality dimensions.",
          confidence: 0.9,
          maxRetries: 1,
        },
        {
          tool: "describe_motion",
          forwardFields: ["request"],
          rationale: "Full project inspector surfaces components, timing and issue counts.",
          confidence: 0.9,
          maxRetries: 1,
        },
        {
          tool: "analyze_creative_context",
          forwardFields: ["request"],
          rationale: "Creative context analysis reveals design direction and session patterns.",
          confidence: 0.88,
          maxRetries: 1,
        },
        {
          tool: "predict_chronopath",
          forwardFields: ["request"],
          rationale: "Gaze trajectory analysis predicts where the eye looks at each moment.",
          confidence: 0.85,
          maxRetries: 1,
        },
        {
          tool: "check_accessibility",
          forwardFields: ["request"],
          rationale: "A11y analysis is a safe fallback when a generic 'check' request arrives.",
          confidence: 0.65,
          maxRetries: 1,
        },
        {
          tool: "analyze_harmonics",
          forwardFields: ["request"],
          rationale: "Harmonic analysis reveals the musical structure of motion — consonance, dissonance, and frequency relationships.",
          confidence: 0.82,
          maxRetries: 1,
        },
        {
          tool: "analyze_topology",
          forwardFields: ["request"],
          rationale: "Topological analysis uncovers spatial and temporal connectivity, detecting holes and connected components in the motion structure.",
          confidence: 0.8,
          maxRetries: 1,
        },
        {
          tool: "analyze_alchemy",
          forwardFields: ["request"],
          rationale: "Alchemical analysis interprets the composition as a four-stage magnum opus transformation journey.",
          confidence: 0.78,
          maxRetries: 1,
        },
        {
          tool: "analyze_cinema",
          forwardFields: ["request"],
          rationale: "Cinematic analysis classifies shot types, camera movement, transitions, pacing, and narrative structure.",
          confidence: 0.84,
          maxRetries: 1,
        },
        {
          tool: "translate_synesthesia",
          forwardFields: ["request"],
          rationale: "Synesthesia translates motion into a multi-sensory experience mapping color, sound, and texture.",
          confidence: 0.76,
          maxRetries: 1,
        },
      ];

    case "export_output": {
      const fmt = resolveExportFormatFromRequest(request);
      return [
        {
          tool: "export_project_video" as ToolName,
          staticArgs: fmt ? { format: fmt } : undefined,
          forwardFields: fmt ? [] : ["request"],
          rationale: fmt ? `Direct export to ${fmt}.` : "Export with format inferred from the request.",
          confidence: fmt ? 0.94 : 0.82,
          maxRetries: 2,
        },
        {
          tool: "export_component_code" as ToolName,
          forwardFields: ["request"],
          rationale: "Fallback: per-component export when project-level is not available.",
          confidence: 0.6,
          maxRetries: 1,
        },
      ];
    }

    case "manage_project":
      return [
        {
          tool: "search_catalog",
          forwardFields: [],
          rationale: "Default project-management action surfaces the project list.",
          confidence: 0.8,
          maxRetries: 1,
        },
      ];

    case "query_catalog":
      return [
        {
          tool: "search_catalog",
          forwardFields: ["request"],
          rationale: "Unified catalog search covers recipes, templates, shaders and brand packs.",
          confidence: 0.92,
          maxRetries: 2,
        },
        {
          tool: "list_recipes",
          forwardFields: [],
          rationale: "Conservative fallback — surface all recipes for browsing.",
          confidence: 0.6,
          maxRetries: 1,
        },
      ];

    case "run_pipeline":
      return [
        {
          tool: "run_pipeline",
          forwardFields: ["request"],
          rationale: "Pipeline runner orchestrates multi-step processing jobs end-to-end.",
          confidence: 0.88,
          maxRetries: 1,
        },
      ];

    case "accessibility_tuning":
      return [
        {
          tool: "check_accessibility",
          forwardFields: ["request"],
          rationale: "Apply an accessibility profile that matches the request tone.",
          confidence: 0.92,
          maxRetries: 2,
        },
        {
          tool: "check_accessibility",
          forwardFields: [],
          rationale: "If tuning can't apply, at least run the accessibility analysis for insight.",
          confidence: 0.7,
          maxRetries: 1,
        },
      ];

    case "performance_tuning":
      return [
        {
          tool: "analyze_motion",
          forwardFields: [],
          rationale: "Performance analysis produces concrete optimizations that the tuning step then applies.",
          confidence: 0.88,
          maxRetries: 1,
        },
        {
          tool: "set_static_style",
          staticArgs: { property: "durationMs" },
          rationale: "Crude fallback: compress durations as a direct speed-improving step.",
          confidence: 0.45,
          maxRetries: 1,
        },
      ];

    case "style_and_branding":
      return [
        {
          tool: "apply_style",
          forwardFields: ["request"],
          rationale: "Style profile applies palette, easing and timing together for consistency.",
          confidence: 0.9,
          maxRetries: 2,
        },
        {
          tool: "set_color",
          staticArgs: { property: "palette" },
          forwardFields: ["request"],
          rationale: "Fallback: set the palette property directly on the project.",
          confidence: 0.55,
          maxRetries: 1,
        },
      ];

    case "free_form_conversation":
    default:
      return [
        {
          tool: "generate_motion_code" as ToolName,
          forwardFields: ["request"],
          rationale: "When intent is unclear, try a generator — it is the broadest tool.",
          confidence: 0.6,
          maxRetries: 1,
        },
        {
          tool: "apply_preset",
          staticArgs: { presetName: "float" },
          rationale: "Conservative fallback: apply a standard float effect so the user always gets visual output.",
          confidence: 0.4,
          maxRetries: 1,
        },
      ];
  }
}

// ---------------------------------------------------------------------------
// Small keyword resolvers for template / preset / export format IDs.
// ---------------------------------------------------------------------------

const TEMPLATE_KEYWORD_MAP: Array<{ id: string; keywords: string[] }> = [
  { id: "tpl-float", keywords: ["float", "floating", "levitate", "悬浮"] },
  { id: "tpl-bounce", keywords: ["bounce", "jumping", "弹跳", "弹"] },
  { id: "tpl-fade-slide", keywords: ["fade", "slide", "渐隐", "滑入"] },
  { id: "tpl-ripple", keywords: ["ripple", "wave", "涟漪", "波纹"] },
  { id: "tpl-typewriter", keywords: ["typewriter", "typing", "text", "打字", "文字"] },
  { id: "tpl-card-flip", keywords: ["flip", "card", "rotate", "翻转", "卡片"] },
  { id: "tpl-spin-3d", keywords: ["spin", "3d", "rotate 360", "旋转", "3d旋转"] },
  { id: "tpl-glow-pulse", keywords: ["glow", "pulse", "shine", "发光", "脉冲"] },
  { id: "tpl-accordion", keywords: ["accordion", "expand", "collapse", "折叠", "展开"] },
  { id: "tpl-magnetic", keywords: ["magnetic", "attract", "follow", "磁吸", "跟随"] },
  { id: "tpl-gravitational-lens", keywords: ["gravitational", "warp", "lens", "引力", "扭曲"] },
  { id: "tpl-quantum-dissolve", keywords: ["dissolve", "disintegrate", "quantum", "消散", "粒子"] },
  { id: "tpl-synthesis-wave", keywords: ["synthesis", "synth", "audio", "合成", "音频"] },
  { id: "tpl-tectonic-shift", keywords: ["tectonic", "geology", "shift", "split", "地质", "分裂"] },
  { id: "tpl-bio-luminescence", keywords: ["bio", "organic", "glow", "生物", "有机"] },
];

function resolveTemplateFromRequest(request: string): string | null {
  const lower = request.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const entry of TEMPLATE_KEYWORD_MAP) {
    let hits = 0;
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase())) hits += 1;
    }
    if (hits > 0 && (!best || hits > best.score)) {
      best = { id: entry.id, score: hits };
    }
  }
  return best?.id ?? null;
}

const PRESET_KEYWORD_MAP: Array<{ name: string; keywords: string[] }> = [
  { name: "float", keywords: ["float", "hover", "悬浮"] },
  { name: "bounce", keywords: ["bounce", "drop", "弹跳"] },
  { name: "shake", keywords: ["shake", "vibrate", "抖动"] },
  { name: "pendulum", keywords: ["pendulum", "swing", "钟摆"] },
  { name: "slide-in", keywords: ["slide", "enter", "滑入"] },
  { name: "zoom-in", keywords: ["zoom", "scale", "放大"] },
  { name: "ripple", keywords: ["ripple", "wave", "波纹"] },
  { name: "typewriter", keywords: ["typewriter", "typing", "打字"] },
  { name: "glow", keywords: ["glow", "pulse", "发光"] },
  { name: "spin", keywords: ["spin", "rotate", "旋转"] },
];

function resolvePresetFromRequest(request: string): string | null {
  const lower = request.toLowerCase();
  for (const entry of PRESET_KEYWORD_MAP) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase())) return entry.name;
    }
  }
  return null;
}

const EXPORT_FORMAT_KEYWORDS: Array<{ format: string; keywords: string[] }> = [
  { format: "lottie", keywords: ["lottie", ".json", "json"] },
  { format: "mp4", keywords: ["mp4", "video", "视频"] },
  { format: "gif", keywords: ["gif", "动图"] },
  { format: "webm", keywords: ["webm"] },
  { format: "css", keywords: ["css", "stylesheet", "样式"] },
  { format: "svg", keywords: ["svg", "矢量"] },
  { format: "png", keywords: ["png", "screenshot", "截图", "图片"] },
];

function resolveExportFormatFromRequest(request: string): string | null {
  const lower = request.toLowerCase();
  for (const entry of EXPORT_FORMAT_KEYWORDS) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase())) return entry.format;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Plan Construction
// ---------------------------------------------------------------------------

/**
 * Build a full autonomous-router plan for a user request.
 * This combines intent classification, semantic inference, emotion
 * detection, collaboration-fallback selection and step ranking into
 * a single deterministic object that can be executed, displayed or cached.
 */
export function buildRouterPlan(request: string): RouterPlan {
  const { bucket, score, secondary } = classifyIntent(request);
  const semantic = inferIntent(request);
  const emotion = detectEmotionFromText(request);
  const steps = expandIntentToSteps(bucket, request);

  // If collaboration keywords are present, mark collaboration as a strong fallback.
  const collabModules = pickCollaborationFallback(request, bucket);
  const secondaryNote = secondary ? ` (secondary: ${secondary})` : "";

  const reasoningParts = [
    `Intent classified as "${bucket}" with confidence ${(score * 100).toFixed(0)}%${secondaryNote}.`,
  ];
  if (semantic.concepts.length > 0) {
    reasoningParts.push(`Semantic focus: ${semantic.concepts.slice(0, 2).map((c) => (c as { label?: string; conceptLabel?: string }).label ?? (c as { conceptLabel: string }).conceptLabel).join(", ")}.`);
  }
  if (emotion) {
    reasoningParts.push(`Emotion tone: ${emotion.name} — ${emotion.description}.`);
  }
  reasoningParts.push(`Primary strategy: ${steps.length > 0 ? steps[0].tool : "conversation"} with ${steps.length} ranked fallback${steps.length === 1 ? "" : "s"}.`);
  if (collabModules.length > 0) {
    reasoningParts.push(`Collaboration fallback engages ${collabModules.length} module${collabModules.length === 1 ? "" : "s"}.`);
  }

  return {
    intent: bucket,
    concepts: semantic.concepts.slice(0, 5).map((c) => ({ label: (c as { label?: string; conceptLabel?: string }).label ?? (c as { conceptLabel: string }).conceptLabel, confidence: c.confidence })),
    emotion: emotion?.name ?? null,
    steps,
    collaborationFallbackModules: collabModules,
    reasoning: reasoningParts.join(" "),
  };
}

function pickCollaborationFallback(request: string, bucket: IntentBucket): string[] {
  const known = new Set(listCollaborationModules().map((m) => m.id));
  const lower = request.toLowerCase();
  const selected: Array<{ id: string; score: number }> = [];

  for (const mod of listCollaborationModules()) {
    let s = 0;
    for (const kw of mod.triggerKeywords) {
      if (lower.includes(kw.toLowerCase())) s += 1;
    }
    // Boost high-relevance modules based on the intent bucket.
    if (bucket === "accessibility_tuning" && mod.id === "accessibility") s += 2;
    if (bucket === "tune_easing" && (mod.id === "tempo" || mod.id === "rhythm")) s += 2;
    if (bucket === "style_and_branding" && (mod.id === "style" || mod.id === "harmony" || mod.id === "brand")) s += 2;
    if (bucket === "choreograph_timeline" && (mod.id === "choreography" || mod.id === "rhythm")) s += 2;
    if (bucket === "performance_tuning" && mod.id === "restraint") s += 2;
    if (s > 0) selected.push({ id: mod.id, score: s });
  }

  selected.sort((a, b) => b.score - a.score);
  return selected.slice(0, 4).map((s) => s.id).filter((id) => known.has(id));
}

// ---------------------------------------------------------------------------
// Plan Execution
// ---------------------------------------------------------------------------

/**
 * Execute a router plan with automatic fallback chains.
 * Steps are attempted in order, each with its own retry budget.
 * If every step fails, collaboration modules run as a last resort,
 * followed by a simulated success so the conversation never dead-ends.
 */
export async function executeRouterPlan(
  plan: RouterPlan,
  ctx: ToolContext,
  request: string,
): Promise<RouterExecution> {
  const results: RouterExecution["results"] = [];
  let finalResult: ToolResult | null = null;
  let strategy: RouterExecution["strategy"] = "simulated";

  // --- Tool-chain execution with retries ---
  for (let i = 0; i < plan.steps.length; i += 1) {
    const step = plan.steps[i];
    if (!TOOL_NAMES.includes(step.tool as ToolName)) {
      // Skip unknown tools entirely rather than cycling retries on a bad name.
      results.push({ stepIndex: i, tool: step.tool, ok: false, summary: `tool not declared: ${step.tool}` });
      continue;
    }

    let attempt = 0;
    while (attempt < step.maxRetries && !finalResult) {
      attempt += 1;
      const mergedArgs = buildStepArgs(step, request, ctx.projectId);
      const result = await executeTool(step.tool as ToolName, mergedArgs, ctx);
      results.push({ stepIndex: i, tool: step.tool, ok: result.ok, summary: result.summary });
      if (result.ok) {
        finalResult = result;
        strategy = "tool";
        break;
      }
    }
    if (finalResult) break;
  }

  // --- Collaboration fallback ---
  if (!finalResult && plan.collaborationFallbackModules.length > 0) {
    try {
      const collabPlan = planCollaboration(request);
      // Only retain the modules our router explicitly greenlit for fallback.
      collabPlan.modules = collabPlan.modules.filter((m) =>
        plan.collaborationFallbackModules.includes(m.id),
      );
      collabPlan.subTasks = collabPlan.subTasks.filter((t) =>
        plan.collaborationFallbackModules.includes(t.moduleId),
      );
      if (collabPlan.modules.length > 0) {
        const collabResult = executeCollaboration(collabPlan);
        const collabConfidence = (collabResult as { confidence?: number; overallConfidence?: number }).confidence
          ?? (collabResult as { overallConfidence?: number }).overallConfidence
          ?? 0.8;
        const summary = `Collaboration fallback produced ${collabResult.conflictResolutions.length} resolution${collabResult.conflictResolutions.length === 1 ? "" : "s"} with confidence ${collabConfidence.toFixed(2)}.`;
        finalResult = {
          ok: true,
          summary,
          specChanged: true,
          data: { collaboration: collabResult },
        };
        strategy = "collaboration";
        results.push({ stepIndex: -1, tool: "plan_collaboration", ok: true, summary });
      }
    } catch {
      // Collaboration itself crashed — fall through to the simulated result.
    }
  }

  // --- Simulated success fallback ---
  if (!finalResult) {
    // Ensure the conversation always produces a user-facing output,
    // even when every concrete execution path has failed.
    finalResult = {
      ok: true,
      summary: `Request acknowledged. The suggestion engine will offer next-best actions you can take directly.`,
      specChanged: false,
      data: { acknowledgedRequest: request, plan },
    };
    strategy = "simulated";
  }

  return { plan, results, finalResult, strategy };
}

function buildStepArgs(
  step: ToolStep,
  request: string,
  projectId: string,
): Record<string, unknown> {
  const args: Record<string, unknown> = { projectId };

  if (step.staticArgs) {
    Object.assign(args, step.staticArgs);
  }

  if (step.forwardFields && step.forwardFields.length > 0) {
    for (const field of step.forwardFields) {
      if (field === "request") args.request = request;
      else if (field === "projectId") args.projectId = projectId;
      else args[field] = extractFieldFromRequest(request, field);
    }
  }

  return args;
}

/** Extract a named conceptual field from the request. Fallback: the full text. */
function extractFieldFromRequest(request: string, _field: string): string {
  // In a richer implementation this would be NER-style extraction; for now,
  // the tool schema validator and executor already clean up the value.
  return request;
}

/**
 * Build a router plan from a text request + project spec, then execute it
 * through the tool registry with full fallback chain support. The spec
 * argument grounds context-aware routing decisions (component density,
 * existing tags) for future iterations.
 */
export async function routeAutonomous(
  text: string,
  spec: unknown,
  ctx?: ToolContext,
): Promise<RouterExecution> {
  const plan = buildRouterPlan(text);
  void spec;

  // If no tool context is provided, return the plan without execution
  // so callers can inspect the plan before committing to tool calls.
  if (!ctx) {
    return {
      plan,
      results: [],
      finalResult: null,
      strategy: "simulated",
    };
  }

  // Execute the full tool-chain with retries and collaboration fallback.
  return executeRouterPlan(plan, ctx, text);
}
