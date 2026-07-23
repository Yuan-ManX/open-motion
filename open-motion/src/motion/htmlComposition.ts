import type { MotionSpec, MotionComponent, Easing } from "@openmotion/shared";
import { easingToCss } from "../shared/motion/easing.js";
import { buildCompositionTree, flattenToTimeline, type CompositionResult } from "./compositionEngine.js";

/**
 * HTML composition generator with seek protocol.
 *
 * Produces a self-contained HTML document that implements the OpenMotion
 * seek protocol: `window.__om.seek(frame)`. Any tool implementing this
 * protocol can capture frames deterministically — the same frame number
 * always yields the same visual state.
 *
 * The composition uses the Web Animations API (WAAPI) for frame-accurate
 * seeking. Each component's keyframes are compiled into a WAAPI
 * KeyframeEffect, and the seek function sets currentTime on all
 * animations simultaneously.
 */

export interface HtmlCompositionOptions {
  /** Width in pixels. */
  width?: number;
  /** Height in pixels. */
  height?: number;
  /** Background color. */
  background?: string;
  /** Frames per second. */
  fps?: number;
  /** Whether to include the seek protocol script. */
  includeSeekProtocol?: boolean;
  /** Whether to include playback controls UI. */
  includeControls?: boolean;
  /** Custom CSS to inject. */
  customCss?: string;
  /** Whether to loop playback. */
  loop?: boolean;
}

export interface HtmlCompositionResult {
  html: string;
  totalFrames: number;
  durationMs: number;
  fps: number;
  componentCount: number;
}

/**
 * Generate a complete HTML composition document from a MotionSpec.
 * The document implements the seek protocol for deterministic rendering.
 */
export function generateHtmlComposition(
  spec: MotionSpec,
  options: HtmlCompositionOptions = {},
): HtmlCompositionResult {
  const fps = options.fps ?? 60;
  const width = options.width ?? 1920;
  const height = options.height ?? 1920;
  const background = options.background ?? "#0a0a0a";
  const loop = options.loop ?? false;

  const composition = flattenToTimeline(buildCompositionTree(spec), fps);
  const componentMap = new Map<string, MotionComponent>();
  for (const comp of spec.components) {
    componentMap.set(comp.id, comp);
  }

  // Generate CSS for each component
  const componentStyles = spec.components.map((comp) => {
    const entry = composition.timeline.find((t) => t.componentId === comp.id);
    const startMs = entry?.startMs ?? comp.delayMs;
    const durationMs = entry?.durationMs ?? comp.durationMs;
    const easingStr = typeof comp.easing === "object" ? easingToCss(comp.easing as Easing) : "ease-out";
    const iterCount = comp.iterationCount === "infinite" ? "infinite" : String(comp.iterationCount);

    const staticStyles = Object.entries(comp.style ?? {})
      .filter(([key]) => !key.startsWith("_"))
      .map(([key, val]) => `${camelToKebab(key)}: ${val}`)
      .join("; ");

    return {
      id: comp.id,
      name: comp.name,
      startMs,
      durationMs,
      easingStr,
      iterCount,
      direction: comp.direction,
      fillMode: comp.fillMode,
      staticStyles,
      delayMs: comp.delayMs,
    };
  });

  // Generate WAAPI keyframes for each component
  const waapiScripts = spec.components.map((comp) => {
    const entry = composition.timeline.find((t) => t.componentId === comp.id);
    const startMs = entry?.startMs ?? comp.delayMs;
    const durationMs = entry?.durationMs ?? comp.durationMs;

    const keyframes = comp.keyframes?.length > 0
      ? comp.keyframes.map((kf) => {
          const props = Object.entries(kf.properties).map(([key, val]) => {
            if (key === "translateX") return `transform: translateX(${val}px)`;
            if (key === "translateY") return `transform: translateY(${val}px)`;
            if (key === "translateZ") return `transform: translateZ(${val}px)`;
            if (key === "scale") return `transform: scale(${val})`;
            if (key === "scaleX") return `transform: scaleX(${val})`;
            if (key === "scaleY") return `transform: scaleY(${val})`;
            if (key === "rotate") return `transform: rotate(${val}deg)`;
            if (key === "rotateX") return `transform: rotateX(${val}deg)`;
            if (key === "rotateY") return `transform: rotateY(${val}deg)`;
            if (key === "rotateZ") return `transform: rotateZ(${val}deg)`;
            if (key === "skewX") return `transform: skewX(${val}deg)`;
            if (key === "skewY") return `transform: skewY(${val}deg)`;
            return `${camelToKebab(key)}: ${val}`;
          });
          return `{ offset: ${kf.offset}, ${props.join(", ")} }`;
        })
      : [
          `{ offset: 0, opacity: 0, transform: 'scale(0.8)' }`,
          `{ offset: 1, opacity: 1, transform: 'scale(1)' }`,
        ];

    const easingStr = typeof comp.easing === "object"
      ? easingToCss(comp.easing as Easing)
      : "ease-out";

    return `    (() => {
      const el = document.querySelector('[data-om-id="${comp.id}"]');
      if (!el) return;
      const keyframes = [${keyframes.join(", ")}];
      const anim = el.animate(keyframes, {
        duration: ${durationMs},
        delay: ${startMs},
        easing: '${easingStr}',
        iterations: ${comp.iterationCount === "infinite" ? "Infinity" : comp.iterationCount},
        direction: '${comp.direction}',
        fill: '${comp.fillMode}',
      });
      anim.pause();
      window.__om.animations.push(anim);
    })();`;
  }).join("\n");

  // Generate the seek protocol script
  const seekProtocol = options.includeSeekProtocol !== false ? `
    <script>
    (function() {
      const FPS = ${fps};
      const TOTAL_FRAMES = ${composition.frameCount};
      const LOOP = ${loop};

      window.__om = {
        animations: [],
        currentFrame: 0,
        isPlaying: false,
        playStartTime: 0,
        totalFrames: TOTAL_FRAMES,
        fps: FPS,

        seek: function(frame) {
          this.currentFrame = frame;
          const timeMs = (frame / FPS) * 1000;
          for (const anim of this.animations) {
            anim.currentTime = timeMs;
          }
          if (window.__om.onSeek) window.__om.onSeek(frame, timeMs);
        },

        play: function() {
          if (this.isPlaying) return;
          this.isPlaying = true;
          this.playStartTime = performance.now() - (this.currentFrame / FPS) * 1000;

          const tick = () => {
            if (!this.isPlaying) return;
            const elapsed = performance.now() - this.playStartTime;
            const frame = Math.floor((elapsed / 1000) * FPS);

            if (frame >= TOTAL_FRAMES) {
              if (LOOP) {
                this.playStartTime = performance.now();
                this.seek(0);
              } else {
                this.isPlaying = false;
                this.seek(TOTAL_FRAMES - 1);
                if (window.__om.onComplete) window.__om.onComplete();
                return;
              }
            } else {
              this.seek(frame);
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        },

        pause: function() {
          this.isPlaying = false;
        },

        toggle: function() {
          if (this.isPlaying) this.pause();
          else this.play();
        },

        getDuration: function() {
          return TOTAL_FRAMES;
        },

        getFps: function() {
          return FPS;
        },

        isReady: function() {
          return this.animations.length > 0 && document.readyState === 'complete';
        }
      };

      // Readiness signal for external capture tools
      Object.defineProperty(window, '__omReady', {
        get: function() { return window.__om.isReady(); }
      });

      // Initialize animations
      ${waapiScripts}

      // Seek to frame 0
      window.__om.seek(0);

      // Mark as ready
      window.__om._ready = true;
      if (window.__om.onReady) window.__om.onReady();

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        switch(e.key) {
          case ' ':
            e.preventDefault();
            window.__om.toggle();
            break;
          case 'ArrowLeft':
            window.__om.seek(Math.max(0, window.__om.currentFrame - 1));
            break;
          case 'ArrowRight':
            window.__om.seek(Math.min(TOTAL_FRAMES - 1, window.__om.currentFrame + 1));
            break;
          case 'Home':
            window.__om.seek(0);
            break;
          case 'End':
            window.__om.seek(TOTAL_FRAMES - 1);
            break;
        }
      });
    })();
    </script>` : "";

  // Generate playback controls
  const controls = options.includeControls !== false ? `
    <div class="om-controls">
      <button class="om-btn om-play-btn" aria-label="Play/Pause">▶</button>
      <input type="range" class="om-slider" min="0" max="${composition.frameCount - 1}" value="0" aria-label="Frame">
      <span class="om-frame-label">0 / ${composition.frameCount}</span>
    </div>` : "";

  // Generate component HTML
  const componentHtml = spec.components
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((comp) => {
      const meta = splitStyle(comp.style ?? {});
      const tag = meta.tag;
      const content = meta.content || escapeHtml(comp.name);
      const mediaAttrs = meta.src ? ` src="${escapeAttr(meta.src)}"` : "";
      const posterAttr = meta.poster ? ` poster="${escapeAttr(meta.poster)}"` : "";
      const loopAttr = meta.loop ? " loop" : "";
      const mutedAttr = meta.muted ? " muted" : "";
      const autoplayAttr = meta.autoplay ? " autoplay" : "";
      const controlsAttr = meta.controls ? " controls" : "";
      const playsinlineAttr = (tag === "video") ? " playsinline" : "";

      const staticCss = Object.entries(comp.style ?? {})
        .filter(([key]) => !key.startsWith("_") && !isTransformProp(key))
        .map(([key, val]) => `${camelToKebab(key)}: ${val}`)
        .join("; ");

      return `      <${tag} data-om-id="${comp.id}" data-om-name="${escapeHtml(comp.name)}" style="${staticCss}"${mediaAttrs}${posterAttr}${loopAttr}${mutedAttr}${autoplayAttr}${controlsAttr}${playsinlineAttr}>${content}</${tag}>`;
    })
    .join("\n");

  // Custom CSS
  const customCss = options.customCss ? `\n${options.customCss}` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(spec.project?.name ?? "OpenMotion Composition")}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #111;
      color: #fff;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      overflow: hidden;
    }
    .om-stage {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      background: ${background};
      overflow: hidden;
      transform-origin: center;
    }
    .om-stage [data-om-id] {
      position: absolute;
      will-change: transform, opacity;
    }
    .om-controls {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #1a1a1a;
      border-radius: 8px;
      margin-top: 16px;
    }
    .om-btn {
      background: #fff;
      color: #000;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
    }
    .om-btn:hover { background: #ddd; }
    .om-slider {
      width: 240px;
      accent-color: #fff;
    }
    .om-frame-label {
      font-size: 12px;
      color: #999;
      font-variant-numeric: tabular-nums;
      min-width: 80px;
      text-align: right;
    }
${customCss}
  </style>
</head>
<body>
  <div class="om-stage" data-om-composition="${escapeHtml(spec.project?.id ?? "composition")}" data-om-fps="${fps}" data-om-frames="${composition.frameCount}">
${componentHtml}
  </div>
${controls}
  <script>
    // Wire up controls
    document.addEventListener('DOMContentLoaded', () => {
      const playBtn = document.querySelector('.om-play-btn');
      const slider = document.querySelector('.om-slider');
      const label = document.querySelector('.om-frame-label');

      if (playBtn) {
        playBtn.addEventListener('click', () => {
          if (window.__om) window.__om.toggle();
          playBtn.textContent = window.__om && window.__om.isPlaying ? '❚❚' : '▶';
        });
      }

      if (slider) {
        slider.addEventListener('input', (e) => {
          if (window.__om) {
            window.__om.pause();
            window.__om.seek(parseInt(e.target.value, 10));
            if (label) label.textContent = e.target.value + ' / ' + (window.__om.totalFrames - 1);
            if (playBtn) playBtn.textContent = '▶';
          }
        });
      }

      // Update slider during playback
      if (window.__om) {
        window.__om.onSeek = (frame) => {
          if (slider) slider.value = frame;
          if (label) label.textContent = frame + ' / ' + (window.__om.totalFrames - 1);
        };
      }
    });
  </script>
${seekProtocol}
</body>
</html>`;

  return {
    html,
    totalFrames: composition.frameCount,
    durationMs: composition.totalDurationMs,
    fps,
    componentCount: spec.components.length,
  };
}

/** Generate a minimal seekable HTML preview for a single frame. */
export function generateFramePreview(
  spec: MotionSpec,
  frame: number,
  options: HtmlCompositionOptions = {},
): string {
  const fps = options.fps ?? 60;
  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
  const background = options.background ?? "#0a0a0a";

  // Import seekToFrame lazily to avoid circular dependency
  // This is a simple HTML preview without the full seek protocol
  const timeMs = (frame / fps) * 1000;
  const composition = flattenToTimeline(buildCompositionTree(spec), fps);

  const activeComponents = composition.timeline.filter((entry) => {
    return timeMs >= entry.startMs && timeMs <= entry.endMs;
  });

  const componentHtml = activeComponents.map((entry) => {
    const comp = spec.components.find((c) => c.id === entry.componentId);
    if (!comp) return "";
    const progress = (timeMs - entry.startMs) / entry.durationMs;
    const opacity = Math.max(0, Math.min(1, progress < 0.5 ? progress * 2 : 1));
    return `      <div data-om-id="${comp.id}" style="opacity: ${opacity.toFixed(3)};">${escapeHtml(comp.name)}</div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Frame ${frame}</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #111; }
    .om-stage { position: relative; width: ${width}px; height: ${height}px; background: ${background}; overflow: hidden; }
    .om-stage [data-om-id] { position: absolute; color: #fff; }
  </style>
</head>
<body>
  <div class="om-stage" data-frame="${frame}" data-time="${timeMs.toFixed(0)}ms">
${componentHtml}
  </div>
</body>
</html>`;
}

/** Generate an HTML composition with embedded design tokens. */
export function generateDesignTokenHtml(
  spec: MotionSpec,
  tokens: Record<string, string | number>,
  options: HtmlCompositionOptions = {},
): string {
  const tokenCss = Object.entries(tokens)
    .map(([key, val]) => `  --om-${camelToKebab(key)}: ${val};`)
    .join("\n");

  const result = generateHtmlComposition(spec, {
    ...options,
    customCss: `:root {\n${tokenCss}\n}\n${options.customCss ?? ""}`,
  });

  return result.html;
}

// --- Helpers ---

function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (match) => "-" + match.toLowerCase());
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}

function isTransformProp(prop: string): boolean {
  const transformProps = [
    "translateX", "translateY", "translateZ",
    "scale", "scaleX", "scaleY",
    "rotate", "rotateX", "rotateY", "rotateZ",
    "skewX", "skewY",
  ];
  return transformProps.includes(prop);
}

function splitStyle(style: Record<string, string | number>): {
  cssStyle: Record<string, string | number>;
  content: string;
  tag: string;
  src: string | null;
  poster: string | null;
  loop: boolean;
  muted: boolean;
  autoplay: boolean;
  controls: boolean;
} {
  const cssStyle: Record<string, string | number> = {};
  let content = "";
  let tag = "div";
  let src: string | null = null;
  let poster: string | null = null;
  let loop = false;
  let muted = false;
  let autoplay = true;
  let controls = false;

  for (const [k, v] of Object.entries(style)) {
    if (k === "_content") content = String(v);
    else if (k === "_tag") tag = String(v);
    else if (k === "_src") src = String(v);
    else if (k === "_poster") poster = String(v);
    else if (k === "_loop") loop = Boolean(v);
    else if (k === "_muted") muted = Boolean(v);
    else if (k === "_autoplay") autoplay = Boolean(v);
    else if (k === "_controls") controls = Boolean(v);
    else cssStyle[k] = v;
  }

  return { cssStyle, content, tag, src, poster, loop, muted, autoplay, controls };
}
