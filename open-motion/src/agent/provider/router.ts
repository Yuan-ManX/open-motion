import { config, getProviderConfigs, type ProviderConfig } from "../../config.js";
import { logger } from "../../utils/logger.js";
import type { LlmProvider, ChatOptions, ChatResult, ChatStreamChunk } from "./types.js";
import { hasMultimodalContent } from "./types.js";
import { MockProvider } from "./mock.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { GeminiProvider } from "./gemini.js";
import { OllamaProvider } from "./ollama.js";
import { findModel, MODEL_REGISTRY, type ModelEntry } from "./registry.js";

/** Create a provider instance from a ProviderConfig. */
export function createProviderInstance(cfg: ProviderConfig): LlmProvider {
  switch (cfg.type) {
    case "openai":
      return new OpenAIProvider(cfg);
    case "anthropic":
      return new AnthropicProvider(cfg);
    case "gemini":
      return new GeminiProvider(cfg);
    case "ollama":
      return new OllamaProvider(cfg);
    default:
      return new MockProvider();
  }
}

/** Cost tier for routing decisions — lower is cheaper. */
type CostTier = 0 | 1 | 2 | 3;

/** Provider capability metadata for routing decisions. */
interface ProviderEntry {
  provider: LlmProvider;
  config: ProviderConfig;
  priority: number;
  /** Maximum context window in tokens (from registry, if known). */
  contextWindow: number;
  /** Relative cost tier: 0 = cheapest, 3 = most expensive. */
  costTier: CostTier;
  /** Model capabilities from the registry, if found. */
  capabilities?: ModelEntry["capabilities"];
}

/** Runtime health metrics tracked per provider for circuit-breaker and latency routing. */
interface ProviderHealth {
  /** Consecutive failure count — resets to 0 on success. */
  consecutiveFailures: number;
  /** Total successful requests. */
  successCount: number;
  /** Total failed requests. */
  failureCount: number;
  /** Exponential moving average of latency in ms. */
  avgLatencyMs: number;
  /** Timestamp (ms) when the circuit closes again after tripping. */
  circuitOpenUntil: number;
  /** Last error message (truncated). */
  lastError: string;
  /** Cumulative input tokens consumed. */
  totalTokensIn: number;
  /** Cumulative output tokens consumed. */
  totalTokensOut: number;
}

/** Circuit breaker threshold — after this many consecutive failures, trip the circuit. */
const CIRCUIT_FAILURE_THRESHOLD = 3;
/** How long to keep the circuit open before retrying (ms). */
const CIRCUIT_RESET_MS = 30_000;
/** Minimum latency samples before avgLatencyMs is trusted for routing. */
const MIN_LATENCY_SAMPLES = 2;
/** Maximum retry attempts for transient errors per provider. */
const MAX_RETRIES = 2;
/** Base delay for exponential backoff (ms). */
const RETRY_BASE_DELAY_MS = 500;
/** Maximum backoff delay cap (ms). */
const RETRY_MAX_DELAY_MS = 8_000;

/** Detect transient HTTP errors that warrant a retry. */
function isTransientError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  // 429 Too Many Requests, 408 Request Timeout
  if (msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests")) return true;
  if (msg.includes("408") || msg.includes("request timeout") || msg.includes("timed out")) return true;
  // 500/502/503/504 server errors
  if (msg.includes("500") || msg.includes("internal server error")) return true;
  if (msg.includes("502") || msg.includes("bad gateway")) return true;
  if (msg.includes("503") || msg.includes("service unavailable") || msg.includes("overloaded")) return true;
  if (msg.includes("504") || msg.includes("gateway timeout")) return true;
  // Network-level errors
  if (msg.includes("econnreset") || msg.includes("enotfound") || msg.includes("econnrefused")) return true;
  if (msg.includes("fetch failed") || msg.includes("network error") || msg.includes("socket hang up")) return true;
  return false;
}

/** Compute exponential backoff delay with jitter. */
function backoffDelay(attempt: number): number {
  const exp = Math.pow(2, attempt) * RETRY_BASE_DELAY_MS;
  const capped = Math.min(exp, RETRY_MAX_DELAY_MS);
  // Add ±25% jitter to avoid thundering herd
  const jitter = capped * (0.75 + Math.random() * 0.5);
  return Math.round(jitter);
}

/** Sleep for the given milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Estimate cost tier from model name patterns and registry metadata. */
function estimateCostTier(model: string, registryEntry?: ModelEntry): CostTier {
  // Use registry capabilities to refine cost estimation
  if (registryEntry) {
    const caps = registryEntry.capabilities;
    // Reasoning + vision + tool use → frontier tier
    if (caps.reasoning && caps.vision && caps.toolUse) return 3;
    // Embedding-only or generation-only models → low cost
    if (caps.embedding || registryEntry.generationModality) return 1;
  }

  const m = model.toLowerCase();
  // Tier 3: frontier / large models
  if (m.includes("opus") || m.includes("gpt-4o") || m.includes("gpt-4.1") || m.includes("sonnet") && m.includes("4") || m.includes("gemini-2.5-pro") || m.includes("qwen-max") || m.includes("grok-3") || m.includes("llama-3.1-sonar-huge")) return 3;
  // Tier 2: mid-tier models
  if (m.includes("gpt-4") || m.includes("claude") || m.includes("gemini-2") || m.includes("mistral-large") || m.includes("deepseek") || m.includes("command-r-plus") || m.includes("yi-large")) return 2;
  // Tier 1: small / fast models
  if (m.includes("mini") || m.includes("flash") || m.includes("haiku") || m.includes("nano") || m.includes("groq") || m.includes("together") || m.includes("fireworks") || m.includes("command-r") || m.includes("glm-4-flash")) return 1;
  // Tier 0: local / free models
  if (m.includes("ollama") || m.includes("llama") || m.includes("qwen2") || m.includes("mistral-nemo") || m.includes("phi") || m.includes("gemma")) return 0;
  return 2;
}

let providerPool: ProviderEntry[] | null = null;

/** Resolve all available providers from environment configuration. */
function getProviderPool(): ProviderEntry[] {
  if (providerPool) return providerPool;

  const configs = getProviderConfigs();
  const entries: ProviderEntry[] = [];

  // If LLM_PROVIDER is explicitly set, prioritize that provider
  const preferred = config.LLM_PROVIDER;

  for (let i = 0; i < configs.length; i++) {
    const cfg = configs[i];
    let priority = i;
    if (preferred !== "auto" && cfg.type === preferred) {
      priority = -1; // highest priority
    }
    try {
      const provider = createProviderInstance(cfg);
      // Look up context window from the model registry
      const registryEntry = findModel(cfg.model);
      const contextWindow = registryEntry?.contextWindow ?? 128000;
      const costTier = estimateCostTier(cfg.model, registryEntry);
      entries.push({ provider, config: cfg, priority, contextWindow, costTier, capabilities: registryEntry?.capabilities });
      const displayName = cfg.providerName ?? cfg.type;
      logger.info(`Provider registered: ${displayName} (${cfg.model})`, { contextWindow, costTier });
    } catch (err) {
      logger.warn(`Failed to create ${cfg.type} provider`, { err: String(err) });
    }
  }

  entries.sort((a, b) => a.priority - b.priority);
  providerPool = entries;
  return entries;
}

/**
 * Resolve a model ID to the provider that can serve it.
 * Returns the provider name and config, or null if no provider matches.
 */
export function getProviderForModel(modelId: string): {
  provider: LlmProvider;
  config: ProviderConfig;
} | null {
  const pool = getProviderPool();
  if (pool.length === 0) return null;

  // First, try exact model match in the pool
  const exactMatch = pool.find((e) => e.config.model === modelId);
  if (exactMatch) {
    return { provider: exactMatch.provider, config: exactMatch.config };
  }

  // Then, check the registry for the model's provider
  const registryEntry = findModel(modelId);
  if (registryEntry) {
    // Find a pool entry that matches the registry provider
    const providerName = registryEntry.provider;
    // Map registry provider names to config providerName or type
    const matchingPool = pool.find((e) => {
      const displayName = e.config.providerName ?? e.config.type;
      return displayName === providerName || e.config.type === providerName;
    });
    if (matchingPool) {
      return { provider: matchingPool.provider, config: matchingPool.config };
    }
  }

  // Fallback: return the first available provider
  return { provider: pool[0].provider, config: pool[0].config };
}

/** Check if any message in the conversation requires vision capability. */
function needsVision(options: ChatOptions): boolean {
  return options.messages.some(
    (m) => typeof m.content !== "string" && hasMultimodalContent(m.content),
  );
}

/** Check if the request includes tool definitions that require tool-use support. */
function needsToolUse(options: ChatOptions): boolean {
  return options.tools.length > 0;
}

/** Estimate total token count from messages (rough heuristic for routing). */
function estimateTokenCount(options: ChatOptions): number {
  let chars = 0;
  for (const msg of options.messages) {
    if (typeof msg.content === "string") {
      chars += msg.content.length;
    } else {
      for (const part of msg.content) {
        if (part.type === "text") chars += part.text.length;
      }
    }
  }
  return Math.ceil(chars / 4);
}

/**
 * Unified LLM Router with capability-aware routing. Selects the best
 * provider based on:
 * 1. Explicit LLM_PROVIDER setting (highest priority)
 * 2. Vision requirement → prefer vision-capable providers
 * 3. Tool-use requirement → prefer providers with native tool support
 * 4. Context window → filter providers that can fit the estimated tokens
 * 5. Circuit breaker → skip providers with consecutive failures
 * 6. Latency-aware → prefer faster providers at equal priority/cost
 * 7. Fallback chain on errors with automatic retry
 * 8. Streaming support via streamChat() async iterator
 */
export class LlmRouter implements LlmProvider {
  readonly name = "router" as const;
  readonly supportsNativeToolCalls = true;
  readonly supportsVision = true;
  readonly supportsStreaming = true;

  /** Per-provider health map keyed by provider name + model. */
  private health = new Map<string, ProviderHealth>();

  /** Get or create the health record for a provider entry. */
  private getHealth(entry: ProviderEntry): ProviderHealth {
    const key = `${entry.provider.name}:${entry.config.model}`;
    let h = this.health.get(key);
    if (!h) {
      h = {
        consecutiveFailures: 0,
        successCount: 0,
        failureCount: 0,
        avgLatencyMs: 0,
        circuitOpenUntil: 0,
        lastError: "",
        totalTokensIn: 0,
        totalTokensOut: 0,
      };
      this.health.set(key, h);
    }
    return h;
  }

  /** Record a successful request with latency and token usage data. */
  private recordSuccess(entry: ProviderEntry, latencyMs: number, tokensIn?: number, tokensOut?: number): void {
    const h = this.getHealth(entry);
    h.consecutiveFailures = 0;
    h.successCount++;
    // Exponential moving average with alpha = 0.3
    h.avgLatencyMs = h.avgLatencyMs === 0
      ? latencyMs
      : Math.round(0.3 * latencyMs + 0.7 * h.avgLatencyMs);
    h.circuitOpenUntil = 0;
    if (tokensIn) h.totalTokensIn += tokensIn;
    if (tokensOut) h.totalTokensOut += tokensOut;
  }

  /** Record a failed request and potentially trip the circuit breaker. */
  private recordFailure(entry: ProviderEntry, err: Error): void {
    const h = this.getHealth(entry);
    h.consecutiveFailures++;
    h.failureCount++;
    h.lastError = String(err).slice(0, 200);
    if (h.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
      h.circuitOpenUntil = Date.now() + CIRCUIT_RESET_MS;
      logger.warn(
        `Circuit tripped for ${entry.provider.name} (${entry.config.model}) — open for ${CIRCUIT_RESET_MS}ms`,
        { consecutiveFailures: h.consecutiveFailures },
      );
    }
  }

  /** Check if a provider's circuit breaker is currently open. */
  private isCircuitOpen(entry: ProviderEntry): boolean {
    const h = this.getHealth(entry);
    if (h.circuitOpenUntil === 0) return false;
    if (Date.now() >= h.circuitOpenUntil) {
      // Half-open state — allow one probe request
      h.circuitOpenUntil = 0;
      return false;
    }
    return true;
  }

  /** Select the best ordered provider list for the given chat options. */
  private selectProviders(options: ChatOptions): ProviderEntry[] {
    const pool = getProviderPool();
    if (pool.length === 0) return [];

    const wantsVision = needsVision(options);
    const wantsTools = needsToolUse(options);
    const estTokens = estimateTokenCount(options);
    const requiredWindow = Math.max(estTokens * 2, estTokens + 4096);

    // Filter out providers whose context window cannot fit the request
    const fitting = pool.filter((e) => e.contextWindow >= requiredWindow);
    const candidates = fitting.length > 0 ? fitting : pool;

    // Filter out providers with open circuits (unless all are open)
    const healthy = candidates.filter((e) => !this.isCircuitOpen(e));
    const routable = healthy.length > 0 ? healthy : candidates;

    // Build ordered provider list based on capability requirements
    const ordered = [...routable].sort((a, b) => {
      if (wantsVision) {
        const aVis = a.provider.supportsVision ? 0 : 1;
        const bVis = b.provider.supportsVision ? 0 : 1;
        if (aVis !== bVis) return aVis - bVis;
      }

      if (wantsTools) {
        const aTool = a.provider.supportsNativeToolCalls ? 0 : 1;
        const bTool = b.provider.supportsNativeToolCalls ? 0 : 1;
        if (aTool !== bTool) return aTool - bTool;
      }

      if (a.priority !== b.priority) return a.priority - b.priority;

      const costDiff = a.costTier - b.costTier;
      if (costDiff !== 0) return costDiff;

      const aHealth = this.getHealth(a);
      const bHealth = this.getHealth(b);
      const aSamples = aHealth.successCount + aHealth.failureCount;
      const bSamples = bHealth.successCount + bHealth.failureCount;
      if (aSamples >= MIN_LATENCY_SAMPLES && bSamples >= MIN_LATENCY_SAMPLES) {
        return aHealth.avgLatencyMs - bHealth.avgLatencyMs;
      }

      return 0;
    });

    return ordered;
  }

  async chat(options: ChatOptions): Promise<ChatResult> {
    const pool = getProviderPool();

    // No providers configured — use mock
    if (pool.length === 0) {
      logger.info("No LLM providers configured, using mock");
      const mock = new MockProvider();
      return mock.chat(options);
    }

    const ordered = this.selectProviders(options);

    logger.debug(`Router selecting from ${ordered.length} providers`, {
      estTokens: estimateTokenCount(options),
      wantsVision: needsVision(options),
      wantsTools: needsToolUse(options),
      poolSize: pool.length,
    });

    // Try providers in order, with retry on transient errors and fallback on persistent errors
    let lastError: Error | null = null;
    for (const entry of ordered) {
      // Retry loop for transient errors (429/5xx/network) with exponential backoff
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const startTs = Date.now();
        try {
          const result = await entry.provider.chat(options);
          const latencyMs = Date.now() - startTs;
          this.recordSuccess(entry, latencyMs, result.tokensIn, result.tokensOut);
          logger.debug(`Chat completed via ${entry.provider.name} (${entry.config.model})`, {
            tokensIn: result.tokensIn,
            tokensOut: result.tokensOut,
            costTier: entry.costTier,
            latencyMs,
            attempt,
          });
          return result;
        } catch (err) {
          lastError = err as Error;
          const transient = isTransientError(lastError);
          if (transient && attempt < MAX_RETRIES) {
            const delay = backoffDelay(attempt);
            logger.warn(`Transient error from ${entry.provider.name}, retrying`, {
              err: String(lastError).slice(0, 120),
              attempt: attempt + 1,
              delayMs: delay,
            });
            await sleep(delay);
            continue;
          }
          // Non-transient or retries exhausted — record failure and fall back to next provider
          this.recordFailure(entry, lastError);
          logger.warn(`Provider ${entry.provider.name} failed, trying fallback`, {
            err: String(err),
            consecutiveFailures: this.getHealth(entry).consecutiveFailures,
            transient,
          });
          break; // exit retry loop, move to next provider
        }
      }
    }

    // All providers failed — fall back to mock
    logger.error("All LLM providers failed, using mock as last resort", {
      err: String(lastError),
    });
    const mock = new MockProvider();
    return mock.chat(options);
  }

  /** Stream chat completions by delegating to the first capable provider. */
  async *streamChat(options: ChatOptions): AsyncIterable<ChatStreamChunk> {
    const pool = getProviderPool();
    if (pool.length === 0) {
      const mock = new MockProvider();
      const result = await mock.chat(options);
      yield { delta: result.text, done: true };
      return;
    }

    const ordered = this.selectProviders(options);
    let lastError: Error | null = null;

    for (const entry of ordered) {
      if (!entry.provider.streamChat) continue;
      // Retry transient errors before falling back to the next provider
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        let yieldedAny = false;
        let streamTokensIn: number | undefined;
        let streamTokensOut: number | undefined;
        try {
          const startTs = Date.now();
          for await (const chunk of entry.provider.streamChat(options)) {
            yieldedAny = true;
            if (chunk.tokensIn !== undefined) streamTokensIn = chunk.tokensIn;
            if (chunk.tokensOut !== undefined) streamTokensOut = chunk.tokensOut;
            yield chunk;
          }
          this.recordSuccess(entry, Date.now() - startTs, streamTokensIn, streamTokensOut);
          return;
        } catch (err) {
          lastError = err as Error;
          const transient = isTransientError(lastError);
          // Only retry if no chunks were yielded yet — once we've streamed data,
          // retrying would produce duplicate content
          if (transient && !yieldedAny && attempt < MAX_RETRIES) {
            const delay = backoffDelay(attempt);
            logger.warn(`Transient stream error from ${entry.provider.name}, retrying`, {
              err: String(lastError).slice(0, 120),
              attempt: attempt + 1,
              delayMs: delay,
            });
            await sleep(delay);
            continue;
          }
          this.recordFailure(entry, lastError);
          logger.warn(`Streaming via ${entry.provider.name} failed, trying fallback`, {
            err: String(err),
            transient,
          });
          break; // move to next provider
        }
      }
    }

    // Fallback to non-streaming chat
    logger.warn("No streaming provider available, falling back to batch chat");
    const result = await this.chat(options);
    yield { delta: result.text, toolCalls: result.toolCalls, tokensIn: result.tokensIn, tokensOut: result.tokensOut, done: true };
  }

  /** List all configured providers with their status. */
  listProviders(): Array<{ type: string; model: string; configured: boolean }> {
    const pool = getProviderPool();
    return pool.map((e) => ({
      type: e.config.providerName ?? e.config.type,
      model: e.config.model,
      configured: true,
    }));
  }

  /** Return runtime health metrics for all providers (for monitoring/dashboards). */
  getHealthStats(): Array<{
    provider: string;
    model: string;
    successCount: number;
    failureCount: number;
    consecutiveFailures: number;
    avgLatencyMs: number;
    circuitOpen: boolean;
    lastError: string;
    totalTokensIn: number;
    totalTokensOut: number;
  }> {
    const pool = getProviderPool();
    return pool.map((e) => {
      const h = this.getHealth(e);
      return {
        provider: e.provider.name,
        model: e.config.model,
        successCount: h.successCount,
        failureCount: h.failureCount,
        consecutiveFailures: h.consecutiveFailures,
        avgLatencyMs: h.avgLatencyMs,
        circuitOpen: this.isCircuitOpen(e),
        lastError: h.lastError,
        totalTokensIn: h.totalTokensIn,
        totalTokensOut: h.totalTokensOut,
      };
    });
  }

  /** Return cumulative token usage across all providers. */
  getTokenStats(): { totalTokensIn: number; totalTokensOut: number; byProvider: Array<{ provider: string; model: string; tokensIn: number; tokensOut: number }> } {
    const pool = getProviderPool();
    let totalTokensIn = 0;
    let totalTokensOut = 0;
    const byProvider = pool.map((e) => {
      const h = this.getHealth(e);
      totalTokensIn += h.totalTokensIn;
      totalTokensOut += h.totalTokensOut;
      return {
        provider: e.provider.name,
        model: e.config.model,
        tokensIn: h.totalTokensIn,
        tokensOut: h.totalTokensOut,
      };
    });
    return { totalTokensIn, totalTokensOut, byProvider };
  }

  /** List all models in the registry (for model selector UI). */
  listModels(): Array<{
    id: string;
    name: string;
    provider: string;
    capabilities: ModelEntry["capabilities"];
    contextWindow?: number;
    description: string;
  }> {
    return MODEL_REGISTRY.map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      capabilities: m.capabilities,
      contextWindow: m.contextWindow,
      description: m.description,
    }));
  }
}

let routerInstance: LlmRouter | null = null;

/** Get the singleton LLM router instance. */
export function getRouter(): LlmRouter {
  if (!routerInstance) {
    routerInstance = new LlmRouter();
  }
  return routerInstance;
}

/** Reset the router and provider pool (for testing). */
export function resetRouter(): void {
  routerInstance = null;
  providerPool = null;
}
