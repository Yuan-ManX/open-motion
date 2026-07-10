import type { Easing, Keyframe, MotionComponent } from "@openmotion/shared";
import { easingPreset } from "../shared/motion/easing.js";

/**
 * Motion Grammar — a text-based language for composing animations.
 *
 * Grammar:
 *   Program    := Statement (SeqOp Statement)*
 *   SeqOp      := "then" | "and" | "with"
 *   Statement  := Verb ("." Direction)? ("(" Args ")")?
 *   Verb       := fade | slide | bounce | rotate | scale | spin | pulse |
 *                 flip | shake | glow | float | blur | skew | wiggle |
 *                 heartbeat | typewriter | drift | swing | drop
 *   Direction  := in | out | up | down | left | right | cw | ccw
 *   Args       := Arg ("," Arg)*
 *   Arg        := Duration | EasingExpr | LoopExpr | DelayExpr | Number
 *   Duration   := digits ("ms" | "s")
 *   EasingExpr := easing(name) | easing(spring, stiffness, damping, mass)
 *   LoopExpr   := loop(n) | loop(infinite)
 *   DelayExpr  := delay(nms)
 *
 * Example: "fade.in(600ms) then slide.up(400ms) with easing(spring) and loop(2)"
 */

// --- AST node types ---

interface GrammarStatement {
  verb: string;
  direction: string | null;
  durationMs: number;
  easing: Easing;
  loop: number | "infinite";
  delayMs: number;
}

interface GrammarProgram {
  statements: GrammarStatement[];
  raw: string;
}

// --- Tokenizer ---

type TokenType = "word" | "number" | "unit" | "lparen" | "rparen" | "comma" | "dot" | "seqop" | "eof";

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const seqOps = new Set(["then", "and", "with"]);

  while (i < input.length) {
    const ch = input[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Parentheses and punctuation
    if (ch === "(") { tokens.push({ type: "lparen", value: ch, pos: i }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "rparen", value: ch, pos: i }); i++; continue; }
    if (ch === ",") { tokens.push({ type: "comma", value: ch, pos: i }); i++; continue; }
    if (ch === ".") { tokens.push({ type: "dot", value: ch, pos: i }); i++; continue; }

    // Numbers (with optional unit)
    if (/[0-9]/.test(ch)) {
      let num = "";
      while (i < input.length && /[0-9.]/.test(input[i])) {
        num += input[i];
        i++;
      }
      let unit = "";
      if (i < input.length && /[a-z]/.test(input[i])) {
        while (i < input.length && /[a-z]/.test(input[i])) {
          unit += input[i];
          i++;
        }
      }
      tokens.push({ type: unit ? "unit" : "number", value: unit ? `${num}${unit}` : num, pos: i - num.length });
      continue;
    }

    // Words (verbs, directions, seqops, easing names)
    if (/[a-zA-Z]/.test(ch)) {
      let word = "";
      while (i < input.length && /[a-zA-Z-]/.test(input[i])) {
        word += input[i];
        i++;
      }
      const lower = word.toLowerCase();
      tokens.push({ type: seqOps.has(lower) ? "seqop" : "word", value: lower, pos: i - word.length });
      continue;
    }

    // Skip unknown characters
    i++;
  }

  tokens.push({ type: "eof", value: "", pos: input.length });
  return tokens;
}

// --- Parser ---

class GrammarParser {
  private pos = 0;
  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType): Token {
    const t = this.consume();
    if (t.type !== type) {
      throw new Error(`grammar parse error: expected ${type} but got ${t.type} "${t.value}" at pos ${t.pos}`);
    }
    return t;
  }

  parseProgram(): GrammarProgram {
    const statements: GrammarStatement[] = [];
    const raw = this.tokens.map((t) => t.value).join(" ");

    statements.push(this.parseStatement());

    while (this.peek().type === "seqop") {
      const seqop = this.consume();
      // "with" and "and" followed by a modifier keyword (easing/loop/delay)
      // apply the modifier to the previous statement instead of starting a new one.
      const isModifier = (seqop.value === "with" || seqop.value === "and")
        && this.peek().type === "word"
        && (this.peek().value === "easing" || this.peek().value === "loop" || this.peek().value === "delay");

      if (isModifier && statements.length > 0) {
        const prev = statements[statements.length - 1];
        const arg = this.parseArg();
        if (arg.type === "easing") {
          prev.easing = arg.value;
        } else if (arg.type === "loop") {
          prev.loop = arg.value;
        } else if (arg.type === "delay") {
          prev.delayMs = arg.value;
        }
      } else {
        statements.push(this.parseStatement());
      }
    }

    return { statements, raw };
  }

  private parseStatement(): GrammarStatement {
    const verbToken = this.expect("word");
    const verb = verbToken.value;

    let direction: string | null = null;

    // Optional .direction
    if (this.peek().type === "dot") {
      this.consume();
      const dirToken = this.expect("word");
      direction = dirToken.value;
    }

    // Default values
    let durationMs = 800;
    let easing: Easing = easingPreset("ease-out");
    let loop: number | "infinite" = 1;
    let delayMs = 0;

    // Optional (args)
    if (this.peek().type === "lparen") {
      this.consume();
      const args = this.parseArgs();
      this.expect("rparen");

      for (const arg of args) {
        if (arg.type === "duration") {
          durationMs = arg.value;
        } else if (arg.type === "easing") {
          easing = arg.value;
        } else if (arg.type === "loop") {
          loop = arg.value;
        } else if (arg.type === "delay") {
          delayMs = arg.value;
        } else if (arg.type === "number") {
          // Bare number defaults to duration
          durationMs = arg.value;
        }
      }
    }

    return { verb, direction, durationMs, easing, loop, delayMs };
  }

  private parseArgs(): ParsedArg[] {
    const args: ParsedArg[] = [];
    if (this.peek().type === "rparen") return args;

    args.push(this.parseArg());
    while (this.peek().type === "comma") {
      this.consume();
      args.push(this.parseArg());
    }
    return args;
  }

  private parseArg(): ParsedArg {
    const t = this.peek();

    // Easing expression: easing(name) or easing(spring, s, d, m)
    if (t.type === "word" && t.value === "easing") {
      this.consume();
      this.expect("lparen");
      const nameToken = this.expect("word");
      const name = nameToken.value;

      if (name === "spring") {
        let stiffness = 170;
        let damping = 26;
        let mass = 1;
        if (this.peek().type === "comma") {
          this.consume();
          stiffness = this.parseNumberArg();
          this.expect("comma");
          damping = this.parseNumberArg();
          if (this.peek().type === "comma") {
            this.consume();
            mass = this.parseNumberArg();
          }
        }
        this.expect("rparen");
        return { type: "easing", value: { type: "spring", stiffness, damping, mass } };
      }

      this.expect("rparen");
      const presetName = mapEasingName(name);
      return { type: "easing", value: easingPreset(presetName) };
    }

    // Loop expression: loop(n) or loop(infinite)
    if (t.type === "word" && t.value === "loop") {
      this.consume();
      this.expect("lparen");
      if (this.peek().type === "word" && this.peek().value === "infinite") {
        this.consume();
        this.expect("rparen");
        return { type: "loop", value: "infinite" as const };
      }
      const n = Math.floor(this.parseNumberArg());
      this.expect("rparen");
      return { type: "loop", value: n };
    }

    // Delay expression: delay(nms)
    if (t.type === "word" && t.value === "delay") {
      this.consume();
      this.expect("lparen");
      const ms = this.parseDurationArg();
      this.expect("rparen");
      return { type: "delay", value: ms };
    }

    // Duration (number with unit) or bare number
    if (t.type === "unit") {
      this.consume();
      return { type: "duration", value: parseDuration(t.value) };
    }

    if (t.type === "number") {
      this.consume();
      return { type: "number", value: Number(t.value) };
    }

    throw new Error(`grammar parse error: unexpected token "${t.value}" at pos ${t.pos}`);
  }

  private parseNumberArg(): number {
    const t = this.consume();
    if (t.type === "number") return Number(t.value);
    if (t.type === "unit") return parseDuration(t.value);
    throw new Error(`expected number but got "${t.value}"`);
  }

  private parseDurationArg(): number {
    const t = this.consume();
    if (t.type === "unit") return parseDuration(t.value);
    if (t.type === "number") return Number(t.value);
    throw new Error(`expected duration but got "${t.value}"`);
  }
}

type ParsedArg =
  | { type: "duration"; value: number }
  | { type: "easing"; value: Easing }
  | { type: "loop"; value: number | "infinite" }
  | { type: "delay"; value: number }
  | { type: "number"; value: number };

// --- Helpers ---

function parseDuration(s: string): number {
  if (s.endsWith("ms")) return parseInt(s.slice(0, -2), 10);
  if (s.endsWith("s")) return parseFloat(s.slice(0, -1)) * 1000;
  return parseInt(s, 10);
}

function mapEasingName(name: string): "ease-in" | "ease-out" | "ease-in-out" | "linear" | "bounce" | "elastic" | "snappy" | "smooth" {
  const map: Record<string, "ease-in" | "ease-out" | "ease-in-out" | "linear" | "bounce" | "elastic" | "snappy" | "smooth"> = {
    "ease-in": "ease-in",
    "ease-out": "ease-out",
    "ease-in-out": "ease-in-out",
    "linear": "linear",
    "bounce": "bounce",
    "bouncy": "bounce",
    "elastic": "elastic",
    "snappy": "snappy",
    "crisp": "snappy",
    "smooth": "smooth",
    "soft": "smooth",
  };
  return map[name] ?? "ease-out";
}

// --- Verb to motion spec mapping ---

interface MotionVerbMap {
  easing: Easing;
  durationMs: number;
  keyframes: Keyframe[];
  properties: string[];
}

/** Map a verb + direction to motion keyframes and defaults. */
function verbToMotion(stmt: GrammarStatement): MotionVerbMap {
  const { verb, direction } = stmt;
  const dir = direction ?? "in";
  const kf = (offset: number, properties: Record<string, string | number>): Keyframe => ({ offset, properties, easing: undefined });
  const keyframes: Keyframe[] = [];

  switch (verb) {
    case "fade":
      if (dir === "in") {
        keyframes.push(kf(0, { opacity: 0 }), kf(1, { opacity: 1 }));
      } else {
        keyframes.push(kf(0, { opacity: 1 }), kf(1, { opacity: 0 }));
      }
      return { easing: stmt.easing, durationMs: stmt.durationMs, keyframes, properties: ["opacity"] };

    case "slide":
      if (dir === "up") {
        keyframes.push(kf(0, { translateY: "40px", opacity: 0 }), kf(1, { translateY: "0px", opacity: 1 }));
      } else if (dir === "down") {
        keyframes.push(kf(0, { translateY: "-40px", opacity: 0 }), kf(1, { translateY: "0px", opacity: 1 }));
      } else if (dir === "left") {
        keyframes.push(kf(0, { translateX: "40px", opacity: 0 }), kf(1, { translateX: "0px", opacity: 1 }));
      } else if (dir === "right") {
        keyframes.push(kf(0, { translateX: "-40px", opacity: 0 }), kf(1, { translateX: "0px", opacity: 1 }));
      } else {
        keyframes.push(kf(0, { translateX: "-40px", opacity: 0 }), kf(1, { translateX: "0px", opacity: 1 }));
      }
      return { easing: stmt.easing, durationMs: stmt.durationMs, keyframes, properties: ["translateX", "translateY", "opacity"] };

    case "bounce":
      keyframes.push(
        kf(0, { translateY: "-60px", opacity: 0 }),
        kf(0.5, { translateY: "10px", opacity: 1 }),
        kf(0.7, { translateY: "-5px" }),
        kf(0.85, { translateY: "2px" }),
        kf(1, { translateY: "0px" }),
      );
      return { easing: easingPreset("bounce"), durationMs: stmt.durationMs, keyframes, properties: ["translateY", "opacity"] };

    case "rotate":
      if (dir === "ccw") {
        keyframes.push(kf(0, { rotate: "-360deg" }), kf(1, { rotate: "0deg" }));
      } else {
        keyframes.push(kf(0, { rotate: "0deg" }), kf(1, { rotate: "360deg" }));
      }
      return { easing: stmt.easing, durationMs: stmt.durationMs, keyframes, properties: ["rotate"] };

    case "scale":
      if (dir === "out") {
        keyframes.push(kf(0, { scale: "1.2", opacity: 1 }), kf(1, { scale: "1", opacity: 0 }));
      } else {
        keyframes.push(kf(0, { scale: "0", opacity: 0 }), kf(1, { scale: "1", opacity: 1 }));
      }
      return { easing: stmt.easing, durationMs: stmt.durationMs, keyframes, properties: ["scale", "opacity"] };

    case "spin":
      keyframes.push(kf(0, { rotate: "0deg" }), kf(1, { rotate: dir === "ccw" ? "-720deg" : "720deg" }));
      return { easing: easingPreset("linear"), durationMs: stmt.durationMs, keyframes, properties: ["rotate"] };

    case "pulse":
      keyframes.push(
        kf(0, { scale: "1" }),
        kf(0.5, { scale: "1.1" }),
        kf(1, { scale: "1" }),
      );
      return { easing: stmt.easing, durationMs: stmt.durationMs, keyframes, properties: ["scale"] };

    case "flip":
      if (dir === "x" || dir === "up" || dir === "down") {
        keyframes.push(kf(0, { rotateX: "90deg", opacity: 0 }), kf(1, { rotateX: "0deg", opacity: 1 }));
      } else {
        keyframes.push(kf(0, { rotateY: "90deg", opacity: 0 }), kf(1, { rotateY: "0deg", opacity: 1 }));
      }
      return { easing: stmt.easing, durationMs: stmt.durationMs, keyframes, properties: ["rotateX", "rotateY", "opacity"] };

    case "shake":
      keyframes.push(
        kf(0, { translateX: "0px" }),
        kf(0.15, { translateX: "-10px" }),
        kf(0.3, { translateX: "10px" }),
        kf(0.45, { translateX: "-8px" }),
        kf(0.6, { translateX: "8px" }),
        kf(0.75, { translateX: "-4px" }),
        kf(1, { translateX: "0px" }),
      );
      return { easing: easingPreset("linear"), durationMs: stmt.durationMs, keyframes, properties: ["translateX"] };

    case "glow":
      keyframes.push(
        kf(0, { boxShadow: "0 0 0px rgba(255,255,255,0)" }),
        kf(0.5, { boxShadow: "0 0 20px rgba(255,255,255,0.8)" }),
        kf(1, { boxShadow: "0 0 0px rgba(255,255,255,0)" }),
      );
      return { easing: stmt.easing, durationMs: stmt.durationMs, keyframes, properties: ["boxShadow"] };

    case "float":
      keyframes.push(
        kf(0, { translateY: "0px" }),
        kf(0.5, { translateY: "-15px" }),
        kf(1, { translateY: "0px" }),
      );
      return { easing: easingPreset("ease-in-out"), durationMs: stmt.durationMs, keyframes, properties: ["translateY"] };

    case "blur":
      if (dir === "out") {
        keyframes.push(kf(0, { filter: "blur(10px)" }), kf(1, { filter: "blur(0px)" }));
      } else {
        keyframes.push(kf(0, { filter: "blur(0px)" }), kf(1, { filter: "blur(10px)" }));
      }
      return { easing: stmt.easing, durationMs: stmt.durationMs, keyframes, properties: ["filter"] };

    case "skew":
      keyframes.push(
        kf(0, { skewX: "0deg" }),
        kf(0.5, { skewX: "10deg" }),
        kf(1, { skewX: "0deg" }),
      );
      return { easing: stmt.easing, durationMs: stmt.durationMs, keyframes, properties: ["skewX"] };

    case "wiggle":
      keyframes.push(
        kf(0, { rotate: "0deg" }),
        kf(0.25, { rotate: "5deg" }),
        kf(0.5, { rotate: "-5deg" }),
        kf(0.75, { rotate: "3deg" }),
        kf(1, { rotate: "0deg" }),
      );
      return { easing: easingPreset("ease-in-out"), durationMs: stmt.durationMs, keyframes, properties: ["rotate"] };

    case "heartbeat":
      keyframes.push(
        kf(0, { scale: "1" }),
        kf(0.14, { scale: "1.15" }),
        kf(0.28, { scale: "1" }),
        kf(0.42, { scale: "1.15" }),
        kf(0.7, { scale: "1" }),
        kf(1, { scale: "1" }),
      );
      return { easing: easingPreset("ease-in-out"), durationMs: stmt.durationMs, keyframes, properties: ["scale"] };

    case "typewriter":
      keyframes.push(kf(0, { clipPath: "inset(0 100% 0 0)" }), kf(1, { clipPath: "inset(0 0% 0 0)" }));
      return { easing: easingPreset("linear"), durationMs: stmt.durationMs, keyframes, properties: ["clipPath"] };

    case "drift":
      keyframes.push(
        kf(0, { translateX: "0px", translateY: "0px" }),
        kf(0.33, { translateX: "15px", translateY: "-10px" }),
        kf(0.66, { translateX: "-10px", translateY: "15px" }),
        kf(1, { translateX: "0px", translateY: "0px" }),
      );
      return { easing: easingPreset("ease-in-out"), durationMs: stmt.durationMs, keyframes, properties: ["translateX", "translateY"] };

    case "swing":
      keyframes.push(
        kf(0, { rotate: "0deg" }),
        kf(0.25, { rotate: "15deg" }),
        kf(0.5, { rotate: "-10deg" }),
        kf(0.75, { rotate: "5deg" }),
        kf(1, { rotate: "0deg" }),
      );
      return { easing: easingPreset("ease-in-out"), durationMs: stmt.durationMs, keyframes, properties: ["rotate"] };

    case "drop":
      keyframes.push(
        kf(0, { translateY: "-100px", opacity: 0 }),
        kf(0.6, { translateY: "10px", opacity: 1 }),
        kf(0.75, { translateY: "-5px" }),
        kf(1, { translateY: "0px" }),
      );
      return { easing: easingPreset("bounce"), durationMs: stmt.durationMs, keyframes, properties: ["translateY", "opacity"] };

    default:
      // Unknown verb — default to a fade
      keyframes.push(kf(0, { opacity: 0 }), kf(1, { opacity: 1 }));
      return { easing: stmt.easing, durationMs: stmt.durationMs, keyframes, properties: ["opacity"] };
  }
}

// --- Public API ---

export interface CompiledMotion {
  statements: Array<{
    verb: string;
    direction: string | null;
    durationMs: number;
    easing: Easing;
    loop: number | "infinite";
    delayMs: number;
    keyframes: Keyframe[];
    properties: string[];
  }>;
  totalDurationMs: number;
  raw: string;
  isValid: boolean;
  errors: string[];
}

/** All supported motion verbs. */
export const MOTION_VERBS = [
  "fade", "slide", "bounce", "rotate", "scale", "spin", "pulse",
  "flip", "shake", "glow", "float", "blur", "skew", "wiggle",
  "heartbeat", "typewriter", "drift", "swing", "drop",
];

/** All supported directions. */
export const MOTION_DIRECTIONS = ["in", "out", "up", "down", "left", "right", "cw", "ccw", "x", "y"];

/**
 * Compile a motion grammar expression into structured motion data.
 * Returns a result object with parsed statements and any errors.
 */
export function compileGrammar(source: string): CompiledMotion {
  const errors: string[] = [];

  if (!source.trim()) {
    return { statements: [], totalDurationMs: 0, raw: source, isValid: false, errors: ["empty input"] };
  }

  try {
    const tokens = tokenize(source);
    const parser = new GrammarParser(tokens);
    const program = parser.parseProgram();

    const compiled = program.statements.map((stmt) => {
      const motion = verbToMotion(stmt);
      return {
        ...stmt,
        keyframes: motion.keyframes,
        properties: motion.properties,
        easing: motion.easing,
        durationMs: motion.durationMs,
      };
    });

    const totalDurationMs = compiled.reduce((sum, s) => sum + s.durationMs + s.delayMs, 0);

    return {
      statements: compiled,
      totalDurationMs,
      raw: source,
      isValid: true,
      errors: [],
    };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    return { statements: [], totalDurationMs: 0, raw: source, isValid: false, errors };
  }
}

/**
 * Apply compiled grammar to a motion component, returning a patch.
 * If multiple statements exist, they are sequenced with incremental delays.
 */
export function applyCompiledGrammar(
  compiled: CompiledMotion,
  component: MotionComponent,
): Partial<MotionComponent> {
  if (!compiled.isValid || compiled.statements.length === 0) {
    return {};
  }

  // Single statement — apply directly
  if (compiled.statements.length === 1) {
    const s = compiled.statements[0];
    return {
      easing: s.easing,
      durationMs: s.durationMs,
      delayMs: s.delayMs,
      iterationCount: s.loop,
      keyframes: s.keyframes,
    };
  }

  // Multiple statements — merge into one component with cumulative keyframes
  const first = compiled.statements[0];
  const mergedKeyframes: Keyframe[] = [];
  let cumulativeDelay = 0;

  for (const stmt of compiled.statements) {
    const offsetBase = cumulativeDelay / compiled.totalDurationMs;
    const spanRatio = stmt.durationMs / compiled.totalDurationMs;

    for (const kf of stmt.keyframes) {
      mergedKeyframes.push({
        offset: Math.min(1, offsetBase + kf.offset * spanRatio),
        properties: kf.properties,
        easing: kf.easing,
      });
    }
    cumulativeDelay += stmt.durationMs + stmt.delayMs;
  }

  return {
    easing: first.easing,
    durationMs: compiled.totalDurationMs,
    delayMs: 0,
    iterationCount: 1,
    keyframes: mergedKeyframes,
  };
}

/** Generate example grammar expressions for the help text. */
export const GRAMMAR_EXAMPLES = [
  "fade.in(600ms)",
  "slide.up(400ms) with easing(smooth)",
  "bounce.in(800ms, easing(bounce)) and loop(2)",
  "rotate.cw(1200ms) then fade.out(400ms) with delay(200ms)",
  "scale.in(500ms) with easing(spring, 200, 20, 1)",
  "shake(500ms) then glow(800ms) and loop(infinite)",
  "heartbeat(1000ms) with loop(infinite)",
  "float(3000ms) with easing(smooth) and loop(infinite)",
];
