import { logger } from "../utils/logger.js";

/**
 * Media generation and resolution pipeline.
 *
 * Resolves any media need (background music, sound effects, voiceover,
 * images, icons, logos, color grades) into a concrete asset — either from
 * the local catalog or generated on demand via AI models. All resolved
 * assets are tracked in a manifest for cross-project reuse.
 *
 * The pipeline is designed to be deterministic: the same media request
 * always resolves to the same asset (when using seeded generation).
 */

export type MediaModality =
  | "audio"
  | "image"
  | "video"
  | "voice"
  | "icon"
  | "logo"
  | "lut"
  | "font";

export type MediaPurpose =
  | "background-music"
  | "sound-effect"
  | "voiceover"
  | "background-image"
  | "foreground-image"
  | "transition"
  | "overlay"
  | "color-grade"
  | "caption"
  | "watermark";

export interface MediaRequest {
  /** What kind of media is needed. */
  modality: MediaModality;
  /** What the media will be used for. */
  purpose: MediaPurpose;
  /** Natural language description of the desired media. */
  description: string;
  /** Preferred style or mood. */
  style?: string;
  /** Duration in seconds (for audio/video). */
  durationSec?: number;
  /** Seed for deterministic generation. */
  seed?: number;
  /** Preferred format. */
  format?: "mp3" | "wav" | "png" | "svg" | "mp4" | "webm" | "json";
  /** Whether to allow generation if catalog misses. */
  allowGeneration?: boolean;
}

export interface MediaAsset {
  id: string;
  modality: MediaModality;
  purpose: MediaPurpose;
  description: string;
  /** Local file path or URL. */
  source: string;
  /** MIME type. */
  mimeType: string;
  /** File size in bytes. */
  sizeBytes: number;
  /** Duration in seconds (for audio/video). */
  durationSec?: number;
  /** Width in pixels (for images/video). */
  width?: number;
  /** Height in pixels (for images/video). */
  height?: number;
  /** Whether this asset was generated or from catalog. */
  generated: boolean;
  /** Generation seed, if applicable. */
  seed?: number;
  /** Creation timestamp. */
  createdAt: string;
  /** Tags for searchability. */
  tags: string[];
}

export interface MediaManifest {
  assets: MediaAsset[];
  totalSizeBytes: number;
  generatedCount: number;
  catalogCount: number;
}

/** In-memory asset manifest (reset on server restart). */
const manifest = new Map<string, MediaAsset>();

/** Local catalog of predefined media assets. */
const CATALOG: MediaAsset[] = [
  {
    id: "bgm-calm-ambient",
    modality: "audio",
    purpose: "background-music",
    description: "Calm ambient background music with soft pads",
    source: "/media/audio/calm-ambient.mp3",
    mimeType: "audio/mpeg",
    sizeBytes: 2400000,
    durationSec: 30,
    generated: false,
    createdAt: new Date().toISOString(),
    tags: ["calm", "ambient", "background", "soft"],
  },
  {
    id: "bgm-upbeat-electronic",
    modality: "audio",
    purpose: "background-music",
    description: "Upbeat electronic background music with energetic rhythm",
    source: "/media/audio/upbeat-electronic.mp3",
    mimeType: "audio/mpeg",
    sizeBytes: 3100000,
    durationSec: 30,
    generated: false,
    createdAt: new Date().toISOString(),
    tags: ["upbeat", "electronic", "energetic", "background"],
  },
  {
    id: "sfx-whoosh",
    modality: "audio",
    purpose: "sound-effect",
    description: "Fast whoosh transition sound effect",
    source: "/media/audio/whoosh.mp3",
    mimeType: "audio/mpeg",
    sizeBytes: 80000,
    durationSec: 1,
    generated: false,
    createdAt: new Date().toISOString(),
    tags: ["whoosh", "transition", "fast", "sfx"],
  },
  {
    id: "sfx-pop",
    modality: "audio",
    purpose: "sound-effect",
    description: "Pop sound effect for UI interactions",
    source: "/media/audio/pop.mp3",
    mimeType: "audio/mpeg",
    sizeBytes: 40000,
    durationSec: 0.5,
    generated: false,
    createdAt: new Date().toISOString(),
    tags: ["pop", "ui", "interaction", "sfx"],
  },
  {
    id: "sfx-impact",
    modality: "audio",
    purpose: "sound-effect",
    description: "Deep impact sound effect for dramatic reveals",
    source: "/media/audio/impact.mp3",
    mimeType: "audio/mpeg",
    sizeBytes: 120000,
    durationSec: 1.5,
    generated: false,
    createdAt: new Date().toISOString(),
    tags: ["impact", "dramatic", "deep", "sfx"],
  },
  {
    id: "img-gradient-bg",
    modality: "image",
    purpose: "background-image",
    description: "Abstract gradient background image",
    source: "/media/images/gradient-bg.png",
    mimeType: "image/png",
    sizeBytes: 450000,
    width: 1920,
    height: 1080,
    generated: false,
    createdAt: new Date().toISOString(),
    tags: ["gradient", "background", "abstract"],
  },
  {
    id: "img-particle-texture",
    modality: "image",
    purpose: "foreground-image",
    description: "Particle texture for visual effects",
    source: "/media/images/particles.png",
    mimeType: "image/png",
    sizeBytes: 180000,
    width: 512,
    height: 512,
    generated: false,
    createdAt: new Date().toISOString(),
    tags: ["particles", "texture", "effect"],
  },
  {
    id: "icon-play",
    modality: "icon",
    purpose: "overlay",
    description: "Play button icon",
    source: "/media/icons/play.svg",
    mimeType: "image/svg+xml",
    sizeBytes: 1200,
    generated: false,
    createdAt: new Date().toISOString(),
    tags: ["play", "icon", "ui"],
  },
  {
    id: "lut-cinematic",
    modality: "lut",
    purpose: "color-grade",
    description: "Cinematic color grade LUT",
    source: "/media/luts/cinematic.cube",
    mimeType: "application/octet-stream",
    sizeBytes: 68000,
    generated: false,
    createdAt: new Date().toISOString(),
    tags: ["cinematic", "color", "grade", "lut"],
  },
];

/** Initialize the manifest with catalog assets. */
export function initializeManifest(): void {
  for (const asset of CATALOG) {
    manifest.set(asset.id, asset);
  }
  logger.info("Media manifest initialized", { count: manifest.size });
}

/** Get the full media manifest. */
export function getManifest(): MediaManifest {
  const assets = Array.from(manifest.values());
  const totalSizeBytes = assets.reduce((sum, a) => sum + a.sizeBytes, 0);
  return {
    assets,
    totalSizeBytes,
    generatedCount: assets.filter((a) => a.generated).length,
    catalogCount: assets.filter((a) => !a.generated).length,
  };
}

/** Search the catalog for assets matching the request. */
function searchCatalog(request: MediaRequest): MediaAsset | null {
  const query = request.description.toLowerCase();
  const modalityMatch = manifest.get(
    Array.from(manifest.values()).find((a) => {
      if (a.modality !== request.modality) return false;
      if (a.purpose !== request.purpose && a.purpose !== "background-music" && a.purpose !== "sound-effect") return false;
      const descMatch = a.description.toLowerCase().includes(query) || query.includes(a.description.toLowerCase().split(" ")[0]);
      const tagMatch = a.tags.some((t) => query.includes(t.toLowerCase()));
      return descMatch || tagMatch;
    })?.id ?? "",
  );
  return modalityMatch ?? null;
}

/** Generate a media asset using AI (simulated when no API configured). */
async function generateMedia(request: MediaRequest): Promise<MediaAsset> {
  const seed = request.seed ?? Math.floor(Math.random() * 1000000);
  const id = `gen-${request.modality}-${seed}`;
  const format = request.format ?? getDefaultFormat(request.modality);
  const mimeType = getMimeType(format);
  const source = `/media/generated/${id}.${format}`;

  // Simulated generation — in production, this would call the actual AI model
  const sizeBytes = estimateSize(request.modality, request.durationSec);

  const asset: MediaAsset = {
    id,
    modality: request.modality,
    purpose: request.purpose,
    description: request.description,
    source,
    mimeType,
    sizeBytes,
    durationSec: request.durationSec,
    width: request.modality === "image" || request.modality === "video" ? 1920 : undefined,
    height: request.modality === "image" || request.modality === "video" ? 1080 : undefined,
    generated: true,
    seed,
    createdAt: new Date().toISOString(),
    tags: extractTags(request.description),
  };

  manifest.set(id, asset);
  logger.info("Media generated", { id, modality: request.modality, seed });

  return asset;
}

/** Resolve a media request — try catalog first, then generate if allowed. */
export async function resolveMedia(request: MediaRequest): Promise<MediaAsset> {
  // Try catalog first
  const catalogMatch = searchCatalog(request);
  if (catalogMatch) {
    logger.info("Media resolved from catalog", { id: catalogMatch.id });
    return catalogMatch;
  }

  // Generate if allowed
  if (request.allowGeneration !== false) {
    return generateMedia(request);
  }

  // No match and generation not allowed
  throw new Error(`No media found for: ${request.description} (${request.modality})`);
}

/** Resolve multiple media requests in parallel. */
export async function resolveMediaBatch(requests: MediaRequest[]): Promise<MediaAsset[]> {
  return Promise.all(requests.map(resolveMedia));
}

/** Resolve all media needs for a composition based on its components. */
export async function resolveCompositionMedia(
  components: Array<{ id: string; name: string; style?: Record<string, unknown> }>,
): Promise<MediaAsset[]> {
  const requests: MediaRequest[] = [];

  for (const comp of components) {
    // Check if component needs media
    const style = comp.style ?? {};
    if (style._src || style._media) {
      const modality = (style._modality as string) ?? "image";
      const purpose = (style._purpose as string) ?? "foreground-image";
      requests.push({
        modality: modality as MediaModality,
        purpose: purpose as MediaPurpose,
        description: comp.name,
        allowGeneration: true,
      });
    }

    // Check if component needs audio
    if (style._audio || style._sfx) {
      requests.push({
        modality: "audio",
        purpose: style._sfx ? "sound-effect" : "background-music",
        description: String(style._audio ?? style._sfx ?? comp.name),
        allowGeneration: true,
      });
    }
  }

  return resolveMediaBatch(requests);
}

/** Generate a voiceover from text. */
export async function generateVoiceover(
  text: string,
  options: {
    voice?: string;
    speed?: number;
    pitch?: number;
    language?: string;
  } = {},
): Promise<MediaAsset> {
  return resolveMedia({
    modality: "voice",
    purpose: "voiceover",
    description: text.slice(0, 100),
    durationSec: Math.ceil(text.length / 15), // ~15 chars per second
    allowGeneration: true,
    format: "mp3",
    seed: hashString(text),
  });
}

/** Generate background music for a composition. */
export async function generateBackgroundMusic(
  mood: string,
  durationSec: number,
): Promise<MediaAsset> {
  return resolveMedia({
    modality: "audio",
    purpose: "background-music",
    description: `${mood} background music`,
    durationSec,
    allowGeneration: true,
    format: "mp3",
    seed: hashString(`${mood}-${durationSec}`),
  });
}

/** Generate a color grade LUT for a composition. */
export async function generateColorGrade(
  description: string,
): Promise<MediaAsset> {
  return resolveMedia({
    modality: "lut",
    purpose: "color-grade",
    description,
    allowGeneration: true,
    format: "json",
    seed: hashString(description),
  });
}

/** List all assets by modality. */
export function listAssetsByModality(modality: MediaModality): MediaAsset[] {
  return Array.from(manifest.values()).filter((a) => a.modality === modality);
}

/** Search assets by text query. */
export function searchAssets(query: string, limit = 20): MediaAsset[] {
  const q = query.toLowerCase();
  return Array.from(manifest.values())
    .filter((a) => {
      return (
        a.description.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)) ||
        a.modality.includes(q) ||
        a.purpose.includes(q)
      );
    })
    .slice(0, limit);
}

/** Get a media asset by ID. */
export function getAsset(id: string): MediaAsset | null {
  return manifest.get(id) ?? null;
}

/** Remove a media asset from the manifest. */
export function removeAsset(id: string): boolean {
  return manifest.delete(id);
}

// --- Helpers ---

function getDefaultFormat(modality: MediaModality): string {
  switch (modality) {
    case "audio":
    case "voice":
      return "mp3";
    case "image":
      return "png";
    case "icon":
      return "svg";
    case "video":
      return "mp4";
    case "lut":
      return "json";
    case "logo":
      return "svg";
    case "font":
      return "json";
    default:
      return "json";
  }
}

function getMimeType(format: string): string {
  switch (format) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "png":
      return "image/png";
    case "svg":
      return "image/svg+xml";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "json":
      return "application/json";
    default:
      return "application/octet-stream";
  }
}

function estimateSize(modality: MediaModality, durationSec?: number): number {
  switch (modality) {
    case "audio":
    case "voice":
      return Math.ceil((durationSec ?? 5) * 80000); // ~80KB/sec
    case "image":
      return 450000;
    case "video":
      return Math.ceil((durationSec ?? 5) * 500000); // ~500KB/sec
    case "icon":
    case "logo":
      return 2000;
    case "lut":
      return 68000;
    default:
      return 10000;
  }
}

function extractTags(description: string): string[] {
  const words = description.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  return words.slice(0, 5);
}

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Initialize on module load
initializeManifest();
