/**
 * Export platform presets — bundled render configurations for each popular
 * output target. End users typically export the same project for multiple
 * surfaces (Web, iOS, Android, Lottie, MP4) and each surface has specific
 * expectations about dimensions, quality, codec, loop behaviour and motion
 * intensity. These presets encode those defaults so the export panel can
 * offer a single "Export for Instagram" (or "Export for iOS Lottie") button.
 */

export type RenderFormat = "lottie" | "mp4" | "gif" | "webm" | "svg-sequence" | "png-sequence" | "css-animations" | "json";

export interface ExportPlatformPreset {
  id: string;
  /** User-facing label */
  name: string;
  /** Output platform (for grouping + search) */
  platform: "Web" | "iOS" | "Android" | "Social" | "Lottie Marketplace" | "Design Tools";
  format: RenderFormat;
  /** Canonical width × height; empty means "inherit project artboard" */
  size: { width?: number; height?: number } | null;
  /** 1 = 100%, 2 = @2x (Retina), 3 = @3x */
  pixelRatio?: number;
  /** Quality 0-100 where meaningful for the format */
  quality?: number;
  /** Target bitrate in kbps where meaningful (video formats) */
  bitrateKbps?: number;
  /** Loop behaviour override for formats that support it */
  loop?: boolean | number;
  /** Max duration cap in seconds. If project exceeds this, user is warned. */
  maxDurationSec?: number;
  /** Override applied to accessibility profile during export */
  forceAccessibilityProfile?: string;
  /** If true, an MP4 export will always be padded to keyframes for smooth scrubbing */
  keyframeOptimized?: boolean;
  /** Override framerate for the exported asset; default 60 for video/sequence formats */
  fps?: number;
  /** Post-export naming pattern — tokens: {project} {date} {width} {height} */
  fileNamePattern: string;
  /** Tag vocab for preset search */
  tags: string[];
}

export const EXPORT_PLATFORM_PRESETS: ExportPlatformPreset[] = [
  // --- Web ---------------------------------------------------------------
  {
    id: "xp-web-lottie-1x",
    name: "Web · Lottie @1x",
    platform: "Web",
    format: "lottie",
    size: null,
    pixelRatio: 1,
    quality: 92,
    loop: true,
    fileNamePattern: "{project}-lottie-{date}.json",
    tags: ["web", "lottie", "standard", "low-bandwidth"],
  },
  {
    id: "xp-web-css-keyframes",
    name: "Web · CSS keyframes",
    platform: "Web",
    format: "css-animations",
    size: null,
    fileNamePattern: "{project}-animations.css",
    tags: ["web", "css", "no-dependency", "static-site"],
  },
  {
    id: "xp-web-mp4-hero",
    name: "Web · Hero MP4",
    platform: "Web",
    format: "mp4",
    size: { width: 1920, height: 1080 },
    pixelRatio: 1,
    quality: 88,
    bitrateKbps: 4800,
    maxDurationSec: 15,
    loop: true,
    keyframeOptimized: true,
    fileNamePattern: "{project}-hero-{width}p.mp4",
    tags: ["web", "mp4", "hero", "1080p"],
  },
  {
    id: "xp-web-webm-alpha",
    name: "Web · WebM with alpha",
    platform: "Web",
    format: "webm",
    size: null,
    pixelRatio: 1,
    quality: 90,
    bitrateKbps: 3000,
    fileNamePattern: "{project}-alpha.webm",
    tags: ["web", "webm", "alpha", "transparent"],
  },

  // --- iOS ---------------------------------------------------------------
  {
    id: "xp-ios-lottie-3x",
    name: "iOS · Lottie @3x",
    platform: "iOS",
    format: "lottie",
    size: null,
    pixelRatio: 3,
    quality: 95,
    forceAccessibilityProfile: "reduced",
    fileNamePattern: "{project}@3x.lottie.json",
    tags: ["ios", "lottie", "retina", "swiftui", "uikit"],
  },
  {
    id: "xp-ios-mp4-launchscreen",
    name: "iOS · Launch Screen MP4",
    platform: "iOS",
    format: "mp4",
    size: { width: 2556, height: 1179 }, // iPhone 14 Pro Max landscape
    pixelRatio: 3,
    quality: 90,
    bitrateKbps: 8000,
    maxDurationSec: 4,
    loop: false,
    keyframeOptimized: true,
    forceAccessibilityProfile: "no-motion",
    fileNamePattern: "{project}-launch-{width}x{height}.mp4",
    tags: ["ios", "launch", "mp4", "iphone"],
  },

  // --- Android -----------------------------------------------------------
  {
    id: "xp-android-lottie-2x",
    name: "Android · Lottie @2x",
    platform: "Android",
    format: "lottie",
    size: null,
    pixelRatio: 2,
    quality: 92,
    forceAccessibilityProfile: "reduced",
    fileNamePattern: "{project}_xxhdpi.json",
    tags: ["android", "lottie", "jetpack-compose", "xxhdpi"],
  },
  {
    id: "xp-android-shorts-mp4",
    name: "Android · App Preview MP4 (Play Store)",
    platform: "Android",
    format: "mp4",
    size: { width: 1080, height: 1920 },
    pixelRatio: 1,
    quality: 88,
    bitrateKbps: 8000,
    maxDurationSec: 30,
    loop: false,
    keyframeOptimized: true,
    fileNamePattern: "{project}-store-preview-{width}x{height}.mp4",
    tags: ["android", "play-store", "preview", "vertical"],
  },

  // --- Social ------------------------------------------------------------
  {
    id: "xp-social-instagram-reel",
    name: "Instagram · Reel",
    platform: "Social",
    format: "mp4",
    size: { width: 1080, height: 1920 },
    pixelRatio: 1,
    quality: 92,
    bitrateKbps: 10000,
    maxDurationSec: 90,
    loop: false,
    keyframeOptimized: true,
    forceAccessibilityProfile: "photosensitive-safe",
    fileNamePattern: "{project}-reel-{date}.mp4",
    tags: ["instagram", "reel", "social", "9:16", "vertical"],
  },
  {
    id: "xp-social-tiktok",
    name: "TikTok · 9:16 MP4",
    platform: "Social",
    format: "mp4",
    size: { width: 1080, height: 1920 },
    pixelRatio: 1,
    quality: 90,
    bitrateKbps: 8000,
    maxDurationSec: 60,
    loop: false,
    keyframeOptimized: true,
    forceAccessibilityProfile: "photosensitive-safe",
    fileNamePattern: "{project}-tiktok-{date}.mp4",
    tags: ["tiktok", "social", "9:16", "vertical"],
  },
  {
    id: "xp-social-youtube-shorts",
    name: "YouTube · Shorts",
    platform: "Social",
    format: "mp4",
    size: { width: 1080, height: 1920 },
    pixelRatio: 1,
    quality: 92,
    bitrateKbps: 12000,
    maxDurationSec: 60,
    loop: false,
    keyframeOptimized: true,
    forceAccessibilityProfile: "photosensitive-safe",
    fileNamePattern: "{project}-yt-shorts-{date}.mp4",
    tags: ["youtube", "shorts", "social", "9:16", "vertical"],
  },
  {
    id: "xp-social-x-gif",
    name: "X · Loop GIF",
    platform: "Social",
    format: "gif",
    size: { width: 1200, height: 675 },
    pixelRatio: 1,
    quality: 85,
    maxDurationSec: 15,
    loop: true,
    forceAccessibilityProfile: "photosensitive-safe",
    fileNamePattern: "{project}-x-loop.gif",
    tags: ["x", "twitter", "gif", "loop", "social"],
  },
  {
    id: "xp-social-linkedin-banner",
    name: "LinkedIn · Banner MP4",
    platform: "Social",
    format: "mp4",
    size: { width: 1584, height: 396 },
    pixelRatio: 1,
    quality: 90,
    bitrateKbps: 5000,
    maxDurationSec: 30,
    loop: true,
    keyframeOptimized: true,
    fileNamePattern: "{project}-linkedin-banner.mp4",
    tags: ["linkedin", "banner", "social", "wide"],
  },

  // --- Lottie Marketplace ------------------------------------------------
  {
    id: "xp-marketplace-lottie-strict",
    name: "LottieFiles · Marketplace",
    platform: "Lottie Marketplace",
    format: "lottie",
    size: null,
    pixelRatio: 1,
    quality: 100,
    loop: true,
    forceAccessibilityProfile: "reduced",
    fileNamePattern: "{project}-lottiefiles.json",
    tags: ["lottiefiles", "marketplace", "strict", "portfolio"],
  },
  {
    id: "xp-marketplace-svg-seq",
    name: "SVG Sequence (thumbnails)",
    platform: "Lottie Marketplace",
    format: "svg-sequence",
    fps: 10,
    size: { width: 640, height: 360 },
    fileNamePattern: "{project}-thumb/{frame}.svg",
    tags: ["svg", "sequence", "thumbnails", "preview"],
  },

  // --- Design Tools ------------------------------------------------------
  {
    id: "xp-figma-png-seq",
    name: "Figma · PNG sequence",
    platform: "Design Tools",
    format: "png-sequence",
    fps: 24,
    size: null,
    pixelRatio: 2,
    fileNamePattern: "{project}-figma/{frame}.png",
    tags: ["figma", "png", "sequence", "hand-off"],
  },
  {
    id: "xp-framer-lottie",
    name: "Framer · Lottie",
    platform: "Design Tools",
    format: "lottie",
    size: null,
    pixelRatio: 2,
    quality: 95,
    loop: true,
    fileNamePattern: "{project}-framer.lottie.json",
    tags: ["framer", "lottie", "prototype", "design-tools"],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Filter presets by text + optional platform. */
export function searchExportPresets(
  query: string,
  opts: { platform?: ExportPlatformPreset["platform"]; format?: RenderFormat } = {},
): ExportPlatformPreset[] {
  const q = query.trim().toLowerCase();
  return EXPORT_PLATFORM_PRESETS.filter((p) => {
    if (opts.platform && p.platform !== opts.platform) return false;
    if (opts.format && p.format !== opts.format) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.platform.toLowerCase().includes(q) ||
      p.format.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}

/** Group presets by platform (stable order matching the `platform` enum order). */
export function groupPresetsByPlatform(presets: ExportPlatformPreset[]): Array<{ platform: ExportPlatformPreset["platform"]; items: ExportPlatformPreset[] }> {
  const PLATFORM_ORDER: ExportPlatformPreset["platform"][] = [
    "Web", "iOS", "Android", "Social", "Lottie Marketplace", "Design Tools",
  ];
  const out: Array<{ platform: ExportPlatformPreset["platform"]; items: ExportPlatformPreset[] }> = [];
  for (const platform of PLATFORM_ORDER) {
    const items = presets.filter((p) => p.platform === platform);
    if (items.length > 0) out.push({ platform, items });
  }
  return out;
}

/** Resolve filename pattern with concrete values. */
export function resolveFileName(preset: ExportPlatformPreset, ctx: { project: string; date?: string; width?: number; height?: number }): string {
  const date = ctx.date ?? new Date().toISOString().slice(0, 10);
  let out = preset.fileNamePattern;
  out = out.replaceAll("{project}", sanitizeFileName(ctx.project));
  out = out.replaceAll("{date}", date);
  out = out.replaceAll("{width}", String(ctx.width ?? ""));
  out = out.replaceAll("{height}", String(ctx.height ?? ""));
  return out;
}

function sanitizeFileName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "project";
}
