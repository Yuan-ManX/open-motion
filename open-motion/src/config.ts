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

export const config = loadEnv();

export const VERSION = "0.1.0";

/** Available provider types in the system. */
export type ProviderType = "openai" | "anthropic" | "gemini" | "ollama" | "mock";

/** Provider configuration map resolved from environment. */
export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  baseUrl: string;
  model: string;
}

/** Resolve all configured providers from environment variables. */
export function getProviderConfigs(): ProviderConfig[] {
  const configs: ProviderConfig[] = [];

  // OpenAI-compatible (also covers DeepSeek, Mistral, Together via OPENAI_BASE_URL)
  if (config.OPENAI_API_KEY || config.LLM_API_KEY) {
    configs.push({
      type: "openai",
      apiKey: config.OPENAI_API_KEY || config.LLM_API_KEY,
      baseUrl: (config.OPENAI_BASE_URL || config.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
      model: config.MODEL || config.LLM_MODEL || "gpt-4o-mini",
    });
  }

  // Anthropic
  if (config.ANTHROPIC_API_KEY) {
    configs.push({
      type: "anthropic",
      apiKey: config.ANTHROPIC_API_KEY,
      baseUrl: (config.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1").replace(/\/$/, ""),
      model: config.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    });
  }

  // Google Gemini
  if (config.GEMINI_API_KEY) {
    configs.push({
      type: "gemini",
      apiKey: config.GEMINI_API_KEY,
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
  if (config.XAI_API_KEY) {
    configs.push({
      type: "openai",
      apiKey: config.XAI_API_KEY,
      baseUrl: "https://api.x.ai/v1",
      model: "grok-3",
    });
  }

  // Mistral AI — OpenAI-compatible API
  if (config.MISTRAL_API_KEY) {
    configs.push({
      type: "openai",
      apiKey: config.MISTRAL_API_KEY,
      baseUrl: "https://api.mistral.ai/v1",
      model: "mistral-large-2411",
    });
  }

  // Cohere — OpenAI-compatible API
  if (config.COHERE_API_KEY) {
    configs.push({
      type: "openai",
      apiKey: config.COHERE_API_KEY,
      baseUrl: "https://api.cohere.ai/v2",
      model: "command-r-plus-08-2024",
    });
  }

  // Groq — OpenAI-compatible API
  if (config.GROQ_API_KEY) {
    configs.push({
      type: "openai",
      apiKey: config.GROQ_API_KEY,
      baseUrl: "https://api.groq.com/openai/v1",
      model: "groq-llama-3.3-70b",
    });
  }

  // Together AI — OpenAI-compatible API
  if (config.TOGETHER_API_KEY) {
    configs.push({
      type: "openai",
      apiKey: config.TOGETHER_API_KEY,
      baseUrl: "https://api.together.xyz/v1",
      model: "together-llama-3.3-70b",
    });
  }

  // Fireworks AI — OpenAI-compatible API
  if (config.FIREWORKS_API_KEY) {
    configs.push({
      type: "openai",
      apiKey: config.FIREWORKS_API_KEY,
      baseUrl: "https://api.fireworks.ai/inference/v1",
      model: "fireworks-llama-3.3-70b",
    });
  }

  // Perplexity — OpenAI-compatible API
  if (config.PERPLEXITY_API_KEY) {
    configs.push({
      type: "openai",
      apiKey: config.PERPLEXITY_API_KEY,
      baseUrl: "https://api.perplexity.ai",
      model: "llama-3.1-sonar-large-128k-online",
    });
  }

  // OpenRouter — OpenAI-compatible universal gateway
  if (config.OPENROUTER_API_KEY) {
    configs.push({
      type: "openai",
      apiKey: config.OPENROUTER_API_KEY,
      baseUrl: "https://openrouter.ai/api/v1",
      model: "openrouter-auto",
    });
  }

  // Zhipu AI (GLM) — OpenAI-compatible API
  if (config.ZHIPU_API_KEY) {
    configs.push({
      type: "openai",
      apiKey: config.ZHIPU_API_KEY,
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      model: "glm-4-plus",
    });
  }

  // Qwen (DashScope) — OpenAI-compatible API
  if (config.QWEN_API_KEY) {
    configs.push({
      type: "openai",
      apiKey: config.QWEN_API_KEY,
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen-max",
    });
  }

  // Yi (01.AI) — OpenAI-compatible API
  if (config.YI_API_KEY) {
    configs.push({
      type: "openai",
      apiKey: config.YI_API_KEY,
      baseUrl: "https://api.01.ai/v1",
      model: "yi-large",
    });
  }

  // DeepSeek (direct API) — OpenAI-compatible
  if (config.DEEPSEEK_API_KEY) {
    configs.push({
      type: "openai",
      apiKey: config.DEEPSEEK_API_KEY,
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat-v3",
    });
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

export const publicBaseUrl = () =>
  config.PUBLIC_BASE_URL || `http://localhost:${config.PORT}`;
