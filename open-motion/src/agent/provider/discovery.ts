import { config, getProviderConfigs, type ProviderConfig } from "../../config.js";
import { logger } from "../../utils/logger.js";
import { MODEL_REGISTRY, type ModelEntry, type ModelCapabilities, type ExtendedProvider } from "./registry.js";

/** A dynamically discovered model from a local or remote API. */
export interface DiscoveredModel {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  capabilities: ModelCapabilities;
  description: string;
  /** Source of discovery: "ollama" for local models, "openai-api" for remote catalog. */
  discoveredVia: "ollama" | "openai-api";
}

/** Cache entry with TTL. */
interface CacheEntry {
  models: DiscoveredModel[];
  fetchedAt: number;
}

/** Cache TTL in milliseconds (5 minutes). */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** In-memory cache keyed by provider endpoint. */
const discoveryCache = new Map<string, CacheEntry>();

/** Default capabilities for models discovered via API (conservative defaults). */
function defaultLlmCapabilities(): ModelCapabilities {
  return {
    text: true,
    vision: false,
    audioInput: false,
    audioOutput: false,
    imageGeneration: false,
    videoGeneration: false,
    code: true,
    toolUse: true,
    streaming: true,
    reasoning: false,
  };
}

/** Infer capabilities from a model name (heuristic). */
function inferCapabilities(modelId: string): ModelCapabilities {
  const caps = defaultLlmCapabilities();
  const m = modelId.toLowerCase();

  // Vision-capable models
  if (m.includes("vision") || m.includes("vl") || m.includes("llava") || m.includes("multimodal")) {
    caps.vision = true;
  }
  // Reasoning models
  if (m.includes("reason") || m.includes("r1") || m.includes("thinking") || m.includes("o1") || m.includes("o3") || m.includes("o4")) {
    caps.reasoning = true;
  }
  // Embedding models
  if (m.includes("embed") || m.includes("bge") || m.includes("e5")) {
    caps.text = false;
    caps.embedding = true;
    caps.code = false;
    caps.toolUse = false;
    caps.streaming = false;
  }
  // Code models
  if (m.includes("code") || m.includes("coder") || m.includes("codestral")) {
    caps.code = true;
  }

  return caps;
}

/** Infer context window from model name (heuristic based on known model families). */
function inferContextWindow(modelId: string): number {
  const m = modelId.toLowerCase();
  if (m.includes("gemini") && (m.includes("pro") || m.includes("2.5") || m.includes("3.0"))) return 2_000_000;
  if (m.includes("gemini")) return 1_000_000;
  if (m.includes("gpt-4.1") || m.includes("gpt-5")) return 200_000;
  if (m.includes("gpt-4") || m.includes("gpt-3.5")) return 128_000;
  if (m.includes("claude")) return 200_000;
  if (m.includes("llama") && m.includes("3.3")) return 128_000;
  if (m.includes("llama") && m.includes("3.1")) return 128_000;
  if (m.includes("llama-4")) return 1_000_000;
  if (m.includes("llama")) return 8_000;
  if (m.includes("qwen") && m.includes("2.5")) return 131_072;
  if (m.includes("qwen")) return 32_000;
  if (m.includes("mistral") || m.includes("mixtral")) return 128_000;
  if (m.includes("deepseek")) return 64_000;
  if (m.includes("phi")) return 128_000;
  if (m.includes("gemma")) return 8_000;
  if (m.includes("command-r")) return 128_000;
  return 32_000;
}

/** Infer provider from model ID (heuristic). */
function inferProvider(modelId: string): string {
  const m = modelId.toLowerCase();
  if (m.includes("llama") || m.includes("qwen") || m.includes("mistral") || m.includes("phi") || m.includes("gemma") || m.includes("deepseek")) {
    return "ollama";
  }
  return "unknown";
}

/**
 * Discover locally installed Ollama models via the /api/tags endpoint.
 * Returns an empty array if Ollama is not running or unreachable.
 */
export async function discoverOllamaModels(baseUrl?: string): Promise<DiscoveredModel[]> {
  const url = (baseUrl ?? config.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
  const cacheKey = `ollama:${url}`;

  // Check cache
  const cached = discoveryCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.models;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${url}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.debug(`Ollama /api/tags returned ${res.status}`);
      return [];
    }

    const data = await res.json() as { models?: Array<{ name: string; model?: string; details?: { parameter_size?: string; family?: string; quantization_level?: string } }> };
    const models: DiscoveredModel[] = (data.models ?? []).map((m) => {
      const id = m.name || m.model || "unknown";
      // Remove :latest suffix for cleaner display
      const cleanId = id.replace(/:latest$/, "");
      const family = m.details?.family ?? "";
      const paramSize = m.details?.parameter_size ?? "";

      return {
        id: cleanId,
        name: cleanId.charAt(0).toUpperCase() + cleanId.slice(1),
        provider: "ollama",
        contextWindow: inferContextWindow(cleanId),
        capabilities: inferCapabilities(cleanId),
        description: `Local Ollama model${paramSize ? ` (${paramSize})` : ""}${family ? ` — ${family} family` : ""}`,
        discoveredVia: "ollama",
      };
    });

    // Update cache
    discoveryCache.set(cacheKey, { models, fetchedAt: Date.now() });
    logger.info(`Discovered ${models.length} local Ollama model(s)`, { models: models.map((m) => m.id) });
    return models;
  } catch (err) {
    logger.debug(`Ollama discovery failed (not running?)`, { err: String(err).slice(0, 100) });
    return [];
  }
}

/**
 * Discover available models from an OpenAI-compatible /v1/models endpoint.
 * Returns an empty array if the endpoint is unreachable or unauthorized.
 */
export async function discoverOpenAIModels(
  baseUrl: string,
  apiKey: string,
  providerName?: string,
): Promise<DiscoveredModel[]> {
  const cleanUrl = baseUrl.replace(/\/$/, "");
  const cacheKey = `openai-api:${cleanUrl}:${providerName ?? "default"}`;

  // Check cache
  const cached = discoveryCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.models;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${cleanUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.debug(`OpenAI-compatible /models at ${cleanUrl} returned ${res.status}`);
      return [];
    }

    const data = await res.json() as { data?: Array<{ id: string; owned_by?: string }> };
    const knownIds = new Set(MODEL_REGISTRY.map((m) => m.id));
    const models: DiscoveredModel[] = (data.data ?? [])
      .filter((m) => m.id && !knownIds.has(m.id))
      .map((m) => ({
        id: m.id,
        name: m.id.charAt(0).toUpperCase() + m.id.slice(1),
        provider: providerName ?? inferProvider(m.id),
        contextWindow: inferContextWindow(m.id),
        capabilities: inferCapabilities(m.id),
        description: `Discovered from ${providerName ?? "OpenAI-compatible API"}${m.owned_by ? ` (owned by ${m.owned_by})` : ""}`,
        discoveredVia: "openai-api",
      }));

    // Update cache
    discoveryCache.set(cacheKey, { models, fetchedAt: Date.now() });
    if (models.length > 0) {
      logger.info(`Discovered ${models.length} model(s) from ${providerName ?? cleanUrl}`, {
        sample: models.slice(0, 5).map((m) => m.id),
      });
    }
    return models;
  } catch (err) {
    logger.debug(`Model discovery from ${cleanUrl} failed`, { err: String(err).slice(0, 100) });
    return [];
  }
}

/**
 * Discover models from all configured providers in parallel.
 * Combines Ollama local models with OpenAI-compatible remote catalogs.
 */
export async function discoverAllModels(): Promise<DiscoveredModel[]> {
  const configs = getProviderConfigs();
  const tasks: Promise<DiscoveredModel[]>[] = [];

  for (const cfg of configs) {
    if (cfg.type === "ollama") {
      tasks.push(discoverOllamaModels(cfg.baseUrl));
    } else if (cfg.type === "openai" && cfg.apiKey) {
      tasks.push(discoverOpenAIModels(cfg.baseUrl, cfg.apiKey, cfg.providerName));
    }
  }

  // Also try default Ollama endpoint if not explicitly configured
  if (!configs.some((c) => c.type === "ollama")) {
    tasks.push(discoverOllamaModels());
  }

  const results = await Promise.allSettled(tasks);
  const allModels: DiscoveredModel[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allModels.push(...result.value);
    }
  }

  // Deduplicate by model ID (prefer Ollama discovery over API discovery)
  const seen = new Set<string>();
  const deduped: DiscoveredModel[] = [];
  for (const model of allModels) {
    if (!seen.has(model.id)) {
      seen.add(model.id);
      deduped.push(model);
    }
  }

  return deduped;
}

/**
 * Get a unified model list combining the static MODEL_REGISTRY with
 * dynamically discovered models. Static entries take precedence.
 */
export async function getUnifiedModelList(): Promise<Array<ModelEntry | DiscoveredModel>> {
  const discovered = await discoverAllModels();
  const staticIds = new Set(MODEL_REGISTRY.map((m) => m.id));
  const newDiscovered = discovered.filter((m) => !staticIds.has(m.id));
  return [...MODEL_REGISTRY, ...newDiscovered];
}

/**
 * Create provider configurations for locally discovered Ollama models.
 * Each discovered model becomes a separate provider config entry so the
 * router can route requests to the specific model.
 */
export async function discoverOllamaProviderConfigs(): Promise<ProviderConfig[]> {
  const models = await discoverOllamaModels();
  const baseUrl = (config.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
  return models.map((m) => ({
    type: "ollama" as const,
    providerName: `ollama-${m.id}`,
    baseUrl,
    model: m.id,
  }));
}

/** Clear the discovery cache (for testing or manual refresh). */
export function clearDiscoveryCache(): void {
  discoveryCache.clear();
}

/** Get the current cache state (for monitoring). */
export function getDiscoveryCacheState(): Array<{ key: string; modelCount: number; ageMs: number }> {
  const now = Date.now();
  return Array.from(discoveryCache.entries()).map(([key, entry]) => ({
    key,
    modelCount: entry.models.length,
    ageMs: now - entry.fetchedAt,
  }));
}
