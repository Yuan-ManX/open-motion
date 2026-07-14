import type { ProviderType } from "../../config.js";

/** Modality flags describing what a model can do. */
export interface ModelCapabilities {
  text: boolean;
  vision: boolean;
  audioInput: boolean;
  audioOutput: boolean;
  imageGeneration: boolean;
  videoGeneration: boolean;
  code: boolean;
  toolUse: boolean;
  streaming: boolean;
  reasoning: boolean;
}

/** Modality categories for generation models. */
export type GenerationModality =
  | "text-to-image"
  | "text-to-video"
  | "text-to-audio"
  | "text-to-music"
  | "text-to-3d"
  | "text-to-speech"
  | "speech-to-text"
  | "image-to-video"
  | "image-to-image"
  | "image-editing";

/** Additional provider names beyond ProviderType for specialized generation APIs. */
export type ExtendedProvider =
  | ProviderType
  | "stability" | "elevenlabs" | "runway" | "midjourney" | "pika" | "sora"
  | "luma" | "meshy" | "tripo"
  | "xai" | "mistral" | "cohere" | "groq" | "together" | "fireworks"
  | "perplexity" | "openrouter" | "zhipu" | "qwen" | "yi" | "deepseek"
  | "flux" | "ideogram" | "suno" | "assemblyai" | "replicate";

/** A model entry in the registry. */
export interface ModelEntry {
  id: string;
  name: string;
  provider: ExtendedProvider;
  contextWindow?: number;
  capabilities: ModelCapabilities;
  generationModality?: GenerationModality;
  description: string;
}

/** Comprehensive catalog of all supported models. */
export const MODEL_REGISTRY: ModelEntry[] = [
  // --- OpenAI ---
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    contextWindow: 128000,
    capabilities: { text: true, vision: true, audioInput: true, audioOutput: true, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "Multimodal flagship with vision, audio, and native tool calling",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o mini",
    provider: "openai",
    contextWindow: 128000,
    capabilities: { text: true, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Affordable multimodal model with vision support",
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai",
    contextWindow: 128000,
    capabilities: { text: true, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "High-performance text and vision model",
  },
  {
    id: "o1",
    name: "o1",
    provider: "openai",
    contextWindow: 200000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: false, streaming: false, reasoning: true },
    description: "Deep reasoning model for complex problem solving",
  },
  {
    id: "o3-mini",
    name: "o3-mini",
    provider: "openai",
    contextWindow: 200000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "Fast reasoning model with tool support",
  },
  {
    id: "dall-e-3",
    name: "DALL-E 3",
    provider: "openai",
    capabilities: { text: false, vision: false, audioInput: false, audioOutput: false, imageGeneration: true, videoGeneration: false, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-image",
    description: "High-quality text-to-image generation",
  },
  {
    id: "dall-e-2",
    name: "DALL-E 2",
    provider: "openai",
    capabilities: { text: false, vision: false, audioInput: false, audioOutput: false, imageGeneration: true, videoGeneration: false, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-image",
    description: "Versatile image generation and editing",
  },
  {
    id: "tts-1",
    name: "TTS-1",
    provider: "openai",
    capabilities: { text: false, vision: false, audioInput: false, audioOutput: true, imageGeneration: false, videoGeneration: false, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-speech",
    description: "Natural text-to-speech synthesis",
  },
  {
    id: "whisper-1",
    name: "Whisper",
    provider: "openai",
    capabilities: { text: true, vision: false, audioInput: true, audioOutput: false, imageGeneration: false, videoGeneration: false, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "speech-to-text",
    description: "Multilingual speech recognition",
  },
  {
    id: "sora",
    name: "Sora",
    provider: "sora",
    capabilities: { text: false, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: true, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-video",
    description: "Cinematic text-to-video generation",
  },

  // --- Anthropic ---
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    contextWindow: 200000,
    capabilities: { text: true, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "Balanced performance and speed with vision and tool use",
  },
  {
    id: "claude-opus-4-20250514",
    name: "Claude Opus 4",
    provider: "anthropic",
    contextWindow: 200000,
    capabilities: { text: true, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "Frontier intelligence for complex tasks",
  },
  {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    contextWindow: 200000,
    capabilities: { text: true, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Fast and affordable model with vision",
  },

  // --- Google Gemini ---
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "gemini",
    contextWindow: 1000000,
    capabilities: { text: true, vision: true, audioInput: true, audioOutput: true, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "Fast multimodal model with 1M context and native audio",
  },
  {
    id: "gemini-2.0-pro",
    name: "Gemini 2.0 Pro",
    provider: "gemini",
    contextWindow: 2000000,
    capabilities: { text: true, vision: true, audioInput: true, audioOutput: true, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "Most capable Gemini model with 2M context",
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "gemini",
    contextWindow: 2000000,
    capabilities: { text: true, vision: true, audioInput: true, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "Long-context multimodal model",
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    provider: "gemini",
    contextWindow: 1000000,
    capabilities: { text: true, vision: true, audioInput: true, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Fast and lightweight multimodal model",
  },

  // --- Ollama (local open-source models) ---
  {
    id: "llama3.2",
    name: "Llama 3.2",
    provider: "ollama",
    contextWindow: 128000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Meta's open model with tool calling support",
  },
  {
    id: "llama3.2-vision",
    name: "Llama 3.2 Vision",
    provider: "ollama",
    contextWindow: 128000,
    capabilities: { text: true, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Meta's multimodal vision-language model",
  },
  {
    id: "qwen2.5",
    name: "Qwen 2.5",
    provider: "ollama",
    contextWindow: 32000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Alibaba's multilingual model",
  },
  {
    id: "mistral-nemo",
    name: "Mistral Nemo",
    provider: "ollama",
    contextWindow: 128000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Mistral's multilingual 12B model",
  },
  {
    id: "phi3.5",
    name: "Phi 3.5",
    provider: "ollama",
    contextWindow: 128000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: false, streaming: true, reasoning: false },
    description: "Microsoft's compact model",
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    provider: "ollama",
    contextWindow: 64000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: false, streaming: true, reasoning: true },
    description: "Open reasoning model",
  },
  {
    id: "gemma2",
    name: "Gemma 2",
    provider: "ollama",
    contextWindow: 8000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: false, streaming: true, reasoning: false },
    description: "Google's open model",
  },

  // --- OpenAI-compatible cloud providers ---
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    provider: "openai",
    contextWindow: 64000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "DeepSeek's chat model (OpenAI-compatible API)",
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek Reasoner",
    provider: "openai",
    contextWindow: 64000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: false, streaming: true, reasoning: true },
    description: "DeepSeek's reasoning model",
  },
  {
    id: "mistral-large-latest",
    name: "Mistral Large",
    provider: "openai",
    contextWindow: 128000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "Mistral's flagship model",
  },
  {
    id: "mixtral-8x7b",
    name: "Mixtral 8x7B",
    provider: "openai",
    contextWindow: 32000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Mixture-of-experts model",
  },
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B (Groq)",
    provider: "openai",
    contextWindow: 128000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Fast inference via Groq",
  },
  {
    id: "qwen2.5-72b-instruct",
    name: "Qwen 2.5 72B (Together)",
    provider: "openai",
    contextWindow: 32000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Large Qwen model via Together AI",
  },

  // --- Stability AI (image generation) ---
  {
    id: "stable-diffusion-3",
    name: "Stable Diffusion 3",
    provider: "stability",
    capabilities: { text: false, vision: false, audioInput: false, audioOutput: false, imageGeneration: true, videoGeneration: false, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-image",
    description: "State-of-the-art open image generation",
  },
  {
    id: "stable-image-ultra",
    name: "Stable Image Ultra",
    provider: "stability",
    capabilities: { text: false, vision: false, audioInput: false, audioOutput: false, imageGeneration: true, videoGeneration: false, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-image",
    description: "Highest quality Stability image model",
  },

  // --- ElevenLabs (audio generation) ---
  {
    id: "eleven-multilingual-v2",
    name: "ElevenLabs Multilingual v2",
    provider: "elevenlabs",
    capabilities: { text: false, vision: false, audioInput: false, audioOutput: true, imageGeneration: false, videoGeneration: false, code: false, toolUse: false, streaming: true, reasoning: false },
    generationModality: "text-to-speech",
    description: "Multilingual voice synthesis",
  },
  {
    id: "eleven-turbo-v2",
    name: "ElevenLabs Turbo v2",
    provider: "elevenlabs",
    capabilities: { text: false, vision: false, audioInput: false, audioOutput: true, imageGeneration: false, videoGeneration: false, code: false, toolUse: false, streaming: true, reasoning: false },
    generationModality: "text-to-speech",
    description: "Low-latency voice synthesis",
  },

  // --- Runway (video generation) ---
  {
    id: "gen-3-alpha",
    name: "Runway Gen-3 Alpha",
    provider: "runway",
    capabilities: { text: false, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: true, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-video",
    description: "High-fidelity text-to-video generation",
  },
  {
    id: "gen-3-image-to-video",
    name: "Runway Image to Video",
    provider: "runway",
    capabilities: { text: false, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: true, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "image-to-video",
    description: "Animate a static image into video",
  },

  // --- Luma (video generation) ---
  {
    id: "luma-dream-machine",
    name: "Luma Dream Machine",
    provider: "luma",
    capabilities: { text: false, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: true, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-video",
    description: "Realistic video generation from text or images",
  },

  // --- Pika (video generation) ---
  {
    id: "pika-1.5",
    name: "Pika 1.5",
    provider: "pika",
    capabilities: { text: false, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: true, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-video",
    description: "Creative video generation with effects",
  },

  // --- Meshy (3D generation) ---
  {
    id: "meshy-text-to-3d-v2",
    name: "Meshy Text to 3D v2",
    provider: "meshy",
    capabilities: { text: false, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-3d",
    description: "Generate 3D models from text descriptions",
  },
  {
    id: "meshy-image-to-3d",
    name: "Meshy Image to 3D",
    provider: "meshy",
    capabilities: { text: false, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-3d",
    description: "Convert a 2D image into a 3D model",
  },

  // --- Tripo (3D generation) ---
  {
    id: "tripo-text-to-3d",
    name: "Tripo Text to 3D",
    provider: "tripo",
    capabilities: { text: false, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-3d",
    description: "Fast text-to-3D model generation",
  },
  {
    id: "tripo-image-to-3d",
    name: "Tripo Image to 3D",
    provider: "tripo",
    capabilities: { text: false, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-3d",
    description: "Single image to 3D model conversion",
  },

  // --- Newer LLM models ---
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    contextWindow: 1000000,
    capabilities: { text: true, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "Latest GPT model with 1M context and vision",
  },
  {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 mini",
    provider: "openai",
    contextWindow: 1000000,
    capabilities: { text: true, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Compact GPT-4.1 with 1M context",
  },
  {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 nano",
    provider: "openai",
    contextWindow: 1000000,
    capabilities: { text: true, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Smallest GPT-4.1 variant for low-latency tasks",
  },
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet (new)",
    provider: "anthropic",
    contextWindow: 200000,
    capabilities: { text: true, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "Latest Claude 3.5 Sonnet with computer use",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "gemini",
    contextWindow: 2000000,
    capabilities: { text: true, vision: true, audioInput: true, audioOutput: true, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "Next-gen Gemini with 2M context and native audio",
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "gemini",
    contextWindow: 1000000,
    capabilities: { text: true, vision: true, audioInput: true, audioOutput: true, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "Fast next-gen Gemini with reasoning",
  },

  // --- Additional open-source models ---
  {
    id: "qwen2.5-coder",
    name: "Qwen 2.5 Coder",
    provider: "ollama",
    contextWindow: 32000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Code-specialized Qwen model",
  },
  {
    id: "llama3.3",
    name: "Llama 3.3",
    provider: "ollama",
    contextWindow: 128000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Meta's latest open model",
  },
  {
    id: "deepseek-v3",
    name: "DeepSeek V3",
    provider: "openai",
    contextWindow: 64000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "DeepSeek V3 via OpenAI-compatible API",
  },

  // --- xAI (Grok) ---
  {
    id: "grok-3",
    name: "Grok 3",
    provider: "xai",
    contextWindow: 131072,
    capabilities: { text: true, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "xAI's frontier model with vision and reasoning",
  },
  {
    id: "grok-3-mini",
    name: "Grok 3 Mini",
    provider: "xai",
    contextWindow: 131072,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "Compact Grok with fast reasoning",
  },
  {
    id: "grok-2-vision",
    name: "Grok 2 Vision",
    provider: "xai",
    contextWindow: 32768,
    capabilities: { text: true, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: false, streaming: true, reasoning: false },
    description: "Grok 2 with multimodal vision support",
  },

  // --- Mistral AI (direct API) ---
  {
    id: "mistral-large-2411",
    name: "Mistral Large 2",
    provider: "mistral",
    contextWindow: 128000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "Mistral's flagship model with tool calling",
  },
  {
    id: "codestral-2501",
    name: "Codestral",
    provider: "mistral",
    contextWindow: 256000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Code-specialized model with 256K context",
  },
  {
    id: "pixtral-large-2411",
    name: "Pixtral Large",
    provider: "mistral",
    contextWindow: 128000,
    capabilities: { text: true, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Mistral's multimodal vision-language model",
  },

  // --- Cohere ---
  {
    id: "command-r-plus-08-2024",
    name: "Command R+",
    provider: "cohere",
    contextWindow: 128000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Cohere's scalable model for RAG and tool use",
  },
  {
    id: "command-r-08-2024",
    name: "Command R",
    provider: "cohere",
    contextWindow: 128000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Cohere's efficient model for production workloads",
  },

  // --- Perplexity ---
  {
    id: "llama-3.1-sonar-large-128k-online",
    name: "Sonar Large Online",
    provider: "perplexity",
    contextWindow: 127072,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: false, streaming: true, reasoning: false },
    description: "Perplexity's online model with real-time web search",
  },
  {
    id: "llama-3.1-sonar-huge-128k-online",
    name: "Sonar Huge Online",
    provider: "perplexity",
    contextWindow: 127072,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: false, streaming: true, reasoning: false },
    description: "Perplexity's largest model with web access",
  },

  // --- Groq (fast inference) ---
  {
    id: "groq-llama-3.3-70b",
    name: "Llama 3.3 70B (Groq)",
    provider: "groq",
    contextWindow: 128000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Ultra-fast Llama 3.3 inference on Groq hardware",
  },
  {
    id: "groq-qwen-2.5-32b",
    name: "Qwen 2.5 32B (Groq)",
    provider: "groq",
    contextWindow: 128000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Fast Qwen inference via Groq",
  },

  // --- Together AI ---
  {
    id: "together-llama-3.3-70b",
    name: "Llama 3.3 70B (Together)",
    provider: "together",
    contextWindow: 131072,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Llama 3.3 hosted on Together AI",
  },
  {
    id: "together-qwen-2.5-coder-32b",
    name: "Qwen 2.5 Coder 32B (Together)",
    provider: "together",
    contextWindow: 32768,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Code model on Together AI",
  },

  // --- Fireworks AI ---
  {
    id: "fireworks-llama-3.3-70b",
    name: "Llama 3.3 70B (Fireworks)",
    provider: "fireworks",
    contextWindow: 131072,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Llama 3.3 on Fireworks AI",
  },
  {
    id: "fireworks-deepseek-v3",
    name: "DeepSeek V3 (Fireworks)",
    provider: "fireworks",
    contextWindow: 64000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "DeepSeek V3 on Fireworks AI",
  },

  // --- OpenRouter (universal gateway) ---
  {
    id: "openrouter-auto",
    name: "OpenRouter Auto",
    provider: "openrouter",
    contextWindow: 128000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "OpenRouter's automatic model selection",
  },

  // --- Zhipu AI (GLM) ---
  {
    id: "glm-4-plus",
    name: "GLM-4-Plus",
    provider: "zhipu",
    contextWindow: 128000,
    capabilities: { text: true, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "Zhipu AI's flagship model with vision",
  },
  {
    id: "glm-4-flash",
    name: "GLM-4-Flash",
    provider: "zhipu",
    contextWindow: 128000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Fast and free GLM-4 variant",
  },

  // --- Qwen (DashScope) ---
  {
    id: "qwen-max",
    name: "Qwen Max",
    provider: "qwen",
    contextWindow: 32768,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: true },
    description: "Alibaba's most capable Qwen model",
  },
  {
    id: "qwen-plus",
    name: "Qwen Plus",
    provider: "qwen",
    contextWindow: 131072,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Balanced Qwen model with long context",
  },
  {
    id: "qwen-vl-max",
    name: "Qwen VL Max",
    provider: "qwen",
    contextWindow: 32768,
    capabilities: { text: true, vision: true, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "Qwen vision-language model",
  },

  // --- Yi (01.AI) ---
  {
    id: "yi-large",
    name: "Yi Large",
    provider: "yi",
    contextWindow: 32768,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "01.AI's flagship model",
  },

  // --- DeepSeek (direct API) ---
  {
    id: "deepseek-chat-v3",
    name: "DeepSeek Chat V3",
    provider: "deepseek",
    contextWindow: 64000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: true, streaming: true, reasoning: false },
    description: "DeepSeek V3 via direct API",
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    provider: "deepseek",
    contextWindow: 64000,
    capabilities: { text: true, vision: false, audioInput: false, audioOutput: false, imageGeneration: false, videoGeneration: false, code: true, toolUse: false, streaming: true, reasoning: true },
    description: "DeepSeek's reasoning model via direct API",
  },

  // --- Flux (image generation) ---
  {
    id: "flux-1.1-pro",
    name: "Flux 1.1 Pro",
    provider: "flux",
    capabilities: { text: false, vision: false, audioInput: false, audioOutput: false, imageGeneration: true, videoGeneration: false, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-image",
    description: "Black Forest Labs' professional image generation model",
  },
  {
    id: "flux-dev",
    name: "Flux Dev",
    provider: "flux",
    capabilities: { text: false, vision: false, audioInput: false, audioOutput: false, imageGeneration: true, videoGeneration: false, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-image",
    description: "Open-source Flux model for development",
  },

  // --- Ideogram (image generation) ---
  {
    id: "ideogram-v2",
    name: "Ideogram v2",
    provider: "ideogram",
    capabilities: { text: false, vision: false, audioInput: false, audioOutput: false, imageGeneration: true, videoGeneration: false, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-image",
    description: "Superior text rendering in generated images",
  },

  // --- Suno (music generation) ---
  {
    id: "suno-v4",
    name: "Suno v4",
    provider: "suno",
    capabilities: { text: false, vision: false, audioInput: false, audioOutput: true, imageGeneration: false, videoGeneration: false, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-music",
    description: "Full-song generation with vocals and instrumentation",
  },
  {
    id: "suno-v3.5",
    name: "Suno v3.5",
    provider: "suno",
    capabilities: { text: false, vision: false, audioInput: false, audioOutput: true, imageGeneration: false, videoGeneration: false, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-music",
    description: "Previous generation Suno music model",
  },

  // --- AssemblyAI (speech-to-text) ---
  {
    id: "assemblyai-best",
    name: "AssemblyAI Best",
    provider: "assemblyai",
    capabilities: { text: true, vision: false, audioInput: true, audioOutput: false, imageGeneration: false, videoGeneration: false, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "speech-to-text",
    description: "High-accuracy speech-to-text with speaker detection",
  },

  // --- Replicate (multi-model gateway) ---
  {
    id: "replicate-flux-schnell",
    name: "Flux Schnell (Replicate)",
    provider: "replicate",
    capabilities: { text: false, vision: false, audioInput: false, audioOutput: false, imageGeneration: true, videoGeneration: false, code: false, toolUse: false, streaming: false, reasoning: false },
    generationModality: "text-to-image",
    description: "Fast Flux variant via Replicate",
  },
];

/** Find a model by ID. */
export function findModel(id: string): ModelEntry | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

/** List all models for a given provider. */
export function modelsByProvider(provider: string): ModelEntry[] {
  return MODEL_REGISTRY.filter((m) => m.provider === provider);
}

/** List all models that support a specific capability. */
export function modelsByCapability<K extends keyof ModelCapabilities>(
  capability: K,
): ModelEntry[] {
  return MODEL_REGISTRY.filter((m) => m.capabilities[capability]);
}

/** List all generation models for a modality. */
export function modelsByModality(modality: GenerationModality): ModelEntry[] {
  return MODEL_REGISTRY.filter((m) => m.generationModality === modality);
}

/** Get all unique provider names from the registry. */
export function getAllProviders(): string[] {
  return Array.from(new Set(MODEL_REGISTRY.map((m) => m.provider)));
}
