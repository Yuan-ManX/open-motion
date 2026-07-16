/**
 * Tool Execution Analytics — tracks tool invocation patterns, success rates,
 * execution duration, and usage frequency across a project session.
 *
 * The analytics engine provides observability into how the Agent interacts
 * with tools, enabling:
 *   - Detection of flaky or slow tools
 *   - Identification of the most impactful tools
 *   - Recovery heuristics (avoid recently-failing tools)
 *   - Session-level productivity metrics
 *
 * All state is in-memory and per-project. No persistence required.
 */

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
