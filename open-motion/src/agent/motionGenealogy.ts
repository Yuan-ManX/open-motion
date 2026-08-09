/** Motion Genealogy Engine — traces evolutionary lineage of motion patterns. */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Genetic traits extracted from a component. */
export interface GeneticTraits {
  componentId: string;
  componentName: string | null;
  /** Easing gene. */
  easingGene: string;
  /** Duration gene (bucketed). */
  durationGene: string;
  /** Keyframe complexity gene. */
  complexityGene: "simple" | "moderate" | "complex" | "intricate";
  /** Iteration gene. */
  iterationGene: string;
  /** Trigger gene. */
  triggerGene: string;
  /** Motion type gene (based on keyframe properties). */
  motionTypeGene: string;
  /** Genetic signature (concatenation of all genes). */
  signature: string;
}

/** A parent-child relationship between components. */
export interface AncestryLink {
  parentId: string;
  parentName: string | null;
  childId: string;
  childName: string | null;
  /** Similarity 0..1. */
  similarity: number;
  /** Inherited traits. */
  inheritedTraits: string[];
  /** Mutated traits. */
  mutatedTraits: string[];
  /** Relationship type. */
  type: "clone" | "direct descendant" | "cousin" | "distant relative";
  description: string;
}

/** A node in the phylogenetic tree. */
export interface PhyloNode {
  componentId: string;
  componentName: string | null;
  /** Parent component ID, if any. */
  parentId: string | null;
  /** Children component IDs. */
  childrenIds: string[];
  /** Generation depth (0 = root). */
  generation: number;
  /** Genetic signature. */
  signature: string;
}

/** Phylogenetic tree result. */
export interface PhylogeneticTree {
  roots: PhyloNode[];
  allNodes: PhyloNode[];
  maxDepth: number;
  totalBranches: number;
  description: string;
}

/** Evolutionary pattern classification. */
export interface EvolutionaryPattern {
  pattern: "divergent" | "convergent" | "parallel" | "hybrid" | "singular";
  description: string;
  /** Pattern strength 0..1. */
  strength: number;
  /** Evidence supporting the classification. */
  evidence: string[];
}

/** Genetic diversity analysis. */
export interface GeneticDiversity {
  /** Overall diversity 0..1. */
  diversity: number;
  /** Number of distinct genetic signatures. */
  distinctSignatures: number;
  /** Trait variation per gene. */
  traitVariation: Array<{ gene: string; distinctValues: number; entropy: number }>;
  /** Description. */
  description: string;
}

/** Inheritance analysis result. */
export interface InheritanceAnalysis {
  /** Most conserved (inherited) traits. */
  conservedTraits: Array<{ trait: string; conservationRate: number }>;
  /** Most mutated traits. */
  mutatedTraits: Array<{ trait: string; mutationRate: number }>;
  /** Description. */
  description: string;
}

/** Full genealogy analysis result. */
export interface GenealogyAnalysis {
  traits: GeneticTraits[];
  ancestryLinks: AncestryLink[];
  tree: PhylogeneticTree;
  pattern: EvolutionaryPattern;
  diversity: GeneticDiversity;
  inheritance: InheritanceAnalysis;
  /** Most recent common ancestor signature. */
  commonAncestor: string | null;
  /** Mutation rate 0..1. */
  mutationRate: number;
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Trait Extraction
// ---------------------------------------------------------------------------

/** Extract genetic traits from a component. */
function extractTraits(comp: MotionComponent): GeneticTraits {
  // Easing gene
  let easingGene = "none";
  const easing = comp.easing;
  if (easing && typeof easing === "object") {
    if (easing.type === "preset") easingGene = `preset:${easing.name}`;
    else if (easing.type === "spring") easingGene = "spring";
    else if (easing.type === "bezier") easingGene = "bezier";
    else easingGene = String((easing as { type: string }).type);
  }

  // Duration gene (bucketed)
  const d = comp.durationMs;
  let durationGene: string;
  if (d < 500) durationGene = "very-short";
  else if (d < 1000) durationGene = "short";
  else if (d < 2000) durationGene = "medium";
  else if (d < 4000) durationGene = "long";
  else durationGene = "very-long";

  // Complexity gene (keyframe count)
  const kfCount = comp.keyframes?.length ?? 0;
  let complexityGene: GeneticTraits["complexityGene"];
  if (kfCount <= 1) complexityGene = "simple";
  else if (kfCount <= 3) complexityGene = "moderate";
  else if (kfCount <= 5) complexityGene = "complex";
  else complexityGene = "intricate";

  // Iteration gene
  const iter = comp.iterationCount;
  let iterationGene: string;
  if (iter === "infinite") iterationGene = "infinite";
  else if (iter === 1) iterationGene = "single";
  else if (iter <= 3) iterationGene = "few";
  else iterationGene = "many";

  // Trigger gene
  const triggerGene = comp.trigger ?? "auto";

  // Motion type gene (based on keyframe properties)
  const motionTypes = new Set<string>();
  if (comp.keyframes) {
    for (const kf of comp.keyframes) {
      const props = kf.properties as Record<string, string | number>;
      if ("opacity" in props) motionTypes.add("fade");
      if ("scale" in props) motionTypes.add("scale");
      if ("rotate" in props) motionTypes.add("rotate");
      if ("translateX" in props || "translateY" in props) motionTypes.add("translate");
      if ("blur" in props) motionTypes.add("blur");
      if ("filter" in props) motionTypes.add("filter");
    }
  }
  const motionTypeGene = motionTypes.size > 0
    ? Array.from(motionTypes).sort().join("+")
    : "static";

  const signature = `${easingGene}|${durationGene}|${complexityGene}|${iterationGene}|${triggerGene}|${motionTypeGene}`;

  return {
    componentId: comp.id,
    componentName: comp.name ?? null,
    easingGene,
    durationGene,
    complexityGene,
    iterationGene,
    triggerGene,
    motionTypeGene,
    signature,
  };
}

// ---------------------------------------------------------------------------
// Similarity Computation
// ---------------------------------------------------------------------------

/** Compute trait similarity between two components (0..1). */
function computeSimilarity(a: GeneticTraits, b: GeneticTraits): {
  similarity: number;
  sharedTraits: string[];
  differingTraits: string[];
} {
  const genes = ["easingGene", "durationGene", "complexityGene", "iterationGene", "triggerGene", "motionTypeGene"] as const;
  let shared = 0;
  let total = genes.length;
  const sharedTraits: string[] = [];
  const differingTraits: string[] = [];

  for (const gene of genes) {
    if (a[gene] === b[gene]) {
      shared++;
      sharedTraits.push(gene.replace("Gene", ""));
    } else {
      differingTraits.push(gene.replace("Gene", ""));
    }
  }

  return {
    similarity: shared / total,
    sharedTraits,
    differingTraits,
  };
}

// ---------------------------------------------------------------------------
// Ancestry Detection
// ---------------------------------------------------------------------------

/** Detect ancestry links between components. */
function detectAncestry(traits: GeneticTraits[]): AncestryLink[] {
  const links: AncestryLink[] = [];

  for (let i = 0; i < traits.length; i++) {
    for (let j = 0; j < traits.length; j++) {
      if (i === j) continue;

      const a = traits[i];
      const b = traits[j];
      const { similarity, sharedTraits, differingTraits } = computeSimilarity(a, b);

      // Only consider links with meaningful similarity
      if (similarity < 0.5) continue;

      // Earlier component (by delay) is the parent
      // For same delay, lower index is parent
      let parentId: string, parentName: string | null;
      let childId: string, childName: string | null;
      const compA = traits[i];
      const compB = traits[j];

      // Use signature as proxy for "ancestral" — simpler signatures are more ancestral
      const aAncestral = compA.complexityGene === "simple" || compA.complexityGene === "moderate";
      const bAncestral = compB.complexityGene === "simple" || compB.complexityGene === "moderate";

      if (aAncestral && !bAncestral) {
        parentId = a.componentId;
        parentName = a.componentName;
        childId = b.componentId;
        childName = b.componentName;
      } else if (!aAncestral && bAncestral) {
        parentId = b.componentId;
        parentName = b.componentName;
        childId = a.componentId;
        childName = a.componentName;
      } else {
        // Same complexity — skip to avoid circular
        continue;
      }

      let type: AncestryLink["type"];
      if (similarity >= 0.95) type = "clone";
      else if (similarity >= 0.8) type = "direct descendant";
      else if (similarity >= 0.65) type = "cousin";
      else type = "distant relative";

      links.push({
        parentId,
        parentName,
        childId,
        childName,
        similarity,
        inheritedTraits: sharedTraits,
        mutatedTraits: differingTraits,
        type,
        description: `${childName ?? childId} is a ${type} of ${parentName ?? parentId} — ${(similarity * 100).toFixed(0)}% similar, inherited: ${sharedTraits.join(", ") || "none"}, mutated: ${differingTraits.join(", ") || "none"}`,
      });
    }
  }

  // Sort by similarity descending and deduplicate
  links.sort((a, b) => b.similarity - a.similarity);

  // Remove duplicate child links (keep highest similarity)
  const seenChildren = new Set<string>();
  return links.filter((link) => {
    if (seenChildren.has(link.childId)) return false;
    seenChildren.add(link.childId);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Phylogenetic Tree Construction
// ---------------------------------------------------------------------------

/** Build a phylogenetic tree from ancestry links. */
function buildTree(traits: GeneticTraits[], links: AncestryLink[]): PhylogeneticTree {
  const nodeMap = new Map<string, PhyloNode>();

  // Initialize all nodes as roots
  for (const t of traits) {
    nodeMap.set(t.componentId, {
      componentId: t.componentId,
      componentName: t.componentName,
      parentId: null,
      childrenIds: [],
      generation: 0,
      signature: t.signature,
    });
  }

  // Apply ancestry links
  for (const link of links) {
    const childNode = nodeMap.get(link.childId);
    if (childNode && !childNode.parentId) {
      childNode.parentId = link.parentId;
      const parentNode = nodeMap.get(link.parentId);
      if (parentNode && !parentNode.childrenIds.includes(link.childId)) {
        parentNode.childrenIds.push(link.childId);
      }
    }
  }

  // Compute generation depths (BFS from roots)
  const roots = Array.from(nodeMap.values()).filter((n) => !n.parentId);
  const queue = roots.map((r) => ({ node: r, depth: 0 }));
  let maxDepth = 0;

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    node.generation = depth;
    maxDepth = Math.max(maxDepth, depth);
    for (const childId of node.childrenIds) {
      const child = nodeMap.get(childId);
      if (child) queue.push({ node: child, depth: depth + 1 });
    }
  }

  const allNodes = Array.from(nodeMap.values());
  const totalBranches = allNodes.reduce((sum, n) => sum + n.childrenIds.length, 0);

  const description = `Tree: ${roots.length} root(s), ${allNodes.length} node(s), ` +
    `max depth ${maxDepth}, ${totalBranches} branch(es)`;

  return { roots, allNodes, maxDepth, totalBranches, description };
}

// ---------------------------------------------------------------------------
// Evolutionary Pattern Classification
// ---------------------------------------------------------------------------

/** Classify the evolutionary pattern of the composition. */
function classifyPattern(traits: GeneticTraits[], tree: PhylogeneticTree): EvolutionaryPattern {
  if (traits.length <= 1) {
    return {
      pattern: "singular",
      description: "Single component — no evolutionary pattern",
      strength: 0,
      evidence: [],
    };
  }

  const evidence: string[] = [];

  // Count distinct signatures
  const signatures = new Set(traits.map((t) => t.signature));
  const distinctRatio = signatures.size / traits.length;

  // Check for divergence (one root, many children)
  const divergentRoots = tree.roots.filter((r) => r.childrenIds.length > 1);
  const isDivergent = divergentRoots.length > 0 && tree.maxDepth > 0;

  // Check for convergence (multiple parents pointing to similar children)
  const childSignatures = new Map<string, number>();
  for (const node of tree.allNodes) {
    if (node.parentId) {
      childSignatures.set(node.signature, (childSignatures.get(node.signature) ?? 0) + 1);
    }
  }
  const convergentChildren = Array.from(childSignatures.values()).filter((c) => c > 1).length;
  const isConvergent = convergentChildren > 0;

  // Check for parallel evolution (similar signatures but no ancestry link)
  const orphanNodes = tree.allNodes.filter((n) => !n.parentId);
  const orphanSignatures = new Map<string, number>();
  for (const node of orphanNodes) {
    orphanSignatures.set(node.signature, (orphanSignatures.get(node.signature) ?? 0) + 1);
  }
  const parallelPairs = Array.from(orphanSignatures.values()).filter((c) => c > 1).length;
  const isParallel = parallelPairs > 0;

  let pattern: EvolutionaryPattern["pattern"];
  let strength = 0;

  if (isDivergent && isConvergent) {
    pattern = "hybrid";
    strength = 0.8;
    evidence.push("both divergent and convergent patterns detected");
  } else if (isDivergent) {
    pattern = "divergent";
    strength = Math.min(1, divergentRoots.length / 2 + tree.maxDepth * 0.15);
    evidence.push(`${divergentRoots.length} root(s) with multiple children`);
    evidence.push(`max tree depth: ${tree.maxDepth}`);
  } else if (isConvergent) {
    pattern = "convergent";
    strength = Math.min(1, convergentChildren / 3);
    evidence.push(`${convergentChildren} convergent child signature(s)`);
  } else if (isParallel) {
    pattern = "parallel";
    strength = Math.min(1, parallelPairs / 2);
    evidence.push(`${parallelPairs} parallel signature pair(s) without ancestry link`);
  } else {
    pattern = "singular";
    strength = 0.3;
    evidence.push("no strong evolutionary pattern detected");
  }

  evidence.push(`${signatures.size} distinct genetic signature(s) out of ${traits.length} component(s)`);

  const description = `Pattern: ${pattern} (strength ${(strength * 100).toFixed(0)}%) — ${evidence.join("; ")}`;

  return { pattern, description, strength, evidence };
}

// ---------------------------------------------------------------------------
// Genetic Diversity Analysis
// ---------------------------------------------------------------------------

/** Analyze genetic diversity of the composition. */
function analyzeDiversity(traits: GeneticTraits[]): GeneticDiversity {
  if (traits.length === 0) {
    return {
      diversity: 0,
      distinctSignatures: 0,
      traitVariation: [],
      description: "No components — diversity is undefined.",
    };
  }

  const genes = ["easingGene", "durationGene", "complexityGene", "iterationGene", "triggerGene", "motionTypeGene"] as const;
  const traitVariation: GeneticDiversity["traitVariation"] = [];

  for (const gene of genes) {
    const values = traits.map((t) => t[gene]);
    const distinct = new Set(values);
    const counts = new Map<string, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

    // Shannon entropy
    let entropy = 0;
    for (const count of counts.values()) {
      const p = count / values.length;
      if (p > 0) entropy -= p * Math.log2(p);
    }
    const maxEntropy = Math.log2(distinct.size || 1);
    const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

    traitVariation.push({
      gene: gene.replace("Gene", ""),
      distinctValues: distinct.size,
      entropy: normalizedEntropy,
    });
  }

  const signatures = new Set(traits.map((t) => t.signature));
  const distinctSignatures = signatures.size;

  const avgEntropy = traitVariation.reduce((sum, tv) => sum + tv.entropy, 0) / traitVariation.length;
  const signatureDiversity = distinctSignatures / traits.length;
  const diversity = (avgEntropy * 0.5 + signatureDiversity * 0.5);

  const description = `Diversity: ${(diversity * 100).toFixed(0)}% — ${distinctSignatures} distinct signature(s), ` +
    `avg trait entropy ${(avgEntropy * 100).toFixed(0)}%`;

  return { diversity, distinctSignatures, traitVariation, description };
}

// ---------------------------------------------------------------------------
// Inheritance Analysis
// ---------------------------------------------------------------------------

/** Analyze inheritance patterns from ancestry links. */
function analyzeInheritance(links: AncestryLink[], traits: GeneticTraits[]): InheritanceAnalysis {
  if (links.length === 0) {
    return {
      conservedTraits: [],
      mutatedTraits: [],
      description: "No ancestry links — inheritance cannot be analyzed.",
    };
  }

  const traitCounts = new Map<string, { conserved: number; mutated: number }>();
  const geneNames = ["easing", "duration", "complexity", "iteration", "trigger", "motionType"];

  for (const gene of geneNames) {
    traitCounts.set(gene, { conserved: 0, mutated: 0 });
  }

  for (const link of links) {
    for (const trait of link.inheritedTraits) {
      const entry = traitCounts.get(trait);
      if (entry) entry.conserved++;
    }
    for (const trait of link.mutatedTraits) {
      const entry = traitCounts.get(trait);
      if (entry) entry.mutated++;
    }
  }

  const totalLinks = links.length;
  const conservedTraits = Array.from(traitCounts.entries())
    .map(([trait, counts]) => ({
      trait,
      conservationRate: totalLinks > 0 ? counts.conserved / totalLinks : 0,
    }))
    .sort((a, b) => b.conservationRate - a.conservationRate);

  const mutatedTraits = Array.from(traitCounts.entries())
    .map(([trait, counts]) => ({
      trait,
      mutationRate: totalLinks > 0 ? counts.mutated / totalLinks : 0,
    }))
    .sort((a, b) => b.mutationRate - a.mutationRate);

  const topConserved = conservedTraits[0];
  const topMutated = mutatedTraits[0];

  const description = `Inheritance: most conserved="${topConserved?.trait ?? "none"}" (${((topConserved?.conservationRate ?? 0) * 100).toFixed(0)}%), ` +
    `most mutated="${topMutated?.trait ?? "none"}" (${((topMutated?.mutationRate ?? 0) * 100).toFixed(0)}%)`;

  return { conservedTraits, mutatedTraits, description };
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Analyze the evolutionary genealogy of a motion composition.
 *
 * Extracts genetic traits, detects ancestry relationships, builds a
 * phylogenetic tree, classifies the evolutionary pattern, and analyzes
 * genetic diversity and inheritance.
 */
export function analyzeGenealogy(spec: MotionSpec): GenealogyAnalysis {
  if (spec.components.length === 0) {
    return {
      traits: [],
      ancestryLinks: [],
      tree: { roots: [], allNodes: [], maxDepth: 0, totalBranches: 0, description: "Empty tree" },
      pattern: { pattern: "singular", description: "No components", strength: 0, evidence: [] },
      diversity: { diversity: 0, distinctSignatures: 0, traitVariation: [], description: "No components" },
      inheritance: { conservedTraits: [], mutatedTraits: [], description: "No components" },
      commonAncestor: null,
      mutationRate: 0,
      summary: "No components — the genealogy is empty.",
    };
  }

  const traits = spec.components.map((c) => extractTraits(c));
  const ancestryLinks = detectAncestry(traits);
  const tree = buildTree(traits, ancestryLinks);
  const pattern = classifyPattern(traits, tree);
  const diversity = analyzeDiversity(traits);
  const inheritance = analyzeInheritance(ancestryLinks, traits);

  // Find most recent common ancestor signature
  const signatureCounts = new Map<string, number>();
  for (const t of traits) {
    signatureCounts.set(t.signature, (signatureCounts.get(t.signature) ?? 0) + 1);
  }
  const commonAncestor = Array.from(signatureCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Mutation rate: average fraction of mutated traits across all links
  const mutationRate = ancestryLinks.length > 0
    ? ancestryLinks.reduce((sum, link) => sum + link.mutatedTraits.length / 6, 0) / ancestryLinks.length
    : 0;

  const summary = `Genealogy: ${traits.length} specimen(s), ${diversity.distinctSignatures} signature(s), ` +
    `${ancestryLinks.length} ancestry link(s), ${pattern.pattern} pattern, ` +
    `depth ${tree.maxDepth}, diversity ${(diversity.diversity * 100).toFixed(0)}%, ` +
    `mutation rate ${(mutationRate * 100).toFixed(0)}%`;

  return {
    traits,
    ancestryLinks,
    tree,
    pattern,
    diversity,
    inheritance,
    commonAncestor,
    mutationRate,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format a genealogy analysis as a human-readable report. */
export function formatGenealogyReport(analysis: GenealogyAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Genealogy Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  // Evolutionary Pattern
  lines.push("## Evolutionary Pattern");
  lines.push(`- Pattern: ${analysis.pattern.pattern} (strength ${(analysis.pattern.strength * 100).toFixed(0)}%)`);
  for (const ev of analysis.pattern.evidence) {
    lines.push(`  - ${ev}`);
  }
  lines.push("");

  // Phylogenetic Tree
  lines.push("## Phylogenetic Tree");
  lines.push(`- ${analysis.tree.description}`);
  if (analysis.tree.roots.length > 0) {
    lines.push("- Roots:");
    for (const root of analysis.tree.roots) {
      lines.push(`  - ${root.componentName ?? root.componentId} (gen ${root.generation}, ${root.childrenIds.length} child(ren))`);
    }
  }
  lines.push("");

  // Ancestry Links
  lines.push("## Ancestry Links");
  if (analysis.ancestryLinks.length === 0) {
    lines.push("- No ancestry links detected");
  } else {
    for (const link of analysis.ancestryLinks.slice(0, 8)) {
      lines.push(`- [${link.type}] ${link.childName ?? link.childId} ← ${link.parentName ?? link.parentId} (${(link.similarity * 100).toFixed(0)}% similar)`);
    }
  }
  lines.push("");

  // Genetic Diversity
  lines.push("## Genetic Diversity");
  lines.push(`- Overall diversity: ${(analysis.diversity.diversity * 100).toFixed(0)}%`);
  lines.push(`- Distinct signatures: ${analysis.diversity.distinctSignatures}`);
  lines.push("- Trait variation:");
  for (const tv of analysis.diversity.traitVariation) {
    lines.push(`  - ${tv.gene}: ${tv.distinctValues} value(s), entropy ${(tv.entropy * 100).toFixed(0)}%`);
  }
  lines.push("");

  // Inheritance
  lines.push("## Inheritance Analysis");
  lines.push(`- Most conserved: ${analysis.inheritance.conservedTraits[0]?.trait ?? "none"} (${((analysis.inheritance.conservedTraits[0]?.conservationRate ?? 0) * 100).toFixed(0)}%)`);
  lines.push(`- Most mutated: ${analysis.inheritance.mutatedTraits[0]?.trait ?? "none"} (${((analysis.inheritance.mutatedTraits[0]?.mutationRate ?? 0) * 100).toFixed(0)}%)`);
  lines.push("");

  // Common Ancestor
  lines.push("## Common Ancestor");
  lines.push(`- Signature: ${analysis.commonAncestor ?? "none"}`);
  lines.push(`- Mutation rate: ${(analysis.mutationRate * 100).toFixed(0)}%`);

  return lines.join("\n");
}
