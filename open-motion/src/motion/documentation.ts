/**
 * Motion Documentation Generator — produces a comprehensive specification
 * document from a project's motion state. Unifies component inventory, Motion
 * DNA signatures, timing analysis, easing distribution, trigger philosophy,
 * accessibility and performance summaries, and storyboard beats into a single
 * shareable artifact.
 */

import type { MotionComponent, MotionSpec } from "@openmotion/shared";
import { buildDna } from "./similarity.js";
import { checkAccessibility } from "./accessibility.js";
import { checkPerformance } from "./performance.js";
import { summarizeBeats, getStoryboardStats, exportStoryboardMarkdown } from "./storyboard.js";

export interface DocOptions {
  format?: "markdown" | "json";
  includeAccessibility?: boolean;
  includePerformance?: boolean;
  includeStoryboard?: boolean;
}

export interface MotionDocumentation {
  projectName: string;
  description: string;
  generatedAt: string;
  format: string;
  content: string;
}

/** Classify an easing into a human-readable family label. */
function easingFamilyLabel(easing: MotionComponent["easing"]): string {
  if (!easing) return "Linear";
  if (easing.type === "preset") return easing.name;
  if (easing.type === "spring") return `Spring (stiffness ${easing.stiffness}, damping ${easing.damping})`;
  if (easing.type === "bezier") return `Bezier (${easing.p1.join(",")} → ${easing.p2.join(",")})`;
  return "Linear";
}

/** Format milliseconds as a human-readable duration string. */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(sec % 1 === 0 ? 0 : 1)}s`;
  const min = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${min}m ${rem}s`;
}

/** Compute the easing distribution across components. */
function easingDistribution(components: MotionComponent[]): Array<{ family: string; count: number; percentage: number }> {
  const families = new Map<string, number>();
  for (const comp of components) {
    const dna = buildDna(comp);
    const family = dna.split("|")[0] ?? "LINEAR";
    families.set(family, (families.get(family) ?? 0) + 1);
  }
  const total = components.length || 1;
  return Array.from(families.entries())
    .map(([family, count]) => ({ family, count, percentage: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

/** Compute trigger distribution. */
function triggerDistribution(components: MotionComponent[]): Array<{ trigger: string; count: number }> {
  const triggers = new Map<string, number>();
  for (const comp of components) {
    const t = comp.trigger ?? "onLoad";
    triggers.set(t, (triggers.get(t) ?? 0) + 1);
  }
  return Array.from(triggers.entries())
    .map(([trigger, count]) => ({ trigger, count }))
    .sort((a, b) => b.count - a.count);
}

/** Compute the total runtime considering delays and durations. */
function computeTotalRuntime(components: MotionComponent[]): number {
  let max = 0;
  for (const comp of components) {
    const end = comp.delayMs + comp.durationMs * (comp.iterationCount === "infinite" ? 1 : comp.iterationCount);
    if (end > max) max = end;
  }
  return max;
}

/** Generate a Markdown documentation string. */
function generateMarkdown(spec: MotionSpec, options: DocOptions): string {
  const { project, components } = spec;
  const lines: string[] = [];

  lines.push(`# ${project.name}`);
  lines.push("");
  if (project.description) {
    lines.push(`> ${project.description}`);
    lines.push("");
  }
  lines.push(`*Generated: ${new Date().toISOString()}*`);
  lines.push("");

  // Overview
  lines.push("## Overview");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Components | ${components.length} |`);
  lines.push(`| Scenes | ${project.scenes.length} |`);
  lines.push(`| Total runtime | ${formatDuration(computeTotalRuntime(components))} |`);
  lines.push(`| Status | ${project.status} |`);
  const looping = components.filter((c) => c.iterationCount === "infinite").length;
  lines.push(`| Infinite loops | ${looping} |`);
  lines.push("");

  // Component inventory
  lines.push("## Component Inventory");
  lines.push("");
  if (components.length === 0) {
    lines.push("*No components yet.*");
    lines.push("");
  } else {
    lines.push(`| # | Name | DNA | Duration | Delay | Easing | Trigger | Loop |`);
    lines.push(`|---|------|-----|----------|-------|--------|---------|------|`);
    components.forEach((comp, i) => {
      const dna = buildDna(comp);
      const loop = comp.iterationCount === "infinite" ? "∞" : String(comp.iterationCount);
      lines.push(`| ${i + 1} | ${comp.name} | \`${dna}\` | ${formatDuration(comp.durationMs)} | ${comp.delayMs}ms | ${easingFamilyLabel(comp.easing)} | ${comp.trigger ?? "onLoad"} | ${loop} |`);
    });
    lines.push("");
  }

  // Easing distribution
  lines.push("## Easing Distribution");
  lines.push("");
  const easing = easingDistribution(components);
  if (easing.length > 0) {
    for (const e of easing) {
      const bar = "█".repeat(Math.round(e.percentage / 10));
      lines.push(`- **${e.family}**: ${e.count} (${e.percentage}%) ${bar}`);
    }
  } else {
    lines.push("*No easing data.*");
  }
  lines.push("");

  // Trigger philosophy
  lines.push("## Trigger Philosophy");
  lines.push("");
  const triggers = triggerDistribution(components);
  if (triggers.length > 0) {
    for (const t of triggers) {
      lines.push(`- **${t.trigger}**: ${t.count} component(s)`);
    }
  } else {
    lines.push("*No trigger data.*");
  }
  lines.push("");

  // Accessibility summary
  if (options.includeAccessibility !== false && components.length > 0) {
    const report = checkAccessibility(components);
    lines.push("## Accessibility & Safety");
    lines.push("");
    lines.push(`**Score: ${report.score}/100** — ${report.summary}`);
    lines.push("");
    if (report.issues.length > 0) {
      const bySeverity = { critical: 0, warning: 0, info: 0 };
      for (const issue of report.issues) bySeverity[issue.severity]++;
      lines.push(`Critical: ${bySeverity.critical} · Warning: ${bySeverity.warning} · Info: ${bySeverity.info}`);
      lines.push("");
      for (const issue of report.issues.slice(0, 8)) {
        lines.push(`- **[${issue.severity.toUpperCase()}]** ${issue.category}: ${issue.message}`);
      }
      if (report.issues.length > 8) {
        lines.push(`- *...and ${report.issues.length - 8} more*`);
      }
    } else {
      lines.push("No accessibility issues detected.");
    }
    lines.push("");
  }

  // Performance summary
  if (options.includePerformance !== false && components.length > 0) {
    const report = checkPerformance(components);
    lines.push("## Performance Budget");
    lines.push("");
    lines.push(`**Estimated frame time: ${report.stats.estimatedFrameMs.toFixed(1)}ms** (target: ${report.stats.targetFrameMs}ms / 60fps) — ${report.summary}`);
    lines.push("");
    if (report.issues.length > 0) {
      for (const issue of report.issues.slice(0, 6)) {
        lines.push(`- **[${issue.severity.toUpperCase()}]** ${issue.message}`);
      }
      if (report.issues.length > 6) {
        lines.push(`- *...and ${report.issues.length - 6} more*`);
      }
    } else {
      lines.push("No performance issues detected.");
    }
    lines.push("");
  }

  // Storyboard
  if (options.includeStoryboard !== false) {
    const stats = getStoryboardStats(project.tokens);
    if (stats.totalBeats > 0) {
      lines.push("## Storyboard");
      lines.push("");
      lines.push(`${stats.totalBeats} beat(s), total runtime ${formatDuration(stats.totalDurationMs)}, transitions: ${stats.transitions.join(", ")}`);
      lines.push("");
      lines.push(exportStoryboardMarkdown(project.tokens));
      lines.push("");
    }
  }

  // Footer
  lines.push("---");
  lines.push("");
  lines.push("*Generated by OpenMotion — AI-Native Motion Design Platform*");

  return lines.join("\n");
}

/** Generate a JSON documentation object. */
function generateJson(spec: MotionSpec, options: DocOptions): string {
  const { project, components } = spec;
  const doc = {
    projectName: project.name,
    description: project.description,
    generatedAt: new Date().toISOString(),
    overview: {
      componentCount: components.length,
      sceneCount: project.scenes.length,
      totalRuntime: computeTotalRuntime(components),
      status: project.status,
      infiniteLoops: components.filter((c) => c.iterationCount === "infinite").length,
    },
    components: components.map((comp, i) => ({
      index: i + 1,
      name: comp.name,
      dna: buildDna(comp),
      durationMs: comp.durationMs,
      delayMs: comp.delayMs,
      easing: easingFamilyLabel(comp.easing),
      trigger: comp.trigger ?? "onLoad",
      iterationCount: comp.iterationCount,
      direction: comp.direction,
    })),
    easingDistribution: easingDistribution(components),
    triggerDistribution: triggerDistribution(components),
    accessibility: options.includeAccessibility !== false && components.length > 0
      ? checkAccessibility(components)
      : undefined,
    performance: options.includePerformance !== false && components.length > 0
      ? checkPerformance(components)
      : undefined,
    storyboard: options.includeStoryboard !== false
      ? {
          stats: getStoryboardStats(project.tokens),
          beats: summarizeBeats(project.tokens),
        }
      : undefined,
  };
  return JSON.stringify(doc, null, 2);
}

/** Generate motion documentation for a project. */
export function generateMotionDocumentation(spec: MotionSpec, options: DocOptions = {}): MotionDocumentation {
  const format = options.format ?? "markdown";
  const content = format === "json" ? generateJson(spec, options) : generateMarkdown(spec, options);
  return {
    projectName: spec.project.name,
    description: spec.project.description,
    generatedAt: new Date().toISOString(),
    format,
    content,
  };
}
