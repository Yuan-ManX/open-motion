/**
 * Motion Curator — semantic grouping and curation engine.
 *
 * This is the fifteenth original AI-native module. Where the Genome measures
 * population diversity and the Forecast projects trends, the Curator organizes
 * components into thematic collections based on their functional role in the
 * design. It tags each component with semantic labels, detects redundancy,
 * and produces curated playlists that help designers navigate large projects.
 *
 * Five core analytics:
 * 1. Semantic tagging — classifies each component into a functional role
 *    (entrance, ambient, interactive, transition, emphasis, feedback,
 *    decorative) based on its motion DNA.
 * 2. Collection grouping — organizes components into named collections
 *    that share a purpose, making large projects navigable.
 * 3. Redundancy detection — finds components that serve the same role
 *    with nearly identical motion DNA, suggesting consolidation.
 * 4. Coverage map — shows which functional roles are well-represented
 *    and which are missing entirely.
 * 5. Curation recommendations — suggests what to add, remove, or merge
 *    to achieve a balanced motion vocabulary.
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionComponent, MotionSpec } from "@openmotion/shared";

/** Functional roles a component can play in a design. */
export type SemanticRole =
  | "entrance"
  | "ambient"
  | "interactive"
  | "transition"
  | "emphasis"
  | "feedback"
  | "decorative";

/** A semantic tag assigned to a component. */
export interface SemanticTag {
  componentId: string;
  componentName: string;
  role: SemanticRole;
  /** Confidence score for the role assignment (0..1). */
  confidence: number;
  /** Secondary role if the component serves multiple purposes. */
  secondaryRole?: SemanticRole;
  /** Keywords extracted from the component that informed the tag. */
  signals: string[];
  /** Human-readable description of why this tag was assigned. */
  reasoning: string;
}

/** A curated collection of components sharing a purpose. */
export interface CuratedCollection {
  role: SemanticRole;
  name: string;
  description: string;
  componentIds: string[];
  componentNames: string[];
  /** Whether this collection has enough variety. */
  isComplete: boolean;
  /** How many more components would idealize this collection. */
  idealCount: number;
}

/** A pair of components detected as redundant. */
export interface RedundancyPair {
  componentAId: string;
  componentAName: string;
  componentBId: string;
  componentBName: string;
  /** Similarity score (0..1). Higher = more redundant. */
  similarity: number;
  /** Which properties are nearly identical. */
  sharedTraits: string[];
  /** Suggested action. */
  suggestion: "merge" | "differentiate" | "remove-one";
  /** Human-readable reason. */
  reason: string;
}

/** Coverage map showing role representation. */
export interface CoverageMap {
  role: SemanticRole;
  count: number;
  /** Target count for a balanced project. */
  targetCount: number;
  status: "missing" | "underweight" | "balanced" | "overweight";
  description: string;
}

/** A curation recommendation. */
export interface CurationRecommendation {
  rank: number;
  type: "add" | "remove" | "merge" | "differentiate";
  role: SemanticRole;
  title: string;
  description: string;
  /** Component IDs affected (if any). */
  componentIds: string[];
  /** Expected benefit. */
  benefit: string;
}

/** The complete curation report. */
export interface CurationReport {
  componentCount: number;
  /** Semantic tags for every component. */
  tags: SemanticTag[];
  /** Curated collections organized by role. */
  collections: CuratedCollection[];
  /** Detected redundancy pairs. */
  redundancies: RedundancyPair[];
  /** Coverage map for all roles. */
  coverage: CoverageMap[];
  /** Ranked curation recommendations. */
  recommendations: CurationRecommendation[];
  /** Overall curation score (0..100). */
  curationScore: number;
  /** Human-readable summary. */
  summary: string;
}

/** Role metadata: description and ideal count range. */
const ROLE_META: Record<SemanticRole, { name: string; description: string; idealMin: number; idealMax: number }> = {
  entrance: {
    name: "Entrance",
    description: "Components that introduce elements into the scene — first impressions.",
    idealMin: 2,
    idealMax: 6,
  },
  ambient: {
    name: "Ambient",
    description: "Continuous background motion that gives the scene life — loops, breathing, idle.",
    idealMin: 1,
    idealMax: 4,
  },
  interactive: {
    name: "Interactive",
    description: "Motion triggered by user interaction — hover, click, tap responses.",
    idealMin: 1,
    idealMax: 5,
  },
  transition: {
    name: "Transition",
    description: "Motion that moves between states or scenes — navigational flow.",
    idealMin: 1,
    idealMax: 4,
  },
  emphasis: {
    name: "Emphasis",
    description: "Motion that draws attention to a specific element — spotlight moments.",
    idealMin: 1,
    idealMax: 3,
  },
  feedback: {
    name: "Feedback",
    description: "Motion that confirms a user action — success, error, loading states.",
    idealMin: 1,
    idealMax: 4,
  },
  decorative: {
    name: "Decorative",
    description: "Ornamental motion with no functional purpose — purely aesthetic.",
    idealMin: 0,
    idealMax: 3,
  },
};

/**
 * Classify a component's easing into an intensity family.
 */
function easingFamily(easing: unknown): string {
  const str = typeof easing === "string" ? easing : "";
  if (str.includes("spring") || str.includes("bounce")) return "energetic";
  if (str.includes("ease-in")) return "accelerating";
  if (str.includes("ease-out")) return "decelerating";
  if (str.includes("linear")) return "mechanical";
  if (str.includes("ease-in-out") || str.includes("cubic")) return "smooth";
  return "default";
}

/**
 * Determine whether a component is looping.
 */
function isLooping(component: MotionComponent): boolean {
  return component.iterationCount === "infinite" ||
    (typeof component.iterationCount === "number" && component.iterationCount > 1);
}

/**
 * Determine the trigger type for role classification.
 */
function triggerRole(trigger: string): SemanticRole[] {
  switch (trigger) {
    case "onLoad": return ["entrance", "ambient", "decorative"];
    case "onClick": return ["interactive", "feedback"];
    case "onHover": return ["interactive", "emphasis"];
    case "onScroll": return ["transition", "entrance"];
    case "afterDelay": return ["transition", "ambient"];
    default: return ["decorative"];
  }
}

/**
 * Assign a semantic role to a component based on its motion DNA.
 */
function classifyComponent(component: MotionComponent): SemanticTag {
  const signals: string[] = [];
  const roleScores: Record<SemanticRole, number> = {
    entrance: 0,
    ambient: 0,
    interactive: 0,
    transition: 0,
    emphasis: 0,
    feedback: 0,
    decorative: 0,
  };

  // Trigger-based scoring
  const triggerRoles = triggerRole(component.trigger);
  for (const r of triggerRoles) {
    roleScores[r] += 2;
  }
  signals.push(`trigger:${component.trigger}`);

  // Loop-based scoring
  if (isLooping(component)) {
    roleScores.ambient += 3;
    roleScores.decorative += 1;
    signals.push("looping");
  }

  // Duration-based scoring
  if (component.durationMs < 400) {
    roleScores.feedback += 2;
    roleScores.interactive += 1;
    signals.push("short-duration");
  } else if (component.durationMs > 1500) {
    roleScores.ambient += 2;
    roleScores.transition += 1;
    signals.push("long-duration");
  } else {
    roleScores.entrance += 1;
    roleScores.emphasis += 1;
    signals.push("medium-duration");
  }

  // Easing-based scoring
  const family = easingFamily(component.easing);
  if (family === "energetic") {
    roleScores.feedback += 2;
    roleScores.emphasis += 1;
    signals.push(`easing:${family}`);
  } else if (family === "smooth") {
    roleScores.entrance += 1;
    roleScores.transition += 1;
    signals.push(`easing:${family}`);
  } else if (family === "mechanical") {
    roleScores.transition += 1;
    signals.push(`easing:${family}`);
  }

  // Name-based scoring (heuristic)
  const nameLower = component.name.toLowerCase();
  if (/enter|appear|show|reveal|fade.?in|slide.?in|load/.test(nameLower)) {
    roleScores.entrance += 3;
    signals.push("name:entrance");
  }
  if (/hover|click|tap|press|cursor/.test(nameLower)) {
    roleScores.interactive += 3;
    signals.push("name:interactive");
  }
  if (/loop|idle|breath|float|ambient|background|bg/.test(nameLower)) {
    roleScores.ambient += 3;
    signals.push("name:ambient");
  }
  if (/transition|navigate|switch|route|page/.test(nameLower)) {
    roleScores.transition += 3;
    signals.push("name:transition");
  }
  if (/highlight|focus|attention|spotlight|emphas/.test(nameLower)) {
    roleScores.emphasis += 3;
    signals.push("name:emphasis");
  }
  if (/success|error|warning|confirm|feedback|toast|alert/.test(nameLower)) {
    roleScores.feedback += 3;
    signals.push("name:feedback");
  }
  if (/decor|ornament|particle|sparkle|shine|glow/.test(nameLower)) {
    roleScores.decorative += 3;
    signals.push("name:decorative");
  }

  // Find the top role
  let bestRole: SemanticRole = "decorative";
  let bestScore = -1;
  let secondRole: SemanticRole | undefined;
  let secondScore = -1;

  for (const role of Object.keys(roleScores) as SemanticRole[]) {
    if (roleScores[role] > bestScore) {
      secondRole = bestRole;
      secondScore = bestScore;
      bestRole = role;
      bestScore = roleScores[role];
    } else if (roleScores[role] > secondScore) {
      secondRole = role;
      secondScore = roleScores[role];
    }
  }

  const total = Object.values(roleScores).reduce((a, b) => a + b, 0);
  const confidence = total > 0 ? bestScore / total : 0.5;
  const reasoning = `Trigger "${component.trigger}" + ${family} easing + ${component.durationMs}ms duration + name pattern match.`;

  return {
    componentId: component.id,
    componentName: component.name,
    role: bestRole,
    confidence: Math.round(confidence * 100) / 100,
    secondaryRole: secondScore > 0 ? secondRole : undefined,
    signals,
    reasoning,
  };
}

/**
 * Compute the motion DNA signature for similarity comparison.
 */
function motionSignature(component: MotionComponent): string {
  const family = easingFamily(component.easing);
  const dur = component.durationMs < 400 ? "short" : component.durationMs > 1500 ? "long" : "medium";
  const loop = isLooping(component) ? "loop" : "single";
  const trigger = component.trigger;
  return `${family}|${dur}|${loop}|${trigger}`;
}

/**
 * Detect redundant component pairs.
 */
function detectRedundancies(
  components: MotionComponent[],
  tags: SemanticTag[],
): RedundancyPair[] {
  const pairs: RedundancyPair[] = [];

  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const a = components[i];
      const b = components[j];
      const tagA = tags[i];
      const tagB = tags[j];

      // Only compare components in the same role
      if (tagA.role !== tagB.role) continue;

      const sigA = motionSignature(a);
      const sigB = motionSignature(b);

      let similarity = 0;
      const sharedTraits: string[] = [];

      if (sigA === sigB) {
        similarity = 0.9;
        sharedTraits.push("easing", "duration", "loop", "trigger");
      } else {
        // Partial match
        const partsA = sigA.split("|");
        const partsB = sigB.split("|");
        let matches = 0;
        for (let k = 0; k < partsA.length; k++) {
          if (partsA[k] === partsB[k]) {
            matches++;
            sharedTraits.push(["easing", "duration", "loop", "trigger"][k]);
          }
        }
        similarity = matches / 4;
      }

      // Check duration proximity
      if (Math.abs(a.durationMs - b.durationMs) <= 100) {
        similarity = Math.max(similarity, 0.7);
        if (!sharedTraits.includes("duration")) sharedTraits.push("duration");
      }

      if (similarity >= 0.7) {
        let suggestion: RedundancyPair["suggestion"] = "differentiate";
        let reason = `Both serve the "${tagA.role}" role with ${Math.round(similarity * 100)}% motion similarity.`;

        if (similarity >= 0.9) {
          suggestion = "merge";
          reason = `Nearly identical motion in the "${tagA.role}" role — consider merging into a single reusable component.`;
        } else if (similarity >= 0.8) {
          suggestion = "remove-one";
          reason = `Highly similar motion in the "${tagA.role}" role — one may be redundant.`;
        }

        pairs.push({
          componentAId: a.id,
          componentAName: a.name,
          componentBId: b.id,
          componentBName: b.name,
          similarity: Math.round(similarity * 100) / 100,
          sharedTraits,
          suggestion,
          reason,
        });
      }
    }
  }

  // Sort by similarity descending
  pairs.sort((a, b) => b.similarity - a.similarity);
  return pairs;
}

/**
 * Build the coverage map for all roles.
 */
function buildCoverageMap(
  tags: SemanticTag[],
): CoverageMap[] {
  const counts: Record<SemanticRole, number> = {
    entrance: 0,
    ambient: 0,
    interactive: 0,
    transition: 0,
    emphasis: 0,
    feedback: 0,
    decorative: 0,
  };

  for (const tag of tags) {
    counts[tag.role]++;
  }

  return (Object.keys(ROLE_META) as SemanticRole[]).map((role) => {
    const meta = ROLE_META[role];
    const count = counts[role];
    let status: CoverageMap["status"];
    let description: string;

    if (count === 0) {
      status = "missing";
      description = `No ${meta.name.toLowerCase()} components — this role is entirely absent.`;
    } else if (count < meta.idealMin) {
      status = "underweight";
      description = `Only ${count} ${meta.name.toLowerCase()} component(s) — below the ideal minimum of ${meta.idealMin}.`;
    } else if (count > meta.idealMax) {
      status = "overweight";
      description = `${count} ${meta.name.toLowerCase()} components — above the ideal maximum of ${meta.idealMax}. Consider consolidating.`;
    } else {
      status = "balanced";
      description = `${count} ${meta.name.toLowerCase()} component(s) — within the ideal range.`;
    }

    return {
      role,
      count,
      targetCount: Math.round((meta.idealMin + meta.idealMax) / 2),
      status,
      description,
    };
  });
}

/**
 * Generate curation recommendations.
 */
function generateCurationRecs(
  coverage: CoverageMap[],
  redundancies: RedundancyPair[],
): CurationRecommendation[] {
  const recs: CurationRecommendation[] = [];
  let rank = 1;

  // Coverage-based recommendations
  for (const c of coverage) {
    if (c.status === "missing") {
      recs.push({
        rank: rank++,
        type: "add",
        role: c.role,
        title: `Add ${ROLE_META[c.role].name} components`,
        description: ROLE_META[c.role].description,
        componentIds: [],
        benefit: `Fills a critical gap — ${c.role} motion is entirely absent.`,
      });
    } else if (c.status === "underweight") {
      recs.push({
        rank: rank++,
        type: "add",
        role: c.role,
        title: `Add more ${ROLE_META[c.role].name} components`,
        description: `Current count (${c.count}) is below the ideal minimum. ${ROLE_META[c.role].description}`,
        componentIds: [],
        benefit: `Brings ${c.role} coverage to a balanced level.`,
      });
    } else if (c.status === "overweight") {
      recs.push({
        rank: rank++,
        type: "remove",
        role: c.role,
        title: `Reduce ${ROLE_META[c.role].name} components`,
        description: `Current count (${c.count}) exceeds the ideal maximum. Consider consolidating or removing redundant ${c.role} motion.`,
        componentIds: [],
        benefit: `Prevents ${c.role} overcrowding and reduces cognitive load.`,
      });
    }
  }

  // Redundancy-based recommendations
  for (const r of redundancies.slice(0, 5)) {
    const type: CurationRecommendation["type"] =
      r.suggestion === "merge" ? "merge" :
      r.suggestion === "remove-one" ? "remove" :
      "differentiate";

    recs.push({
      rank: rank++,
      type,
      role: "decorative", // Role will be inferred from context
      title: `${r.suggestion === "merge" ? "Merge" : r.suggestion === "remove-one" ? "Remove duplicate" : "Differentiate"}: ${r.componentAName} ↔ ${r.componentBName}`,
      description: r.reason,
      componentIds: [r.componentAId, r.componentBId],
      benefit: `Reduces redundancy (${Math.round(r.similarity * 100)}% similar).`,
    });
  }

  return recs;
}

/**
 * Compute the overall curation score.
 */
function computeCurationScore(
  coverage: CoverageMap[],
  redundancies: RedundancyPair[],
  componentCount: number,
): number {
  if (componentCount === 0) return 0;

  // Coverage score: how many roles are balanced
  const balancedCount = coverage.filter((c) => c.status === "balanced").length;
  const coverageScore = (balancedCount / coverage.length) * 60;

  // Redundancy penalty: each redundancy pair reduces the score
  const redundancyPenalty = Math.min(redundancies.length * 5, 30);

  // Missing role penalty
  const missingCount = coverage.filter((c) => c.status === "missing").length;
  const missingPenalty = missingCount * 5;

  return Math.max(0, Math.min(100, Math.round(coverageScore - redundancyPenalty - missingPenalty)));
}

/**
 * Curate a motion spec and return a semantic organization report.
 */
export function curateMotion(spec: MotionSpec): CurationReport {
  const components = spec.components;
  if (components.length === 0) {
    return {
      componentCount: 0,
      tags: [],
      collections: [],
      redundancies: [],
      coverage: buildCoverageMap([]),
      recommendations: [],
      curationScore: 0,
      summary: "Empty project — no components to curate.",
    };
  }

  // Classify each component
  const tags = components.map(classifyComponent);

  // Build collections by role
  const collections: CuratedCollection[] = (Object.keys(ROLE_META) as SemanticRole[]).map((role) => {
    const meta = ROLE_META[role];
    const roleTags = tags.filter((t) => t.role === role);
    return {
      role,
      name: meta.name,
      description: meta.description,
      componentIds: roleTags.map((t) => t.componentId),
      componentNames: roleTags.map((t) => t.componentName),
      isComplete: roleTags.length >= meta.idealMin && roleTags.length <= meta.idealMax,
      idealCount: Math.round((meta.idealMin + meta.idealMax) / 2),
    };
  }).filter((c) => c.componentIds.length > 0);

  // Detect redundancies
  const redundancies = detectRedundancies(components, tags);

  // Build coverage map
  const coverage = buildCoverageMap(tags);

  // Generate recommendations
  const recommendations = generateCurationRecs(coverage, redundancies);

  // Compute curation score
  const curationScore = computeCurationScore(coverage, redundancies, components.length);

  // Summary
  const balancedCount = coverage.filter((c) => c.status === "balanced").length;
  const missingCount = coverage.filter((c) => c.status === "missing").length;
  const summary = `Curation score ${curationScore}/100. ${collections.length} collection(s) across ${balancedCount}/${coverage.length} balanced roles. ${missingCount} missing role(s). ${redundancies.length} redundancy pair(s) detected. ${recommendations.length} curation recommendation(s).`;

  return {
    componentCount: components.length,
    tags,
    collections,
    redundancies,
    coverage,
    recommendations,
    curationScore,
    summary,
  };
}

/**
 * List all semantic roles with their metadata.
 */
export function listSemanticRoles(): Array<{ role: SemanticRole; name: string; description: string; idealMin: number; idealMax: number }> {
  return (Object.keys(ROLE_META) as SemanticRole[]).map((role) => ({
    role,
    ...ROLE_META[role],
  }));
}

/**
 * Format the curation report as a human-readable string.
 */
export function formatCurationReport(report: CurationReport): string {
  const lines: string[] = [];
  lines.push(`# Motion Curator Report`);
  lines.push("");
  lines.push(`**Curation Score: ${report.curationScore}/100**`);
  lines.push(report.summary);
  lines.push("");

  if (report.collections.length > 0) {
    lines.push(`## Collections`);
    for (const c of report.collections) {
      lines.push(`- **${c.name}** (${c.componentIds.length} components) — ${c.description}`);
      lines.push(`  Members: ${c.componentNames.join(", ")}`);
    }
    lines.push("");
  }

  if (report.redundancies.length > 0) {
    lines.push(`## Redundancies`);
    for (const r of report.redundancies) {
      lines.push(`- **${r.componentAName}** ↔ **${r.componentBName}** (${Math.round(r.similarity * 100)}% similar) — ${r.suggestion}`);
      lines.push(`  ${r.reason}`);
    }
    lines.push("");
  }

  lines.push(`## Coverage Map`);
  for (const c of report.coverage) {
    const icon = c.status === "balanced" ? "OK" : c.status === "missing" ? "MISSING" : c.status.toUpperCase();
    lines.push(`- ${ROLE_META[c.role].name}: ${c.count}/${c.targetCount} [${icon}]`);
  }
  lines.push("");

  if (report.recommendations.length > 0) {
    lines.push(`## Recommendations`);
    for (const r of report.recommendations) {
      lines.push(`${r.rank}. [${r.type.toUpperCase()}] ${r.title}`);
      lines.push(`   ${r.description}`);
      lines.push(`   Benefit: ${r.benefit}`);
    }
  }

  return lines.join("\n");
}
