/**
 * Semantic Motion Memory — content-addressable index over every motion
 * component the agent has ever produced.
 *
 * Unlike the short-term chat memory, this store indexes components by
 * high-level motion semantics: their "motion signature" (a composite of
 * easing family, duration bucket, iteration mode, direction, and tag
 * vocabulary). Users can ask "find me something like this floating
 * entrance" and the retriever surfaces semantically-similar past work
 * regardless of naming.
 *
 * The store also tracks lineage relationships (which components were
 * derived from which) so the agent can present variations as a family
 * tree rather than a flat list.
 */

import type { MotionComponent, MotionSpec, Easing, Trigger } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MotionSignature {
  /** Normalized easing family: "elastic", "spring", "ease-in-out", "linear", etc. */
  easingFamily: string;
  /** Duration bucket: "micro" < 200ms, "short" < 500, "standard" < 1000, "long" < 2000, "epic" ≥ 2000 */
  durationBucket: "micro" | "short" | "standard" | "long" | "epic";
  /** "finite" vs "infinite" looping */
  loopMode: "finite" | "infinite";
  /** Playback direction (normal / alternate / reverse) */
  directionKind: string;
  /** Entrance, exit, emphasis, transition, load, scene, or "unknown" */
  intentTag: string;
  /** Top-level transform property family — "translate" / "scale" / "rotate" / "skew" / "opacity" / "composite" */
  propertyKind: string;
}

export interface MemoryEntry {
  entryId: string;
  projectId: string;
  componentId: string;
  componentName: string;
  signature: MotionSignature;
  keywords: Set<string>;
  templateId?: string;
  createdAt: number;
  /** How many times this component was reused as a reference */
  reuseCount: number;
}

/** Result from a semantic search. */
export interface MemoryHit {
  entry: MemoryEntry;
  /** 0-1 similarity score */
  similarity: number;
  /** Why this entry matched — human-readable dimension breakdown */
  matchReasons: string[];
}

// ---------------------------------------------------------------------------
// Signature derivation
// ---------------------------------------------------------------------------

const EASING_FAMILY_MAP: Record<string, string> = {
  "ease-in": "ease-in",
  "ease-out": "ease-out",
  "ease-in-out": "ease-in-out",
  linear: "linear",
  spring: "spring",
  elastic: "elastic",
  bounce: "bounce",
};

function durationBucket(ms: number | undefined): MotionSignature["durationBucket"] {
  if (ms == null) return "standard";
  if (ms < 200) return "micro";
  if (ms < 500) return "short";
  if (ms < 1000) return "standard";
  if (ms < 2000) return "long";
  return "epic";
}

function easingFamily(e: Easing | undefined): string {
  if (!e) return "ease-out";
  if (e.type === "preset") {
    const name = e.name.toLowerCase();
    if (name.includes("spring")) return "spring";
    if (name.includes("elastic")) return "elastic";
    if (name.includes("bounce")) return "bounce";
    if (name.startsWith("ease-in-out") || name.startsWith("ease-out-in")) return "ease-in-out";
    if (name.startsWith("ease-in")) return "ease-in";
    if (name.startsWith("ease-out")) return "ease-out";
    return EASING_FAMILY_MAP[name] ?? "ease-out";
  }
  if (e.type === "spring") return "spring";
  if (e.type === "bezier") {
    // Classify cubic bezier into the closest family
    const [x1, y1] = e.p1;
    const [, y2] = e.p2;
    if (y1 < 0.1 && y2 > 0.9) return "ease-in-out";
    if (x1 < 0.2 && y2 < 0.3) return "ease-out";
    if (x1 > 0.7 && y1 > 0.6) return "ease-in";
    return "ease-in-out";
  }
  return "ease-out";
}

function directionKind(d: string | undefined): string {
  if (!d) return "normal";
  if (d.startsWith("alternate")) return "alternate";
  if (d.includes("reverse")) return "reverse";
  return "normal";
}

function intentTagFromName(name: string, tplId?: string): string {
  const hay = `${name} ${tplId ?? ""}`.toLowerCase();
  if (hay.includes("entrance") || hay.includes("float-in") || hay.includes("slide-in") || hay.includes("fade-in")) return "entrance";
  if (hay.includes("exit") || hay.includes("outro") || hay.includes("slide-out") || hay.includes("fade-out")) return "exit";
  if (hay.includes("emphasis") || hay.includes("pulse") || hay.includes("shake") || hay.includes("bounce")) return "emphasis";
  if (hay.includes("transition") || hay.includes("wipe") || hay.includes("morph")) return "transition";
  if (hay.includes("load") || hay.includes("spinner") || hay.includes("progress")) return "load";
  if (hay.includes("scene") || hay.includes("reveal")) return "scene";
  return "unknown";
}

function propertyKindFromKeyframes(kfs: unknown[] | undefined): string {
  if (!kfs || kfs.length === 0) return "opacity";
  const found = new Set<string>();
  for (const kf of kfs as Array<Record<string, unknown>>) {
    const props = (kf.properties ?? {}) as Record<string, unknown>;
    for (const k of Object.keys(props)) {
      if (k.startsWith("translate")) found.add("translate");
      else if (k.startsWith("scale")) found.add("scale");
      else if (k.startsWith("rotate")) found.add("rotate");
      else if (k.startsWith("skew")) found.add("skew");
      else if (k === "opacity") found.add("opacity");
      else found.add("composite");
    }
  }
  if (found.size === 1) return Array.from(found)[0];
  if (found.size > 1) return "composite";
  return "opacity";
}

function keywordsFromComponent(c: MotionComponent): Set<string> {
  const words = new Set<string>();
  const push = (s: string) => s.toLowerCase().split(/[\s_-]+/).filter(Boolean).forEach((w) => words.add(w));
  if (c.name) push(c.name);
  if (c.templateId) push(c.templateId);
  if (c.trigger) push((c.trigger as Trigger) ?? "");
  const kfs = c.keyframes as unknown[] | undefined;
  if (kfs) for (const kf of kfs as Array<Record<string, unknown>>) {
    const props = Object.keys((kf.properties ?? {}) as Record<string, unknown>);
    props.forEach(push);
  }
  return words;
}

/**
 * Derive the motion signature for any component. This is the content
 * address used for semantic lookups.
 */
export function deriveSignature(c: MotionComponent): MotionSignature {
  return {
    easingFamily: easingFamily(c.easing),
    durationBucket: durationBucket(c.durationMs),
    loopMode: c.iterationCount === "infinite" || (typeof c.iterationCount === "number" && c.iterationCount > 2) ? "infinite" : "finite",
    directionKind: directionKind(c.direction),
    intentTag: intentTagFromName(c.name ?? c.id, c.templateId ?? undefined),
    propertyKind: propertyKindFromKeyframes(c.keyframes as unknown[] | undefined),
  };
}

// ---------------------------------------------------------------------------
// Singleton memory index
// ---------------------------------------------------------------------------

const INDEX: Map<string, MemoryEntry> = new Map();

function entryId(pid: string, cid: string): string {
  return `${pid}:${cid}`;
}

/** Index a single component (idempotent — repeated calls bump reuseCount). */
export function indexComponent(
  projectId: string,
  component: MotionComponent,
): MemoryEntry {
  const id = entryId(projectId, component.id);
  const existing = INDEX.get(id);
  if (existing) {
    existing.reuseCount += 1;
    existing.signature = deriveSignature(component);
    existing.keywords = keywordsFromComponent(component);
    existing.componentName = component.name ?? component.id;
    return existing;
  }
  const entry: MemoryEntry = {
    entryId: id,
    projectId,
    componentId: component.id,
    componentName: component.name ?? component.id,
    signature: deriveSignature(component),
    keywords: keywordsFromComponent(component),
    templateId: component.templateId ?? undefined,
    createdAt: Date.now(),
    reuseCount: 0,
  };
  INDEX.set(id, entry);
  return entry;
}

/** Index every component in a spec. Call at the end of each agent turn. */
export function indexProjectSpec(projectId: string, spec: MotionSpec): number {
  let count = 0;
  for (const c of spec.components) {
    indexComponent(projectId, c);
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Similarity + retrieval
// ---------------------------------------------------------------------------

const SIG_DIM_WEIGHTS: Record<keyof MotionSignature, number> = {
  intentTag: 0.28,
  propertyKind: 0.22,
  easingFamily: 0.18,
  durationBucket: 0.14,
  loopMode: 0.1,
  directionKind: 0.08,
};

const DURATION_ORDER: MotionSignature["durationBucket"][] = ["micro", "short", "standard", "long", "epic"];

export function signatureSimilarity(a: MotionSignature, b: MotionSignature): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  for (const [dim, weight] of Object.entries(SIG_DIM_WEIGHTS) as Array<[keyof MotionSignature, number]>) {
    const av = a[dim];
    const bv = b[dim];
    if (av === bv) {
      score += weight;
      reasons.push(`${dim}: same "${av}"`);
      continue;
    }
    // For durationBucket, partial credit if buckets are adjacent
    if (dim === "durationBucket") {
      const ia = DURATION_ORDER.indexOf(av as MotionSignature["durationBucket"]);
      const ib = DURATION_ORDER.indexOf(bv as MotionSignature["durationBucket"]);
      const dist = Math.abs(ia - ib);
      if (dist === 1) {
        score += weight * 0.5;
        reasons.push(`durationBucket: adjacent (${av} ↔ ${bv})`);
      }
    }
    // For easing, ease-in and ease-out are mildly related
    if (dim === "easingFamily") {
      const s1 = av as string;
      const s2 = bv as string;
      if ((s1.startsWith("ease-") && s2.startsWith("ease-")) || s1 === s2) {
        score += weight * 0.3;
        reasons.push(`easingFamily: related families`);
      }
    }
  }

  return { score, reasons };
}

function keywordOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let common = 0;
  for (const w of a) if (b.has(w)) common++;
  return common / Math.sqrt(a.size * b.size); // cosine-ish
}

/**
 * Retrieve semantically-similar components. The query can be a raw component
 * (its signature is derived on the fly) or a free-form prompt that we
 * synthesize into a pseudo-signature via keyword heuristics.
 */
export function retrieveSimilar(
  projectId: string,
  query: MotionComponent | MotionSignature | string,
  opts: { limit?: number; crossProject?: boolean; minSimilarity?: number } = {},
): MemoryHit[] {
  const limit = opts.limit ?? 10;
  const minSim = opts.minSimilarity ?? 0.3;

  let querySig: MotionSignature;
  let queryKeywords: Set<string> = new Set();

  if (typeof query === "string") {
    // Synthesize signature from natural language
    const lower = query.toLowerCase();
    querySig = {
      easingFamily: lower.includes("spring") ? "spring" : lower.includes("elastic") ? "elastic" : lower.includes("bounce") ? "bounce" : lower.includes("harsh") || lower.includes("linear") ? "linear" : "ease-out",
      durationBucket: lower.includes("fast") || lower.includes("quick") || lower.includes("snappy") ? "short" : lower.includes("slow") || lower.includes("lingering") ? "long" : "standard",
      loopMode: lower.includes("loop") || lower.includes("repeat") || lower.includes("infinite") ? "infinite" : "finite",
      directionKind: lower.includes("alternate") || lower.includes("back") ? "alternate" : "normal",
      intentTag: lower.includes("entrance") || lower.includes("enter") || lower.includes("in") ? "entrance" : lower.includes("exit") || lower.includes("outro") || lower.includes("leave") ? "exit" : lower.includes("emphasis") || lower.includes("pulse") || lower.includes("shake") ? "emphasis" : "unknown",
      propertyKind: lower.includes("scale") || lower.includes("zoom") ? "scale" : lower.includes("rotate") || lower.includes("spin") ? "rotate" : lower.includes("move") || lower.includes("slide") || lower.includes("float") ? "translate" : lower.includes("fade") ? "opacity" : "composite",
    };
    queryKeywords = new Set(lower.split(/[\s_-]+/).filter(Boolean));
  } else if ("durationMs" in query || "keyframes" in query) {
    querySig = deriveSignature(query as MotionComponent);
    queryKeywords = keywordsFromComponent(query as MotionComponent);
  } else {
    querySig = query as MotionSignature;
  }

  const hits: MemoryHit[] = [];
  for (const entry of INDEX.values()) {
    if (!opts.crossProject && entry.projectId !== projectId) continue;
    const sigResult = signatureSimilarity(querySig, entry.signature);
    const kwSim = keywordOverlap(queryKeywords, entry.keywords);
    const combined = Math.min(1, sigResult.score * 0.75 + kwSim * 0.25 + entry.reuseCount * 0.01);
    if (combined < minSim) continue;
    const reasons = sigResult.reasons;
    if (kwSim > 0.1) reasons.push(`keyword overlap: ${Math.round(kwSim * 100)}%`);
    if (entry.reuseCount > 0) reasons.push(`reused ${entry.reuseCount}×`);
    hits.push({ entry, similarity: combined, matchReasons: reasons });
  }
  return hits
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/** Get per-dimension statistics for the current project index. */
export function getMemoryStats(projectId: string): {
  totalComponents: number;
  perIntent: Record<string, number>;
  perProperty: Record<string, number>;
  topReused: Array<{ name: string; count: number; id: string }>;
} {
  const perIntent: Record<string, number> = {};
  const perProperty: Record<string, number> = {};
  let total = 0;
  const reused: Array<{ name: string; count: number; id: string }> = [];
  for (const e of INDEX.values()) {
    if (e.projectId !== projectId) continue;
    total++;
    perIntent[e.signature.intentTag] = (perIntent[e.signature.intentTag] ?? 0) + 1;
    perProperty[e.signature.propertyKind] = (perProperty[e.signature.propertyKind] ?? 0) + 1;
    if (e.reuseCount > 0) reused.push({ name: e.componentName, count: e.reuseCount, id: e.componentId });
  }
  reused.sort((a, b) => b.count - a.count);
  return { totalComponents: total, perIntent, perProperty, topReused: reused.slice(0, 5) };
}

/** Drop a single project's entries (for cleanup / reset). */
export function clearProjectMemory(projectId: string): number {
  let removed = 0;
  for (const [k, v] of INDEX) {
    if (v.projectId === projectId) {
      INDEX.delete(k);
      removed++;
    }
  }
  return removed;
}
