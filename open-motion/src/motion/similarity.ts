/**
 * Motion DNA Similarity Search — finds motions with similar DNA signatures
 * across all projects and the template library. The DNA signature encodes five
 * facets of a motion (easing family, duration class, loop behavior, animated
 * properties, direction); similarity is scored as a weighted segment comparison
 * with Jaccard overlap on the property set.
 */

import type { Easing, MotionComponent } from "@openmotion/shared";
import { listProjects, getProjectSpec } from "../db/repositories/projects.js";
import { TEMPLATES } from "./templates/index.js";

/** Segment weights for the five DNA facets. */
const WEIGHTS = {
  easing: 0.3,
  props: 0.25,
  duration: 0.2,
  loop: 0.15,
  direction: 0.1,
} as const;

/** The subset of a MotionComponent needed to compute a DNA signature. */
type DnaSource = Pick<MotionComponent, "name" | "easing" | "durationMs" | "iterationCount" | "direction" | "keyframes">;

export interface SimilarMotion {
  componentName: string;
  projectId: string;
  projectName: string;
  dna: string;
  score: number;
  matchedSegments: string[];
  source: "project" | "template";
}

/** Classify an easing into a short DNA token. */
function easingDnaToken(easing: Easing | undefined): string {
  if (!easing) return "LINEAR";
  if (easing.type === "preset") {
    const n = easing.name;
    if (/bounce|back|elastic|spring/.test(n)) return "BOUNCE";
    if (/smooth|ease-in-out|ease-out/.test(n)) return "SMOOTH";
    if (/snappy|ease-in/.test(n)) return "SNAPPY";
    return n.toUpperCase();
  }
  if (easing.type === "spring") return "SPRING";
  if (easing.type === "bezier") return "BEZIER";
  return "LINEAR";
}

function durationDnaToken(ms: number): string {
  if (ms < 500) return "FAST";
  if (ms <= 1500) return "NORMAL";
  return "SLOW";
}

function loopDnaToken(count: number | "infinite"): string {
  if (count === "infinite") return "LOOP∞";
  if (count === 1) return "ONCE";
  return `LOOP×${count}`;
}

function directionDnaToken(dir: string): string {
  if (dir === "alternate" || dir === "alternate-reverse") return "ALT";
  if (dir === "reverse") return "REV";
  return "FWD";
}

/** Extract the set of animated property names from a component's keyframes. */
function animatedPropSet(comp: DnaSource): Set<string> {
  const props = new Set<string>();
  for (const kf of comp.keyframes) {
    for (const key of Object.keys(kf.properties)) props.add(key.toLowerCase());
  }
  return props;
}

/** Build a Motion DNA signature for a component. */
export function buildDna(comp: DnaSource): string {
  const easing = easingDnaToken(comp.easing);
  const duration = durationDnaToken(comp.durationMs);
  const loop = loopDnaToken(comp.iterationCount);
  const props = Array.from(animatedPropSet(comp)).map((p) => p.toUpperCase()).sort().join("+") || "STATIC";
  const dir = directionDnaToken(comp.direction);
  return [easing, duration, loop, props, dir].join("|");
}

/** Parse a DNA signature into its five segments. */
function parseDna(dna: string): { easing: string; duration: string; loop: string; props: string; direction: string } {
  const [easing, duration, loop, props, direction] = dna.split("|");
  return { easing: easing ?? "", duration: duration ?? "", loop: loop ?? "", props: props ?? "", direction: direction ?? "" };
}

/** Jaccard similarity between two property sets (0..1). */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Score the similarity between two DNA signatures on a 0..100 scale.
 * Each segment contributes its weight times a match ratio.
 */
export function scoreDnaSimilarity(queryDna: string, candidateDna: string): { score: number; matchedSegments: string[] } {
  if (!queryDna || !candidateDna) return { score: 0, matchedSegments: [] };
  const q = parseDna(queryDna);
  const c = parseDna(candidateDna);

  let score = 0;
  const matched: string[] = [];

  // Easing — exact match.
  const easingScore = q.easing === c.easing ? 1 : 0;
  score += easingScore * WEIGHTS.easing;
  if (easingScore === 1) matched.push("easing");

  // Duration — exact match (FAST/NORMAL/SLOW buckets).
  const durationScore = q.duration === c.duration ? 1 : 0;
  score += durationScore * WEIGHTS.duration;
  if (durationScore === 1) matched.push("duration");

  // Loop — exact match.
  const loopScore = q.loop === c.loop ? 1 : 0;
  score += loopScore * WEIGHTS.loop;
  if (loopScore === 1) matched.push("loop");

  // Direction — exact match.
  const directionScore = q.direction === c.direction ? 1 : 0;
  score += directionScore * WEIGHTS.direction;
  if (directionScore === 1) matched.push("direction");

  // Properties — Jaccard overlap.
  const qProps = new Set(q.props.toLowerCase().split("+").filter(Boolean));
  const cProps = new Set(c.props.toLowerCase().split("+").filter(Boolean));
  const propsScore = jaccard(qProps, cProps);
  score += propsScore * WEIGHTS.props;
  if (propsScore > 0.5) matched.push("properties");

  return { score: Math.round(score * 100), matchedSegments: matched };
}

/** Collect all candidate components from the template library. */
function collectTemplateCandidates(): Array<{ comp: DnaSource; templateName: string }> {
  const out: Array<{ comp: DnaSource; templateName: string }> = [];
  for (const tpl of TEMPLATES) {
    const drafts = tpl.build();
    for (const d of drafts) {
      out.push({ comp: d, templateName: tpl.name });
    }
  }
  return out;
}

/** Collect all candidate components from every project in the database. */
function collectProjectCandidates(excludeProjectId: string): Array<{ comp: DnaSource; projectId: string; projectName: string }> {
  const out: Array<{ comp: DnaSource; projectId: string; projectName: string }> = [];
  for (const project of listProjects()) {
    if (project.id === excludeProjectId) continue;
    const spec = getProjectSpec(project.id);
    if (!spec) continue;
    for (const comp of spec.components) {
      out.push({ comp, projectId: project.id, projectName: project.name });
    }
  }
  return out;
}

/**
 * Find motions similar to the query component across all projects and templates.
 * Returns a ranked list capped at `limit` results, each above the threshold.
 */
export function findSimilarMotions(
  queryComp: DnaSource,
  options: { excludeProjectId?: string; limit?: number; threshold?: number } = {},
): { queryDna: string; matches: SimilarMotion[] } {
  const limit = options.limit ?? 10;
  const threshold = options.threshold ?? 40;
  const queryDna = buildDna(queryComp);
  const matches: SimilarMotion[] = [];

  // Search templates.
  for (const { comp, templateName } of collectTemplateCandidates()) {
    const candidateDna = buildDna(comp);
    const { score, matchedSegments } = scoreDnaSimilarity(queryDna, candidateDna);
    if (score >= threshold) {
      matches.push({
        componentName: comp.name || templateName,
        projectId: "",
        projectName: templateName,
        dna: candidateDna,
        score,
        matchedSegments,
        source: "template",
      });
    }
  }

  // Search other projects.
  for (const { comp, projectId, projectName } of collectProjectCandidates(options.excludeProjectId ?? "")) {
    const candidateDna = buildDna(comp);
    const { score, matchedSegments } = scoreDnaSimilarity(queryDna, candidateDna);
    if (score >= threshold) {
      matches.push({
        componentName: comp.name,
        projectId,
        projectName,
        dna: candidateDna,
        score,
        matchedSegments,
        source: "project",
      });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return { queryDna, matches: matches.slice(0, limit) };
}

/** Compute a compact similarity summary string. */
export function summarizeSimilarity(matches: SimilarMotion[]): string {
  if (matches.length === 0) return "no similar motions found above the threshold";
  const top = matches[0];
  const sources = matches.filter((m) => m.source === "template").length;
  const projects = matches.filter((m) => m.source === "project").length;
  return `${matches.length} similar motion(s) — top: "${top.componentName}" (${top.score}% match, ${top.matchedSegments.join("+")}). ${sources} from templates, ${projects} from projects.`;
}
