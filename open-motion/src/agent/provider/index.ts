import { providerMode } from "../../config.js";
import { logger } from "../../utils/logger.js";
import { MockProvider } from "./mock.js";
import type { LlmProvider } from "./types.js";

let instance: LlmProvider | null = null;

/**
 * Resolve the active LLM provider. With OPENAI_API_KEY set, the OpenAI-compatible
 * provider drives the loop; otherwise the offline Mock simulates the full
 * tool-calling cycle so the platform runs with zero configuration.
 */
export async function getProvider(): Promise<LlmProvider> {
  if (instance) return instance;
  instance = await createProvider();
  return instance;
}

async function createProvider(): Promise<LlmProvider> {
  const mode = providerMode();
  if (mode === "openai") {
    try {
      const mod = await import("./openai.js");
      logger.info("LLM provider: openai-compatible");
      return new mod.OpenAIProvider();
    } catch (err) {
      logger.warn("OpenAI provider unavailable, falling back to mock", { err: String(err) });
      return new MockProvider();
    }
  }
  logger.info("LLM provider: mock (offline)");
  return new MockProvider();
}

/** Test hook: force a fresh provider resolution on the next getProvider() call. */
export function resetProvider(): void {
  instance = null;
}
