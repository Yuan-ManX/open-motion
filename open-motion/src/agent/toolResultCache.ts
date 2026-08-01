/**
 * Per-project tool result cache for read-only idempotent tools.
 *
 * The agent loop frequently re-issues query tools (get_motion_spec, list_templates,
 * list_recipes, etc.) within a single turn — especially after spec-changing
 * operations when the model wants to verify state. Each redundant call rebuilds
 * the same response from the same in-memory spec, wasting cycles and tokens.
 *
 * This cache stores the ToolResult of read-only calls keyed by (tool, args).
 * It is invalidated automatically the moment a spec-mutating tool runs in the
 * same project, and a TTL acts as a safety net so stale entries never persist.
 *
 * The cache is opt-in: only tools whose result is a pure function of the
 * current project state are cached. Tools with external side effects
 * (exports, generation, memory writes) bypass the cache entirely.
 */

import type { ToolResult } from "./tools/registry.js";

interface CacheEntry {
  result: ToolResult;
  /** Wall-clock time the entry was stored. */
  storedAt: number;
}

/** Project-id → cache map. */
const projectCaches = new Map<string, Map<string, CacheEntry>>();

/** Default TTL: 60 seconds. Long enough to dedupe within a turn, short enough
 *  to never survive across user-visible project edits from outside the agent. */
const DEFAULT_TTL_MS = 60_000;

/** Maximum entries per project before oldest eviction. Keeps memory bounded. */
const MAX_ENTRIES_PER_PROJECT = 64;

/**
 * Tool name prefixes that are safe to cache. These tools produce deterministic
 * outputs from the current project state and have no external side effects.
 */
const CACHEABLE_PREFIXES = [
  "get_",
  "list_",
  "describe_",
  "analyze_",
  "recommend_",
  "find_",
  "search_",
  "match_",
  "check_",
  "recognize_",
  "compare_",
  "suggest_",
  "preview_", // preview_adaptations, preview_url (URL string only — no side effect)
  "harmonize_colors", // returns analysis + suggestions, does not mutate
  "detect_",
  "profile_motion",
  "audit_motion",
  "curate_motion",
  "strategize_motion",
  "encode_motion",
  "infer_",
  "query_",
] as const;

/** Tools that match a cacheable prefix but should NOT be cached because they
 *  produce an external artifact or write to a store. */
const CACHE_BLOCKLIST = new Set<string>([
  "preview_url", // returns a generated URL — keep fresh each call
  "preview_fullscreen", // emits an editor command — must emit every time
  "preview_adaptations", // safe but large; allow through
  "suggest_creative", // non-deterministic (random surprise mode)
  "find_similar_motion", // includes a freshness signal; allow through
]);

/**
 * Determine whether a tool's result may be cached. Conservative: defaults to
 * false unless the tool name matches a known-safe prefix and is not blocklisted.
 */
export function isCacheable(tool: string): boolean {
  if (CACHE_BLOCKLIST.has(tool)) return false;
  // Exact-name entries (harmonize_colors, profile_motion, etc.).
  if ((CACHEABLE_PREFIXES as readonly string[]).includes(tool)) return true;
  for (const prefix of CACHEABLE_PREFIXES) {
    if (tool.startsWith(prefix)) return true;
  }
  return false;
}

/** Build a stable string key from a tool name and its arguments. */
function buildKey(tool: string, args: Record<string, unknown>): string {
  // projectId is contextual — exclude it so the cache key is stable across
  // call sites that may or may not inject it into args.
  const { projectId: _ignored, ...rest } = args as { projectId?: unknown };
  const payload = stableStringify(rest);
  return `${tool}::${payload}`;
}

/** Deterministic JSON serializer — sorts object keys so arg order does not matter. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

/** Look up a cached result. Returns undefined on miss or expiry. */
export function getCached(
  projectId: string,
  tool: string,
  args: Record<string, unknown>,
  ttlMs = DEFAULT_TTL_MS,
): ToolResult | undefined {
  if (!isCacheable(tool)) return undefined;
  const cache = projectCaches.get(projectId);
  if (!cache) return undefined;
  const key = buildKey(tool, args);
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.storedAt > ttlMs) {
    cache.delete(key);
    return undefined;
  }
  // Return a shallow copy so callers cannot mutate the cached entry.
  return { ...entry.result };
}

/** Store a result in the cache. No-op for non-cacheable tools. */
export function setCached(
  projectId: string,
  tool: string,
  args: Record<string, unknown>,
  result: ToolResult,
): void {
  if (!isCacheable(tool)) return;
  // Don't cache failures — the underlying state may have been transient.
  if (!result.ok) return;
  let cache = projectCaches.get(projectId);
  if (!cache) {
    cache = new Map();
    projectCaches.set(projectId, cache);
  }
  const key = buildKey(tool, args);
  // Bounded eviction: drop the oldest entry when the cap is hit.
  if (cache.size >= MAX_ENTRIES_PER_PROJECT && !cache.has(key)) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { result, storedAt: Date.now() });
}

/**
 * Invalidate the entire cache for a project. Called after every spec-mutating
 * tool so the next read sees fresh state.
 */
export function invalidateProject(projectId: string): void {
  projectCaches.delete(projectId);
}

/** Clear all cached entries across all projects (e.g., on server reset). */
export function clearAllCaches(): void {
  projectCaches.clear();
}

/** Introspection helper for diagnostics — returns cache size for a project. */
export function cacheSize(projectId: string): number {
  return projectCaches.get(projectId)?.size ?? 0;
}
