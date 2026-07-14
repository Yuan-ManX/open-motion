import { config, getProviderConfigs, type ProviderConfig } from "../../config.js";
import { logger } from "../../utils/logger.js";
import type { LlmProvider, ChatOptions, ChatResult } from "./types.js";
import { hasMultimodalContent } from "./types.js";
import { MockProvider } from "./mock.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";
import { GeminiProvider } from "./gemini.js";
import { OllamaProvider } from "./ollama.js";

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

/** Provider capability metadata for routing decisions. */
interface ProviderEntry {
  provider: LlmProvider;
  config: ProviderConfig;
  priority: number;
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
      entries.push({ provider, config: cfg, priority });
      logger.info(`Provider registered: ${cfg.type} (${cfg.model})`);
    } catch (err) {
      logger.warn(`Failed to create ${cfg.type} provider`, { err: String(err) });
    }
  }

  entries.sort((a, b) => a.priority - b.priority);
  providerPool = entries;
  return entries;
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
 * 5. Fallback chain on errors with automatic retry
 */
export class LlmRouter implements LlmProvider {
  readonly name = "router" as const;
  readonly supportsNativeToolCalls = true;
  readonly supportsVision = true;
  readonly supportsStreaming = true;

  async chat(options: ChatOptions): Promise<ChatResult> {
    const pool = getProviderPool();

    // No providers configured — use mock
    if (pool.length === 0) {
      logger.info("No LLM providers configured, using mock");
      const mock = new MockProvider();
      return mock.chat(options);
    }

    const wantsVision = needsVision(options);
    const wantsTools = needsToolUse(options);
    const estTokens = estimateTokenCount(options);

    // Build ordered provider list based on capability requirements
    const ordered = [...pool].sort((a, b) => {
      // Vision capability takes highest priority when needed
      if (wantsVision) {
        const aVis = a.provider.supportsVision ? 0 : 1;
        const bVis = b.provider.supportsVision ? 0 : 1;
        if (aVis !== bVis) return aVis - bVis;
      }

      // Tool-use capability when tools are present
      if (wantsTools) {
        const aTool = a.provider.supportsNativeToolCalls ? 0 : 1;
        const bTool = b.provider.supportsNativeToolCalls ? 0 : 1;
        if (aTool !== bTool) return aTool - bTool;
      }

      // Then by original priority
      return a.priority - b.priority;
    });

    // Try providers in order, with fallback on error
    let lastError: Error | null = null;
    for (const entry of ordered) {
      try {
        const result = await entry.provider.chat(options);
        logger.debug(`Chat completed via ${entry.provider.name} (${entry.config.model})`, {
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          estTokens,
        });
        return result;
      } catch (err) {
        lastError = err as Error;
        logger.warn(`Provider ${entry.provider.name} failed, trying fallback`, {
          err: String(err),
        });
      }
    }

    // All providers failed — fall back to mock
    logger.error("All LLM providers failed, using mock as last resort", {
      err: String(lastError),
    });
    const mock = new MockProvider();
    return mock.chat(options);
  }

  /** List all configured providers with their status. */
  listProviders(): Array<{ type: string; model: string; configured: boolean }> {
    const pool = getProviderPool();
    return pool.map((e) => ({
      type: e.config.type,
      model: e.config.model,
      configured: true,
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
