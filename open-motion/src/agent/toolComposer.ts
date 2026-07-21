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
      // Skip when the user is asking to save/capture/export rather than
      // create a new template — keywords like "bounce" can appear in saved
      // names (e.g. "save as a profile called bounce-profile") and would
      // otherwise hijack the request.
      if (has(msg, "save", "capture", "export", "record", "as a profile", "as a pipeline", "as a recipe")) {
        return null;
      }
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
        "glitch": "tpl-glitch",
        "gradient shift": "tpl-gradient-shift",
        "text scramble": "tpl-text-scramble",
        "data stream": "tpl-data-stream",
        "gravity drop": "tpl-gravity-drop",
        "breathing light": "tpl-breathing-light",
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
      // Guard: when the user clearly means per-character text animation
      // (text animator context), defer to the dedicated add_text_animator
      // intent in the mock provider — don't hijack as component stagger.
      // Match plural forms (characters/words/chars) too.
      if (/\b(?:text|characters?|words?|chars?)\b/i.test(msg)) return null;
      // Guard: when the user mentions a single-layer ripple/wave effect
      // (mesh warp, liquid distortion), defer to the dedicated apply_mesh_warp
      // intent in the mock provider — "ripple the layer" is a layer effect,
      // not a multi-layer choreography pattern.
      if (/\b(?:warp|distort\w*|liquid|organic|mesh|puppet|turbulence)\b/i.test(msg)) return null;
      // Guard: "ripple/wave + layer/this/it" patterns target a single layer,
      // not a multi-component choreography.
      if (/\b(?:ripple|wave)\s+(?:the\s+)?(?:layer|this|it|element|component)\b/i.test(msg)) return null;
      // Guard: when the user wants to time-offset existing layers with a
      // staggered start (sequence/stagger/cascade + layers/components),
      // defer to the dedicated sequence_layers intent in the mock provider
      // — this is a layer-timing operation, not a choreography pattern.
      if (/\b(?:sequence|stagger|cascade)\s+(?:these\s+|the\s+)?(?:layers|components)\b/i.test(msg)) return null;
      // Guard: when the user wants to sequence layers with an explicit
      // transition (crossfade/dissolve/wipe/push) or mentions a transition
      // between layers/clips, defer to the dedicated
      // sequence_with_transition intent in the mock provider.
      if (/\b(?:sequence|stagger|cascade)\s+with\s+(?:crossfade|transition|dissolve|wipe|push)\b/i.test(msg)) return null;
      if (/\b(?:dissolve|transition)\s+between\s+(?:layers|clips)\b/i.test(msg)) return null;
      if (/\bcrossfade\s+(?:the\s+)?layers\b/i.test(msg)) return null;
      // Guard: when the user wants radio waves / sonar rings / wave
      // emitter / expanding circles — these are simulation generator
      // intents handled by the mock provider's radio_waves handler, not
      // a choreography pattern.
      if (/\b(?:radio\s+waves|sonar\s+rings|expanding\s+circles|wave\s+emitter|电波扩散)\b/i.test(msg)) return null;

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
      // Skip when the user explicitly requests an easing preset — the mock
      // provider's EASING_INTENTS will handle "soft easing", "ease-in" etc.
      if (has(msg, "easing")) return null;

      const tools: ComposedTool[] = [];

      // Match comparative forms specifically so base adjectives like "smooth",
      // "soft", "bouncy", "snappy" are handled by the easing preset intents.
      if (has(msg, "snappier", "snappi", "faster", "quicker")) {
        tools.push({
          tool: "refine_motion",
          args: { projectId: ctx.projectId, refinement: "snappier" },
          reason: "Make motion snappier",
        });
      } else if (has(msg, "smoother", "more smooth", "gentler")) {
        tools.push({
          tool: "refine_motion",
          args: { projectId: ctx.projectId, refinement: "smoother" },
          reason: "Make motion smoother",
        });
      } else if (has(msg, "more dramatic", "bolder", "intenser")) {
        tools.push({
          tool: "refine_motion",
          args: { projectId: ctx.projectId, refinement: "more-dramatic" },
          reason: "Make motion more dramatic",
        });
      } else if (has(msg, "calmer", "subtler", "softer")) {
        tools.push({
          tool: "refine_motion",
          args: { projectId: ctx.projectId, refinement: "calmer" },
          reason: "Make motion calmer",
        });
      } else if (has(msg, "more energetic", "livelier", "more dynamic")) {
        tools.push({
          tool: "refine_motion",
          args: { projectId: ctx.projectId, refinement: "more-energetic" },
          reason: "Make motion more energetic",
        });
      } else if (has(msg, "bouncier", "springier")) {
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
      // Defer to the version-and-export pattern when the user also wants to
      // save a checkpoint, so both save_version and export run together.
      if (has(msg, "save version", "checkpoint", "snapshot and export", "version and export")) {
        return null;
      }

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
      // Guard: when the user clearly means posterize-time (stop-motion /
      // stepped animation), defer to the dedicated posterize_time intent.
      if (/\b(?:posterize|stop[\s-]?motion|stepped\s+animation|stutter|choppy)\b/i.test(msg)) return null;
      // Guard: when the user clearly means adding a particle emitter
      // (which often mentions "rate" or "burst"), defer to the dedicated
      // add_particle_emitter intent in the mock provider.
      if (/\b(?:particle|emitter|spawn|burst|sparks|snow|confetti)\b/i.test(msg)) return null;
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
      if (!has(msg, "style preset", "apply style", "make it playful", "make it energetic", "make it calm", "make it professional", "make it dramatic", "make it minimal", "make it cinematic", "make it glassy", "make it retro", "make it futuristic", "make it organic", "make it mechanical", "make it luxury", "playful style", "energetic style", "calm style", "professional style", "dramatic style", "minimal style", "cinematic style", "glassy style", "retro style", "futuristic style", "organic style", "mechanical style", "luxury style")) {
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
      else if (has(msg, "cinematic")) presetId = "cinematic";
      else if (has(msg, "glassy")) presetId = "glassy";
      else if (has(msg, "retro")) presetId = "retro";
      else if (has(msg, "futuristic")) presetId = "futuristic";
      else if (has(msg, "organic")) presetId = "organic";
      else if (has(msg, "mechanical")) presetId = "mechanical";
      else if (has(msg, "luxury")) presetId = "luxury";

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

  // --- Spring physics composition ---
  {
    name: "spring-physics",
    match: (msg, ctx) => {
      if (!has(msg, "spring", "physics")) return null;
      if (!ctx.hasComponents) return null;

      const stiffness = extractNumber(msg, /stiffness\s*(\d+)/) ?? 180;
      const damping = extractNumber(msg, /damping\s*(\d+)/) ?? 14;
      const mass = extractNumber(msg, /mass\s*(\d+(?:\.\d+)?)/) ?? 1;

      return [
        {
          tool: "set_spring",
          args: { projectId: ctx.projectId, componentId: "__last__", stiffness, damping, mass },
          reason: `Configure spring physics: stiffness ${stiffness}, damping ${damping}, mass ${mass}`,
        },
      ];
    },
  },

  // --- Loop animation composition ---
  {
    name: "loop-animation",
    match: (msg, ctx) => {
      if (!has(msg, "loop", "repeat", "forever", "infinite")) return null;
      if (!ctx.hasComponents) return null;
      // Guard: when the user clearly means a pattern repeater (pattern
      // duplication with copies/instances/tile/cascade), defer to the
      // dedicated add_repeater intent in the mock provider — don't hijack
      // the message as a loop-iteration request.
      if (/\b(?:repeater|repeat\s+this|repeat\s+in\s+(?:a\s+)?(?:radial|circular|grid|pattern|linear)|\d+\s*(?:copies|instances)|tile\s+this|cascade\s+copies)\b/i.test(msg)) return null;
      // Guard: when the user wants an expression-based loop (loopIn/loopOut
      // with cycle/pingpong/offset/continue modes applied to a specific
      // property), defer to the dedicated set_loop_expression intent in the
      // mock provider — don't hijack as a CSS iteration-count loop.
      if (/\b(?:loop\s+(?:the\s+)?(?:rotation|position|scale|opacity|this\s+property|this)|pingpong\s+(?:this|the)|cycle\s+loop|loop\s+this\s+property)\b/i.test(msg)) return null;

      const countMatch = msg.match(/(\d+)\s*(?:times?|loops?|repeats?)/);
      const iterationCount: number | "infinite" = countMatch ? parseInt(countMatch[1], 10) : "infinite";

      let direction: "normal" | "reverse" | "alternate" | "alternate-reverse" = "normal";
      // Check compound direction first so "alternate-reverse" wins over "alternate"
      if (has(msg, "alternate-reverse", "alternate reverse")) direction = "alternate-reverse";
      else if (has(msg, "alternate")) direction = "alternate";
      else if (has(msg, "reverse")) direction = "reverse";

      const tools: ComposedTool[] = [
        {
          tool: "set_loop",
          args: { projectId: ctx.projectId, componentId: "__last__", iterationCount, direction },
          reason: `Set loop to ${iterationCount === "infinite" ? "infinite" : iterationCount + "x"} with ${direction} direction`,
        },
      ];

      // When the same message also mentions an easing style, compose a
      // set_easing call so compound requests like "apply elastic easing and
      // loop forever" produce both tool calls in a single round-trip.
      if (has(msg, "elastic")) {
        tools.unshift({
          tool: "set_easing",
          args: { projectId: ctx.projectId, componentId: "__last__", easing: { type: "preset", name: "elastic" } },
          reason: "Apply elastic easing before looping",
        });
      } else if (has(msg, "bouncy", "bounce")) {
        tools.unshift({
          tool: "set_easing",
          args: { projectId: ctx.projectId, componentId: "__last__", easing: { type: "preset", name: "bounce" } },
          reason: "Apply bounce easing before looping",
        });
      } else if (has(msg, "smooth", "smoothly")) {
        tools.unshift({
          tool: "set_easing",
          args: { projectId: ctx.projectId, componentId: "__last__", easing: { type: "preset", name: "smooth" } },
          reason: "Apply smooth easing before looping",
        });
      } else if (has(msg, "snappy", "sharp")) {
        tools.unshift({
          tool: "set_easing",
          args: { projectId: ctx.projectId, componentId: "__last__", easing: { type: "preset", name: "snappy" } },
          reason: "Apply snappy easing before looping",
        });
      } else if (has(msg, "soft", "gentle")) {
        tools.unshift({
          tool: "set_easing",
          args: { projectId: ctx.projectId, componentId: "__last__", easing: { type: "preset", name: "soft" } },
          reason: "Apply soft easing before looping",
        });
      }

      return tools;
    },
  },

  // --- Recipe apply composition ---
  {
    name: "recipe-apply",
    match: (msg, ctx) => {
      if (!has(msg, "recipe", "preset animation", "motion recipe")) return null;
      if (!ctx.hasComponents) return null;

      const recipeMap: Record<string, string> = {
        "gentle entrance": "recipe-gentle-entrance",
        "impact reveal": "recipe-impact-reveal",
        "elastic bounce": "recipe-elastic-bounce",
        "cinematic fade": "recipe-cinematic-fade",
        "data pulse": "recipe-data-pulse",
        "ambient float": "recipe-ambient-float",
        "typewriter reveal": "recipe-typewriter-reveal",
        "magnetic hover": "recipe-magnetic-hover",
        "swift dismissal": "recipe-swift-dismissal",
        "graceful departure": "recipe-graceful-departure",
        "skeleton shimmer": "recipe-skeleton-shimmer",
        "progress march": "recipe-progress-march",
        "toast rise": "recipe-toast-rise",
        "bar grow": "recipe-bar-grow",
        "confetti burst": "recipe-confetti-burst",
        "3d flip": "recipe-flip-3d",
        "card tilt": "recipe-card-tilt",
        "perspective rotate": "recipe-perspective-rotate",
        "chromatic shift": "recipe-chromatic-shift",
        "color pulse": "recipe-color-pulse",
        "gradient flow": "recipe-gradient-flow",
        "cinematic dolly": "recipe-cinematic-dolly",
        "cinematic pan": "recipe-cinematic-pan",
        "rack focus": "recipe-cinematic-rack-focus",
        "error shake": "recipe-error-shake",
        "success checkmark": "recipe-success-checkmark",
        "long press bloom": "recipe-long-press-bloom",
        "pinch zoom": "recipe-pinch-zoom",
        "swipe back": "recipe-swipe-back",
        "focus ring": "recipe-focus-ring",
        "ripple out": "recipe-ripple-out",
        "toggle pulse": "recipe-toggle-pulse",
        "gravity drop": "recipe-gravity-drop",
        "momentum slide": "recipe-momentum-slide",
        "spring settle": "recipe-spring-settle",
        "parallax depth": "recipe-parallax-depth",
        "scroll reveal": "recipe-scroll-reveal",
        "sticky shrink": "recipe-sticky-shrink",
        "dropdown reveal": "recipe-dropdown-reveal",
        "modal open": "recipe-modal-open",
        "tab switch": "recipe-tab-switch",
        "cross route": "recipe-cross-route",
        "page curl": "recipe-page-curl",
        "shared element": "recipe-shared-element",
      };

      for (const [keyword, recipeId] of Object.entries(recipeMap)) {
        if (msg.includes(keyword)) {
          return [
            {
              tool: "apply_recipe",
              args: { projectId: ctx.projectId, componentId: "__last__", recipeId },
              reason: `Apply ${keyword} recipe`,
            },
          ];
        }
      }

      return null;
    },
  },

  // --- Comprehensive analysis composition ---
  {
    name: "comprehensive-analysis",
    match: (msg, ctx) => {
      if (!has(msg, "analyze everything", "full analysis", "comprehensive analysis", "analyze all", "audit motion", "full audit", "review everything")) return null;
      if (!ctx.hasComponents) return null;

      return [
        {
          tool: "analyze_motion",
          args: { projectId: ctx.projectId },
          reason: "Analyze motion quality, timing, and composition",
        },
        {
          tool: "check_accessibility",
          args: { projectId: ctx.projectId },
          reason: "Check accessibility and motion safety",
        },
        {
          tool: "check_performance",
          args: { projectId: ctx.projectId },
          reason: "Profile runtime performance",
        },
        {
          tool: "analyze_principles",
          args: { projectId: ctx.projectId },
          reason: "Analyze against the 12 animation principles",
        },
      ];
    },
  },

  // --- Adaptive + responsive CSS composition ---
  {
    name: "adaptive-responsive",
    match: (msg, ctx) => {
      if (!has(msg, "responsive", "adapt for", "adapt to", "mobile", "tablet", "breakpoint")) return null;
      if (!ctx.hasComponents) return null;

      const tools: ComposedTool[] = [
        {
          tool: "adapt_motion",
          args: { projectId: ctx.projectId },
          reason: "Adapt motion for the target device and viewport",
        },
      ];

      if (has(msg, "css", "media query", "stylesheet")) {
        tools.push({
          tool: "generate_responsive_css",
          args: { projectId: ctx.projectId },
          reason: "Generate responsive CSS with media queries",
        });
      }

      return tools;
    },
  },

  // --- Story arc + apply composition ---
  {
    name: "story-arc-apply",
    match: (msg, ctx) => {
      if (!has(msg, "story arc", "storytelling", "narrative structure", "hero journey")) return null;
      if (!ctx.hasComponents) return null;

      const genreMap: Record<string, string> = {
        romance: "romance",
        comedy: "comedy",
        mystery: "mystery",
        fantasy: "fantasy",
        horror: "horror",
        documentary: "documentary",
      };

      let genre: string | null = null;
      for (const [keyword, g] of Object.entries(genreMap)) {
        if (msg.includes(keyword)) {
          genre = g;
          break;
        }
      }

      return [
        {
          tool: "create_story_arc",
          args: { projectId: ctx.projectId, ...(genre ? { genre } : {}) },
          reason: `Create a ${genre ?? "default"} story arc`,
        },
        {
          tool: "apply_story_plan",
          args: { projectId: ctx.projectId },
          reason: "Apply the story plan to align component timing with story beats",
        },
      ];
    },
  },

  // --- Multimodal generation + layer composition ---
  {
    name: "multimodal-generate",
    match: (msg, _ctx) => {
      if (!has(msg, "generate", "create")) return null;

      const tools: ComposedTool[] = [];

      if (has(msg, "image", "picture", "photo")) {
        const promptMatch = msg.match(/(?:image|picture|photo)\s*(?:of|with|showing)?\s*(.+)/);
        const prompt = promptMatch ? promptMatch[1].trim().slice(0, 200) : "abstract motion design";
        tools.push({
          tool: "generate_image",
          args: { prompt },
          reason: `Generate an image: ${prompt}`,
        });
      } else if (has(msg, "speech", "voice", "narrat", "audio")) {
        const textMatch = msg.match(/(?:speech|voice|narrat|audio)\s*(?:of|for|saying)?\s*["']?(.+?)["']?$/);
        const text = textMatch ? textMatch[1].trim().slice(0, 200) : "Welcome to OpenMotion";
        tools.push({
          tool: "generate_speech",
          args: { text },
          reason: `Generate speech: ${text}`,
        });
      } else if (has(msg, "video", "animation clip", "movie")) {
        const promptMatch = msg.match(/(?:video|clip|movie)\s*(?:of|with|showing)?\s*(.+)/);
        const prompt = promptMatch ? promptMatch[1].trim().slice(0, 200) : "motion design sequence";
        tools.push({
          tool: "generate_video",
          args: { prompt },
          reason: `Generate a video: ${prompt}`,
        });
      } else if (has(msg, "3d", "model", "mesh")) {
        const promptMatch = msg.match(/(?:3d|model|mesh)\s*(?:of|with|showing)?\s*(.+)/);
        const prompt = promptMatch ? promptMatch[1].trim().slice(0, 200) : "geometric shape";
        tools.push({
          tool: "generate_3d",
          args: { prompt },
          reason: `Generate a 3D model: ${prompt}`,
        });
      }

      return tools.length > 0 ? tools : null;
    },
  },

  // --- Version + export composition ---
  {
    name: "version-and-export",
    match: (msg, ctx) => {
      if (!has(msg, "save version", "checkpoint", "snapshot and export", "version and export")) return null;
      if (!ctx.hasComponents) return null;

      const tools: ComposedTool[] = [
        {
          tool: "save_version",
          args: { projectId: ctx.projectId, label: "checkpoint" },
          reason: "Save a version checkpoint",
        },
      ];

      if (has(msg, "html")) {
        tools.push({ tool: "export_html", args: { format: "html" }, reason: "Export as HTML" });
      } else if (has(msg, "react", "component")) {
        tools.push({ tool: "export_code", args: { format: "react" }, reason: "Export as React component" });
      } else if (has(msg, "css")) {
        tools.push({ tool: "export_code", args: { format: "css" }, reason: "Export as CSS" });
      }

      return tools;
    },
  },

  // --- Motion variations composition ---
  // "give me variations of this", "try different easings", "explore alternatives"
  {
    name: "motion-variations",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      // Must explicitly ask for variations/alternatives/options.
      if (!has(msg, "variation", "alternative", "option", "different version", "explore", "try different")) return null;
      // Avoid hijacking style comparison requests (handled by subagent delegation).
      if (has(msg, "compare", "vs", "versus")) return null;

      return [
        {
          tool: "generate_variations",
          args: { projectId: ctx.projectId, componentId: "__last__", countPerAxis: 3 },
          reason: "Generate motion variations along easing, duration, intensity, and direction axes",
        },
      ];
    },
  },

  // --- Motion DNA analysis composition ---
  // "analyze the dna of this motion", "what makes this motion tick"
  {
    name: "motion-dna-analysis",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "dna", "what makes this motion", "decompose", "character of this motion", "motion signature")) return null;

      return [
        {
          tool: "extract_motion_dna",
          args: { projectId: ctx.projectId, componentId: "__last__" },
          reason: "Extract the motion DNA — easing family, timing profile, transform signature, intensity",
        },
      ];
    },
  },

  // --- Style transfer composition ---
  // "transfer the style of X to Y", "apply the feel of X to Y"
  {
    name: "style-transfer",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "transfer", "apply the feel", "apply the style", "adopt the")) return null;
      // Need at least 2 components for style transfer.
      // The orchestrator resolves __last__ but we also need a source.
      // This pattern is a hint; the actual tool will use the first two components.
      return [
        {
          tool: "transfer_style",
          args: { projectId: ctx.projectId, sourceComponentId: "__first__", targetComponentId: "__last__" },
          reason: "Transfer the motion style (easing, timing, intensity) from the first component to the last",
        },
      ];
    },
  },

  // --- Motion critique composition ---
  {
    name: "motion-critique",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "critique", "review this", "review the", "analyze this", "analyze the", "evaluate", "audit", "how good", "quality check", "accessibility check")) return null;
      // Skip when the user is asking to critique a specific aspect that has
      // a dedicated tool (e.g., "extract DNA").
      if (has(msg, "dna", "decompose")) return null;
      return [
        {
          tool: "critique_motion",
          args: { projectId: ctx.projectId },
          reason: "Run a full structural critique across accessibility, performance, aesthetic, and consistency dimensions",
        },
      ];
    },
  },

  // --- Motion storytelling composition ---
  {
    name: "motion-storytelling",
    match: (msg, _ctx) => {
      // Detect narrative keywords that map to the storytelling engine.
      // This pattern does not require existing components — it generates a
      // narrative plan that the agent can then use to create new components.
      const narrativeKeywords = [
        "hero entrance", "grand entrance", "make an entrance",
        "celebration", "celebrate", "confetti", "victory",
        "dramatic reveal", "reveal", "unveil", "surprise",
        "conflict", "clash", "battle", "versus",
        "transformation", "transform", "metamorphosis", "morph",
        "journey", "adventure", "quest",
        "resolution", "closure", "wind down", "settle down",
        "story", "narrative", "cinematic sequence",
      ];
      const matched = narrativeKeywords.some((k) => msg.includes(k));
      if (!matched) return null;
      // Pass the original message as the prompt so the storytelling engine
      // can detect the specific narrative intent.
      return [
        {
          tool: "generate_story",
          args: { projectId: _ctx.projectId, prompt: msg },
          reason: "Generate a 5-act narrative motion sequence matching the detected story intent",
        },
      ];
    },
  },

  // --- Motion lineage composition ---
  {
    name: "motion-lineage",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      // Detect lineage/genealogy/ancestry queries.
      if (!has(msg, "lineage", "genealogy", "ancestry", "ancestor", "descendant", "heritage", "where did this come from", "origin of", "derived from", "family tree")) return null;

      // If the user asks for a tree/overview, return the full tree.
      if (has(msg, "tree", "overview", "all", "full", "summary")) {
        return [
          {
            tool: "get_lineage_tree",
            args: { projectId: ctx.projectId },
            reason: "Retrieve the full lineage tree showing all component derivations",
          },
        ];
      }

      // Otherwise, query the lineage of the latest component.
      return [
        {
          tool: "query_lineage",
          args: { projectId: ctx.projectId, componentId: "__last__" },
          reason: "Query the lineage and ancestry of the most recently created component",
        },
      ];
    },
  },

  // --- Motion synthesis composition ---
  {
    name: "motion-synthesis",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      // Detect synthesis/breeding/hybridization keywords.
      if (!has(msg, "synthes", "hybrid", "breed", "cross", "combine the dna", "merge the motion", "blend the motion", "splice")) return null;

      // Determine strategy from the message.
      let strategy: "blend" | "dominant" | "crossover" | "mutation" = "blend";
      if (has(msg, "dominant")) strategy = "dominant";
      else if (has(msg, "crossover")) strategy = "crossover";
      else if (has(msg, "mutat")) strategy = "mutation";

      return [
        {
          tool: "synthesize_motion",
          args: {
            projectId: ctx.projectId,
            sourceComponentId: "__first__",
            targetComponentId: "__last__",
            strategy,
          },
          reason: `Synthesize a hybrid motion DNA from the first and last components using ${strategy} strategy`,
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
