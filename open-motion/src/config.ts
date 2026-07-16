import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(7000),
  // OpenAI-compatible
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  MODEL: z.string().optional(),
  // Anthropic
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_BASE_URL: z.string().url().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  // Google Gemini
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_BASE_URL: z.string().url().optional(),
  GEMINI_MODEL: z.string().optional(),
  // Ollama (local models)
  OLLAMA_BASE_URL: z.string().url().optional(),
  OLLAMA_MODEL: z.string().optional(),
  // Generic OpenAI-compatible (e.g., DeepSeek, Mistral, Together, Groq, etc.)
  LLM_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.string().url().optional(),
  LLM_MODEL: z.string().optional(),
  // Provider selection
  LLM_PROVIDER: z.enum(["openai", "anthropic", "gemini", "ollama", "auto"]).default("auto"),
  // Multimodal
  ENABLE_MULTIMODAL: z.coerce.boolean().default(true),
  // Generation providers
  STABILITY_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  RUNWAY_API_KEY: z.string().optional(),
  LUMA_API_KEY: z.string().optional(),
  PIKA_API_KEY: z.string().optional(),
  // 3D generation providers
  MESHY_API_KEY: z.string().optional(),
  TRIPO_API_KEY: z.string().optional(),
  // OpenAI-compatible LLM providers (all use the same chat/completions API)
  XAI_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  COHERE_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  TOGETHER_API_KEY: z.string().optional(),
  FIREWORKS_API_KEY: z.string().optional(),
  PERPLEXITY_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  ZHIPU_API_KEY: z.string().optional(),
  QWEN_API_KEY: z.string().optional(),
  YI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  // Additional generation providers
  FLUX_API_KEY: z.string().optional(),
  IDEOGRAM_API_KEY: z.string().optional(),
  SUNO_API_KEY: z.string().optional(),
  ASSEMBLYAI_API_KEY: z.string().optional(),
  REPLICATE_API_KEY: z.string().optional(),
  // Next-gen generation providers
  LEONARDO_API_KEY: z.string().optional(),
  RECRAFT_API_KEY: z.string().optional(),
  KLING_API_KEY: z.string().optional(),
  HAILUO_API_KEY: z.string().optional(),
  PLAYHT_API_KEY: z.string().optional(),
  VOYAGE_API_KEY: z.string().optional(),
  CARTESIA_API_KEY: z.string().optional(),
  FAL_API_KEY: z.string().optional(),
  DEEPINFRA_API_KEY: z.string().optional(),
  MINIMAX_API_KEY: z.string().optional(),
  MODELSCOPE_API_KEY: z.string().optional(),
  BAAI_API_KEY: z.string().optional(),
  // App
  PUBLIC_BASE_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  OPENMOTION_API_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().default(60),
  CHAT_RATE_LIMIT_MAX: z.coerce.number().default(10),
  DB_PATH: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Don't crash on unknown env keys; only validate the ones we read.
    const env: Env = {
      PORT: Number(process.env.PORT) || 7000,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
      MODEL: process.env.MODEL,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
      ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_BASE_URL: process.env.GEMINI_BASE_URL,
      GEMINI_MODEL: process.env.GEMINI_MODEL,
      OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
      OLLAMA_MODEL: process.env.OLLAMA_MODEL,
      LLM_API_KEY: process.env.LLM_API_KEY,
      LLM_BASE_URL: process.env.LLM_BASE_URL,
      LLM_MODEL: process.env.LLM_MODEL,
      LLM_PROVIDER: (process.env.LLM_PROVIDER as Env["LLM_PROVIDER"]) || "auto",
      ENABLE_MULTIMODAL: process.env.ENABLE_MULTIMODAL !== "false",
      STABILITY_API_KEY: process.env.STABILITY_API_KEY,
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
      RUNWAY_API_KEY: process.env.RUNWAY_API_KEY,
      LUMA_API_KEY: process.env.LUMA_API_KEY,
      PIKA_API_KEY: process.env.PIKA_API_KEY,
      MESHY_API_KEY: process.env.MESHY_API_KEY,
      TRIPO_API_KEY: process.env.TRIPO_API_KEY,
      XAI_API_KEY: process.env.XAI_API_KEY,
      MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
      COHERE_API_KEY: process.env.COHERE_API_KEY,
      GROQ_API_KEY: process.env.GROQ_API_KEY,
      TOGETHER_API_KEY: process.env.TOGETHER_API_KEY,
      FIREWORKS_API_KEY: process.env.FIREWORKS_API_KEY,
      PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      ZHIPU_API_KEY: process.env.ZHIPU_API_KEY,
      QWEN_API_KEY: process.env.QWEN_API_KEY,
      YI_API_KEY: process.env.YI_API_KEY,
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
      FLUX_API_KEY: process.env.FLUX_API_KEY,
      IDEOGRAM_API_KEY: process.env.IDEOGRAM_API_KEY,
      SUNO_API_KEY: process.env.SUNO_API_KEY,
      ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY,
      REPLICATE_API_KEY: process.env.REPLICATE_API_KEY,
      LEONARDO_API_KEY: process.env.LEONARDO_API_KEY,
      RECRAFT_API_KEY: process.env.RECRAFT_API_KEY,
      KLING_API_KEY: process.env.KLING_API_KEY,
      HAILUO_API_KEY: process.env.HAILUO_API_KEY,
      PLAYHT_API_KEY: process.env.PLAYHT_API_KEY,
      VOYAGE_API_KEY: process.env.VOYAGE_API_KEY,
      CARTESIA_API_KEY: process.env.CARTESIA_API_KEY,
      FAL_API_KEY: process.env.FAL_API_KEY,
      DEEPINFRA_API_KEY: process.env.DEEPINFRA_API_KEY,
      MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
      MODELSCOPE_API_KEY: process.env.MODELSCOPE_API_KEY,
      BAAI_API_KEY: process.env.BAAI_API_KEY,
      PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
      LOG_LEVEL: (process.env.LOG_LEVEL as Env["LOG_LEVEL"]) || "info",
      OPENMOTION_API_KEY: process.env.OPENMOTION_API_KEY,
      CORS_ORIGIN: process.env.CORS_ORIGIN,
      RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
      RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX) || 60,
      CHAT_RATE_LIMIT_MAX: Number(process.env.CHAT_RATE_LIMIT_MAX) || 10,
      DB_PATH: process.env.DB_PATH,
    };
    return env;
  }
  return parsed.data;
}

const loadedConfig = loadEnv();

/**
 * Runtime overrides for provider API keys. These take precedence over
 * environment variables and allow the settings UI to configure providers
 * without a server restart. Declared before `config` so the Proxy can
 * reference it.
 */
const runtimeKeyOverrides: Record<string, string | undefined> = {};

/**
 * Proxy wrapper around the loaded config. Checks runtime overrides first
 * so that API keys set via the settings UI are visible everywhere config
 * is read (getProviderConfigs, generation.ts, etc.).
 */
export const config: Env = new Proxy(loadedConfig, {
  get(target, prop: string) {
    if (prop in runtimeKeyOverrides) {
      return runtimeKeyOverrides[prop];
    }
    return target[prop as keyof Env];
  },
  ownKeys(target) {
    return Reflect.ownKeys(target);
  },
  getOwnPropertyDescriptor(target, prop) {
    return Reflect.getOwnPropertyDescriptor(target, prop);
  },
});

export const VERSION = "0.1.0";

/** Available provider types in the system. */
export type ProviderType = "openai" | "anthropic" | "gemini" | "ollama" | "mock";

/** Provider configuration map resolved from environment. */
export interface ProviderConfig {
  type: ProviderType;
  /** Display name for monitoring (e.g. "groq", "together"). Defaults to type. */
  providerName?: string;
  apiKey?: string;
  baseUrl: string;
  model: string;
}

/** Resolve all configured providers from environment and runtime overrides. */
export function getProviderConfigs(): ProviderConfig[] {
  const configs: ProviderConfig[] = [];

  // OpenAI-compatible (also covers DeepSeek, Mistral, Together via OPENAI_BASE_URL)
  const openaiKey = resolveConfigValue("OPENAI_API_KEY") || resolveConfigValue("LLM_API_KEY");
  if (openaiKey) {
    configs.push({
      type: "openai",
      apiKey: openaiKey,
      baseUrl: (config.OPENAI_BASE_URL || config.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
      model: config.MODEL || config.LLM_MODEL || "gpt-4o-mini",
    });
  }

  // Anthropic
  const anthropicKey = resolveConfigValue("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    configs.push({
      type: "anthropic",
      apiKey: anthropicKey,
      baseUrl: (config.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1").replace(/\/$/, ""),
      model: config.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    });
  }

  // Google Gemini
  const geminiKey = resolveConfigValue("GEMINI_API_KEY");
  if (geminiKey) {
    configs.push({
      type: "gemini",
      apiKey: geminiKey,
      baseUrl: (config.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, ""),
      model: config.GEMINI_MODEL || "gemini-2.0-flash",
    });
  }

  // Ollama (local models — no API key required)
  if (config.OLLAMA_BASE_URL || config.OLLAMA_MODEL) {
    configs.push({
      type: "ollama",
      baseUrl: (config.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, ""),
      model: config.OLLAMA_MODEL || "llama3.2",
    });
  }

  // xAI (Grok) — OpenAI-compatible API
  const xaiKey = resolveConfigValue("XAI_API_KEY");
  if (xaiKey) {
    configs.push({ type: "openai", providerName: "xai", apiKey: xaiKey, baseUrl: "https://api.x.ai/v1", model: "grok-3" });
  }

  // Mistral AI — OpenAI-compatible API
  const mistralKey = resolveConfigValue("MISTRAL_API_KEY");
  if (mistralKey) {
    configs.push({ type: "openai", providerName: "mistral", apiKey: mistralKey, baseUrl: "https://api.mistral.ai/v1", model: "mistral-large-2411" });
  }

  // Cohere — OpenAI-compatible API
  const cohereKey = resolveConfigValue("COHERE_API_KEY");
  if (cohereKey) {
    configs.push({ type: "openai", providerName: "cohere", apiKey: cohereKey, baseUrl: "https://api.cohere.ai/v2", model: "command-r-plus-08-2024" });
  }

  // Groq — OpenAI-compatible API
  const groqKey = resolveConfigValue("GROQ_API_KEY");
  if (groqKey) {
    configs.push({ type: "openai", providerName: "groq", apiKey: groqKey, baseUrl: "https://api.groq.com/openai/v1", model: "groq-llama-3.3-70b" });
  }

  // Together AI — OpenAI-compatible API
  const togetherKey = resolveConfigValue("TOGETHER_API_KEY");
  if (togetherKey) {
    configs.push({ type: "openai", providerName: "together", apiKey: togetherKey, baseUrl: "https://api.together.xyz/v1", model: "together-llama-3.3-70b" });
  }

  // Fireworks AI — OpenAI-compatible API
  const fireworksKey = resolveConfigValue("FIREWORKS_API_KEY");
  if (fireworksKey) {
    configs.push({ type: "openai", providerName: "fireworks", apiKey: fireworksKey, baseUrl: "https://api.fireworks.ai/inference/v1", model: "fireworks-llama-3.3-70b" });
  }

  // Perplexity — OpenAI-compatible API
  const perplexityKey = resolveConfigValue("PERPLEXITY_API_KEY");
  if (perplexityKey) {
    configs.push({ type: "openai", providerName: "perplexity", apiKey: perplexityKey, baseUrl: "https://api.perplexity.ai", model: "llama-3.1-sonar-large-128k-online" });
  }

  // OpenRouter — OpenAI-compatible universal gateway
  const openrouterKey = resolveConfigValue("OPENROUTER_API_KEY");
  if (openrouterKey) {
    configs.push({ type: "openai", providerName: "openrouter", apiKey: openrouterKey, baseUrl: "https://openrouter.ai/api/v1", model: "openrouter-auto" });
  }

  // Zhipu AI (GLM) — OpenAI-compatible API
  const zhipuKey = resolveConfigValue("ZHIPU_API_KEY");
  if (zhipuKey) {
    configs.push({ type: "openai", providerName: "zhipu", apiKey: zhipuKey, baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-plus" });
  }

  // Qwen (DashScope) — OpenAI-compatible API
  const qwenKey = resolveConfigValue("QWEN_API_KEY");
  if (qwenKey) {
    configs.push({ type: "openai", providerName: "qwen", apiKey: qwenKey, baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-max" });
  }

  // Yi (01.AI) — OpenAI-compatible API
  const yiKey = resolveConfigValue("YI_API_KEY");
  if (yiKey) {
    configs.push({ type: "openai", providerName: "yi", apiKey: yiKey, baseUrl: "https://api.01.ai/v1", model: "yi-large" });
  }

  // DeepSeek (direct API) — OpenAI-compatible
  const deepseekKey = resolveConfigValue("DEEPSEEK_API_KEY");
  if (deepseekKey) {
    configs.push({ type: "openai", providerName: "deepseek", apiKey: deepseekKey, baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat-v3" });
  }

  // DeepInfra — OpenAI-compatible serverless GPU inference
  const deepinfraKey = resolveConfigValue("DEEPINFRA_API_KEY");
  if (deepinfraKey) {
    configs.push({ type: "openai", providerName: "deepinfra", apiKey: deepinfraKey, baseUrl: "https://api.deepinfra.com/v1/openai", model: "meta-llama/Llama-3.3-70B-Instruct" });
  }

  // MiniMax — OpenAI-compatible API for MoE models with long context
  const minimaxKey = resolveConfigValue("MINIMAX_API_KEY");
  if (minimaxKey) {
    configs.push({ type: "openai", providerName: "minimax", apiKey: minimaxKey, baseUrl: "https://api.minimax.chat/v1", model: "MiniMax-Text-01" });
  }

  // ModelScope — OpenAI-compatible API for open-source models
  const modelscopeKey = resolveConfigValue("MODELSCOPE_API_KEY");
  if (modelscopeKey) {
    configs.push({ type: "openai", providerName: "modelscope", apiKey: modelscopeKey, baseUrl: "https://api-inference.modelscope.cn/v1", model: "Qwen/Qwen2.5-72B-Instruct" });
  }

  return configs;
}

/** Resolve the active provider mode. Falls back to mock when no keys are set. */
export function providerMode(): ProviderType | "mock" {
  const configs = getProviderConfigs();
  if (configs.length === 0) return "mock";

  if (config.LLM_PROVIDER !== "auto") {
    return config.LLM_PROVIDER as ProviderType;
  }

  // Auto: return first available provider type
  return configs[0].type;
}

/**
 * Mapping of provider identifiers to their env-var key names and display labels.
 * Used by the runtime configuration API and the settings UI.
 */
export interface ProviderKeySpec {
  envVar: keyof Env;
  label: string;
  category: "llm" | "image" | "video" | "audio" | "3d" | "embedding";
  baseUrl?: string;
  defaultModel?: string;
}

export const PROVIDER_KEY_SPECS: ProviderKeySpec[] = [
  // Core LLM providers
  { envVar: "OPENAI_API_KEY", label: "OpenAI", category: "llm", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini" },
  { envVar: "ANTHROPIC_API_KEY", label: "Anthropic", category: "llm", baseUrl: "https://api.anthropic.com/v1", defaultModel: "claude-sonnet-4-20250514" },
  { envVar: "GEMINI_API_KEY", label: "Google Gemini", category: "llm", baseUrl: "https://generativelanguage.googleapis.com/v1beta", defaultModel: "gemini-2.0-flash" },
  { envVar: "XAI_API_KEY", label: "xAI (Grok)", category: "llm", baseUrl: "https://api.x.ai/v1", defaultModel: "grok-3" },
  { envVar: "MISTRAL_API_KEY", label: "Mistral AI", category: "llm", baseUrl: "https://api.mistral.ai/v1", defaultModel: "mistral-large-2411" },
  { envVar: "COHERE_API_KEY", label: "Cohere", category: "llm", baseUrl: "https://api.cohere.ai/v2", defaultModel: "command-r-plus-08-2024" },
  { envVar: "GROQ_API_KEY", label: "Groq", category: "llm", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "groq-llama-3.3-70b" },
  { envVar: "TOGETHER_API_KEY", label: "Together AI", category: "llm", baseUrl: "https://api.together.xyz/v1", defaultModel: "together-llama-3.3-70b" },
  { envVar: "FIREWORKS_API_KEY", label: "Fireworks AI", category: "llm", baseUrl: "https://api.fireworks.ai/inference/v1", defaultModel: "fireworks-llama-3.3-70b" },
  { envVar: "PERPLEXITY_API_KEY", label: "Perplexity", category: "llm", baseUrl: "https://api.perplexity.ai", defaultModel: "llama-3.1-sonar-large-128k-online" },
  { envVar: "OPENROUTER_API_KEY", label: "OpenRouter", category: "llm", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openrouter-auto" },
  { envVar: "ZHIPU_API_KEY", label: "Zhipu (GLM)", category: "llm", baseUrl: "https://open.bigmodel.cn/api/paas/v4", defaultModel: "glm-4-plus" },
  { envVar: "QWEN_API_KEY", label: "Qwen (DashScope)", category: "llm", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-max" },
  { envVar: "YI_API_KEY", label: "Yi (01.AI)", category: "llm", baseUrl: "https://api.01.ai/v1", defaultModel: "yi-large" },
  { envVar: "DEEPSEEK_API_KEY", label: "DeepSeek", category: "llm", baseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat-v3" },
  // Image generation
  { envVar: "STABILITY_API_KEY", label: "Stability AI", category: "image" },
  { envVar: "FLUX_API_KEY", label: "Flux", category: "image" },
  { envVar: "IDEOGRAM_API_KEY", label: "Ideogram", category: "image" },
  { envVar: "LEONARDO_API_KEY", label: "Leonardo AI", category: "image" },
  { envVar: "RECRAFT_API_KEY", label: "Recraft", category: "image" },
  { envVar: "REPLICATE_API_KEY", label: "Replicate", category: "image" },
  // Video generation
  { envVar: "RUNWAY_API_KEY", label: "Runway", category: "video" },
  { envVar: "LUMA_API_KEY", label: "Luma AI", category: "video" },
  { envVar: "PIKA_API_KEY", label: "Pika", category: "video" },
  { envVar: "KLING_API_KEY", label: "Kling", category: "video" },
  { envVar: "HAILUO_API_KEY", label: "Hailuo", category: "video" },
  // Audio / speech
  { envVar: "ELEVENLABS_API_KEY", label: "ElevenLabs", category: "audio" },
  { envVar: "SUNO_API_KEY", label: "Suno", category: "audio" },
  { envVar: "ASSEMBLYAI_API_KEY", label: "AssemblyAI", category: "audio" },
  { envVar: "PLAYHT_API_KEY", label: "PlayHT", category: "audio" },
  { envVar: "CARTESIA_API_KEY", label: "Cartesia", category: "audio" },
  // 3D generation
  { envVar: "MESHY_API_KEY", label: "Meshy", category: "3d" },
  { envVar: "TRIPO_API_KEY", label: "Tripo", category: "3d" },
  // Embedding
  { envVar: "VOYAGE_API_KEY", label: "Voyage AI", category: "embedding" },
  // Additional
  { envVar: "FAL_API_KEY", label: "Fal AI", category: "image" },
  { envVar: "DEEPINFRA_API_KEY", label: "DeepInfra", category: "llm", baseUrl: "https://api.deepinfra.com/v1/openai", defaultModel: "meta-llama/Llama-3.3-70B-Instruct" },
  { envVar: "MINIMAX_API_KEY", label: "MiniMax", category: "llm", baseUrl: "https://api.minimax.chat/v1", defaultModel: "MiniMax-Text-01" },
  { envVar: "MODELSCOPE_API_KEY", label: "ModelScope", category: "llm", baseUrl: "https://api-inference.modelscope.cn/v1", defaultModel: "Qwen/Qwen2.5-72B-Instruct" },
  { envVar: "BAAI_API_KEY", label: "BAAI", category: "embedding" },
];

/**
 * Update provider API keys at runtime. Accepts a partial map of env-var
 * name to key value. Empty string clears the key.
 */
export function updateProviderKeys(updates: Partial<Record<string, string>>): void {
  for (const [key, value] of Object.entries(updates)) {
    runtimeKeyOverrides[key] = value || undefined;
  }
}

/**
 * Update the LLM provider mode at runtime. Stored in runtimeKeyOverrides
 * so all config.LLM_PROVIDER reads pick up the new value.
 */
export function updateLLMProviderMode(mode: string): void {
  runtimeKeyOverrides["LLM_PROVIDER"] = mode;
}

/**
 * Return the effective LLM provider mode (runtime override or env default).
 */
export function getLLMProviderMode(): string {
  return config.LLM_PROVIDER;
}

/**
 * Resolve a config value: runtime override takes precedence, then env var.
 */
function resolveConfigValue(key: string): string | undefined {
  return (config as Record<string, unknown>)[key] as string | undefined;
}

/**
 * Return the current key status for all provider specs (without revealing values).
 */
export function getProviderKeyStatus(): Array<{
  envVar: string;
  label: string;
  category: string;
  configured: boolean;
}> {
  return PROVIDER_KEY_SPECS.map((spec) => ({
    envVar: String(spec.envVar),
    label: spec.label,
    category: spec.category,
    configured: Boolean(resolveConfigValue(String(spec.envVar))),
  }));
}

export const publicBaseUrl = () =>
  config.PUBLIC_BASE_URL || `http://localhost:${config.PORT}`;
