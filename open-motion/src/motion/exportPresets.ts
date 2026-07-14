/**
 * Smart Export Presets — platform-aware export profiles that bundle the right
 * format, dimensions, frame rate, and optimizations for each target platform.
 *
 * The recommendation engine analyzes the project's motion characteristics
 * (component count, total duration, loop behavior, shader usage, keyframe
 * density) and ranks presets by suitability, so the Agent can suggest the best
 * export format without the user needing to know the technical tradeoffs.
 */

import type { MotionComponent } from "@openmotion/shared";

export type ExportPlatform =
  | "web"
  | "react"
  | "vue"
  | "mobile-lottie"
  | "social-video"
  | "email"
  | "embed"
  | "figma";

export type ExportFormat = "html" | "css" | "json" | "react" | "vue" | "lottie" | "mp4" | "gif" | "webm";

export interface ExportPreset {
  id: string;
  name: string;
  platform: ExportPlatform;
  format: ExportFormat;
  description: string;
  /** Target dimensions (null = use project canvas size). */
  width: number | null;
  height: number | null;
  /** Frame rate for video/lottie exports. */
  fps: number | null;
  /** Maximum keyframes per component (0 = no limit). */
  maxKeyframes: number;
  /** Whether to inline all styles (for email/embed). */
  inlineStyles: boolean;
  /** Whether to strip JS and use CSS-only animations. */
  cssOnly: boolean;
  /** Whether to force infinite loop. */
  forceLoop: boolean;
  /** File extension hint for the export. */
  fileExtension: string;
  /** Keywords that trigger this preset in natural language. */
  keywords: string[];
  /** Scenarios where this preset is recommended. */
  recommendedFor: string[];
}

export interface PresetRecommendation {
  preset: ExportPreset;
  score: number;
  reasons: string[];
}

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: "preset-web-standalone",
    name: "Web Standalone",
    platform: "web",
    format: "html",
    description: "Self-contained HTML page with inline CSS and JavaScript — open directly in any browser, no build step required.",
    width: null,
    height: null,
    fps: null,
    maxKeyframes: 0,
    inlineStyles: true,
    cssOnly: false,
    forceLoop: false,
    fileExtension: "html",
    keywords: ["web", "html", "standalone", "page", "browser", "demo", "share"],
    recommendedFor: ["Sharing a live demo link", "Standalone preview", "Full-fidelity export with shaders and 3D"],
  },
  {
    id: "preset-react-component",
    name: "React Component",
    platform: "react",
    format: "react",
    description: "Drop-in React component using the Web Animations API — no external animation library needed, works with any React 18+ project.",
    width: null,
    height: null,
    fps: null,
    maxKeyframes: 0,
    inlineStyles: false,
    cssOnly: false,
    forceLoop: false,
    fileExtension: "tsx",
    keywords: ["react", "component", "jsx", "tsx", "next", "app"],
    recommendedFor: ["Integrating into a React or Next.js app", "Component-driven development", "TypeScript projects"],
  },
  {
    id: "preset-vue-component",
    name: "Vue Component",
    platform: "vue",
    format: "vue",
    description: "Vue 3 single-file component with scoped styles and Web Animations API — drop into any Vue 3 project.",
    width: null,
    height: null,
    fps: null,
    maxKeyframes: 0,
    inlineStyles: false,
    cssOnly: false,
    forceLoop: false,
    fileExtension: "vue",
    keywords: ["vue", "sfc", "nuxt", "component"],
    recommendedFor: ["Vue 3 or Nuxt projects", "Component-driven development"],
  },
  {
    id: "preset-mobile-lottie",
    name: "Mobile Lottie",
    platform: "mobile-lottie",
    format: "lottie",
    description: "Lottie JSON optimized for iOS/Android — reduced frame rate and capped keyframes for smooth playback on mobile devices with minimal bundle size.",
    width: null,
    height: null,
    fps: 30,
    maxKeyframes: 20,
    inlineStyles: false,
    cssOnly: false,
    forceLoop: false,
    fileExtension: "json",
    keywords: ["mobile", "lottie", "ios", "android", "react native", "flutter", "app", "native"],
    recommendedFor: ["Mobile app animations", "Cross-platform native playback", "Small bundle size requirements"],
  },
  {
    id: "preset-social-square",
    name: "Social Square Video",
    platform: "social-video",
    format: "mp4",
    description: "1080×1080 square MP4 optimized for Instagram feeds, Twitter, and Facebook — infinite loop, 30fps, H.264 compression.",
    width: 1080,
    height: 1080,
    fps: 30,
    maxKeyframes: 0,
    inlineStyles: false,
    cssOnly: false,
    forceLoop: true,
    fileExtension: "mp4",
    keywords: ["instagram", "social", "square", "feed", "twitter", "facebook", "post"],
    recommendedFor: ["Instagram feed posts", "Twitter/X video posts", "Facebook video ads"],
  },
  {
    id: "preset-social-story",
    name: "Social Story Video",
    platform: "social-video",
    format: "mp4",
    description: "1080×1920 vertical MP4 for Instagram Stories, TikTok, and YouTube Shorts — infinite loop, 30fps, vertical aspect ratio.",
    width: 1080,
    height: 1920,
    fps: 30,
    maxKeyframes: 0,
    inlineStyles: false,
    cssOnly: false,
    forceLoop: true,
    fileExtension: "mp4",
    keywords: ["story", "stories", "tiktok", "reels", "shorts", "vertical", "portrait", "youtube"],
    recommendedFor: ["Instagram Stories", "TikTok videos", "YouTube Shorts", "Vertical video ads"],
  },
  {
    id: "preset-email-inline",
    name: "Email Inline CSS",
    platform: "email",
    format: "css",
    description: "CSS-only animation with all styles inlined — no JavaScript, capped at 8 keyframes per component for compatibility with major email clients.",
    width: null,
    height: null,
    fps: null,
    maxKeyframes: 8,
    inlineStyles: true,
    cssOnly: true,
    forceLoop: false,
    fileExtension: "css",
    keywords: ["email", "newsletter", "mail", "outlook", "gmail", "inline", "css-only"],
    recommendedFor: ["Email newsletter animations", "Email client compatible", "No-JS environments"],
  },
  {
    id: "preset-embed-snippet",
    name: "Embed Snippet",
    platform: "embed",
    format: "html",
    description: "Minimal HTML snippet designed for iframe embedding — compact, self-contained, with transparent background for overlaying on existing pages.",
    width: null,
    height: null,
    fps: null,
    maxKeyframes: 0,
    inlineStyles: true,
    cssOnly: false,
    forceLoop: true,
    fileExtension: "html",
    keywords: ["embed", "snippet", "iframe", "widget", "overlay", "banner", "inline"],
    recommendedFor: ["Embedding in blog posts", "iframe widgets", "Overlay banners", "Header animations"],
  },
  {
    id: "preset-figma-spec",
    name: "Design Tool Spec",
    platform: "figma",
    format: "json",
    description: "Structured JSON spec matching design tool plugin schemas — import directly into design tools to sync animations with design files.",
    width: null,
    height: null,
    fps: 60,
    maxKeyframes: 0,
    inlineStyles: false,
    cssOnly: false,
    forceLoop: false,
    fileExtension: "json",
    keywords: ["figma", "design", "spec", "import", "sync", "plugin"],
    recommendedFor: ["Syncing with design tools", "Design-to-dev handoff", "Plugin import"],
  },
];

/** Summarize presets for compact listing. */
export function summarizePresets(): Array<{
  id: string;
  name: string;
  platform: ExportPlatform;
  format: ExportFormat;
  description: string;
  fileExtension: string;
  recommendedFor: string[];
}> {
  return EXPORT_PRESETS.map((p) => ({
    id: p.id,
    name: p.name,
    platform: p.platform,
    format: p.format,
    description: p.description,
    fileExtension: p.fileExtension,
    recommendedFor: p.recommendedFor,
  }));
}

/** Find a preset by id. */
export function findPreset(presetId: string): ExportPreset | undefined {
  return EXPORT_PRESETS.find((p) => p.id === presetId);
}

/** Find a preset by keyword match (returns first match). */
export function findPresetByKeyword(text: string): ExportPreset | undefined {
  const lower = text.toLowerCase();
  for (const preset of EXPORT_PRESETS) {
    if (preset.keywords.some((kw) => lower.includes(kw))) {
      return preset;
    }
  }
  return undefined;
}

interface ProjectAnalysis {
  componentCount: number;
  totalDurationMs: number;
  hasInfiniteLoops: boolean;
  hasShaders: boolean;
  has3D: boolean;
  keyframeDensity: number;
  avgKeyframesPerComponent: number;
  hasSprings: boolean;
}

function analyzeProject(components: MotionComponent[]): ProjectAnalysis {
  const componentCount = components.length;
  let totalKeyframes = 0;
  let totalDurationMs = 0;
  let hasInfiniteLoops = false;
  let hasSprings = false;
  let hasShaders = false;
  let has3D = false;

  for (const c of components) {
    const kfCount = Array.isArray(c.keyframes) ? c.keyframes.length : 0;
    totalKeyframes += kfCount;
    if (c.easing?.type === "spring") hasSprings = true;
    if (c.iterationCount === "infinite") hasInfiniteLoops = true;
    if (c.style) {
      const filter = String(c.style.filter ?? "");
      if (filter.includes("shader") || filter.includes("chromatic") || filter.includes("plasma")) {
        hasShaders = true;
      }
      const transform = String(c.style.transform ?? "");
      if (transform.includes("perspective") || transform.includes("rotateX") || transform.includes("rotateY")) {
        has3D = true;
      }
    }
  }

  totalDurationMs = componentCount > 0
    ? components.reduce((max, c) => Math.max(max, c.durationMs + c.delayMs), 0)
    : 0;

  const avgKeyframesPerComponent = componentCount > 0 ? totalKeyframes / componentCount : 0;
  const keyframeDensity = totalDurationMs > 0 ? totalKeyframes / (totalDurationMs / 1000) : 0;

  return {
    componentCount,
    totalDurationMs,
    hasInfiniteLoops,
    hasShaders,
    has3D,
    keyframeDensity,
    avgKeyframesPerComponent,
    hasSprings,
  };
}

/**
 * Recommend the best export presets for a project, ranked by suitability score.
 * Returns all presets with scores and reasoning; the caller picks the top N.
 */
export function recommendExportPresets(
  components: MotionComponent[],
  userHint?: string,
): PresetRecommendation[] {
  const analysis = analyzeProject(components);
  const recommendations: PresetRecommendation[] = [];

  for (const preset of EXPORT_PRESETS) {
    let score = 50;
    const reasons: string[] = [];

    // Keyword hint boost (strong signal)
    if (userHint) {
      const lower = userHint.toLowerCase();
      if (preset.keywords.some((kw) => lower.includes(kw))) {
        score += 40;
        reasons.push(`matches "${userHint.trim().slice(0, 40)}"`);
      }
    }

    // Platform-specific scoring
    if (preset.platform === "web") {
      if (analysis.hasShaders || analysis.has3D) {
        score += 25;
        reasons.push("preserves shaders and 3D transforms at full fidelity");
      }
      if (analysis.componentCount <= 5) {
        score += 10;
        reasons.push("small component count is ideal for standalone HTML");
      }
    }

    if (preset.platform === "react") {
      if (analysis.hasSprings) {
        score += 15;
        reasons.push("spring easings map naturally to React's Web Animations API");
      }
      if (analysis.componentCount > 3) {
        score += 10;
        reasons.push("component-based architecture suits multi-component projects");
      }
    }

    if (preset.platform === "mobile-lottie") {
      if (analysis.componentCount > 5) {
        score += 20;
        reasons.push("many components benefit from Lottie's compact binary format");
      }
      if (analysis.avgKeyframesPerComponent > 10) {
        score += 15;
        reasons.push("high keyframe density compresses well in Lottie");
      }
      if (analysis.hasShaders || analysis.has3D) {
        score -= 20;
        reasons.push("shaders and 3D are not supported in Lottie — fidelity loss expected");
      }
    }

    if (preset.platform === "social-video") {
      if (analysis.hasInfiniteLoops) {
        score += 15;
        reasons.push("infinite loops export cleanly as looping video");
      }
      if (analysis.totalDurationMs > 0 && analysis.totalDurationMs < 10000) {
        score += 10;
        reasons.push("short duration is ideal for social media");
      }
      if (analysis.totalDurationMs > 30000) {
        score -= 15;
        reasons.push("long duration may exceed social media limits");
      }
    }

    if (preset.platform === "email") {
      if (analysis.avgKeyframesPerComponent > 12) {
        score -= 15;
        reasons.push("high keyframe count will be capped at 8 for email compatibility");
      }
      if (analysis.hasShaders) {
        score -= 25;
        reasons.push("shaders are not supported in email clients");
      }
      if (analysis.componentCount <= 3) {
        score += 15;
        reasons.push("simple composition is ideal for email");
      }
    }

    if (preset.platform === "embed") {
      if (analysis.hasInfiniteLoops) {
        score += 10;
        reasons.push("infinite loop is ideal for embed/banner use");
      }
      if (analysis.componentCount <= 4) {
        score += 10;
        reasons.push("compact composition embeds cleanly");
      }
    }

    if (preset.platform === "figma") {
      if (analysis.componentCount > 0) {
        score += 5;
        reasons.push("structured spec syncs with design tool layers");
      }
    }

    recommendations.push({ preset, score, reasons });
  }

  recommendations.sort((a, b) => b.score - a.score);
  return recommendations;
}

/** Get the top N recommendations for a project. */
export function topRecommendations(
  components: MotionComponent[],
  n: number,
  userHint?: string,
): PresetRecommendation[] {
  return recommendExportPresets(components, userHint).slice(0, n);
}
