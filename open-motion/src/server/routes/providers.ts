import { Router } from "express";
import { providerMode, getProviderConfigs, updateProviderKeys, updateLLMProviderMode, getLLMProviderMode, getProviderKeyStatus, PROVIDER_KEY_SPECS, type ProviderConfig } from "../../config.js";
import { listConfiguredProviders, resetProvider } from "../../agent/provider/index.js";
import { MODEL_REGISTRY, getAllProviders, modelsByModality, type GenerationModality } from "../../agent/provider/registry.js";
import { generateMedia, isModalityAvailable, listAvailableModels } from "../../agent/provider/generation.js";
import { getRouter, resetRouter, createProviderInstance } from "../../agent/provider/router.js";
import { runAsync } from "../../utils/async.js";
import { logger } from "../../utils/logger.js";

export const providersRouter = Router();

/**
 * GET /api/providers — list all configured providers and their status.
 */
providersRouter.get("/providers", (_req, res) => {
  res.json({
    mode: providerMode(),
    configured: listConfiguredProviders(),
    configs: getProviderConfigs().map((c) => ({
      type: c.type,
      providerName: c.providerName ?? c.type,
      model: c.model,
      baseUrl: c.baseUrl,
      hasKey: Boolean(c.apiKey),
    })),
  });
});

/**
 * GET /api/providers/models — list all models in the registry.
 * Query: ?provider=openai, ?capability=vision, ?modality=text-to-image
 */
providersRouter.get("/providers/models", (req, res) => {
  const { provider, capability, modality } = req.query;

  let models = MODEL_REGISTRY;

  if (provider) {
    models = models.filter((m) => m.provider === provider);
  }
  if (capability && typeof capability === "string") {
    models = models.filter((m) => m.capabilities[capability as keyof typeof m.capabilities]);
  }
  if (modality && typeof modality === "string") {
    models = models.filter((m) => m.generationModality === modality);
  }

  res.json({
    models: models.map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      contextWindow: m.contextWindow,
      capabilities: m.capabilities,
      generationModality: m.generationModality,
      description: m.description,
      available: m.generationModality ? isModalityAvailable(m.generationModality) : true,
    })),
  });
});

/**
 * GET /api/providers/registry — get all providers and their model counts.
 */
providersRouter.get("/providers/registry", (_req, res) => {
  const providers = getAllProviders().map((p) => ({
    name: p,
    modelCount: MODEL_REGISTRY.filter((m) => m.provider === p).length,
  }));
  res.json({ providers });
});

/**
 * GET /api/providers/health — runtime health metrics for circuit-breaker and latency routing.
 */
providersRouter.get("/providers/health", (_req, res) => {
  const router = getRouter();
  res.json({ providers: router.getHealthStats() });
});

/**
 * GET /api/providers/tokens — cumulative token usage across all providers.
 */
providersRouter.get("/providers/tokens", (_req, res) => {
  const router = getRouter();
  res.json(router.getTokenStats());
});

/**
 * GET /api/providers/modalities — list all generation modalities and availability.
 */
providersRouter.get("/providers/modalities", (_req, res) => {
  const modalities: GenerationModality[] = [
    "text-to-image",
    "text-to-video",
    "text-to-audio",
    "text-to-music",
    "text-to-3d",
    "text-to-speech",
    "speech-to-text",
    "text-to-embedding",
    "text-to-animation",
    "image-to-video",
    "image-to-image",
    "image-editing",
  ];
  res.json({
    modalities: modalities.map((m) => ({
      modality: m,
      available: isModalityAvailable(m),
      models: modelsByModality(m).map((model) => ({ id: model.id, name: model.name, provider: model.provider })),
    })),
  });
});

/**
 * GET /api/providers/keys — list all provider key specs and their configured status.
 */
providersRouter.get("/providers/keys", (_req, res) => {
  res.json({
    specs: PROVIDER_KEY_SPECS.map((s) => ({
      envVar: String(s.envVar),
      label: s.label,
      category: s.category,
      baseUrl: s.baseUrl,
      defaultModel: s.defaultModel,
      configured: Boolean(getProviderKeyStatus().find((k) => k.envVar === String(s.envVar))?.configured),
    })),
  });
});

/**
 * POST /api/providers/configure — update provider API keys at runtime.
 * Body: { keys: { OPENAI_API_KEY: "sk-...", GROQ_API_KEY: "gsk_...", ... } }
 * Empty string clears a key. Resets the router so new keys take effect.
 */
providersRouter.post(
  "/providers/configure",
  runAsync(async (req, res) => {
    const keys = req.body?.keys;
    if (!keys || typeof keys !== "object") {
      res.status(400).json({ error: "keys object is required" });
      return;
    }

    // Filter to only known env-var names to prevent arbitrary mutation
    const allowedVars = new Set(PROVIDER_KEY_SPECS.map((s) => String(s.envVar)));
    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(keys)) {
      if (allowedVars.has(k) && typeof v === "string") {
        filtered[k] = v;
      }
    }

    updateProviderKeys(filtered);

    // Reset provider and router instances so new configs take effect
    resetProvider();
    resetRouter();

    res.json({
      ok: true,
      mode: providerMode(),
      configured: listConfiguredProviders(),
      keyStatus: getProviderKeyStatus(),
    });
  }),
);

/**
 * POST /api/providers/mode — update the LLM provider mode at runtime.
 * Body: { mode: "auto" | "openai" | "anthropic" | "gemini" | "ollama" }
 * Resets the router so the new mode takes effect immediately.
 */
providersRouter.post(
  "/providers/mode",
  runAsync(async (req, res) => {
    const mode = req.body?.mode;
    const allowed = ["auto", "openai", "anthropic", "gemini", "ollama"];
    if (!mode || !allowed.includes(mode)) {
      res.status(400).json({ error: `mode must be one of: ${allowed.join(", ")}` });
      return;
    }
    updateLLMProviderMode(mode);
    resetProvider();
    resetRouter();
    res.json({ ok: true, mode: providerMode(), llmProvider: getLLMProviderMode() });
  }),
);

/**
 * POST /api/providers/test — test a provider connection with a minimal chat request.
 * Body: { providerName: "groq" | "openai" | "anthropic" | ... }
 * Resolves the provider config by name, creates a fresh instance, and sends
 * a one-token "ping" request. Returns latency and any error.
 */
providersRouter.post(
  "/providers/test",
  runAsync(async (req, res) => {
    const providerName = req.body?.providerName;
    if (!providerName || typeof providerName !== "string") {
      res.status(400).json({ error: "providerName is required" });
      return;
    }

    const configs = getProviderConfigs();
    const cfg = configs.find(
      (c) => c.providerName === providerName || c.type === providerName,
    );
    if (!cfg) {
      res.status(404).json({ error: `Provider "${providerName}" is not configured. Set its API key first.` });
      return;
    }

    const start = Date.now();
    try {
      const provider = createProviderInstance(cfg);
      const result = await provider.chat({
        messages: [{ role: "user", content: "ping" }],
        tools: [],
      });
      const latencyMs = Date.now() - start;
      res.json({
        ok: true,
        provider: providerName,
        model: cfg.model,
        latencyMs,
        tokensOut: result.tokensOut,
        response: result.text.slice(0, 200),
      });
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`Provider test failed for "${providerName}"`, { err: message });
      res.json({
        ok: false,
        provider: providerName,
        model: cfg.model,
        latencyMs,
        error: message,
      });
    }
  }),
);

/**
 * POST /api/providers/generate — generate a media asset.
 * Body: { prompt, modality, model?, sourceImage?, negativePrompt?, width?, height?, duration?, voiceId?, n? }
 */
providersRouter.post(
  "/providers/generate",
  runAsync(async (req, res) => {
    const body = req.body ?? {};
    if (!body.prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }
    if (!body.modality) {
      res.status(400).json({ error: "modality is required" });
      return;
    }

    const result = await generateMedia({
      prompt: body.prompt,
      modality: body.modality as GenerationModality,
      model: body.model,
      sourceImage: body.sourceImage,
      negativePrompt: body.negativePrompt,
      width: body.width,
      height: body.height,
      duration: body.duration,
      voiceId: body.voiceId,
      n: body.n,
    });

    res.json(result);
  }),
);
