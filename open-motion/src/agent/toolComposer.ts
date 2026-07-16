/**
 * Tool Composer — automatically synthesizes multi-tool pipelines from natural
 * language intent, reducing the round-trips needed for compound requests.
 *
 * When a user says "add a bouncy fade-in with a slight delay", the composer
 * recognizes three sub-intents (template, easing, delay) and produces a
 * single tool call sequence:
 *   1. set_template (fade)
 *   2. set_easing (bounce)
 *   3. set_delay (100ms)
 *
 * This runs as a pre-pass before the LLM is consulted. If the composer
 * matches a known pattern, it emits the composed tool calls directly —
 * saving a full LLM round-trip. If no pattern matches, the orchestrator
 * falls through to the normal LLM-driven planning path.
 *
 * Patterns are defined declaratively and can be extended without code changes.
 */

import type { LlmToolCall } from "./provider/types.js";

export interface ComposedTool {
  tool: string;
  args: Record<string, unknown>;
  /** Human-readable reason for this step in the chain. */
  reason: string;
}

export interface CompositionResult {
  /** Whether a composition was found. */
  matched: boolean;
  /** The composed tool call sequence. */
  tools: ComposedTool[];
  /** A label for the composition pattern that matched. */
  patternName: string;
}

interface CompositionPattern {
  name: string;
  /** Returns composed tools if the message matches, or null. */
  match: (message: string, context: MatchContext) => ComposedTool[] | null;
}

interface MatchContext {
  projectId: string;
  /** Whether the project already has components. */
  hasComponents: boolean;
}

/** Normalize a message for matching: lowercase, collapse whitespace. */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Check if a message contains any of the given keywords. */
function has(msg: string, ...keywords: string[]): boolean {
  return keywords.some((k) => msg.includes(k));
}

/** Extract a number from a string (e.g., "500ms" → 500). */
function extractNumber(msg: string, pattern: RegExp): number | null {
  const m = msg.match(pattern);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return isNaN(n) ? null : n;
}

const PATTERNS: CompositionPattern[] = [
  // --- Template + easing composition ---
  {
    name: "template-with-easing",
    match: (msg, ctx) => {
      // Must mention a template type and an easing style.
      // Compound keywords (e.g. "fade out") are listed BEFORE their
      // single-word counterparts (e.g. "fade") so that the longer match
      // wins when iterating in insertion order.
      const templateMap: Record<string, string> = {
        "fade out": "tpl-fade-out",
        "slide out": "tpl-slide-out",
        "zoom out": "tpl-zoom-out",
        "collapse down": "tpl-collapse-down",
        "dissolve out": "tpl-dissolve-out",
        fade: "tpl-fade-in",
        slide: "tpl-slide-up",
        bounce: "tpl-bounce-in",
        scale: "tpl-scale-in",
        spin: "tpl-spin",
        pulse: "tpl-pulse",
        flip: "tpl-flip-card",
        shimmer: "tpl-shimmer",
        typewriter: "tpl-typewriter",
        ripple: "tpl-ripple",
        wave: "tpl-wave",
        orbit: "tpl-orbit",
        confetti: "tpl-confetti",
        "kinetic typography": "tpl-kinetic-typography",
        "kinetic text": "tpl-kinetic-text",
        "split text": "tpl-split-text",
        "mouse parallax": "tpl-mouse-parallax",
        parallax: "tpl-parallax",
        "long press": "tpl-long-press",
        counter: "tpl-counter",
        "text reveal": "tpl-text-reveal",
        "blur reveal": "tpl-blur-reveal",
        "logo reveal": "tpl-logo-reveal",
        "scroll reveal": "tpl-scroll-reveal",
        "3d reveal": "tpl-reveal-3d",
        "elastic scale": "tpl-elastic-scale",
        "chromatic pulse": "tpl-chromatic-pulse",
        "kinetic ribbon": "tpl-kinetic-ribbon",
        "magnetic ripple": "tpl-magnetic-ripple",
        "fadeout": "tpl-fade-out",
        "slideout": "tpl-slide-out",
        "zoomout": "tpl-zoom-out",
        "collapsedown": "tpl-collapse-down",
        "dissolveout": "tpl-dissolve-out",
        dissolve: "tpl-dissolve-out",
      };

      let templateId: string | null = null;
      for (const [keyword, id] of Object.entries(templateMap)) {
        if (msg.includes(keyword)) {
          templateId = id;
          break;
        }
      }

      if (!templateId) return null;

      const tools: ComposedTool[] = [
        {
          tool: "set_template",
          args: { projectId: ctx.projectId, templateId },
          reason: `Apply ${templateId} template`,
        },
      ];

      // Check for easing modifiers
      if (has(msg, "bouncy", "bounce")) {
        tools.push({
          tool: "set_easing",
          args: { projectId: ctx.projectId, componentId: "__last__", easing: { type: "preset", name: "bounce" } },
          reason: "Apply bounce easing to the new component",
        });
      } else if (has(msg, "elastic")) {
        tools.push({
          tool: "set_easing",
          args: { projectId: ctx.projectId, componentId: "__last__", easing: { type: "preset", name: "elastic" } },
          reason: "Apply elastic easing",
        });
      } else if (has(msg, "smooth", "smoothly")) {
        tools.push({
          tool: "set_easing",
          args: { projectId: ctx.projectId, componentId: "__last__", easing: { type: "preset", name: "smooth" } },
          reason: "Apply smooth easing",
        });
      } else if (has(msg, "snappy", "sharp")) {
        tools.push({
          tool: "set_easing",
          args: { projectId: ctx.projectId, componentId: "__last__", easing: { type: "preset", name: "snappy" } },
          reason: "Apply snappy easing",
        });
      } else if (has(msg, "soft", "gentle")) {
        tools.push({
          tool: "set_easing",
          args: { projectId: ctx.projectId, componentId: "__last__", easing: { type: "preset", name: "soft" } },
          reason: "Apply soft easing",
        });
      }

      // Check for delay
      const delayMs = extractNumber(msg, /(\d+)\s*(?:ms|millisecond)/);
      if (delayMs !== null && has(msg, "delay", "after", "wait")) {
        tools.push({
          tool: "set_delay",
          args: { projectId: ctx.projectId, componentId: "__last__", delayMs },
          reason: `Set delay to ${delayMs}ms`,
        });
      }

      // Check for duration
      const durationMs = extractNumber(msg, /(\d+)\s*(?:ms|millisecond|s\b)/);
      if (durationMs !== null && has(msg, "duration", "last", "long", "short")) {
        const adjusted = msg.includes("s") && !msg.includes("ms") ? durationMs * 1000 : durationMs;
        tools.push({
          tool: "set_duration",
          args: { projectId: ctx.projectId, componentId: "__last__", durationMs: adjusted },
          reason: `Set duration to ${adjusted}ms`,
        });
      }

      // Check for color
      const colorMatch = msg.match(/#([0-9a-f]{3,6})/);
      if (colorMatch) {
        tools.push({
          tool: "set_color",
          args: { projectId: ctx.projectId, componentId: "__last__", color: `#${colorMatch[1]}` },
          reason: `Set color to #${colorMatch[1]}`,
        });
      }

      return tools.length > 1 ? tools : null;
    },
  },

  // --- Stagger + choreography composition ---
  {
    name: "choreograph-sequence",
    match: (msg, ctx) => {
      if (!has(msg, "stagger", "cascade", "wave", "ripple", "sequence", "choreograph")) {
        return null;
      }
      if (!ctx.hasComponents) return null;

      const stepMs = extractNumber(msg, /(\d+)\s*ms\s*(?:step|stagger|delay)/) ?? 150;

      let pattern: "cascade" | "wave" | "ripple" = "cascade";
      if (has(msg, "wave")) pattern = "wave";
      else if (has(msg, "ripple")) pattern = "ripple";

      return [
        {
          tool: "stagger_components",
          args: { projectId: ctx.projectId, stepMs },
          reason: `Stagger components with ${stepMs}ms step`,
        },
        {
          tool: "choreograph",
          args: { projectId: ctx.projectId, pattern, stepMs },
          reason: `Apply ${pattern} choreography pattern`,
        },
      ];
    },
  },

  // --- Color harmony + style composition ---
  {
    name: "color-harmony",
    match: (msg, ctx) => {
      if (!has(msg, "harmoniz", "color scheme", "palette", "color harmony")) return null;
      if (!ctx.hasComponents) return null;

      let scheme: "complementary" | "analogous" | "triadic" | "monochrome" = "analogous";
      if (has(msg, "complement")) scheme = "complementary";
      else if (has(msg, "triad")) scheme = "triadic";
      else if (has(msg, "monochrome", "mono")) scheme = "monochrome";

      const baseColorMatch = msg.match(/#([0-9a-f]{3,6})/);

      return [
        {
          tool: "harmonize_colors",
          args: {
            projectId: ctx.projectId,
            scheme,
            ...(baseColorMatch ? { baseColor: `#${baseColorMatch[1]}` } : {}),
          },
          reason: `Apply ${scheme} color harmony`,
        },
      ];
    },
  },

  // --- Refine motion composition ---
  {
    name: "refine-motion",
    match: (msg, ctx) => {
      if (!has(msg, "make it", "refine", "adjust", "tweak")) return null;
      if (!ctx.hasComponents) return null;

      const tools: ComposedTool[] = [];

      if (has(msg, "snappi", "faster", "quicker")) {
        tools.push({
          tool: "refine_motion",
          args: { projectId: ctx.projectId, refinement: "snappier" },
          reason: "Make motion snappier",
        });
      } else if (has(msg, "smooth", "slower", "gentler")) {
        tools.push({
          tool: "refine_motion",
          args: { projectId: ctx.projectId, refinement: "smoother" },
          reason: "Make motion smoother",
        });
      } else if (has(msg, "dramatic", "bold", "intense")) {
        tools.push({
          tool: "refine_motion",
          args: { projectId: ctx.projectId, refinement: "more-dramatic" },
          reason: "Make motion more dramatic",
        });
      } else if (has(msg, "calm", "subtle", "soft")) {
        tools.push({
          tool: "refine_motion",
          args: { projectId: ctx.projectId, refinement: "calmer" },
          reason: "Make motion calmer",
        });
      } else if (has(msg, "energetic", "lively", "dynamic")) {
        tools.push({
          tool: "refine_motion",
          args: { projectId: ctx.projectId, refinement: "more-energetic" },
          reason: "Make motion more energetic",
        });
      } else if (has(msg, "bouncy", "springy")) {
        tools.push({
          tool: "refine_motion",
          args: { projectId: ctx.projectId, refinement: "bouncier" },
          reason: "Make motion bouncier",
        });
      }

      return tools.length > 0 ? tools : null;
    },
  },

  // --- Export composition ---
  {
    name: "export-package",
    match: (msg, _ctx) => {
      if (!has(msg, "export", "download", "generate code")) return null;

      const tools: ComposedTool[] = [];

      if (has(msg, "html")) {
        tools.push({
          tool: "export_html",
          args: { format: "html" },
          reason: "Export as HTML",
        });
      }
      if (has(msg, "react", "jsx", "component")) {
        tools.push({
          tool: "export_code",
          args: { format: "react" },
          reason: "Export as React component",
        });
      }
      if (has(msg, "css")) {
        tools.push({
          tool: "export_code",
          args: { format: "css" },
          reason: "Export as CSS",
        });
      }

      return tools.length > 0 ? tools : null;
    },
  },

  // --- Accessibility check composition ---
  {
    name: "accessibility-check",
    match: (msg, ctx) => {
      if (!has(msg, "accessibility", "a11y", "vestibular", "seizure", "safe motion", "motion safety", "wcag")) {
        return null;
      }
      if (!ctx.hasComponents) return null;
      return [
        {
          tool: "check_accessibility",
          args: { projectId: ctx.projectId },
          reason: "Run accessibility and safety check on project components",
        },
      ];
    },
  },

  // --- Performance check composition ---
  {
    name: "performance-check",
    match: (msg, ctx) => {
      if (!has(msg, "performance", "perf", "fps", "jank", "render cost", "frame budget", "optimize performance")) {
        return null;
      }
      if (!ctx.hasComponents) return null;
      return [
        {
          tool: "check_performance",
          args: { projectId: ctx.projectId },
          reason: "Profile runtime performance of project components",
        },
      ];
    },
  },

  // --- Style preset composition ---
  {
    name: "style-preset",
    match: (msg, ctx) => {
      if (!has(msg, "style preset", "apply style", "make it playful", "make it energetic", "make it calm", "make it professional", "make it dramatic", "make it minimal", "playful style", "energetic style", "calm style", "professional style", "dramatic style", "minimal style")) {
        return null;
      }
      if (!ctx.hasComponents) return null;

      let presetId: string | null = null;
      if (has(msg, "playful")) presetId = "playful";
      else if (has(msg, "energetic")) presetId = "energetic";
      else if (has(msg, "calm")) presetId = "calm";
      else if (has(msg, "professional")) presetId = "professional";
      else if (has(msg, "dramatic")) presetId = "dramatic";
      else if (has(msg, "minimal")) presetId = "minimal";

      if (!presetId) return null;

      return [
        {
          tool: "apply_style",
          args: { projectId: ctx.projectId, styleId: presetId },
          reason: `Apply ${presetId} style preset to all components`,
        },
      ];
    },
  },
];

/**
 * Attempt to compose a multi-tool pipeline from a user message.
 * Returns matched=false if no pattern matches, signaling the orchestrator
 * to fall through to LLM-driven planning.
 */
export function composeTools(
  message: string,
  projectId: string,
  hasComponents: boolean,
): CompositionResult {
  const normalized = norm(message);
  const ctx: MatchContext = { projectId, hasComponents };

  for (const pattern of PATTERNS) {
    const tools = pattern.match(normalized, ctx);
    if (tools && tools.length > 0) {
      return { matched: true, tools, patternName: pattern.name };
    }
  }

  return { matched: false, tools: [], patternName: "none" };
}

/**
 * Convert composed tools to LlmToolCall format for execution by the orchestrator.
 * The `__last__` placeholder for componentId is resolved to the most recently
 * created component at execution time.
 */
export function composedToToolCalls(composed: ComposedTool[]): LlmToolCall[] {
  return composed.map((t, i) => ({
    tool: t.tool as LlmToolCall["tool"],
    args: t.args,
    callId: `composed_${i}_${Date.now()}`,
  }));
}
