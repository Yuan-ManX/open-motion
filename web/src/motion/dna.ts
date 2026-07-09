import type { MotionComponent, Easing } from "@openmotion/shared";

/** Classify an easing into a short DNA token. */
function easingDnaToken(e: Easing | undefined): string {
  if (!e) return "LINEAR";
  if (e.type === "preset") {
    const n = e.name;
    if (/bounce|back|elastic|spring/.test(n)) return "BOUNCE";
    if (/smooth|ease-in-out|ease-out/.test(n)) return "SMOOTH";
    if (/snappy|ease-in/.test(n)) return "SNAPPY";
    return n.toUpperCase();
  }
  if (e.type === "spring") return "SPRING";
  if (e.type === "bezier") return "BEZIER";
  return "LINEAR";
}

/** Compute a compact Motion DNA signature for a component. */
export function buildMotionDna(comp: MotionComponent): string {
  const easing = easingDnaToken(comp.easing);
  const dur = comp.durationMs < 500 ? "FAST" : comp.durationMs <= 1500 ? "NORMAL" : "SLOW";
  const loop = comp.iterationCount === "infinite" ? "LOOP∞" : comp.iterationCount === 1 ? "ONCE" : `LOOP×${comp.iterationCount}`;
  const dir = comp.direction === "alternate" || comp.direction === "alternate-reverse" ? "ALT" : comp.direction === "reverse" ? "REV" : "FWD";

  const props = new Set<string>();
  for (const kf of comp.keyframes) {
    for (const key of Object.keys(kf.properties)) props.add(key.toUpperCase());
  }
  const propStr = Array.from(props).join("+") || "STATIC";

  return [easing, dur, loop, propStr, dir].join("|");
}

/** Compute a compact diff between two DNA signatures, highlighting changed segments. */
export function diffDna(before: string, after: string): string | null {
  if (!before || !after || before === after) return null;
  const beforeParts = before.split("|");
  const afterParts = after.split("|");
  if (beforeParts.length !== 5 || afterParts.length !== 5) return null;

  const changed: string[] = [];
  for (let i = 0; i < 5; i++) {
    if (beforeParts[i] !== afterParts[i]) {
      changed.push(`${beforeParts[i]}→${afterParts[i]}`);
    }
  }
  return changed.length > 0 ? changed.join(" ") : null;
}
