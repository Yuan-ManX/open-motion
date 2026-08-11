/** Tool Composer — automatically synthesizes multi-tool pipelines from natural language intent. */

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
      // Yield to Motion Astronomy — "orbit" as a celestial concept (orbital
      // period, galactic structure) is astronomical analysis, not a template.
      if (has(msg, "astronomy", "astronomical", "celestial", "cosmos", "cosmic", "constellation", "galaxy", "galactic", "stellar", "spectral type", "supernova", "black hole", "nebula", "pulsar", "star system", "orbital period", "luminosity")) {
        return null;
      }
      // Yield to Motion Chemistry — chemical analysis should not be confused
      // with template creation.
      if (has(msg, "chemistry", "chemical", "molecule", "molecular", "atom", "atomic", "bond", "reaction", "catalyst", "inhibitor", "compound", "covalent", "ionic", "metallic", "hydrogen bond", "van der waals", "synthesis reaction", "decomposition reaction", "displacement reaction", "combustion reaction", "ph of", "acidity", "alkalinity", "enthalpy", "entropy of", "equilibrium", "state of matter", "periodic")) {
        return null;
      }
      // Yield to Motion Musicology — musical analysis is not template creation.
      if (has(msg, "musicology", "musical", "melody", "melodic", "harmony", "harmonic", "rhythm", "rhythmic", "tempo", "bpm", "chord", "phrase", "key signature", "time signature", "scale of", "pitch of", "dynamics of", "crescendo", "decrescendo", "sonata", "rondo", "aaba")) {
        return null;
      }
      // Yield to Motion Botany — botanical analysis is not template creation.
      if (has(msg, "botany", "botanical", "plant", "leaf", "leaves", "stem", "flower", "petal", "root", "canopy", "germination", "seedling", "phenology", "biomass", "tropism", "vine", "shrub")) {
        return null;
      }
      // Yield to Motion Geology — geological analysis is not template creation.
      if (has(msg, "geology", "geological", "stratum", "strata", "sedimentary", "igneous", "metamorphic", "volcanic", "alluvial", "tectonic", "earthquake", "uplift", "fault line", "faulting", "erosion", "deposition", "mineral", "epoch", "canyon", "plateau", "mountain range", "rock layer", "crust")) {
        return null;
      }
      // Yield to Motion Physics — physics analysis is not template creation.
      if (has(msg, "physics", "physical", "kinematic", "dynamic", "force", "energy of", "momentum", "collision", "velocity", "acceleration", "inertia", "equilibrium", "work of", "power of", "spring force")) {
        return null;
      }
      // Yield to Motion Linguistics — linguistic analysis is not template creation.
      if (has(msg, "linguistics", "linguistic", "phoneme", "phonology", "morpheme", "morphology", "syntax", "syntactic", "semantic", "semantics", "pragmatic", "pragmatics", "prosody", "discourse", "speech act", "intonation", "language family")) {
        return null;
      }
      // Yield to Motion Cinema — cinematic analysis is not template creation.
      if (has(msg, "cinema", "cinematic", "film", "movie", "mise-en-scène", "mise en scene", "camera movement", "camera angle", "narrative structure", "montage", "storyboard", "screenplay", "directing")) {
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
        "quantum entanglement": "tpl-quantum-entanglement",
        "acoustic wave": "tpl-acoustic-wave",
        "crystalline growth": "tpl-crystalline-growth",
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
      // Guard: when the user wants to *analyze* the composition through
      // physics principles (kinematics/dynamics/energy/momentum), defer to
      // the analyze-physics composition so a physics report is produced
      // instead of configuring spring easing on an existing component.
      if (has(msg, "analyze", "examine", "study", "inspect", "investigate", "measure", "calculate", "report on", "tell me about", "describe the", "of the motion", "of the composition", "of the animation")) return null;
      // Guard: when the user clearly wants to generate a new physics
      // simulation (rather than tune an existing component's spring),
      // defer to the physics-simulate composition below so a new component
      // with sampled keyframes is created.
      if (has(msg, "generate", "simulate", "create", "animation", "animat")) return null;

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
      // Guard: "collaboration" requests belong to the collaboration engine
      if (has(msg, "collaboration", "collaborate")) return null;

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
      // Skip when the user explicitly wants auto-fix — handled by the
      // motion-auto-fix pattern below.
      if (has(msg, "auto fix", "auto-fix", "autofix", "fix accessibility", "fix the accessibility", "remediate", "make it safe", "make the motion safe", "fix motion issues", "fix these issues", "fix the issues")) return null;
      // Yield to Motion Harmonics — harmonic/frequency/spectrum/consonance/dissonance analysis
      if (has(msg, "harmonic", "harmony", "harmonics", "frequency spectrum", "frequency signature", "overtone", "consonance", "dissonance")) return null;
      // Yield to Motion Entropy — entropy/information theory/predictability/redundancy analysis
      if (has(msg, "entropy", "information theory", "information content", "information density", "predictability", "redundancy", "hotspot")) return null;
      // Yield to Motion Cognition — cognitive load/working memory/attention switching analysis
      if (has(msg, "cognitive load", "working memory", "attention switching", "perceptual grouping", "processing fluency", "mental load", "mental effort")) return null;
      // Yield to Motion Topology — topology/connected components/euler characteristic analysis
      if (has(msg, "topology", "topological", "connected component", "temporal hole", "euler characteristic", "genus", "compactness")) return null;
      // Yield to Motion Poetics — poetic meter/form analysis
      if (has(msg, "poetic", "poetics", "meter", "iambic", "trochaic", "dactylic", "anapestic", "stanza", "caesura", "enjambment", "sonnet", "haiku", "free verse", "blank verse", "poetic form")) return null;
      // Yield to Motion Ecology — ecosystem/ecology/biodiversity/species analysis
      if (has(msg, "ecosystem", "ecology", "ecological", "biodiversity", "symbiotic", "parasitic", "predator-prey", "trophic", "carrying capacity", "niche")) return null;
      // Yield to Motion Calligraphy — calligraphic/brush/stroke/ink analysis
      if (has(msg, "calligraphy", "calligraphic", "brush stroke", "ink flow", "penmanship", "cursive", "regular script", "running script", "wild script")) return null;
      // Yield to Motion Mythology — mythology/hero's journey/archetype analysis
      if (has(msg, "mythology", "mythic", "mythological", "hero's journey", "heros journey", "monomyth", "archetype", "archetypal", "shadow archetype", "mentor archetype", "threshold guardian", "boon", "transformation myth")) return null;
      // Yield to Motion Weather — weather/storm/climate/front analysis
      if (has(msg, "weather", "storm", "storm pattern", "atmospheric pressure", "weather system", "weather forecast", "climate", "front activity", "calm period", "wind speed", "humidity")) return null;
      // Yield to Motion Alchemy — alchemical/transmutation/magnum opus analysis
      if (has(msg, "alchemy", "alchemical", "transmutation", "magnum opus", "philosopher's stone", "nigredo", "albedo", "citrinitas", "rubedo", "prima materia", "crucible", "hermetic")) return null;
      // Yield to Motion Architecture — architectural/structural/proportion analysis
      if (has(msg, "architecture", "architectural", "structural", "foundation", "facade", "load-bearing", "proportion", "golden ratio", "hierarchy", "material honesty", "brutalist", "modernist", "baroque", "gothic", "deconstructivist")) return null;
      // Yield to Motion Cartography — cartographic/terrain/elevation/contour analysis
      if (has(msg, "cartography", "cartographic", "terrain", "elevation", "contour", "landmark", "compass", "biome", "territory", "route", "map the composition", "topography")) return null;
      // Yield to Motion Genealogy — genealogy/lineage/ancestry/evolution analysis
      if (has(msg, "genealogy", "genealogical", "lineage", "ancestry", "ancestor", "descendant", "evolutionary", "phylogenetic", "genetic trait", "mutation rate", "common ancestor")) return null;
      // Yield to Motion Astronomy — celestial/cosmic/galactic/constellation analysis
      if (has(msg, "astronomy", "astronomical", "celestial", "cosmos", "cosmic", "constellation", "galaxy", "galactic", "stellar", "spectral type", "supernova", "black hole", "nebula", "pulsar", "star system", "light-years", "light years", "orbital period", "luminosity")) return null;
      // Yield to Motion Chemistry — chemical/molecular/atomic/bond/reaction analysis
      if (has(msg, "chemistry", "chemical", "molecule", "molecular", "atom", "atomic", "bond", "reaction", "catalyst", "inhibitor", "compound", "covalent", "ionic", "metallic", "hydrogen bond", "van der waals", "synthesis reaction", "decomposition reaction", "displacement reaction", "combustion reaction", "ph of", "acidity", "alkalinity", "enthalpy", "entropy of", "equilibrium", "state of matter", "plasma", "periodic")) return null;
      // Yield to Motion Musicology — musical/melodic/harmonic/rhythmic analysis
      if (has(msg, "musicology", "musical", "melody", "melodic", "harmony", "harmonic", "rhythm", "rhythmic", "tempo", "bpm", "chord", "phrase", "key signature", "time signature", "scale of", "pitch of", "dynamics of", "crescendo", "decrescendo", "sonata", "rondo", "aaba", "orchestration", "counterpoint", "articulation")) return null;
      // Yield to Motion Botany — botanical/plant/organ/canopy analysis
      if (has(msg, "botany", "botanical", "plant", "leaf", "leaves", "stem", "flower", "petal", "root", "branch", "canopy", "germination", "seedling", "phenology", "biomass", "tropism", "photosynth", "vine", "shrub", "tree-like", "growth pattern", "branching")) return null;
      // Yield to Motion Geology — geological/strata/tectonic/erosion analysis
      if (has(msg, "geology", "geological", "stratum", "strata", "sedimentary", "igneous", "metamorphic", "volcanic", "alluvial", "tectonic", "earthquake", "uplift", "fault line", "faulting", "erosion", "deposition", "mineral", "epoch", "topology of", "terrain of", "canyon", "plateau", "mountain range", "rock layer", "crust")) return null;
      // Yield to Motion Physics — physics/kinematics/dynamics/force analysis
      if (has(msg, "physics", "physical", "kinematic", "dynamic", "force", "energy", "momentum", "collision", "velocity", "acceleration", "inertia", "equilibrium", "work of", "power of", "friction", "gravity", "spring force")) return null;
      // Yield to Motion Linguistics — linguistics/phonology/syntax/semantics analysis
      if (has(msg, "linguistics", "linguistic", "phoneme", "phonology", "morpheme", "morphology", "syntax", "syntactic", "semantic", "semantics", "pragmatic", "pragmatics", "prosody", "discourse", "clause", "phrase structure", "speech act", "intonation", "stress pattern", "rhythm of speech", "register of", "language family")) return null;
      // Yield to Motion Cinema — cinema/film/shot/camera analysis
      if (has(msg, "cinema", "cinematic", "film", "movie", "shot", "scene", "cut", "transition", "mise-en-scène", "mise en scene", "camera movement", "camera angle", "narrative structure", "montage", "genre of", "close-up", "wide shot", "pan", "tilt", "dolly", "zoom", "crane", "storyboard", "screenplay", "directing")) return null;
      // Yield to core intelligence tools — emotion/rhythm/narrative/pacing/
      // mood/restraint/principles/visual-context have dedicated analysis tools.
      if (has(msg, "emotion", "emotional", "mood of", "rhythm of", "narrative of", "pacing of", "restraint of", "principles of", "visual context", "visual layout", "visual quality")) return null;
      return [
        {
          tool: "critique_motion",
          args: { projectId: ctx.projectId },
          reason: "Run a full structural critique across accessibility, performance, aesthetic, and consistency dimensions",
        },
      ];
    },
  },

  // --- Motion auto-fix composition ---
  {
    name: "motion-auto-fix",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      // Detect explicit remediation requests.
      if (!has(msg, "auto fix", "auto-fix", "autofix", "fix accessibility", "fix the accessibility", "remediate", "make it safe", "make the motion safe", "fix motion issues", "fix these issues", "fix the issues", "fix safety", "make accessible")) return null;
      return [
        {
          tool: "auto_fix_accessibility",
          args: { projectId: ctx.projectId, apply: true },
          reason: "Automatically remediate vestibular, seizure, reduced-motion, and cognitive accessibility issues across the project",
        },
      ];
    },
  },

  // --- Verification-driven self-correction composition ---
  // When the user explicitly asks the agent to verify its own work and fix
  // any gaps, compose a single self_correct call. This closes the
  // verification loop in one round-trip: verify -> remediate -> re-verify.
  {
    name: "self-correction",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      // Guard: accessibility-specific fixes belong to motion-auto-fix,
      // which is evaluated earlier in the pattern list. This guard is a
      // safety net in case pattern ordering changes.
      if (has(msg, "accessibility", "a11y", "vestibular", "seizure", "safe motion", "motion safety", "wcag", "make it safe", "make accessible")) return null;
      // Guard: "fix the color/easing/duration" targets a specific property
      // and should defer to the dedicated property tool via the mock provider.
      if (/\bfix\s+(?:the\s+)?(?:color|colour|easing|duration|delay|loop|trigger|opacity|scale|rotation|position)\b/.test(msg)) return null;
      // Guard: "fix the layout/spacing/alignment" is a visual-context concern.
      if (/\bfix\s+(?:the\s+)?(?:layout|spacing|alignment|balance)\b/.test(msg)) return null;
      // Match explicit self-correction / verify-and-fix requests only.
      // Pure verify requests ("check your work", "did you do it right")
      // are left to the mock provider's verify_motion handler so the user
      // gets a read-only report without automatic patching.
      const triggers = [
        "self-correct", "self correct", "selfcorrect",
        "verify and fix", "check and fix", "verify then fix",
        "fix it", "correct it", "fix the motion",
        "you didn't do it right", "you did not do it right",
        "fix your work", "fix your mistake",
      ];
      if (!triggers.some((t) => msg.includes(t))) return null;
      return [
        {
          tool: "self_correct",
          args: { projectId: ctx.projectId, intent: msg, apply: true },
          reason: "Close the verification loop: verify the motion against the stated intent, apply concrete remediation patches for each failed assertion, and re-verify",
        },
      ];
    },
  },

  // --- Motion persona composition ---
  {
    name: "motion-persona-detect",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      // Detection-only requests — list personas or identify the current style.
      if (has(msg, "list personas", "what personas", "available personas", "detect persona", "what style", "what design style", "identify the style", "which persona", "what design language")) {
        return [
          {
            tool: "list_personas",
            args: { projectId: ctx.projectId },
            reason: "List all available motion personas",
          },
          {
            tool: "detect_persona",
            args: { projectId: ctx.projectId },
            reason: "Score the project against every persona and identify the closest match",
          },
        ];
      }
      return null;
    },
  },
  {
    name: "motion-persona-apply",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      // Apply a specific named persona. Match the persona id against keywords.
      const personaTriggers: Array<{ id: string; keywords: string[] }> = [
        { id: "bauhaus", keywords: ["bauhaus", "geometric primary", "form follows function"] },
        { id: "apple-hig", keywords: ["apple", "hig", "ios style", "macos style", "apple style"] },
        { id: "material", keywords: ["material design", "material style", "android style"] },
        { id: "brutalist", keywords: ["brutalist", "raw style", "jarring"] },
        { id: "memphis", keywords: ["memphis", "playful style", "postmodern"] },
        { id: "art-deco", keywords: ["art deco", "deco style", "geometric luxury"] },
        { id: "swiss", keywords: ["swiss style", "international typographic", "grid discipline"] },
        { id: "vaporwave", keywords: ["vaporwave", "vhs style", "retrofuturist", "nostalgic style"] },
      ];
      if (!has(msg, "apply persona", "apply the", "make it", "style it as", "redesign as", "convert to", "transform to", "give it a", "give the project a")) return null;
      for (const trigger of personaTriggers) {
        if (has(msg, ...trigger.keywords)) {
          return [
            {
              tool: "apply_persona",
              args: { projectId: ctx.projectId, personaId: trigger.id, apply: true },
              reason: `Apply the ${trigger.id} persona across the project`,
            },
          ];
        }
      }
      return null;
    },
  },

  // --- Motion coach composition ---
  {
    name: "motion-coach",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      // Detect coaching / explanation / teaching requests.
      if (has(msg, "coach me", "teach me", "explain", "what does this do", "what is this animation", "why does this work", "what principle", "what should i try", "how can i improve", "what should i learn", "lesson", "tutorial", "walk me through", "help me understand")) {
        return [
          {
            tool: "coach_motion",
            args: { projectId: ctx.projectId },
            reason: "Generate a coaching pass: narrate each component, suggest skill-tiered next steps, and build a lesson plan anchored to real components",
          },
        ];
      }
      return null;
    },
  },

  // --- Motion genome composition ---
  {
    name: "motion-genome",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      // Yield to Motion Ecology — ecosystem/ecology/biodiversity analysis
      // (avoids "biodiversity of" matching the "diversity of" keyword below)
      if (has(msg, "ecosystem", "ecology", "ecological", "biodiversity")) return null;
      // Detect population-genetics / diversity / monoculture requests.
      if (has(msg, "genome", "genetic diversity", "diversity of", "how diverse", "monoculture", "inbreeding", "evolutionary tree", "genealogy of the project", "population", "are my components too similar", "everything looks the same", "too repetitive")) {
        return [
          {
            tool: "analyze_genome",
            args: { projectId: ctx.projectId },
            reason: "Analyze project-level population genetics: diversity, inbreeding coefficient, evolutionary tree, monoculture detection, and diversification suggestions",
          },
        ];
      }
      return null;
    },
  },

  // --- Motion forecast composition ---
  {
    name: "motion-forecast",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      // Detect forecasting / trend / prediction requests.
      if (has(msg, "forecast", "predict", "trend", "where is this going", "where is the project going", "what should i add next", "what's next", "what should come next", "project the future", "trajectory", "extrapolate", "what am i missing", "what haven't i tried")) {
        return [
          {
            tool: "forecast_motion",
            args: { projectId: ctx.projectId },
            reason: "Project current trends forward, flag monoculture risks, identify missing axes, and recommend ranked next moves with expected diversity gain",
          },
        ];
      }
      return null;
    },
  },

  // --- Motion negotiation composition ---
  {
    name: "motion-negotiate",
    match: (msg, ctx) => {
      // Detect requests that involve extreme intent + constraint awareness.
      // Triggered when the user mentions accessibility constraints AND an
      // extreme motion descriptor, or when they explicitly say "negotiate",
      // "compromise", "safe version", "accessible version".
      const wantsNegotiation = has(
        msg,
        "negotiate",
        "compromise",
        "safe version",
        "accessible version",
        "vestibular safe",
        "photosensitivity safe",
        "cognitive safe",
        "reduced motion",
        "make it safe",
        "make it accessible",
        "but safe",
        "but accessible",
      );
      const hasExtreme = has(
        msg,
        "really fast",
        "very fast",
        "extreme",
        "intense",
        "rainbow",
        "neon",
        "infinite",
        "lots of",
        "maximalist",
        "explosive",
      );
      if (!wantsNegotiation && !hasExtreme) return null;

      // Determine the profile from the message.
      let profile = "vestibular-safe";
      if (has(msg, "photosensitivity", "seizure", "flashing", "photosensitive")) profile = "photosensitivity-safe";
      else if (has(msg, "cognitive", "overwhelm", "overload", "attention")) profile = "cognitive-safe";
      else if (has(msg, "reduced motion", "reduce motion", "prefers reduced")) profile = "reduced-motion";
      else if (has(msg, "vestibular", "dizziness", "motion sickness")) profile = "vestibular-safe";

      // Use the original message as the intent.
      return [
        {
          tool: "negotiate_intent",
          args: { projectId: ctx.projectId, intent: msg, profile, apply: false },
          reason: `Negotiate the user's intent against the ${profile} constraint profile and propose a compromise that preserves creative direction while satisfying accessibility constraints`,
        },
      ];
    },
  },

  // --- Motion remix composition ---
  {
    name: "motion-remix",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      // Detect remix requests.
      if (!has(msg, "remix", "recombine", "reshuffle", "different take", "another take", "reimagine", "reinterpret", "fresh take", "shuffle it", "mix it up")) {
        return null;
      }

      // Detect which strategy the user wants.
      let strategy = "shuffle";
      if (has(msg, "mirror", "flip", "reflect")) strategy = "mirror";
      else if (has(msg, "invert", "opposite", "reverse intensity")) strategy = "invert";
      else if (has(msg, "swap", "exchange easings")) strategy = "swap";
      else if (has(msg, "cascade", "stagger", "waterfall")) strategy = "cascade";
      else if (has(msg, "scatter", "randomize timing", "loose")) strategy = "scatter";
      else if (has(msg, "hybridize", "cross-pollinate", "crossbreed")) strategy = "hybridize";
      else if (has(msg, "rephrase", "change mood", "change feel", "different mood")) strategy = "rephrase";
      else if (has(msg, "shuffle", "reorder", "rearrange")) strategy = "shuffle";

      // Determine whether to apply or dry-run.
      const apply = has(msg, "apply", "do it", "make it so", "go ahead");

      return [
        {
          tool: "remix_motion",
          args: { projectId: ctx.projectId, strategy, apply },
          reason: `Remix the project using the ${strategy} strategy to produce a fresh interpretation of the same motion vocabulary`,
        },
      ];
    },
  },

  // --- Motion dialect composition ---
  {
    name: "motion-dialect",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      // Guard: "collaboration" requests belong to the collaboration engine
      if (has(msg, "collaboration", "collaborate")) return null;
      // Detect dialect translation requests.
      if (!has(msg, "translate", "dialect", "for mobile", "for web", "for gaming", "for data", "for presentation", "for kiosk", "mobile version", "web version", "gaming version", "make it mobile", "make it gaming", "convert to")) {
        return null;
      }

      // Detect which target dialect the user wants.
      let targetDialect = "";
      if (has(msg, "mobile", "phone", "ios", "android")) targetDialect = "mobile";
      else if (has(msg, "gaming", "game", "game-ready")) targetDialect = "gaming";
      else if (has(msg, "data-viz", "data viz", "chart", "dashboard")) targetDialect = "data-viz";
      else if (has(msg, "presentation", "slideshow", "deck", "slide")) targetDialect = "presentation";
      else if (has(msg, "kiosk", "signage", "display")) targetDialect = "kiosk";
      else if (has(msg, "accessibility", "reduced motion", "a11y")) targetDialect = "accessibility";
      else if (has(msg, "web", "website", "browser")) targetDialect = "web";

      if (!targetDialect) return null;

      // Determine whether to apply or dry-run.
      const apply = has(msg, "apply", "do it", "make it so", "go ahead", "convert");

      return [
        {
          tool: "translate_dialect",
          args: { projectId: ctx.projectId, sourceDialect: "web", targetDialect, apply },
          reason: `Translate the project's motion vocabulary from web to ${targetDialect} dialect, adjusting duration ranges, easing preferences, intensity, loop behavior, and stagger patterns`,
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
      // Guard: "emotion journey" belongs to emotion intelligence, not storytelling
      if (has(msg, "emotion")) return null;
      // Guard: alchemical transformation belongs to Motion Alchemy analysis,
      // not narrative storytelling.
      if (has(msg, "alchemy", "alchemical", "transmutation", "magnum opus", "philosopher's stone", "nigredo", "albedo", "citrinitas", "rubedo", "prima materia", "crucible", "hermetic")) return null;
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
      // Guard: when the user requests evolutionary/genealogical ANALYSIS
      // (phylogenetic tree, genetic diversity, mutation rate, evolutionary
      // pattern), defer to the dedicated analyze_genealogy intent in the
      // mock provider — this is an analytical operation, not a lineage query.
      if (has(msg, "evolutionary", "phylogenetic", "genetic diversity", "mutation rate", "common ancestor", "genetic trait", "evolution of", "genealogical analysis", "trace the genealogy", "trace the lineage", "trace the ancestry", "analyze the genealogy", "analyze the lineage", "analyze the ancestry")) return null;

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
      // Guard: when the user requests chemical synthesis analysis (alongside
      // chemistry keywords like reaction/compound/molecule/atom/bond/catalyst),
      // defer to the dedicated analyze_chemistry intent — "synthesis" here is
      // a chemical reaction type, not motion-DNA hybridization.
      if (has(msg, "reaction", "compound", "molecule", "molecular", "atom", "atomic", "bond", "catalyst", "inhibitor", "covalent", "ionic", "metallic", "ph of", "enthalpy", "chemical", "chemistry")) return null;

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

  // --- Motion profiler composition ---
  {
    name: "motion-profiler",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      // Guard: "taste profile" belongs to adaptive learning, not performance profiling
      if (has(msg, "taste")) return null;
      if (!has(msg, "profile", "performance cost", "gpu cost", "jank", "frame budget", "rendering cost", "paint cost", "composite layer", "will-change", "fps", "optimization recommendation")) return null;
      return [
        {
          tool: "profile_motion",
          args: { projectId: ctx.projectId },
          reason: "Profile the project's quantitative performance cost — GPU layers, paint complexity, jank risk, and frame budget consumption",
        },
      ];
    },
  },

  // --- Motion curator composition ---
  {
    name: "motion-curator",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "curate", "curation", "organize", "group components", "semantic", "redundanc", "coverage", "collection", "tag components", "classify")) return null;
      // Yield to Motion Chemistry — chemical bonds/reactions/compounds are
      // molecular analysis, not component curation.
      if (has(msg, "chemistry", "chemical", "molecule", "molecular", "atom", "atomic", "bond", "reaction", "catalyst", "inhibitor", "compound", "covalent", "ionic", "metallic", "hydrogen bond", "van der waals", "synthesis", "decomposition", "displacement", "combustion", "ph of", "acidity", "alkalinity", "enthalpy", "entropy of", "equilibrium", "state of matter", "plasma", "periodic")) return null;
      // Yield to Motion Astronomy — celestial bodies/constellations are
      // astronomical classification, not component curation.
      if (has(msg, "astronomy", "astronomical", "celestial", "cosmos", "cosmic", "constellation", "galaxy", "galactic", "stellar", "spectral", "supernova", "black hole", "nebula", "pulsar", "star system", "light-years", "light years", "orbital period", "luminosity")) return null;
      // Yield to Motion Musicology — musical classification is not curation.
      if (has(msg, "musicology", "musical", "melody", "melodic", "harmony", "harmonic", "rhythm", "rhythmic", "tempo", "bpm", "chord", "phrase", "key signature", "time signature", "scale of", "pitch of", "dynamics of", "crescendo", "decrescendo", "sonata", "rondo", "aaba")) return null;
      // Yield to Motion Botany — botanical classification is not curation.
      if (has(msg, "botany", "botanical", "plant", "leaf", "leaves", "stem", "flower", "petal", "root", "canopy", "germination", "seedling", "phenology", "biomass", "tropism", "vine", "shrub")) return null;
      // Yield to Motion Geology — geological classification is not curation.
      if (has(msg, "geology", "geological", "stratum", "strata", "sedimentary", "igneous", "metamorphic", "volcanic", "alluvial", "tectonic", "earthquake", "uplift", "fault line", "faulting", "erosion", "deposition", "mineral", "epoch", "canyon", "plateau", "mountain range", "rock layer", "crust")) return null;
      // Yield to Motion Physics — physics analysis is not curation.
      if (has(msg, "physics", "physical", "kinematic", "dynamic", "force", "energy of", "momentum", "collision", "velocity", "acceleration", "inertia", "equilibrium", "work of", "power of", "spring force")) return null;
      // Yield to Motion Linguistics — linguistic analysis is not curation.
      if (has(msg, "linguistics", "linguistic", "phoneme", "phonology", "morpheme", "morphology", "syntax", "syntactic", "semantic", "semantics", "pragmatic", "pragmatics", "prosody", "discourse", "speech act", "intonation", "language family")) return null;
      // Yield to Motion Cinema — cinematic analysis is not curation.
      if (has(msg, "cinema", "cinematic", "film", "movie", "mise-en-scène", "mise en scene", "camera movement", "camera angle", "narrative structure", "montage", "storyboard", "screenplay", "directing")) return null;
      return [
        {
          tool: "curate_motion",
          args: { projectId: ctx.projectId },
          reason: "Curate the project semantically — tag components by functional role, detect redundancy, and build coverage map",
        },
      ];
    },
  },

  // --- Motion strategist composition ---
  {
    name: "motion-strategist",
    match: (msg, ctx) => {
      if (!has(msg, "strategy", "strategize", "motion plan", "motion philosophy", "timing philosophy", "easing palette", "rhythm pattern", "accessibility stance", "archetype", "motion language", "motion direction", "overall approach")) return null;
      // Yield to Motion Mythology — when mythology context is present,
      // "archetype" means mythological archetype, not strategic archetype.
      if (has(msg, "mythology", "mythic", "mythological", "hero's journey", "heros journey", "monomyth", "shadow archetype", "mentor archetype", "threshold guardian", "transformation myth", "narrative archetype")) return null;
      return [
        {
          tool: "strategize_motion",
          args: { projectId: ctx.projectId },
          reason: "Analyze the project and recommend a holistic motion strategy — archetype, timing philosophy, easing palette, rhythm pattern, and accessibility stance",
        },
      ];
    },
  },

  // --- Motion auditor composition ---
  {
    name: "motion-auditor",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "audit", "wcag", "accessibility report", "compliance", "flash", "seizure", "pause stop hide", "distraction", "cognitive load", "motion sickness", "vestibular", "a11y audit")) return null;
      // Yield to Motion Cognition — detailed cognitive load modeling with working memory,
      // attention switching, perceptual grouping, and processing fluency analysis
      if (has(msg, "working memory", "attention switching", "perceptual grouping", "processing fluency", "mental load", "mental effort")) return null;
      return [
        {
          tool: "audit_motion",
          args: { projectId: ctx.projectId },
          reason: "Audit the project against WCAG accessibility guidelines — flash thresholds, pause/stop/hide, distraction, cognitive load, and motion sickness risk",
        },
      ];
    },
  },

  // --- Motion choreographer composition ---
  {
    name: "motion-choreographer",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      const mode = has(msg, "wave") ? "wave"
        : has(msg, "cluster") ? "cluster"
        : has(msg, "climax") ? "climax"
        : has(msg, "symphony") ? "symphony"
        : has(msg, "cascade") ? "cascade"
        : null;
      if (!has(msg, "choreograph", "sequence", "stagger", "orchestrat", "timeline arrangement", "timing arrangement", "cascade", "wave", "cluster", "climax", "symphony") && !mode) return null;
      return [
        {
          tool: "choreograph_motion",
          args: { projectId: ctx.projectId, mode: mode || "cascade", apply: false },
          reason: `Choreograph the components into a ${mode || "cascade"} sequence with optimal stagger timing and act structure`,
        },
      ];
    },
  },

  // --- Motion export optimizer composition ---
  {
    name: "motion-export-optimizer",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      // A concrete media-format export request (video, gif, webm, html,
      // lottie, or a specific code format) is handled by the dedicated export
      // intents/tools, so do not hijack it into the optimiser here.
      if (has(msg, "video", "mp4", "gif", "webm", "lottie", "after effects", "html", "css code", "json code", "react code", "tsx", "download")) return null;
      const target = has(msg, "lottie") ? "lottie"
        : has(msg, "react spring", "react-spring") ? "react-spring"
        : has(msg, "gsap", "greensock") ? "gsap"
        : has(msg, "waapi", "web animations api") ? "waapi"
        : has(msg, "css", "keyframes") ? "css"
        : null;
      if (!has(msg, "export", "optimize export", "convert to", "target", "bundle", "ship", "deploy") && !target) return null;
      return [
        {
          tool: "optimize_export",
          args: { projectId: ctx.projectId, target: target || "css" },
          reason: `Optimize the project for ${target || "CSS"} export — check compatibility, generate target-specific output, and provide reduced-motion strategy`,
        },
      ];
    },
  },

  // --- Motion cohesion composition ---
  {
    name: "motion-cohesion",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "cohesion", "hierarchy", "focal point", "attention flow", "compositional balance", "synchronicity", "unified", "harmony", "visual weight", "cohesive")) return null;
      return [
        {
          tool: "analyze_cohesion",
          args: { projectId: ctx.projectId },
          reason: "Analyze project-level cohesion — visual hierarchy, focal points, attention flow, compositional balance, and motion synchronicity",
        },
      ];
    },
  },

  // --- Motion conflict detection composition ---
  {
    name: "motion-conflict-detector",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "conflict", "collision", "overlap", "clash", "timeline problem", "timing issue", "gap", "redundant", "anomaly", "dead time")) return null;
      return [
        {
          tool: "detect_conflicts",
          args: { projectId: ctx.projectId },
          reason: "Detect structural conflicts in the timeline — property conflicts, transform collisions, timing gaps, timing collisions, and duration anomalies",
        },
      ];
    },
  },

  // --- Motion variant comparator composition ---
  {
    name: "motion-comparator",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "compare", "versus", "vs", "best variant", "recommend", "rank", "evaluate variants", "a/b test", "which is better")) return null;
      return [
        {
          tool: "compare_variants",
          args: { projectId: ctx.projectId },
          reason: "Compare all variants across five criteria — accessibility, performance, novelty, consistency, and clarity — and recommend the best option",
        },
      ];
    },
  },

  // --- Motion evolution: evolutionary optimization ---
  {
    name: "motion-evolution",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "evolve", "evolution", "optimize", "breed", "natural selection", "genetic", "fitness", "survival of the fittest", "iteratively improve", "evolutionary")) return null;
      // Yield to Motion Genealogy — tracing genealogy/lineage/ancestry is
      // historical analysis, not evolutionary optimization.
      if (has(msg, "genealogy", "genealogical", "lineage", "ancestry", "ancestor", "descendant", "phylogenetic", "common ancestor", "analyze the genealogy", "analyze the lineage", "analyze the ancestry")) return null;
      const strategyM = msg.match(/\b(playful|accessible|performant|harmonious|balanced)\b/);
      const strategy = strategyM ? strategyM[1] : "balanced";
      const apply = has(msg, "apply", "commit", "use the best", "make it so");
      return [
        {
          tool: "evolve_motion",
          args: { projectId: ctx.projectId, strategy, apply },
          reason: `Evolve the motion spec across multiple generations using the ${strategy} strategy — breeds progressively better animations via selection, crossover, and mutation`,
        },
      ];
    },
  },

  // --- List evolution strategies ---
  {
    name: "list-evolution-strategies",
    match: (msg, _ctx) => {
      if (!has(msg, "evolution strateg", "evolve strateg", "list evolution", "what strateg", "available strateg", "optimization strateg")) return null;
      return [
        {
          tool: "list_evolution_strategies",
          args: {},
          reason: "List all available evolution strategies — balanced, playful, accessible, performant, and harmonious",
        },
      ];
    },
  },

  // --- Motion perception: predict viewer response ---
  {
    name: "motion-perception",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "how will", "perceive", "viewer response", "emotional response", "cognitive load", "memorab", "attention retention", "brand perception", "how will viewers", "how does it feel")) return null;
      // Yield to Motion Cognition — detailed cognitive load modeling with working memory,
      // attention switching, perceptual grouping, and processing fluency analysis
      if (has(msg, "working memory", "attention switching", "perceptual grouping", "processing fluency", "mental load", "mental effort")) return null;
      return [
        {
          tool: "predict_perception",
          args: { projectId: ctx.projectId },
          reason: "Predict how viewers will cognitively and emotionally respond to the motion composition",
        },
      ];
    },
  },

  // --- Motion semantics: list concepts ---
  {
    name: "list-semantic-concepts",
    match: (msg, _ctx) => {
      // Guard: plural "emotions" refers to emotion profiles, not semantic concepts
      if (has(msg, "emotions")) return null;
      if (!has(msg, "what emotion", "what concept", "list semantic", "list concept", "available emotion", "motion concept", "what feeling", "semantic concept")) return null;
      const categoryM = msg.match(/\b(emotion|brand|energy|aesthetic)\b/);
      const category = categoryM ? categoryM[1] : undefined;
      return [
        {
          tool: "list_semantic_concepts",
          args: category ? { category } : {},
          reason: `List semantic concepts${category ? ` in the ${category} category` : ""} that can be mapped to motion parameters`,
        },
      ];
    },
  },

  // --- Motion semantics: infer intent ---
  {
    name: "infer-semantic-intent",
    match: (msg, _ctx) => {
      if (!has(msg, "make it feel", "should feel", "feel like", "give it a sense", "convey", "express the", "emotion of", "mood of", "feeling of")) return null;
      // Guard: when the user wants to *analyze* mood/emotion/feeling (rather
      // than generate motion from a description), defer to the dedicated
      // analysis tools (analyze_mood, analyze_emotion).
      if (has(msg, "analyze", "examine", "study", "inspect", "check", "report on", "tell me about", "describe the", "of the motion", "of the composition", "of the animation")) return null;
      return [
        {
          tool: "infer_intent",
          args: { description: msg },
          reason: "Infer semantic intent from the natural language description and generate a matching motion profile",
        },
      ];
    },
  },

  // --- Motion semantics: blend concepts ---
  {
    name: "blend-semantic-concepts",
    match: (msg, _ctx) => {
      if (!has(msg, "blend", "combine", "mix", "merge", "hybrid")) return null;
      const conceptM = msg.match(/\b(trust|urgency|luxury|playful|innovation|calm|energy|mystery|minimal|celebration)\b/g);
      if (!conceptM || conceptM.length < 2) return null;
      const weightM = msg.match(/(\d+)%/);
      const weightA = weightM ? parseInt(weightM[1], 10) / 100 : 0.5;
      return [
        {
          tool: "blend_concepts",
          args: { conceptA: conceptM[0], conceptB: conceptM[1], weightA },
          reason: `Blend ${conceptM[0]} and ${conceptM[1]} into a hybrid motion profile`,
        },
      ];
    },
  },

  // --- Motion physics: simulate ---
  {
    name: "physics-simulate",
    match: (msg, _ctx) => {
      if (!has(msg, "physics", "spring", "gravity", "projectile", "friction", "pendulum")) return null;
      // Guard: when the user wants to *analyze* the composition through
      // physics principles (rather than generate a new simulation), defer
      // to the analyze-physics composition so a physics report is produced.
      if (has(msg, "analyze", "examine", "study", "inspect", "investigate", "measure", "calculate", "report on", "tell me about", "describe the", "of the motion", "of the composition", "of the animation")) return null;

      let simType = "spring";
      if (has(msg, "gravity", "drop", "fall")) simType = "gravity";
      else if (has(msg, "projectile", "throw", "arc", "trajectory")) simType = "projectile";
      else if (has(msg, "friction", "slide", "decelerate")) simType = "friction";
      else if (has(msg, "pendulum", "swing")) simType = "pendulum";

      // Extract numeric parameters
      const config: Record<string, number> = {};
      const stiffnessM = msg.match(/stiffness\s*(\d+)/);
      if (stiffnessM) config.stiffness = parseInt(stiffnessM[1], 10);
      const dampingM = msg.match(/damping\s*(\d+)/);
      if (dampingM) config.damping = parseInt(dampingM[1], 10);
      const massM = msg.match(/mass\s*(\d+(?:\.\d+)?)/);
      if (massM) config.mass = parseFloat(massM[1]);
      const durM = msg.match(/(\d+)\s*ms/);
      if (durM) config.durationMs = parseInt(durM[1], 10);
      const heightM = msg.match(/height\s*(\d+)/);
      if (heightM) config.initialHeight = parseInt(heightM[1], 10);
      const angleM = msg.match(/angle\s*(\d+)/);
      if (angleM) config.angle = parseInt(angleM[1], 10);

      return [
        {
          tool: "simulate_physics",
          args: { type: simType, config: Object.keys(config).length > 0 ? config : undefined },
          reason: `Run a ${simType} physics simulation${Object.keys(config).length > 0 ? " with custom parameters" : ""} and generate motion keyframes from the physical model`,
        },
      ];
    },
  },

  // --- Motion physics: list presets ---
  {
    name: "list-physics-presets",
    match: (msg, _ctx) => {
      if (!has(msg, "physics preset", "list physics", "what physics", "available physics", "physics simulation")) return null;
      return [
        {
          tool: "list_physics_presets",
          args: {},
          reason: "List all available physics simulation presets and types",
        },
      ];
    },
  },

  // --- Motion physics: run named preset ---
  {
    name: "run-physics-preset",
    match: (msg, _ctx) => {
      const presetM = msg.match(/\b(spring-snappy|spring-gentle|spring-bouncy|gravity-drop|gravity-slam|projectile-arc|projectile-high|friction-slide|friction-glide|pendulum-swing)\b/);
      if (!presetM) return null;
      return [
        {
          tool: "run_physics_preset",
          args: { presetId: presetM[1] },
          reason: `Run the ${presetM[1]} physics preset and generate a motion component`,
        },
      ];
    },
  },

  // --- Emotion Intelligence compositions ---
  {
    name: "list-emotions",
    match: (msg) => {
      if (!has(msg, "emotion")) return null;
      if (!has(msg, "list", "show", "available", "all", "what")) return null;
      return [
        {
          tool: "list_emotions",
          args: {},
          reason: "List all available emotion profiles with VAD coordinates and motion parameters",
        },
      ];
    },
  },
  {
    name: "synthesize-from-emotion",
    match: (msg) => {
      const m = msg.match(/\b(?:make|create|generate|synthesize)\s+(?:a\s+)?(?:motion|animation)\s+(?:that\s+(?:feels?|conveys?|expresses?)\s+)?(\w+)/i);
      if (!m) return null;
      const emotionWords = ["joy", "calm", "anger", "fear", "surprise", "trust", "anticipation", "power", "melancholy", "serenity", "playful", "mystery", "urgency", "luxury", "excitement", "sadness"];
      const word = m[1].toLowerCase();
      if (!emotionWords.includes(word)) return null;
      return [
        {
          tool: "synthesize_from_emotion",
          args: { emotionId: word },
          reason: `Synthesize motion parameters from the "${word}" emotion`,
        },
      ];
    },
  },
  {
    name: "plan-emotion-journey",
    match: (msg) => {
      if (!has(msg, "emotion")) return null;
      if (!has(msg, "journey", "arc", "sequence")) return null;
      return [
        {
          tool: "plan_emotion_journey",
          args: { emotionIds: ["calm", "anticipation", "excitement", "joy"], totalDurationMs: 5000 },
          reason: "Plan an emotion journey across a timeline",
        },
      ];
    },
  },

  // --- Adaptive Learning compositions ---
  {
    name: "get-taste-profile",
    match: (msg) => {
      if (!has(msg, "taste")) return null;
      if (!has(msg, "profile", "preference", "learning")) return null;
      return [
        {
          tool: "get_taste_profile",
          args: {},
          reason: "Get the user's learned motion taste profile",
        },
      ];
    },
  },
  {
    name: "recommend-for-project",
    match: (msg) => {
      if (!has(msg, "recommend", "suggest")) return null;
      if (!has(msg, "motion", "animation", "parameter")) return null;
      return [
        {
          tool: "recommend_for_project",
          args: {},
          reason: "Recommend motion parameters based on learned preferences",
        },
      ];
    },
  },

  // --- Contextual Awareness compositions ---
  {
    name: "auto-detect-context",
    match: (msg) => {
      if (!has(msg, "context")) return null;
      if (!has(msg, "detect", "auto", "sense", "what is")) return null;
      return [
        {
          tool: "auto_detect_context",
          args: {},
          reason: "Auto-detect the current motion context from available signals",
        },
      ];
    },
  },
  {
    name: "list-context-options",
    match: (msg) => {
      if (!has(msg, "context")) return null;
      if (!has(msg, "option", "choice", "dimension", "list", "show")) return null;
      return [
        {
          tool: "list_context_options",
          args: {},
          reason: "List all available context options",
        },
      ];
    },
  },

  // --- Motion Collaboration compositions ---
  {
    name: "list-collaboration-modules",
    match: (msg) => {
      if (!has(msg, "collaboration")) return null;
      if (!has(msg, "module", "list", "show", "what", "available")) return null;
      return [
        {
          tool: "list_collaboration_modules",
          args: {},
          reason: "List all available collaboration modules",
        },
      ];
    },
  },
  {
    name: "execute-collaboration",
    match: (msg) => {
      if (!has(msg, "collaboration", "collaborate")) return null;
      if (has(msg, "plan", "design") && !has(msg, "execute", "run")) return null;
      return [
        {
          tool: "execute_collaboration",
          args: { request: msg },
          reason: "Execute a multi-module collaboration to produce a unified motion design",
        },
      ];
    },
  },
  {
    name: "plan-collaboration",
    match: (msg) => {
      if (!has(msg, "collaboration")) return null;
      if (!has(msg, "plan", "design")) return null;
      return [
        {
          tool: "plan_collaboration",
          args: { request: msg },
          reason: "Plan a multi-module collaboration for the complex motion request",
        },
      ];
    },
  },

  // --- Motion Resonance compositions ---
  {
    name: "analyze-resonance",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "resonance", "resonate", "cognitive alignment", "emotional alignment", "rhythmic alignment")) return null;
      if (has(msg, "tune", "optimize", "improve", "fix")) return null;
      return [
        {
          tool: "analyze_resonance",
          args: { projectId: ctx.projectId },
          reason: "Analyze the resonance between the project's motion and the viewer's cognitive/emotional state",
        },
      ];
    },
  },
  {
    name: "tune-resonance",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "resonance", "resonate")) return null;
      if (!has(msg, "tune", "optimize", "improve", "fix", "maximize")) return null;
      return [
        {
          tool: "tune_resonance",
          args: { projectId: ctx.projectId },
          reason: "Tune motion parameters to maximize resonance with the viewer's state",
        },
      ];
    },
  },

  // --- Motion Synesthesia compositions ---
  {
    name: "translate-synesthesia",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "synesthesia", "synesthetic", "multi-sensory", "multisensory", "sound like", "feel like", "taste like", "color of this motion", "color of the motion")) return null;
      return [
        {
          tool: "translate_synesthesia",
          args: { projectId: ctx.projectId },
          reason: "Translate the project's motion into a multi-sensory experience — color, sound, and texture",
        },
      ];
    },
  },
  {
    name: "map-sensory-to-motion",
    match: (msg, _ctx) => {
      if (!has(msg, "motion from", "motion for a", "map a", "convert a", "translate a")) return null;
      const modalityMatch = msg.match(/\b(color|sound|texture|emotion)\b/);
      if (!modalityMatch) return null;
      const valueMatch = msg.match(/#([0-9a-f]{3,6})|\b([A-G]#?\d)\b|\b(smooth|rough|soft|hard|liquid|granular|crystalline|elastic)\b|\b(joy|calm|anger|fear|surprise|trust|anticipation|sadness)\b/i);
      return [
        {
          tool: "map_sensory_to_motion",
          args: {
            modality: modalityMatch[1].toLowerCase(),
            value: valueMatch ? (valueMatch[1] || valueMatch[2] || valueMatch[3] || valueMatch[4] || "#3366cc") : "#3366cc",
          },
          reason: `Map a ${modalityMatch[1]} input to motion parameters for cross-modal design`,
        },
      ];
    },
  },

  // --- Motion Dream compositions ---
  {
    name: "list-dream-concepts",
    match: (msg) => {
      if (!has(msg, "dream")) return null;
      if (!has(msg, "concept", "list", "show", "what", "available")) return null;
      return [
        {
          tool: "list_dream_concepts",
          args: {},
          reason: "List all available dream concepts used as seeds for generative creativity",
        },
      ];
    },
  },
  {
    name: "dream-from-prompt",
    match: (msg, _ctx) => {
      // Must mention "dream" or surrealist keywords
      if (!has(msg, "dream", "imagine", "fantasize", "hallucinate", "surreal")) return null;
      // Skip dream sequence requests
      if (has(msg, "sequence", "series")) return null;
      return [
        {
          tool: "dream_from_prompt",
          args: { projectId: _ctx.projectId, prompt: msg },
          reason: "Generate a dream-like motion variation from the prompt using surrealist concept juxtaposition",
        },
      ];
    },
  },
  {
    name: "dream-sequence",
    match: (msg, _ctx) => {
      if (!has(msg, "dream")) return null;
      if (!has(msg, "sequence", "series")) return null;
      const lengthMatch = msg.match(/(\d+)\s*(?:motion|step|part)/);
      return [
        {
          tool: "generate_dream_sequence",
          args: {
            projectId: _ctx.projectId,
            length: lengthMatch ? parseInt(lengthMatch[1], 10) : 3,
          },
          reason: "Generate a dream sequence — multiple dream motions composed into a narrative thread",
        },
      ];
    },
  },

  // --- Motion Harmonics compositions ---
  {
    name: "analyze-harmonics",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "harmonic", "harmonics", "harmony", "frequency", "spectrum", "overtone", "consonance", "dissonance")) return null;
      if (has(msg, "find", "partner", "compatible", "match")) return null;
      return [
        {
          tool: "analyze_harmonics",
          args: { projectId: ctx.projectId },
          reason: "Analyze the harmonic structure of the composition — extract frequency signatures and compute consonance between components",
        },
      ];
    },
  },
  {
    name: "find-harmonics",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "harmonic", "harmony", "harmonize")) return null;
      if (!has(msg, "find", "partner", "compatible", "match", "pair")) return null;
      return [
        {
          tool: "find_harmonics",
          args: { projectId: ctx.projectId, componentId: "" },
          reason: "Find components that harmonize with the selected component",
        },
      ];
    },
  },

  // --- Motion Entropy compositions ---
  {
    name: "analyze-entropy",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "entropy", "information theory", "information content", "predictability", "redundancy", "information density")) return null;
      if (has(msg, "hotspot", "most varied", "least varied")) return null;
      return [
        {
          tool: "analyze_entropy",
          args: { projectId: ctx.projectId },
          reason: "Apply Shannon's information theory to the composition — measure entropy, mutual information, and predictability",
        },
      ];
    },
  },
  {
    name: "identify-hotspots",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "hotspot", "most varied", "least varied", "most informative", "redundant pair")) return null;
      return [
        {
          tool: "identify_information_hotspots",
          args: { projectId: ctx.projectId },
          reason: "Identify the most and least varied motion properties, plus redundant component pairs",
        },
      ];
    },
  },

  // --- Motion Cognition compositions ---
  {
    name: "analyze-cognitive-load",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "cognitive load", "cognitive", "working memory", "attention switching", "perceptual grouping", "processing fluency", "mental load", "mental effort")) return null;
      return [
        {
          tool: "analyze_cognitive_load",
          args: { projectId: ctx.projectId },
          reason: "Model the cognitive load the composition imposes on the viewer — working memory, attention switching, grouping, fluency",
        },
      ];
    },
  },

  // --- Motion Topology compositions ---
  {
    name: "analyze-topology",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "topology", "topological", "connected component", "temporal hole", "euler characteristic", "genus", "compactness", "connectivity")) return null;
      if (has(msg, "path", "route", "between")) return null;
      return [
        {
          tool: "analyze_topology",
          args: { projectId: ctx.projectId },
          reason: "Analyze the topological structure of the composition — connected components, temporal holes, Euler characteristic, genus",
        },
      ];
    },
  },
  {
    name: "find-temporal-path",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "path", "route", "between")) return null;
      if (!has(msg, "topology", "topological", "temporal", "overlap")) return null;
      return [
        {
          tool: "find_temporal_path",
          args: { projectId: ctx.projectId, fromId: "", toId: "" },
          reason: "Find the shortest temporal path between two components through overlapping neighbors",
        },
      ];
    },
  },

  // --- Motion Poetics compositions ---
  {
    name: "analyze-poetics",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "poetic", "poetics", "meter", "iambic", "trochaic", "dactylic", "anapestic", "stanza", "caesura", "enjambment", "sonnet", "haiku", "free verse", "blank verse", "rhythm of the motion", "poetic form")) return null;
      return [
        {
          tool: "analyze_poetics",
          args: { projectId: ctx.projectId },
          reason: "Apply poetic meter and form to the composition — detect feet, stanzas, caesuras, enjambments, and classify the poetic form",
        },
      ];
    },
  },

  // --- Motion Ecology compositions ---
  {
    name: "analyze-ecosystem",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "ecosystem", "ecology", "ecological", "species", "biodiversity", "symbiotic", "parasitic", "predator-prey", "trophic", "carrying capacity", "niche")) return null;
      return [
        {
          tool: "analyze_ecosystem",
          args: { projectId: ctx.projectId },
          reason: "Model the composition as a living ecosystem — classify species, detect relationships, compute biodiversity and health",
        },
      ];
    },
  },

  // --- Motion Calligraphy compositions ---
  {
    name: "analyze-calligraphy",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "calligraphy", "calligraphic", "brush stroke", "brushwork", "ink flow", "penmanship", "cursive", "regular script", "running script", "wild script", "stroke quality", "calligraphic character")) return null;
      return [
        {
          tool: "analyze_calligraphy",
          args: { projectId: ctx.projectId },
          reason: "Analyze the composition as calligraphic art — evaluate stroke quality, pressure, velocity, fluency, ink flow, and overall character",
        },
      ];
    },
  },

  // --- Motion Mythology compositions ---
  {
    name: "analyze-mythology",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "mythology", "mythic", "mythological", "hero's journey", "heros journey", "monomyth", "archetype", "archetypal", "shadow archetype", "mentor archetype", "threshold guardian", "boon", "transformation myth", "narrative archetype")) return null;
      return [
        {
          tool: "analyze_mythology",
          args: { projectId: ctx.projectId },
          reason: "Interpret the composition through mythological lens — detect hero's journey stages, archetypal patterns, narrative structure, and emotional boon",
        },
      ];
    },
  },

  // --- Motion Weather compositions ---
  {
    name: "analyze-weather",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "weather", "storm", "storm pattern", "atmospheric pressure", "weather system", "weather forecast", "climate", "front activity", "calm period", "wind speed", "humidity", "forecast the", "meteorological")) return null;
      return [
        {
          tool: "analyze_weather",
          args: { projectId: ctx.projectId },
          reason: "Model the composition as a weather system — detect pressure, wind, fronts, storms, calm periods, and forecast emotional climate",
        },
      ];
    },
  },

  // --- Motion Alchemy compositions ---
  {
    name: "analyze-alchemy",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "alchemy", "alchemical", "transmutation", "magnum opus", "philosopher's stone", "nigredo", "albedo", "citrinitas", "rubedo", "prima materia", "crucible", "hermetic", "alchemy of", "alchemically")) return null;
      return [
        {
          tool: "analyze_alchemy",
          args: { projectId: ctx.projectId },
          reason: "Interpret the composition through alchemical transformation — detect the four magnum opus stages, operations, prima materia, and philosopher's stone",
        },
      ];
    },
  },

  // --- Motion Architecture compositions ---
  {
    name: "analyze-architecture",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "architecture", "architectural", "structural role", "foundation", "facade", "load-bearing", "proportion", "golden ratio", "hierarchy of", "material honesty", "brutalist", "modernist", "baroque", "gothic", "deconstructivist", "building", "structure of")) return null;
      // Yield to Motion Astronomy — galactic/celestial structure is
      // astronomical, not architectural.
      if (has(msg, "astronomy", "astronomical", "celestial", "cosmos", "cosmic", "constellation", "galaxy", "galactic", "stellar", "spectral", "supernova", "black hole", "nebula", "pulsar", "star system", "light-years", "light years", "orbital period", "luminosity")) return null;
      // Yield to Motion Chemistry — molecular structure is chemical.
      if (has(msg, "chemistry", "chemical", "molecule", "molecular", "atom", "atomic", "bond", "reaction", "catalyst", "inhibitor", "compound", "covalent", "ionic", "metallic", "hydrogen bond", "van der waals", "synthesis", "decomposition", "displacement", "combustion", "ph of", "acidity", "alkalinity", "enthalpy", "entropy of", "equilibrium", "state of matter", "plasma", "periodic")) return null;
      // Yield to Motion Musicology — musical form/structure is musical.
      if (has(msg, "musicology", "musical", "melody", "melodic", "harmony", "harmonic", "rhythm", "rhythmic", "tempo", "bpm", "chord", "phrase", "key signature", "time signature", "scale of", "pitch of", "dynamics of", "crescendo", "decrescendo", "sonata", "rondo", "aaba")) return null;
      // Yield to Motion Botany — plant structure is botanical.
      if (has(msg, "botany", "botanical", "plant", "leaf", "leaves", "stem", "flower", "petal", "root", "canopy", "germination", "seedling", "phenology", "biomass", "tropism", "vine", "shrub")) return null;
      // Yield to Motion Geology — geological strata structure is geological.
      if (has(msg, "geology", "geological", "stratum", "strata", "sedimentary", "igneous", "metamorphic", "volcanic", "alluvial", "tectonic", "earthquake", "uplift", "fault line", "faulting", "erosion", "deposition", "mineral", "epoch", "canyon", "plateau", "mountain range", "rock layer", "crust")) return null;
      return [
        {
          tool: "analyze_architecture",
          args: { projectId: ctx.projectId },
          reason: "Analyze the composition as a built structure — classify structural roles, proportion, hierarchy, spatial organization, style, and integrity",
        },
      ];
    },
  },

  // --- Motion Cartography compositions ---
  {
    name: "analyze-cartography",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "cartography", "cartographic", "terrain", "elevation", "contour", "landmark", "compass direction", "biome", "territory", "map the", "topography", "landscape of")) return null;
      // Yield to Motion Astronomy — mapping the cosmos/constellations is
      // astronomical, not cartographic.
      if (has(msg, "astronomy", "astronomical", "celestial", "cosmos", "cosmic", "constellation", "galaxy", "galactic", "stellar", "spectral", "supernova", "black hole", "nebula", "pulsar", "star system", "light-years", "light years", "orbital period", "luminosity")) return null;
      // Yield to Motion Chemistry — mapping molecular structure is chemical.
      if (has(msg, "chemistry", "chemical", "molecule", "molecular", "atom", "atomic", "bond", "reaction", "catalyst", "inhibitor", "compound", "covalent", "ionic", "metallic", "hydrogen bond", "van der waals", "synthesis", "decomposition", "displacement", "combustion", "ph of", "acidity", "alkalinity", "enthalpy", "entropy of", "equilibrium", "state of matter", "plasma", "periodic")) return null;
      // Yield to Motion Musicology — musical landscape is musical.
      if (has(msg, "musicology", "musical", "melody", "melodic", "harmony", "harmonic", "rhythm", "rhythmic", "tempo", "bpm", "chord", "phrase", "key signature", "time signature", "scale of", "pitch of", "dynamics of", "crescendo", "decrescendo", "sonata", "rondo", "aaba")) return null;
      // Yield to Motion Botany — botanical landscape is botanical.
      if (has(msg, "botany", "botanical", "plant", "leaf", "leaves", "stem", "flower", "petal", "root", "canopy", "germination", "seedling", "phenology", "biomass", "tropism", "vine", "shrub")) return null;
      // Yield to Motion Geology — geological terrain is geological.
      if (has(msg, "geology", "geological", "stratum", "strata", "sedimentary", "igneous", "metamorphic", "volcanic", "alluvial", "tectonic", "earthquake", "uplift", "fault line", "faulting", "erosion", "deposition", "mineral", "epoch", "canyon", "plateau", "mountain range", "rock layer", "crust")) return null;
      return [
        {
          tool: "analyze_cartography",
          args: { projectId: ctx.projectId },
          reason: "Map the composition as cartographic terrain — compute elevation, contours, landmarks, routes, territories, compass, and scale",
        },
      ];
    },
  },

  // --- Motion Genealogy compositions ---
  {
    name: "analyze-genealogy",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "genealogy", "genealogical", "lineage", "ancestry", "ancestor", "descendant", "evolutionary", "phylogenetic", "genetic trait", "mutation", "common ancestor", "evolution of")) return null;
      return [
        {
          tool: "analyze_genealogy",
          args: { projectId: ctx.projectId },
          reason: "Trace the evolutionary lineage of motion patterns — extract genetic traits, detect ancestry, build phylogenetic tree, and analyze diversity",
        },
      ];
    },
  },

  // --- Motion Astronomy compositions ---
  {
    name: "analyze-astronomy",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "astronomy", "astronomical", "celestial", "cosmos", "cosmic", "constellation", "galaxy", "galactic", "stellar", "spectral", "supernova", "black hole", "nebula", "pulsar", "star system", "light-years", "light years", "orbit of", "orbital", "magnitude of", "luminosity")) return null;
      return [
        {
          tool: "analyze_astronomy",
          args: { projectId: ctx.projectId },
          reason: "Map the composition as celestial phenomena — classify celestial bodies, spectral types, constellations, cosmic events, and galactic structure",
        },
      ];
    },
  },

  // --- Motion Chemistry compositions ---
  {
    name: "analyze-chemistry",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "chemistry", "chemical", "molecule", "molecular", "atom", "atomic", "bond", "reaction", "catalyst", "inhibitor", "compound", "covalent", "ionic", "metallic", "hydrogen bond", "van der waals", "synthesis", "decomposition", "displacement", "combustion", "ph of", "acidity", "alkalinity", "enthalpy", "entropy of", "equilibrium", "state of matter", "plasma", "periodic")) return null;
      return [
        {
          tool: "analyze_chemistry",
          args: { projectId: ctx.projectId },
          reason: "Analyze the composition as a chemical system — extract atoms, build molecules, detect bonds, classify reactions, identify catalysts and inhibitors, and compute pH, temperature, entropy, enthalpy, and equilibrium",
        },
      ];
    },
  },

  // --- Motion Musicology compositions ---
  {
    name: "analyze-musicology",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      // Yield to set_project_tempo / quantize_to_tempo when the user explicitly
      // wants to SET or QUANTIZE the tempo rather than analyze it. Without this
      // guard, "sync to 120 bpm" matches the musicology keyword set (bpm/tempo)
      // and pre-empts the tempo-setting tools in the mock provider.
      // The same yield applies to phase / polyrhythm intents — "polyrhythm"
      // contains the "rhythm" substring and would otherwise hijack set_phase /
      // align_to_beat into a musicology analysis.
      if (has(msg, "sync", "set tempo", "set bpm", "quantize", "lock to", "snap to", "on the beat", "phase", "offbeat", "downbeat", "backbeat", "polyrhythm", "on the and", "align to beat", "align to the beat")) {
        return null;
      }
      if (!has(msg, "musicology", "musical", "melody", "melodic", "harmony", "harmonic", "rhythm", "rhythmic", "tempo", "bpm", "chord", "phrase", "key signature", "time signature", "scale of", "pitch of", "dynamics of", "crescendo", "decrescendo", "sonata", "rondo", "aaba", "orchestration", "counterpoint", "articulation")) return null;
      return [
        {
          tool: "analyze_musicology",
          args: { projectId: ctx.projectId },
          reason: "Analyze the composition as a musical score — extract notes, detect chords, identify phrases, compute rhythm and tempo, analyze dynamics, determine form, and detect key and scale",
        },
      ];
    },
  },

  // --- Motion Botany compositions ---
  {
    name: "analyze-botany",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "botany", "botanical", "plant", "organ", "leaf", "leaves", "stem", "flower", "petal", "root", "branch", "canopy", "germination", "seedling", "phenology", "biomass", "tropism", "photosynth", "vine", "shrub", "tree-like", "growth pattern", "branching")) return null;
      return [
        {
          tool: "analyze_botany",
          args: { projectId: ctx.projectId },
          reason: "Analyze the composition as a botanical system — classify organs, detect branching, analyze canopy and root system, build phenology timeline, determine life form, and compute biomass, diversity, and vitality",
        },
      ];
    },
  },

  // --- Motion Geology compositions ---
  {
    name: "analyze-geology",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "geology", "geological", "stratum", "strata", "sedimentary", "igneous", "metamorphic", "volcanic", "alluvial", "tectonic", "earthquake", "uplift", "fault line", "faulting", "erosion", "deposition", "mineral", "epoch", "topology of", "terrain of", "canyon", "plateau", "mountain range", "rock layer", "crust")) return null;
      return [
        {
          tool: "analyze_geology",
          args: { projectId: ctx.projectId },
          reason: "Analyze the composition as a geological formation — classify strata, detect tectonic events, identify fault lines, analyze mineral composition, divide epochs, and examine surface topology",
        },
      ];
    },
  },

  // --- Motion Physics compositions ---
  {
    name: "analyze-physics",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      // Yield to simulate_physics when the user wants to *generate* motion
      if (has(msg, "simulate", "generate", "create", "run", "preset")) return null;
      if (!has(msg, "physics", "physical", "kinematic", "dynamic", "force", "energy", "momentum", "collision", "velocity", "acceleration", "inertia", "equilibrium", "work of", "power of", "friction", "gravity", "spring force")) return null;
      return [
        {
          tool: "analyze_physics",
          args: { projectId: ctx.projectId },
          reason: "Analyze the composition through physics principles — compute kinematics, dynamics, energy, momentum, detect collisions, and analyze equilibrium",
        },
      ];
    },
  },

  // --- Motion Linguistics compositions ---
  {
    name: "analyze-linguistics",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "linguistics", "linguistic", "phoneme", "phonology", "morpheme", "morphology", "syntax", "syntactic", "semantic", "semantics", "pragmatic", "pragmatics", "prosody", "discourse", "clause", "phrase structure", "speech act", "intonation", "stress pattern", "rhythm of speech", "register of", "language family")) return null;
      return [
        {
          tool: "analyze_linguistics",
          args: { projectId: ctx.projectId },
          reason: "Analyze the composition as a linguistic utterance — extract phonemes, classify morphemes, build syntactic phrases and clauses, analyze prosody, determine semantics, identify speech acts, and trace discourse coherence",
        },
      ];
    },
  },

  // --- Motion Cinema compositions ---
  {
    name: "analyze-cinema",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "cinema", "cinematic", "film", "movie", "shot", "scene", "cut", "transition", "mise-en-scène", "mise en scene", "camera movement", "camera angle", "narrative structure", "montage", "genre of", "close-up", "wide shot", "pan", "tilt", "dolly", "zoom", "crane", "storyboard", "screenplay", "directing")) return null;
      return [
        {
          tool: "analyze_cinema",
          args: { projectId: ctx.projectId },
          reason: "Analyze the composition as a cinematic sequence — classify shots, detect cuts and transitions, determine camera movement, analyze mise-en-scène, identify narrative structure, compute pacing, classify montage type, and detect genre",
        },
      ];
    },
  },

  // --- Core intelligence: emotion analysis ---
  {
    name: "analyze-emotion",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "emotion", "emotional", "feeling of", "feel of", "emotional arc", "emotional journey", "emotional impact", "emotional tone")) return null;
      return [
        {
          tool: "analyze_emotion",
          args: { projectId: ctx.projectId },
          reason: "Analyze the emotional content — extract emotional beats, determine the dominant emotion, classify the emotional arc, and measure emotional range",
        },
      ];
    },
  },

  // --- Core intelligence: rhythm analysis ---
  {
    name: "analyze-rhythm",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "rhythm of", "rhythmic", "beat of", "tempo of", "groove of", "rhythmic pattern", "rhythm analysis")) return null;
      return [
        {
          tool: "analyze_rhythm",
          args: { projectId: ctx.projectId },
          reason: "Analyze the visual rhythm — extract rhythmic beats, compute tempo (BPM), classify rhythm type, measure regularity and groove, and detect rhythmic conflicts",
        },
      ];
    },
  },

  // --- Core intelligence: narrative analysis ---
  {
    name: "analyze-narrative",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "narrative of", "narrative arc", "story arc", "story structure", "three-act", "five-act", "narrative structure", "plot of", "storytelling of")) return null;
      return [
        {
          tool: "analyze_narrative",
          args: { projectId: ctx.projectId },
          reason: "Analyze the narrative structure — identify story segments/acts, detect complete arcs, compute pacing and coherence scores, and suggest narrative improvements",
        },
      ];
    },
  },

  // --- Core intelligence: pacing analysis ---
  {
    name: "analyze-pacing",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "pacing of", "pace of", "pacing analysis", "too fast", "too slow", "pacing score", "timing pace")) return null;
      return [
        {
          tool: "analyze_pacing",
          args: { projectId: ctx.projectId },
          reason: "Analyze the pacing — compute pacing score, detect timing distribution, evaluate rhythm of delivery, and suggest pacing improvements",
        },
      ];
    },
  },

  // --- Core intelligence: mood analysis ---
  {
    name: "analyze-mood",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "mood of", "mood analysis", "vibe of", "atmosphere of", "tone of the motion", "mood profile")) return null;
      return [
        {
          tool: "analyze_mood",
          args: { projectId: ctx.projectId },
          reason: "Analyze the mood — detect the dominant mood, measure energy and valence, and generate a mood profile with personality traits",
        },
      ];
    },
  },

  // --- Core intelligence: restraint analysis ---
  {
    name: "analyze-restraint",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "restraint of", "restraint analysis", "restraint score", "motion density", "too much motion", "overanimated", "busy motion")) return null;
      return [
        {
          tool: "analyze_restraint",
          args: { projectId: ctx.projectId },
          reason: "Analyze motion restraint — compute a restraint score, detect excess motion density, identify over-animated areas, and recommend simplifications",
        },
      ];
    },
  },

  // --- Core intelligence: principles analysis ---
  {
    name: "analyze-principles",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "principles of", "animation principles", "principle analysis", "squash and stretch", "anticipation principle", "follow through", "staging principle", "appeal principle", "slow in slow out", "arcs principle", "secondary action")) return null;
      return [
        {
          tool: "analyze_principles",
          args: { projectId: ctx.projectId },
          reason: "Analyze against the 12 animation principles — check squash & stretch, anticipation, staging, follow-through, overlapping action, slow in/out, arcs, secondary action, timing, exaggeration, solid drawing, and appeal",
        },
      ];
    },
  },

  // --- Core intelligence: visual context analysis ---
  {
    name: "analyze-visual-context",
    match: (msg, ctx) => {
      if (!ctx.hasComponents) return null;
      if (!has(msg, "visual context", "visual layout", "visual quality", "layout balance", "spacing consistency", "visual hierarchy", "canvas layout", "composition balance", "visual review", "canvas look", "spatial layout")) return null;
      return [
        {
          tool: "analyze_visual_context",
          args: { projectId: ctx.projectId },
          reason: "Analyze the visual context — compute visual balance, spacing consistency, hierarchy, color palette distribution, overlap detection, and alignment, returning a 0-100 visual quality score",
        },
      ];
    },
  },
];

/**
 * Pre-check for collaboration requests. These must be handled before any
 * other pattern, because collaboration requests often contain keywords
 * (spring, physics, mobile, etc.) that would otherwise match more
 * specific patterns and hijack the request.
 */
/**
 * Pre-check for core intelligence analysis requests. These must be handled
 * before any other pattern, because keywords like "mood", "emotion",
 * "rhythm", "pacing" inside analysis requests would otherwise match
 * semantic-intent, template, or critique patterns and hijack the routing.
 */
function matchAnalysisFirst(normalized: string, ctx: MatchContext): ComposedTool[] | null {
  if (!ctx.hasComponents) return null;
  // Only intercept when the user explicitly wants to analyze/examine.
  if (!has(normalized, "analyze", "examine", "study", "inspect", "investigate")) return null;

  const checks: Array<{ keywords: string[]; tool: string; reason: string }> = [
    { keywords: ["emotion", "emotional", "emotional arc", "emotional journey"], tool: "analyze_emotion", reason: "Analyze the emotional content — extract emotional beats, determine the dominant emotion, classify the emotional arc, and measure emotional range" },
    { keywords: ["rhythm of", "rhythmic", "beat of", "tempo of", "groove of"], tool: "analyze_rhythm", reason: "Analyze the visual rhythm — extract rhythmic beats, compute tempo (BPM), classify rhythm type, measure regularity and groove, and detect rhythmic conflicts" },
    { keywords: ["narrative of", "narrative arc", "story arc", "story structure", "narrative structure"], tool: "analyze_narrative", reason: "Analyze the narrative structure — identify story segments/acts, detect complete arcs, compute pacing and coherence scores, and suggest narrative improvements" },
    { keywords: ["pacing of", "pace of", "pacing analysis", "pacing score"], tool: "analyze_pacing", reason: "Analyze the pacing — compute pacing score, detect timing distribution, evaluate rhythm of delivery, and suggest pacing improvements" },
    { keywords: ["mood of", "mood analysis", "mood profile"], tool: "analyze_mood", reason: "Analyze the mood — detect the dominant mood, measure energy and valence, and generate a mood profile with personality traits" },
    { keywords: ["restraint of", "restraint analysis", "restraint score", "motion density"], tool: "analyze_restraint", reason: "Analyze motion restraint — compute a restraint score, detect excess motion density, identify over-animated areas, and recommend simplifications" },
    { keywords: ["principles of", "animation principles", "principle analysis", "squash and stretch", "follow through"], tool: "analyze_principles", reason: "Analyze against the 12 animation principles — check squash & stretch, anticipation, staging, follow-through, overlapping action, slow in/out, arcs, secondary action, timing, exaggeration, solid drawing, and appeal" },
    { keywords: ["visual context", "visual layout", "visual quality", "layout balance", "spacing consistency", "visual hierarchy"], tool: "analyze_visual_context", reason: "Analyze the visual context — compute visual balance, spacing consistency, hierarchy, color palette distribution, overlap detection, and alignment, returning a 0-100 visual quality score" },
  ];

  for (const check of checks) {
    if (has(normalized, ...check.keywords)) {
      return [
        {
          tool: check.tool,
          args: { projectId: ctx.projectId },
          reason: check.reason,
        },
      ];
    }
  }
  return null;
}

function matchCollaborationFirst(normalized: string): ComposedTool[] | null {
  if (!has(normalized, "collaboration", "collaborate")) return null;

  // List modules: "list collaboration modules", "what collaboration modules are available"
  if (has(normalized, "module", "list", "show", "what", "available")) {
    return [
      {
        tool: "list_collaboration_modules",
        args: {},
        reason: "List all available collaboration modules",
      },
    ];
  }

  // Plan only: "plan a collaboration", "design a collaboration" (without execute/run)
  if (has(normalized, "plan", "design") && !has(normalized, "execute", "run")) {
    return [
      {
        tool: "plan_collaboration",
        args: { request: normalized },
        reason: "Plan a multi-module collaboration for the complex motion request",
      },
    ];
  }

  // Execute (default when "collaboration/collaborate" is present without "plan/design" only)
  return [
    {
      tool: "execute_collaboration",
      args: { request: normalized },
      reason: "Execute a multi-module collaboration to produce a unified motion design",
    },
  ];
}

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

  // Collaboration requests are checked first so that keywords like
  // "spring", "physics", "mobile" inside a collaboration request don't
  // hijack the routing to more specific patterns.
  const collaborationTools = matchCollaborationFirst(normalized);
  if (collaborationTools) {
    return {
      matched: true,
      tools: collaborationTools,
      patternName: "collaboration-priority",
    };
  }

  // Core intelligence analysis requests are checked early so that keywords
  // like "mood", "emotion", "rhythm" inside an analysis request don't get
  // hijacked by template, semantics, or critique patterns.
  const analysisTools = matchAnalysisFirst(normalized, ctx);
  if (analysisTools) {
    return {
      matched: true,
      tools: analysisTools,
      patternName: "analysis-priority",
    };
  }

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
