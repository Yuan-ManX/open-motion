import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(7000),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  MODEL: z.string().optional(),
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

/** Provider in use: real OpenAI-compatible when a key is set, else offline mock. */
export function providerMode(): "mock" | "openai" {
  return config.OPENAI_API_KEY ? "openai" : "mock";
}

export const publicBaseUrl = () =>
  config.PUBLIC_BASE_URL || `http://localhost:${config.PORT}`;
