import type { Easing, Keyframe } from "@openmotion/shared";
import { easingPreset } from "../shared/motion/easing.js";

/**
 * Natural language motion parser — converts free-text descriptions into
 * structured motion specs. Works without an LLM by detecting keywords for
 * motion verbs, easing, duration, and direction.
 *
 * Example inputs:
 *   "make it bounce in playfully with spring physics"
 *   "smooth fade from left, about 600ms"
 *   "dramatic scale up with overshoot, loop 3 times"
 */

interface ParsedMotionResult {
  verb: string;
  direction: string | null;
  easing: Easing;
  durationMs: number;
  loop: number | "infinite";
  delayMs: number;
  keyframes: Keyframe[];
  properties: string[];
  isValid: boolean;
  errors: string[];
  toPatch: () => Partial<{
    easing: Easing;
    durationMs: number;
    delayMs: number;
    iterationCount: number | "infinite";
    keyframes: Keyframe[];
  }>;
}

// --- Verb detection ---

interface VerbPattern {
  verbs: string[];
  keywords: RegExp;
  keyframes: (dir: string) => Keyframe[];
  properties: string[];
  defaultEasing: Easing;
  defaultDuration: number;
}

const VERB_PATTERNS: VerbPattern[] = [
  {
    verbs: ["fade"],
    keywords: /\b(fade|dissolve|appear|disappear|vanish)\b/i,
    keyframes: (dir) =>
      dir === "out"
        ? [{ offset: 0, properties: { opacity: 1 } }, { offset: 1, properties: { opacity: 0 } }]
        : [{ offset: 0, properties: { opacity: 0 } }, { offset: 1, properties: { opacity: 1 } }],
    properties: ["opacity"],
    defaultEasing: easingPreset("ease-out"),
    defaultDuration: 600,
  },
  {
    verbs: ["slide"],
    keywords: /\b(slide|glide|sweep|move|travel)\b/i,
    keyframes: (dir) => {
      const dist = 40;
      const map: Record<string, [string, string]> = {
        up: [`translateY(${dist}px)`, "translateY(0px)"],
        down: [`translateY(-${dist}px)`, "translateY(0px)"],
        left: [`translateX(${dist}px)`, "translateX(0px)"],
        right: [`translateX(-${dist}px)`, "translateX(0px)"],
      };
      const [from, to] = map[dir] ?? map.right;
      return [
        { offset: 0, properties: { transform: from, opacity: 0 } },
        { offset: 1, properties: { transform: to, opacity: 1 } },
      ];
    },
    properties: ["translateX", "translateY", "opacity"],
    defaultEasing: easingPreset("ease-out"),
    defaultDuration: 500,
  },
  {
    verbs: ["bounce"],
    keywords: /\b(bounce|hop|jump|spring up|pop in)\b/i,
    keyframes: () => [
      { offset: 0, properties: { translateY: "-60px", opacity: 0 } },
      { offset: 0.5, properties: { translateY: "10px", opacity: 1 } },
      { offset: 0.7, properties: { translateY: "-5px" } },
      { offset: 0.85, properties: { translateY: "2px" } },
      { offset: 1, properties: { translateY: "0px" } },
    ],
    properties: ["translateY", "opacity"],
    defaultEasing: easingPreset("bounce"),
    defaultDuration: 800,
  },
  {
    verbs: ["rotate"],
    keywords: /\b(rotat|spin|turn|twist|swirl)\b/i,
    keyframes: (dir) =>
      dir === "ccw" || dir === "counterclockwise"
        ? [{ offset: 0, properties: { rotate: "-360deg" } }, { offset: 1, properties: { rotate: "0deg" } }]
        : [{ offset: 0, properties: { rotate: "0deg" } }, { offset: 1, properties: { rotate: "360deg" } }],
    properties: ["rotate"],
    defaultEasing: easingPreset("ease-in-out"),
    defaultDuration: 1000,
  },
  {
    verbs: ["scale"],
    keywords: /\b(scale|grow|shrink|zoom|expand|enlarge)\b/i,
    keyframes: (dir) =>
      dir === "out"
        ? [{ offset: 0, properties: { scale: "1.2", opacity: 1 } }, { offset: 1, properties: { scale: "1", opacity: 0 } }]
        : [{ offset: 0, properties: { scale: "0", opacity: 0 } }, { offset: 1, properties: { scale: "1", opacity: 1 } }],
    properties: ["scale", "opacity"],
    defaultEasing: easingPreset("ease-out"),
    defaultDuration: 500,
  },
  {
    verbs: ["pulse"],
    keywords: /\b(pulse|throb|beat|flash|blink)\b/i,
    keyframes: () => [
      { offset: 0, properties: { scale: "1" } },
      { offset: 0.5, properties: { scale: "1.15" } },
      { offset: 1, properties: { scale: "1" } },
    ],
    properties: ["scale"],
    defaultEasing: easingPreset("ease-in-out"),
    defaultDuration: 800,
  },
  {
    verbs: ["shake"],
    keywords: /\b(shake|vibrate|tremble|rattle|jitter)\b/i,
    keyframes: () => [
      { offset: 0, properties: { translateX: "0px" } },
      { offset: 0.15, properties: { translateX: "-10px" } },
      { offset: 0.3, properties: { translateX: "10px" } },
      { offset: 0.45, properties: { translateX: "-8px" } },
      { offset: 0.6, properties: { translateX: "8px" } },
      { offset: 0.75, properties: { translateX: "-4px" } },
      { offset: 1, properties: { translateX: "0px" } },
    ],
    properties: ["translateX"],
    defaultEasing: easingPreset("linear"),
    defaultDuration: 500,
  },
  {
    verbs: ["flip"],
    keywords: /\b(flip|turn over|cartwheel)\b/i,
    keyframes: (dir) => {
      if (dir === "x" || dir === "vertical") {
        return [{ offset: 0, properties: { rotateX: "90deg", opacity: 0 } }, { offset: 1, properties: { rotateX: "0deg", opacity: 1 } }];
      }
      return [{ offset: 0, properties: { rotateY: "90deg", opacity: 0 } }, { offset: 1, properties: { rotateY: "0deg", opacity: 1 } }];
    },
    properties: ["rotateX", "rotateY", "opacity"],
    defaultEasing: easingPreset("ease-out"),
    defaultDuration: 600,
  },
  {
    verbs: ["float"],
    keywords: /\b(float|hover|drift|levitate|bob)\b/i,
    keyframes: () => [
      { offset: 0, properties: { translateY: "0px" } },
      { offset: 0.5, properties: { translateY: "-15px" } },
      { offset: 1, properties: { translateY: "0px" } },
    ],
    properties: ["translateY"],
    defaultEasing: easingPreset("ease-in-out"),
    defaultDuration: 3000,
  },
  {
    verbs: ["glow"],
    keywords: /\b(glow|shine|radiate|glare|neon)\b/i,
    keyframes: () => [
      { offset: 0, properties: { boxShadow: "0 0 0px rgba(255,255,255,0)" } },
      { offset: 0.5, properties: { boxShadow: "0 0 20px rgba(255,255,255,0.8)" } },
      { offset: 1, properties: { boxShadow: "0 0 0px rgba(255,255,255,0)" } },
    ],
    properties: ["boxShadow"],
    defaultEasing: easingPreset("ease-in-out"),
    defaultDuration: 1200,
  },
  {
    verbs: ["heartbeat"],
    keywords: /\b(heartbeat|heart beat|cardiac|pump)\b/i,
    keyframes: () => [
      { offset: 0, properties: { scale: "1" } },
      { offset: 0.14, properties: { scale: "1.15" } },
      { offset: 0.28, properties: { scale: "1" } },
      { offset: 0.42, properties: { scale: "1.15" } },
      { offset: 0.7, properties: { scale: "1" } },
      { offset: 1, properties: { scale: "1" } },
    ],
    properties: ["scale"],
    defaultEasing: easingPreset("ease-in-out"),
    defaultDuration: 1000,
  },
  {
    verbs: ["drop"],
    keywords: /\b(drop|fall|plunge|descend|tumble)\b/i,
    keyframes: () => [
      { offset: 0, properties: { translateY: "-100px", opacity: 0 } },
      { offset: 0.6, properties: { translateY: "10px", opacity: 1 } },
      { offset: 0.75, properties: { translateY: "-5px" } },
      { offset: 1, properties: { translateY: "0px" } },
    ],
    properties: ["translateY", "opacity"],
    defaultEasing: easingPreset("bounce"),
    defaultDuration: 700,
  },
  {
    verbs: ["swing"],
    keywords: /\b(swing|sway|pendulum|rock|oscillate)\b/i,
    keyframes: () => [
      { offset: 0, properties: { rotate: "0deg" } },
      { offset: 0.25, properties: { rotate: "15deg" } },
      { offset: 0.5, properties: { rotate: "-10deg" } },
      { offset: 0.75, properties: { rotate: "5deg" } },
      { offset: 1, properties: { rotate: "0deg" } },
    ],
    properties: ["rotate"],
    defaultEasing: easingPreset("ease-in-out"),
    defaultDuration: 1000,
  },
  {
    verbs: ["wiggle"],
    keywords: /\b(wiggle|wobble|jiggle|squirm)\b/i,
    keyframes: () => [
      { offset: 0, properties: { rotate: "0deg" } },
      { offset: 0.25, properties: { rotate: "5deg" } },
      { offset: 0.5, properties: { rotate: "-5deg" } },
      { offset: 0.75, properties: { rotate: "3deg" } },
      { offset: 1, properties: { rotate: "0deg" } },
    ],
    properties: ["rotate"],
    defaultEasing: easingPreset("ease-in-out"),
    defaultDuration: 500,
  },
];

// --- Easing detection ---

interface EasingPattern {
  keywords: RegExp;
  easing: Easing;
}

const EASING_PATTERNS: EasingPattern[] = [
  { keywords: /\b(bouncy|bouncy|spring|springy|elastic|rubber)\b/i, easing: easingPreset("bounce") },
  { keywords: /\b(smooth|soft|gentle|calm|fluid|flowing)\b/i, easing: easingPreset("smooth") },
  { keywords: /\b(snappy|crisp|sharp|quick|precise|tight)\b/i, easing: easingPreset("snappy") },
  { keywords: /\b(elastic|stretchy|rubber)\b/i, easing: easingPreset("elastic") },
  { keywords: /\b(linear|constant|steady|even)\b/i, easing: easingPreset("linear") },
  { keywords: /\b(dramatic|powerful|strong|bold|intense)\b/i, easing: { type: "bezier", p1: [0.7, 0], p2: [0.3, 1] } },
  { keywords: /\b(ease.?in|accelerate|build up|ramp up)\b/i, easing: easingPreset("ease-in") },
  { keywords: /\b(ease.?out|decelerate|settle|coast)\b/i, easing: easingPreset("ease-out") },
  { keywords: /\b(ease.?in.?out|symmetric|balanced)\b/i, easing: easingPreset("ease-in-out") },
];

// --- Direction detection ---

const DIRECTION_PATTERNS: RegExp[] = [
  /\b(in|enter|appear|show|reveal)\b/i,
  /\b(out|exit|leave|disappear|hide|vanish)\b/i,
  /\b(up|upward|above|top)\b/i,
  /\b(down|downward|below|bottom|drop)\b/i,
  /\b(left|leftward)\b/i,
  /\b(right|rightward)\b/i,
  /\b(clockwise|cw)\b/i,
  /\b(counterclockwise|counter.?clockwise|ccw)\b/i,
];

const DIRECTION_NAMES = ["in", "out", "up", "down", "left", "right", "cw", "ccw"];

// --- Duration detection ---

function extractDuration(text: string): number | null {
  const msMatch = text.match(/(\d+)\s*ms\b/i);
  if (msMatch) return parseInt(msMatch[1], 10);

  const sMatch = text.match(/(\d+\.?\d*)\s*s\b/i);
  if (sMatch) return Math.round(parseFloat(sMatch[1]) * 1000);

  // Word-based durations
  const wordMap: Record<string, number> = {
    "instant": 200, "quick": 300, "fast": 400, "brief": 400,
    "short": 500, "normal": 800, "medium": 800, "default": 800,
    "long": 1200, "slow": 1500, "very slow": 2500, "extended": 2000,
  };
  for (const [word, ms] of Object.entries(wordMap)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) return ms;
  }

  return null;
}

// --- Loop detection ---

function extractLoop(text: string): number | "infinite" | null {
  if (/\b(infinite|forever|endless|continuous|always)\b/i.test(text)) return "infinite";
  const loopMatch = text.match(/\b(?:loop|repeat|times)\s*(\d+)\b/i) ?? text.match(/\b(\d+)\s*(?:times|loops|repeats)\b/i);
  if (loopMatch) return parseInt(loopMatch[1], 10);
  return null;
}

// --- Delay detection ---

function extractDelay(text: string): number | null {
  const delayMatch = text.match(/(?:delay|wait|after|pause)\s*(\d+)\s*(ms|s)?/i);
  if (delayMatch) {
    const val = parseInt(delayMatch[1], 10);
    return delayMatch[2]?.toLowerCase() === "s" ? val * 1000 : val;
  }
  return null;
}

// --- Main parser ---

export function parseNaturalMotion(description: string): ParsedMotionResult {
  const errors: string[] = [];

  if (!description.trim()) {
    return invalidResult(["empty description"], errors);
  }

  // Find matching verb
  let matched: VerbPattern | null = null;
  for (const pattern of VERB_PATTERNS) {
    if (pattern.keywords.test(description)) {
      matched = pattern;
      break;
    }
  }

  if (!matched) {
    errors.push(`no motion verb detected in "${description.slice(0, 50)}"`);
    return invalidResult(errors, errors);
  }

  // Detect direction
  let direction = matched.verbs[0] === "fade" || matched.verbs[0] === "scale" ? "in" : "up";
  for (let i = 0; i < DIRECTION_PATTERNS.length; i++) {
    if (DIRECTION_PATTERNS[i].test(description)) {
      direction = DIRECTION_NAMES[i];
      break;
    }
  }

  // Detect easing
  let easing = matched.defaultEasing;
  for (const ep of EASING_PATTERNS) {
    if (ep.keywords.test(description)) {
      easing = ep.easing;
      break;
    }
  }

  // Override easing for spring physics
  if (/\b(spring|physics|realistic|natural)\b/i.test(description)) {
    easing = { type: "spring", stiffness: 170, damping: 26, mass: 1 };
  }

  // Detect duration
  const durationMs = extractDuration(description) ?? matched.defaultDuration;

  // Detect loop
  const loop = extractLoop(description) ?? 1;

  // Detect delay
  const delayMs = extractDelay(description) ?? 0;

  // Generate keyframes
  const keyframes = matched.keyframes(direction);

  return {
    verb: matched.verbs[0],
    direction,
    easing,
    durationMs,
    loop,
    delayMs,
    keyframes,
    properties: matched.properties,
    isValid: true,
    errors: [],
    toPatch: () => ({
      easing,
      durationMs,
      delayMs,
      iterationCount: loop,
      keyframes,
    }),
  };
}

function invalidResult(errors: string[], _allErrors: string[]): ParsedMotionResult {
  return {
    verb: "unknown",
    direction: null,
    easing: easingPreset("ease-out"),
    durationMs: 800,
    loop: 1,
    delayMs: 0,
    keyframes: [],
    properties: [],
    isValid: false,
    errors,
    toPatch: () => ({}),
  };
}
