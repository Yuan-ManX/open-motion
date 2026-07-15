import { providerMode, getProviderConfigs, type ProviderConfig } from "../../config.js";
import { logger } from "../../utils/logger.js";
import type { LlmProvider } from "./types.js";
import { getRouter, resetRouter, createProviderInstance } from "./router.js";
import { findModel, type ExtendedProvider } from "./registry.js";

let instance: LlmProvider | null = null;

/**
 * Registry provider names that use the OpenAI-compatible chat/completions
 * API format. These all map to the "openai" ProviderType at runtime but
 * have distinct base URLs and API keys.
 */
const OPENAI_COMPATIBLE_PROVIDERS: ExtendedProvider[] = [
  "openai", "xai", "mistral", "cohere", "groq", "together", "fireworks",
  "perplexity", "openrouter", "zhipu", "qwen", "yi", "deepseek",
];

/**
 * Map a registry provider name to the corresponding ProviderConfig by
 * matching the base URL. This lets us resolve models from xAI, Mistral,
 * Groq, etc. to their correct API endpoint even though they all use the
 * "openai" ProviderType.
 */
function findConfigForProvider(provider: ExtendedProvider, configs: ProviderConfig[]): ProviderConfig | null {
  // Direct type match (openai, anthropic, gemini, ollama, mock)
  const direct = configs.find((c) => c.type === provider);
  if (direct) return direct;

  // Match by providerName field (most reliable for OpenAI-compatible providers)
  const byName = configs.find((c) => c.providerName === provider);
  if (byName) return byName;

  // OpenAI-compatible providers — match by base URL as fallback
  if (OPENAI_COMPATIBLE_PROVIDERS.includes(provider)) {
    const baseUrlMap: Record<string, string> = {
      xai: "api.x.ai",
      mistral: "api.mistral.ai",
      cohere: "api.cohere.ai",
      groq: "api.groq.com",
      together: "api.together.xyz",
      fireworks: "api.fireworks.ai",
      perplexity: "api.perplexity.ai",
      openrouter: "openrouter.ai",
      zhipu: "open.bigmodel.cn",
      qwen: "dashscope.aliyuncs.com",
      yi: "api.01.ai",
      deepseek: "api.deepseek.com",
      openai: "api.openai.com",
    };
    const expectedHost = baseUrlMap[provider];
    if (expectedHost) {
      const match = configs.find((c) => c.baseUrl.includes(expectedHost));
      if (match) return match;
    }
    // Fall back to first openai-type config
    const fallback = configs.find((c) => c.type === "openai");
    if (fallback) return fallback;
  }

  return null;
}

/**
 * Resolve the active LLM provider. The unified router supports multiple
 * providers (OpenAI, Anthropic, Gemini, Ollama, xAI, Mistral, Groq, etc.)
 * with automatic fallback and multimodal routing. When no API keys are
 * configured, the offline Mock provider simulates the full tool-calling cycle.
 */
export async function getProvider(): Promise<LlmProvider> {
  if (instance) return instance;
  const mode = providerMode();
  logger.info(`LLM provider mode: ${mode}`);
  const router = getRouter();
  instance = router as LlmProvider;
  return instance;
}

/**
 * Resolve a provider instance configured for a specific model id. Looks up
 * the model in the registry, finds a matching configured provider by type
 * or base URL, and creates a fresh instance with the selected model
 * overriding the default. Returns null when the model is unknown or its
 * provider is not configured with credentials, so callers can fall back
 * to the router.
 */
export async function getProviderForModel(modelId: string): Promise<LlmProvider | null> {
  const entry = findModel(modelId);
  if (!entry) {
    logger.warn(`Model "${modelId}" not found in registry, using default router`);
    return null;
  }

  const configs = getProviderConfigs();
  const match = findConfigForProvider(entry.provider, configs);
  if (!match) {
    logger.warn(`Provider "${entry.provider}" for model "${modelId}" is not configured, using default router`);
    return null;
  }

  // Create a provider instance with the user-selected model.
  const cfg = { ...match, model: entry.id };
  try {
    const provider = createProviderInstance(cfg);
    logger.info(`Provider resolved for model "${modelId}": ${entry.provider}`);
    return provider;
  } catch (err) {
    logger.warn(`Failed to create provider for model "${modelId}"`, { err: String(err) });
    return null;
  }
}

/** Test hook: force a fresh provider resolution on the next getProvider() call. */
export function resetProvider(): void {
  instance = null;
  resetRouter();
}

/** Get the list of configured providers (for introspection / health checks). */
export function listConfiguredProviders(): Array<{ type: string; model: string; configured: boolean }> {
  return getRouter().listProviders();
}
