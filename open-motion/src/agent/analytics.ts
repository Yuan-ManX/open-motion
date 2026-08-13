/** Tool Execution Analytics — tracks tool invocation patterns, success rates, execution duration, and usage frequency. */

import { now } from "../utils/id.js";

export interface ToolStat {
  tool: string;
  invocations: number;
  successes: number;
  failures: number;
  /** Average execution time in milliseconds. */
  avgMs: number;
  /** Last execution timestamp (ISO). */
  lastUsed: string | null;
  /** Consecutive failure streak — resets on success. */
  consecutiveFailures: number;
  /** Total tokens consumed by this tool's downstream LLM calls (approx). */
  tokensIn: number;
  tokensOut: number;
}

export interface SessionMetrics {
  projectId: string;
  startedAt: string;
  totalToolCalls: number;
  totalSuccesses: number;
  totalFailures: number;
  uniqueToolsUsed: number;
  avgLatencyMs: number;
  /** Tools sorted by invocation count (descending). */
  topTools: Array<{ tool: string; count: number }>;
  /** Tools with failure rate above 30%. */
  unreliableTools: string[];
  /** Tools that have never failed (reliable workhorses). */
  reliableTools: string[];
  /** Estimated productivity: successful tool calls per minute. */
  throughputPerMin: number;
}

export interface AggregatedAnalytics {
  totalProjects: number;
  totalToolCalls: number;
  totalSuccesses: number;
  totalFailures: number;
  overallSuccessRate: number;
  globalUniqueTools: number;
  /** Global tool invocation ranking. */
  toolRanking: Array<{ tool: string; calls: number; successRate: number; avgMs: number }>;
  /** Tool taxonomy — category counts. */
  taxonomy: {
    creation: number;
    analysis: number;
    editing: number;
    export: number;
    intelligence: number;
    pipeline: number;
  };
  generatedAt: string;
}

const projectStats = new Map<string, Map<string, ToolStat>>();
const sessionStart = new Map<string, string>();

function ensureProject(projectId: string): Map<string, ToolStat> {
  if (!projectStats.has(projectId)) {
    projectStats.set(projectId, new Map());
    sessionStart.set(projectId, now());
  }
  return projectStats.get(projectId)!;
}

/** Record a tool execution result. Call after every tool call. */
export function recordToolExecution(
  projectId: string,
  tool: string,
  ok: boolean,
  durationMs: number,
  tokensIn = 0,
  tokensOut = 0,
): void {
  const stats = ensureProject(projectId);
  let stat = stats.get(tool);
  if (!stat) {
    stat = {
      tool,
      invocations: 0,
      successes: 0,
      failures: 0,
      avgMs: 0,
      lastUsed: null,
      consecutiveFailures: 0,
      tokensIn: 0,
      tokensOut: 0,
    };
    stats.set(tool, stat);
  }

  stat.invocations++;
  if (ok) {
    stat.successes++;
    stat.consecutiveFailures = 0;
  } else {
    stat.failures++;
    stat.consecutiveFailures++;
  }

  // Rolling average latency
  stat.avgMs = (stat.avgMs * (stat.invocations - 1) + durationMs) / stat.invocations;
  stat.lastUsed = now();
  stat.tokensIn += tokensIn;
  stat.tokensOut += tokensOut;
}

/** Get the stat for a single tool. */
export function getToolStat(projectId: string, tool: string): ToolStat | null {
  return projectStats.get(projectId)?.get(tool) ?? null;
}

/** Check if a tool has been failing repeatedly — used for recovery heuristics. */
export function isToolUnreliable(projectId: string, tool: string, threshold = 3): boolean {
  const stat = getToolStat(projectId, tool);
  if (!stat || stat.invocations < 2) return false;
  return stat.consecutiveFailures >= threshold;
}

/** Get all tool stats for a project, sorted by invocation count. */
export function listToolStats(projectId: string): ToolStat[] {
  const stats = projectStats.get(projectId);
  if (!stats) return [];
  return Array.from(stats.values()).sort((a, b) => b.invocations - a.invocations);
}

/** Compute aggregate session metrics for a project. */
export function getSessionMetrics(projectId: string): SessionMetrics {
  const stats = listToolStats(projectId);
  const start = sessionStart.get(projectId) ?? now();

  const totalCalls = stats.reduce((s, t) => s + t.invocations, 0);
  const totalSuccess = stats.reduce((s, t) => s + t.successes, 0);
  const totalFail = stats.reduce((s, t) => s + t.failures, 0);
  const totalLatency = stats.reduce((s, t) => s + t.avgMs * t.invocations, 0);

  const topTools = stats.slice(0, 5).map((t) => ({ tool: t.tool, count: t.invocations }));

  const unreliableTools = stats
    .filter((t) => t.invocations >= 2 && t.failures / t.invocations > 0.3)
    .map((t) => t.tool);

  const reliableTools = stats
    .filter((t) => t.invocations >= 2 && t.failures === 0)
    .map((t) => t.tool);

  // Throughput: successful calls per minute since session start
  const elapsedMs = Date.now() - new Date(start).getTime();
  const elapsedMin = elapsedMs > 0 ? elapsedMs / 60000 : 1;
  const throughput = totalSuccess / elapsedMin;

  return {
    projectId,
    startedAt: start,
    totalToolCalls: totalCalls,
    totalSuccesses: totalSuccess,
    totalFailures: totalFail,
    uniqueToolsUsed: stats.length,
    avgLatencyMs: totalCalls > 0 ? totalLatency / totalCalls : 0,
    topTools,
    unreliableTools,
    reliableTools,
    throughputPerMin: Math.round(throughput * 10) / 10,
  };
}

/** Reset analytics for a project (e.g., when clearing a session). */
export function resetAnalytics(projectId: string): void {
  projectStats.delete(projectId);
  sessionStart.delete(projectId);
}

// ---------------------------------------------------------------------------
// Global aggregation
// ---------------------------------------------------------------------------

/** Simple tool taxonomy — classifies a tool name into a rough category. */
function classifyToolCategory(tool: string): "creation" | "analysis" | "editing" | "export" | "intelligence" | "pipeline" {
  const t = tool.toLowerCase();
  if (/(export|lottie|html|react|video|code|recorder|download)/.test(t)) return "export";
  if (/(analyz|inspect|score|critique|audit|profil|verify|detect|genome|dna|compare|forecast|budget|calibr)/.test(t)) return "analysis";
  if (/(generat|creat|synth|blend|spawn|morph|instantiate|apply_template|bake_component|render_scene)/.test(t)) return "creation";
  if (/(collabor|evolve|persona|dream|knowledge|semantic|emotion|intent|narrative|myth|orchestr|coach|jury|negotiat|remix|dialect|curate|strateg|choreograph|synthesize|alchemy|architecture|botany|chemistry|astronomy|cinema|linguistics|physics|musicology|weather|geology|calligraphy|cartography|genealogy|ecology|thermodynamics|harmonics|resonance|synesthesia|topology|path|perception|cognition|cohesion|conflict|prophecy|consciousness|volition|telepathy|testing|styl|recipe)/.test(t)) return "intelligence";
  if (/(pipe|workflow|schedule|batch|queue|run_pipeline|compose)/.test(t)) return "pipeline";
  return "editing";
}

/**
 * Aggregate analytics across all known projects into a single report.
 * Useful for dashboards, capability manifests, and health checks.
 */
export function aggregateAllAnalytics(): AggregatedAnalytics {
  const totals = new Map<string, { calls: number; ok: number; avgMs: number; count: number }>();
  let totalCalls = 0;
  let totalOk = 0;
  let totalFail = 0;

  for (const stats of projectStats.values()) {
    for (const stat of stats.values()) {
      const prior = totals.get(stat.tool) ?? { calls: 0, ok: 0, avgMs: 0, count: 0 };
      prior.calls += stat.invocations;
      prior.ok += stat.successes;
      // Weighted average across projects
      prior.avgMs =
        (prior.avgMs * prior.count + stat.avgMs * stat.invocations) /
        (prior.count + stat.invocations || 1);
      prior.count += stat.invocations;
      totals.set(stat.tool, prior);
      totalCalls += stat.invocations;
      totalOk += stat.successes;
      totalFail += stat.failures;
    }
  }

  const toolRanking = Array.from(totals.entries())
    .map(([tool, s]) => ({
      tool,
      calls: s.calls,
      successRate: s.calls > 0 ? Math.round((s.ok / s.calls) * 1000) / 10 : 0,
      avgMs: Math.round(s.avgMs),
    }))
    .sort((a, b) => b.calls - a.calls);

  const taxonomy: AggregatedAnalytics["taxonomy"] = {
    creation: 0,
    analysis: 0,
    editing: 0,
    export: 0,
    intelligence: 0,
    pipeline: 0,
  };
  for (const { tool, calls } of toolRanking) {
    const cat = classifyToolCategory(tool);
    taxonomy[cat] += calls;
  }

  return {
    totalProjects: projectStats.size,
    totalToolCalls: totalCalls,
    totalSuccesses: totalOk,
    totalFailures: totalFail,
    overallSuccessRate: totalCalls > 0 ? Math.round((totalOk / totalCalls) * 1000) / 10 : 0,
    globalUniqueTools: totals.size,
    toolRanking: toolRanking.slice(0, 30),
    taxonomy,
    generatedAt: new Date().toISOString(),
  };
}

/** Format analytics as a compact human-readable summary for the system prompt. */
export function formatAnalyticsContext(projectId: string): string {
  const metrics = getSessionMetrics(projectId);
  if (metrics.totalToolCalls === 0) return "";

  const lines: string[] = [];
  lines.push(`[Session analytics: ${metrics.totalToolCalls} tool calls, ${metrics.totalSuccesses} ok, ${metrics.totalFailures} failed]`);
  if (metrics.topTools.length > 0) {
    lines.push(`Most used: ${metrics.topTools.map((t) => `${t.tool}(${t.count})`).join(", ")}`);
  }
  if (metrics.unreliableTools.length > 0) {
    lines.push(`Recently unreliable: ${metrics.unreliableTools.join(", ")} — consider alternative approaches`);
  }
  return lines.join(" ");
}
