import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";
import { MODEL_REGISTRY, type GenerationModality, type ModelEntry } from "./registry.js";

/** Result of a generation request. */
export interface GenerationResult {
  modality: GenerationModality;
  model: string;
  provider: string;
  /** URL or base64 data URI of the generated asset. */
  assetUrl: string;
  /** Revised prompt if the provider modified it. */
  revisedPrompt?: string;
  /** Estimated generation duration in ms. */
  durationMs?: number;
}

/** Request for generating a media asset. */
export interface GenerationRequest {
  prompt: string;
  modality: GenerationModality;
  model?: string;
  /** For image-to-video or image-to-image, source image URL or base64. */
  sourceImage?: string;
  /** Negative prompt for image generation. */
  negativePrompt?: string;
  /** Image dimensions. */
  width?: number;
  height?: number;
  /** Video duration in seconds. */
  duration?: number;
  /** Voice ID for TTS. */
  voiceId?: string;
  /** Number of results to generate. */
  n?: number;
}

/** Check if a generation modality is available based on configured API keys. */
export function isModalityAvailable(modality: GenerationModality): boolean {
  switch (modality) {
    case "text-to-image":
    case "image-to-image":
    case "image-editing":
      return Boolean(config.OPENAI_API_KEY || config.STABILITY_API_KEY || config.FLUX_API_KEY || config.IDEOGRAM_API_KEY || config.REPLICATE_API_KEY);
    case "text-to-speech":
      return Boolean(config.OPENAI_API_KEY || config.ELEVENLABS_API_KEY);
    case "speech-to-text":
      return Boolean(config.OPENAI_API_KEY || config.ASSEMBLYAI_API_KEY);
    case "text-to-video":
    case "image-to-video":
      return Boolean(config.RUNWAY_API_KEY || config.LUMA_API_KEY || config.PIKA_API_KEY);
    case "text-to-audio":
      return Boolean(config.OPENAI_API_KEY || config.ELEVENLABS_API_KEY);
    case "text-to-music":
      return Boolean(config.SUNO_API_KEY);
    case "text-to-3d":
      return Boolean(config.MESHY_API_KEY || config.TRIPO_API_KEY);
    default:
      return false;
  }
}

/** Generate a media asset via the appropriate provider. */
export async function generateMedia(req: GenerationRequest): Promise<GenerationResult> {
  const { modality, prompt } = req;

  if (!isModalityAvailable(modality)) {
    logger.warn(`Generation modality ${modality} not configured`, { prompt: prompt.slice(0, 80) });
    return {
      modality,
      model: "unavailable",
      provider: "none",
      assetUrl: "",
    };
  }

  // Select the best provider for this modality
  switch (modality) {
    case "text-to-image":
      return generateImage(req);
    case "text-to-speech":
      return generateSpeech(req);
    case "speech-to-text":
      return transcribeAudio(req);
    case "text-to-video":
    case "image-to-video":
      return generateVideo(req);
    case "text-to-audio":
      return generateAudio(req);
    case "text-to-music":
      return generateMusic(req);
    case "text-to-3d":
      return generate3D(req);
    default:
      throw new Error(`Unsupported generation modality: ${modality}`);
  }
}

/** Generate an image via DALL-E, Stability AI, Flux, Ideogram, or Replicate. */
async function generateImage(req: GenerationRequest): Promise<GenerationResult> {
  const model = req.model ?? "dall-e-3";

  // OpenAI DALL-E
  if (config.OPENAI_API_KEY && (model.startsWith("dall-e") || (!config.STABILITY_API_KEY && !config.FLUX_API_KEY && !config.IDEOGRAM_API_KEY && !config.REPLICATE_API_KEY))) {
    const baseUrl = (config.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const size = req.width && req.height
      ? `${req.width}x${req.height}`
      : "1024x1024";
    const res = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        prompt: req.prompt,
        n: req.n ?? 1,
        size,
        response_format: "url",
      }),
    });
    if (!res.ok) throw new Error(`DALL-E error ${res.status}: ${await res.text()}`);
    const data = await res.json() as { data: Array<{ url?: string; revised_prompt?: string }> };
    return {
      modality: "text-to-image",
      model,
      provider: "openai",
      assetUrl: data.data[0]?.url ?? "",
      revisedPrompt: data.data[0]?.revised_prompt,
    };
  }

  // Stability AI
  if (config.STABILITY_API_KEY && (model.startsWith("stable") || (!config.FLUX_API_KEY && !config.IDEOGRAM_API_KEY && !config.REPLICATE_API_KEY))) {
    const stabilityModel = model.startsWith("stable") ? model : "stable-diffusion-3";
    const formData = new FormData();
    formData.append("prompt", req.prompt);
    formData.append("output_format", "png");
    if (req.negativePrompt) formData.append("negative_prompt", req.negativePrompt);
    if (req.width) formData.append("width", String(req.width));
    if (req.height) formData.append("height", String(req.height));

    const res = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/core`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.STABILITY_API_KEY}`,
        Accept: "image/*",
      },
      body: formData,
    });
    if (!res.ok) throw new Error(`Stability error ${res.status}: ${await res.text()}`);
    const blob = await res.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const dataUri = `data:image/png;base64,${buffer.toString("base64")}`;
    return {
      modality: "text-to-image",
      model: stabilityModel,
      provider: "stability",
      assetUrl: dataUri,
    };
  }

  // Flux (via fal.ai compatible endpoint or direct BFL API)
  if (config.FLUX_API_KEY && (model.startsWith("flux") || (!config.IDEOGRAM_API_KEY && !config.REPLICATE_API_KEY))) {
    const fluxModel = model.startsWith("flux") ? model : "flux-1.1-pro";
    const width = req.width ?? 1024;
    const height = req.height ?? 1024;
    const res = await fetch("https://api.bfl.ai/v1/flux-pro-1.1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.FLUX_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: req.prompt,
        width,
        height,
        prompt_upsampling: true,
      }),
    });
    if (!res.ok) throw new Error(`Flux error ${res.status}: ${await res.text()}`);
    const data = await res.json() as { id?: string; result?: { sample?: string }; image_url?: string };
    // BFL returns a task id; fetch the result
    const taskId = data.id;
    if (taskId) {
      const resultRes = await fetch(`https://api.bfl.ai/v1/get_result?id=${taskId}`, {
        headers: { Authorization: `Bearer ${config.FLUX_API_KEY}` },
      });
      if (resultRes.ok) {
        const resultData = await resultRes.json() as { result?: { sample?: string } };
        if (resultData.result?.sample) {
          return {
            modality: "text-to-image",
            model: fluxModel,
            provider: "flux",
            assetUrl: resultData.result.sample,
          };
        }
      }
    }
    // Fallback to direct URL if provided
    const assetUrl = data.result?.sample ?? data.image_url ?? "";
    return {
      modality: "text-to-image",
      model: fluxModel,
      provider: "flux",
      assetUrl,
    };
  }

  // Ideogram
  if (config.IDEOGRAM_API_KEY && (model.startsWith("ideogram") || !config.REPLICATE_API_KEY)) {
    const ideogramModel = model.startsWith("ideogram") ? model : "ideogram-v2";
    const res = await fetch("https://api.ideogram.ai/v1/ideogram/v3/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.IDEOGRAM_API_KEY}`,
      },
      body: JSON.stringify({
        model: ideogramModel,
        prompt: req.prompt,
        aspect_ratio: req.width && req.height ? `${req.width}:${req.height}` : "1x1",
        magic_prompt_option: "AUTO",
        negative_prompt: req.negativePrompt,
      }),
    });
    if (!res.ok) throw new Error(`Ideogram error ${res.status}: ${await res.text()}`);
    const data = await res.json() as { data?: Array<{ url?: string }> };
    return {
      modality: "text-to-image",
      model: ideogramModel,
      provider: "ideogram",
      assetUrl: data.data?.[0]?.url ?? "",
    };
  }

  // Replicate (Flux schnell and other image models)
  if (config.REPLICATE_API_KEY) {
    const replicateModel = model.startsWith("replicate") ? model : "replicate-flux-schnell";
    const version = "black-forest-labs/flux-schnell";
    const res = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.REPLICATE_API_KEY}`,
        Prefer: "wait",
      },
      body: JSON.stringify({
        version,
        input: {
          prompt: req.prompt,
          width: req.width ?? 1024,
          height: req.height ?? 1024,
          num_outputs: req.n ?? 1,
        },
      }),
    });
    if (!res.ok) throw new Error(`Replicate error ${res.status}: ${await res.text()}`);
    const data = await res.json() as { output?: string | string[]; id?: string };
    const output = Array.isArray(data.output) ? data.output[0] : data.output;
    return {
      modality: "text-to-image",
      model: replicateModel,
      provider: "replicate",
      assetUrl: output ?? "",
    };
  }

  throw new Error("No image generation provider configured");
}

/** Generate speech via OpenAI TTS or ElevenLabs. */
async function generateSpeech(req: GenerationRequest): Promise<GenerationResult> {
  const model = req.model ?? "tts-1";

  // OpenAI TTS
  if (config.OPENAI_API_KEY && (model.startsWith("tts") || !config.ELEVENLABS_API_KEY)) {
    const baseUrl = (config.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const res = await fetch(`${baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        input: req.prompt,
        voice: "alloy",
        response_format: "mp3",
      }),
    });
    if (!res.ok) throw new Error(`TTS error ${res.status}: ${await res.text()}`);
    const blob = await res.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const dataUri = `data:audio/mp3;base64,${buffer.toString("base64")}`;
    return {
      modality: "text-to-speech",
      model,
      provider: "openai",
      assetUrl: dataUri,
    };
  }

  // ElevenLabs
  if (config.ELEVENLABS_API_KEY) {
    const voiceId = req.voiceId || "21m00Tcm4TlvDq8ikWAM";
    const elevenModel = model.startsWith("eleven") ? model : "eleven-multilingual-v2";
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": config.ELEVENLABS_API_KEY,
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: req.prompt,
        model_id: elevenModel,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs error ${res.status}: ${await res.text()}`);
    const blob = await res.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const dataUri = `data:audio/mp3;base64,${buffer.toString("base64")}`;
    return {
      modality: "text-to-speech",
      model: elevenModel,
      provider: "elevenlabs",
      assetUrl: dataUri,
    };
  }

  throw new Error("No speech generation provider configured");
}

/** Transcribe audio via OpenAI Whisper or AssemblyAI. */
async function transcribeAudio(req: GenerationRequest): Promise<GenerationResult> {
  // OpenAI Whisper
  if (config.OPENAI_API_KEY && (!req.model || req.model.startsWith("whisper") || !config.ASSEMBLYAI_API_KEY)) {
    const baseUrl = (config.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const formData = new FormData();
    // For transcription, prompt is the audio URL/data
    formData.append("file", req.prompt);
    formData.append("model", req.model ?? "whisper-1");

    const res = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}` },
      body: formData,
    });
    if (!res.ok) throw new Error(`Whisper error ${res.status}: ${await res.text()}`);
    const data = await res.json() as { text: string };
    return {
      modality: "speech-to-text",
      model: "whisper-1",
      provider: "openai",
      assetUrl: data.text,
    };
  }

  // AssemblyAI
  if (config.ASSEMBLYAI_API_KEY) {
    const model = "assemblyai-best";
    const res = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: config.ASSEMBLYAI_API_KEY,
      },
      body: JSON.stringify({
        audio_url: req.prompt,
        speech_model: "best",
      }),
    });
    if (!res.ok) throw new Error(`AssemblyAI error ${res.status}: ${await res.text()}`);
    const data = await res.json() as { id: string };
    // Poll for completion
    const transcriptId = data.id;
    let transcriptText = "";
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { Authorization: config.ASSEMBLYAI_API_KEY },
      });
      if (!pollRes.ok) continue;
      const pollData = await pollRes.json() as { status: string; text?: string };
      if (pollData.status === "completed") {
        transcriptText = pollData.text ?? "";
        break;
      }
      if (pollData.status === "error") {
        throw new Error(`AssemblyAI transcription failed for ${transcriptId}`);
      }
    }
    return {
      modality: "speech-to-text",
      model,
      provider: "assemblyai",
      assetUrl: transcriptText,
    };
  }

  throw new Error("No transcription provider configured");
}

/** Generate video via Runway, Luma, or Pika. */
async function generateVideo(req: GenerationRequest): Promise<GenerationResult> {
  const isImageToVideo = Boolean(req.sourceImage);
  const modality = isImageToVideo ? "image-to-video" : "text-to-video";

  // Runway Gen-3
  if (config.RUNWAY_API_KEY) {
    const runwayModel = isImageToVideo ? "gen-3-image-to-video" : "gen-3-alpha";
    const body: Record<string, unknown> = {
      promptText: req.prompt,
      model: runwayModel,
      duration: req.duration ?? 5,
    };
    if (req.sourceImage) body.promptImage = req.sourceImage;

    const res = await fetch("https://api.runwayml.com/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.RUNWAY_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Runway error ${res.status}: ${await res.text()}`);
    const data = await res.json() as { task_id: string; output?: string[] };
    // Runway returns a task ID — poll for completion in production
    return {
      modality,
      model: runwayModel,
      provider: "runway",
      assetUrl: data.output?.[0] ?? "",
      durationMs: (req.duration ?? 5) * 1000,
    };
  }

  // Luma Dream Machine
  if (config.LUMA_API_KEY) {
    const body: Record<string, unknown> = {
      prompt: req.prompt,
    };
    if (req.sourceImage) body.keyframes = { frame0: { type: "image", url: req.sourceImage } };

    const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.LUMA_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Luma error ${res.status}: ${await res.text()}`);
    const data = await res.json() as { id: string; assets?: { video?: string } };
    return {
      modality,
      model: "luma-dream-machine",
      provider: "luma",
      assetUrl: data.assets?.video ?? "",
      durationMs: (req.duration ?? 5) * 1000,
    };
  }

  // Pika
  if (config.PIKA_API_KEY) {
    const body: Record<string, unknown> = {
      promptText: req.prompt,
    };
    if (req.sourceImage) body.image = req.sourceImage;

    const res = await fetch("https://api.pika.art/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.PIKA_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Pika error ${res.status}: ${await res.text()}`);
    const data = await res.json() as { videos?: Array<{ url: string }> };
    return {
      modality,
      model: "pika-1.5",
      provider: "pika",
      assetUrl: data.videos?.[0]?.url ?? "",
      durationMs: (req.duration ?? 3) * 1000,
    };
  }

  throw new Error("No video generation provider configured");
}

/** Generate audio effects or music. */
async function generateAudio(req: GenerationRequest): Promise<GenerationResult> {
  // Reuse speech generation for now — can be extended for music generation
  return generateSpeech(req);
}

/** Generate music via Suno API. */
async function generateMusic(req: GenerationRequest): Promise<GenerationResult> {
  if (!config.SUNO_API_KEY) throw new Error("Music generation requires SUNO_API_KEY");

  const sunoModel = req.model ?? "suno-v4";
  // Suno API: create a generation task
  const res = await fetch("https://api.suno.ai/v1/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.SUNO_API_KEY}`,
    },
    body: JSON.stringify({
      model: sunoModel,
      prompt: req.prompt,
      duration: req.duration ?? 30,
      instrumental: false,
    }),
  });
  if (!res.ok) throw new Error(`Suno error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { id?: string; audio_url?: string; output?: Array<{ audio_url?: string }> };

  // Suno returns a task id — attempt to fetch result directly first
  if (data.audio_url) {
    return {
      modality: "text-to-music",
      model: sunoModel,
      provider: "suno",
      assetUrl: data.audio_url,
      durationMs: (req.duration ?? 30) * 1000,
    };
  }

  // Poll for completion if we got a task id
  const taskId = data.id;
  if (taskId) {
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const pollRes = await fetch(`https://api.suno.ai/v1/generations/${taskId}`, {
        headers: { Authorization: `Bearer ${config.SUNO_API_KEY}` },
      });
      if (!pollRes.ok) continue;
      const pollData = await pollRes.json() as { status?: string; audio_url?: string; output?: Array<{ audio_url?: string }> };
      if (pollData.status === "completed") {
        const audioUrl = pollData.audio_url ?? pollData.output?.[0]?.audio_url ?? "";
        return {
          modality: "text-to-music",
          model: sunoModel,
          provider: "suno",
          assetUrl: audioUrl,
          durationMs: (req.duration ?? 30) * 1000,
        };
      }
      if (pollData.status === "error") {
        throw new Error(`Suno generation failed for ${taskId}`);
      }
    }
  }

  // Fallback to output array
  const assetUrl = data.output?.[0]?.audio_url ?? "";
  return {
    modality: "text-to-music",
    model: sunoModel,
    provider: "suno",
    assetUrl,
    durationMs: (req.duration ?? 30) * 1000,
  };
}

/** Generate 3D models via Meshy or Tripo. */
async function generate3D(req: GenerationRequest): Promise<GenerationResult> {
  const isImageTo3D = Boolean(req.sourceImage);

  // Meshy
  if (config.MESHY_API_KEY) {
    const meshyModel = isImageTo3D ? "meshy-image-to-3d" : "meshy-text-to-3d-v2";
    const body: Record<string, unknown> = {
      mode: isImageTo3D ? "image-to-3d" : "text-to-3d",
      prompt: req.prompt,
    };
    if (req.sourceImage) body.image_url = req.sourceImage;

    const res = await fetch("https://api.meshy.ai/v2/text-to-3d", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.MESHY_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Meshy error ${res.status}: ${await res.text()}`);
    const data = await res.json() as { result?: string; model_urls?: { glb?: string; obj?: string } };
    return {
      modality: "text-to-3d",
      model: meshyModel,
      provider: "meshy",
      assetUrl: data.model_urls?.glb ?? data.result ?? "",
    };
  }

  // Tripo3D
  if (config.TRIPO_API_KEY) {
    const tripoModel = isImageTo3D ? "tripo-image-to-3d" : "tripo-text-to-3d";
    const body: Record<string, unknown> = {
      type: isImageTo3D ? "image_to_model" : "text_to_model",
      prompt: req.prompt,
    };
    if (req.sourceImage) body.image = req.sourceImage;

    const res = await fetch("https://api.tripo3d.ai/v2/openapi/task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.TRIPO_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Tripo error ${res.status}: ${await res.text()}`);
    const data = await res.json() as { data?: { task_id?: string; result?: { model_url?: string } } };
    return {
      modality: "text-to-3d",
      model: tripoModel,
      provider: "tripo",
      assetUrl: data.data?.result?.model_url ?? "",
    };
  }

  throw new Error("No 3D generation provider configured");
}

/** List all available generation models based on configured API keys. */
export function listAvailableModels(): ModelEntry[] {
  return MODEL_REGISTRY.filter((m) => {
    if (!m.generationModality) return false;
    return isModalityAvailable(m.generationModality);
  });
}
