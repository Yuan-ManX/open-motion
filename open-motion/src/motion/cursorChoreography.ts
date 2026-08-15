/**
 * Cursor Choreography Library — micro-interaction gesture responses.
 *
 * Desktop motion design has a blind spot: the cursor is a per-pixel input
 * device but most hover/tap handlers are binary boolean. These choreography
 * entries define per-event response profiles that the agent can attach to
 * any canvas component so its cursor response is non-binary, responsive to
 * direction, velocity, and dwell time.
 */

export type CursorEventKind = "idle" | "hover" | "hover-hold" | "enter" | "leave" | "down" | "up" | "click" | "drag-start" | "drag-end" | "long-press";

export interface CursorStep {
  /** Event that triggers this response */
  on: CursorEventKind;
  /** Min velocity in px/sec required (0 = any) */
  minVelocityPxPerSec?: number;
  /** Dwell time threshold in ms (for hover-hold, long-press) */
  dwellMs?: number;
  /** Cursor direction requirement: "any" or the dominant axis of movement */
  direction?: "any" | "horizontal" | "vertical" | "inward" | "outward";
  /** The motion effect applied to the component */
  effect: {
    durationMs: number;
    easing: string;
    properties: Record<string, [number | string, number | string]>; // [from, to]
    iterationCount?: number | "infinite";
  };
}

export interface CursorChoreography {
  id: string;
  name: string;
  category: "magnetic" | "tactile" | "lively" | "subtle" | "playful" | "professional";
  description: string;
  /** Per-event response steps, evaluated in order; first match wins */
  steps: CursorStep[];
  /** Good use cases (for catalog search + agent recommendation) */
  useCases: string[];
  tags: string[];
}

export const CURSOR_CHOREOGRAPHIES: CursorChoreography[] = [
  {
    id: "cursor-magnetic-pro",
    name: "Magnetic Pro",
    category: "magnetic",
    description: "Component drifts toward the cursor within a 48px attraction radius, snapping back cleanly on leave. Feels premium and responsive — widely used for hero CTAs.",
    steps: [
      {
        on: "hover",
        direction: "any",
        effect: { durationMs: 320, easing: "ease-out-back", properties: { translateX: ["0px", "var(--magnet-x, 6px)"], translateY: ["0px", "var(--magnet-y, 4px)"] }, iterationCount: 1 },
      },
      {
        on: "leave",
        effect: { durationMs: 420, easing: "ease-out-elastic", properties: { translateX: ["var(--magnet-x, 6px)", "0px"], translateY: ["var(--magnet-y, 4px)", "0px"] } },
      },
      {
        on: "down",
        effect: { durationMs: 90, easing: "ease-in-out", properties: { scale: ["1", "0.97"] } },
      },
      {
        on: "up",
        effect: { durationMs: 260, easing: "ease-out-back", properties: { scale: ["0.97", "1"] } },
      },
    ],
    useCases: ["Hero CTA buttons", "Subscription widgets", "Main navigation links"],
    tags: ["magnetic", "attraction", "hero", "cta", "premium"],
  },
  {
    id: "cursor-tactile-surface",
    name: "Tactile Surface",
    category: "tactile",
    description: "Pressure-sensitive response: fast press = sharp tap, slow press = deep squish. Simulates haptic feedback through visual motion only.",
    steps: [
      {
        on: "down",
        minVelocityPxPerSec: 500,
        effect: { durationMs: 70, easing: "ease-in", properties: { scale: ["1", "0.955"], brightness: ["1", "0.94"] } },
      },
      {
        on: "down",
        minVelocityPxPerSec: 0,
        effect: { durationMs: 180, easing: "ease-in-out", properties: { scale: ["1", "0.94"], brightness: ["1", "0.92"] } },
      },
      {
        on: "up",
        effect: { durationMs: 360, easing: "ease-out-elastic", properties: { scale: ["0.94", "1"], brightness: ["0.92", "1"] } },
      },
      {
        on: "hover",
        effect: { durationMs: 180, easing: "ease-out-quart", properties: { translateY: ["0px", "-1px"] } },
      },
    ],
    useCases: ["Piano / synth UI", "Physical toggle switches", "Dial controls"],
    tags: ["tactile", "haptic", "pressure", "surface", "tangible"],
  },
  {
    id: "cursor-lively-springy",
    name: "Lively Springy",
    category: "lively",
    description: "Every cursor leave triggers a small spring wobble. Playful and friendly without being noisy — fits consumer social apps.",
    steps: [
      {
        on: "enter",
        effect: { durationMs: 220, easing: "ease-out-quart", properties: { scale: ["1", "1.035"], brightness: ["1", "1.04"] } },
      },
      {
        on: "leave",
        effect: { durationMs: 620, easing: "spring", properties: { scale: ["1.035", "1"], rotate: ["1deg", "0deg"] }, iterationCount: 1 },
      },
      {
        on: "click",
        effect: { durationMs: 480, easing: "ease-out-back", properties: { scale: ["1", "1.15"] }, iterationCount: 1 },
      },
    ],
    useCases: ["Social feed cards", "Photo upload tiles", "Kids / education apps"],
    tags: ["playful", "bouncy", "spring", "social", "friendly"],
  },
  {
    id: "cursor-subtle-whisper",
    name: "Subtle Whisper",
    category: "subtle",
    description: "Near-imperceptible glow + 1px nudge. Respects users who want clean, quiet UI while still rewarding cursor proximity.",
    steps: [
      {
        on: "hover",
        effect: { durationMs: 260, easing: "ease-out", properties: { boxShadow: ["0 0 0 rgba(0,0,0,0)", "0 2px 8px rgba(0,0,0,0.08)"], translateY: ["0px", "-1px"], opacity: ["0.97", "1"] } },
      },
      {
        on: "leave",
        effect: { durationMs: 220, easing: "ease-out", properties: { boxShadow: ["0 2px 8px rgba(0,0,0,0.08)", "0 0 0 rgba(0,0,0,0)"], translateY: ["-1px", "0px"] } },
      },
      {
        on: "down",
        effect: { durationMs: 90, easing: "ease-in", properties: { translateY: ["-1px", "0px"] } },
      },
    ],
    useCases: ["Finance / dashboard grids", "Document list items", "Enterprise software"],
    tags: ["subtle", "quiet", "minimal", "enterprise", "clean"],
  },
  {
    id: "cursor-hover-hold-peek",
    name: "Hover-Hold Peek",
    category: "playful",
    description: "Holding the cursor over a component for 400ms triggers a 'peek' animation — ideal for revealing hidden metadata, previews, or Easter eggs.",
    steps: [
      {
        on: "hover-hold",
        dwellMs: 400,
        effect: { durationMs: 350, easing: "ease-out-back", properties: { translateY: ["0px", "-3px"], scale: ["1", "1.02"], filter: ["brightness(1)", "brightness(1.1)"] } },
      },
      {
        on: "leave",
        effect: { durationMs: 280, easing: "ease-out", properties: { translateY: ["-3px", "0px"], scale: ["1.02", "1"], filter: ["brightness(1.1)", "brightness(1)"] } },
      },
      {
        on: "click",
        effect: { durationMs: 180, easing: "ease-in-out", properties: { scale: ["1", "0.98"], filter: ["brightness(1)", "brightness(1.05)"] } },
      },
    ],
    useCases: ["Content cards with preview", "Product cards with zoom peek", "Folder / file listings"],
    tags: ["dwell", "peek", "hover-hold", "preview", "easter-egg"],
  },
  {
    id: "cursor-professional-link",
    name: "Professional Underline",
    category: "professional",
    description: "Editorial-grade link: underline grows from left (0→100% width) on hover, then shrinks from left again on leave. Used by The Verge / Medium.",
    steps: [
      {
        on: "enter",
        effect: { durationMs: 300, easing: "ease-in-out-cubic", properties: { underlineWidth: ["0%", "100%"], color: ["var(--fg)", "var(--accent)"] } },
      },
      {
        on: "leave",
        effect: { durationMs: 280, easing: "ease-in-out-cubic", properties: { underlineWidth: ["100%", "0%"], color: ["var(--accent)", "var(--fg)"] } },
      },
      {
        on: "down",
        effect: { durationMs: 80, easing: "ease-out", properties: { letterSpacing: ["normal", "0.1px"] } },
      },
    ],
    useCases: ["Long-form content links", "Editorial publications", "Legal site navigation"],
    tags: ["editorial", "underline", "link", "professional", "verge-style"],
  },
];

export function listCursorChoreographies(): CursorChoreography[] {
  return CURSOR_CHOREOGRAPHIES;
}

export function getCursorChoreography(id: string): CursorChoreography | undefined {
  return CURSOR_CHOREOGRAPHIES.find((c) => c.id === id);
}

export function searchCursorChoreographies(query: string, limit = 10): CursorChoreography[] {
  const q = query.toLowerCase();
  return CURSOR_CHOREOGRAPHIES.filter((c) => {
    const hay = `${c.name} ${c.description} ${c.category} ${c.tags.join(" ")}`.toLowerCase();
    return hay.includes(q);
  }).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Compatibility aliases used by catalog routes
// ---------------------------------------------------------------------------

export type CursorPattern = CursorChoreography["category"];

/** Alias matching the legacy catalog import. */
export function listCursorChoreography(pattern?: CursorPattern): CursorChoreography[] {
  if (!pattern) return listCursorChoreographies();
  return CURSOR_CHOREOGRAPHIES.filter((c) => c.category === pattern);
}

/** Match a cursor choreography via keyword query. */
export function matchCursorChoreography(query: string): CursorChoreography | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const results = searchCursorChoreographies(q);
  return results[0] ?? null;
}
