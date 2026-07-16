import type { MotionSpec } from "@openmotion/shared";
import { generateSpecCss } from "./css.js";

const RESERVED_STYLE_KEYS = new Set(["_content", "_tag", "_label", "_src", "_poster", "_loop", "_muted", "_autoplay", "_controls"]);

/** Strip reserved (non-CSS) keys from a style record, returning CSS-only style + meta. */
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
    else if (RESERVED_STYLE_KEYS.has(k)) continue;
    else cssStyle[k] = v;
  }
  return { cssStyle, content, tag, src, poster, loop, muted, autoplay, controls };
}

/** Build a standalone, runnable HTML document from a MotionSpec. */
export function generateStandaloneHtml(spec: MotionSpec): string {
  const componentsWithMeta = spec.components
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((c) => ({ ...c, _meta: splitStyle(c.style) }));

  // Rebuild components with CSS-only styles for the stylesheet generator.
  const cssComponents = componentsWithMeta.map((c) => ({
    ...c,
    style: c._meta.cssStyle,
  }));
  const css = generateSpecCss(cssComponents);

  const bodyNodes = componentsWithMeta
    .map((c) => {
      const cls = c.selector ? "" : ` class="om-c-${c.id}"`;
      const meta = c._meta;
      const isMedia = meta.tag === "img" || meta.tag === "video" || meta.tag === "audio";
      const mediaAttrs: string[] = [];
      if (isMedia) {
        if (meta.src) mediaAttrs.push(`src="${escapeAttr(meta.src)}"`);
        if (meta.poster) mediaAttrs.push(`poster="${escapeAttr(meta.poster)}"`);
        if (meta.loop) mediaAttrs.push("loop");
        if (meta.muted) mediaAttrs.push("muted");
        if (meta.autoplay) mediaAttrs.push("autoplay");
        if (meta.controls) mediaAttrs.push("controls");
        mediaAttrs.push("playsinline");
      }
      const attrs = mediaAttrs.length > 0 ? " " + mediaAttrs.join(" ") : "";
      if (isMedia) {
        return `    <${meta.tag}${cls}${attrs} data-om-name="${escapeHtml(c.name)}"></${meta.tag}>`;
      }
      const content = meta.content
        ? escapeHtml(meta.content)
        : escapeHtml(c.name);
      return `    <${meta.tag}${cls} data-om-name="${escapeHtml(c.name)}">${content}</${meta.tag}>`;
    })
    .join("\n");

  const title = escapeHtml(spec.project.name || "OpenMotion");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    gap: 24px; flex-wrap: wrap;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: radial-gradient(120% 120% at 50% 0%, #1b2230 0%, #0b0e14 60%);
    color: #f4f6fb;
    padding: 48px;
  }
  [data-om-name] { will-change: transform, opacity; }

${css}
</style>
</head>
<body>
${bodyNodes}
  <script>
    // Replay helper: shift+R restarts all animations.
    document.addEventListener('keydown', (e) => {
      if (e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        document.querySelectorAll('[data-om-name]').forEach((el) => {
          const cs = getComputedStyle(el).animationName;
          el.style.animation = 'none';
          void el.offsetWidth;
          el.style.animation = '';
        });
      }
    });
  </script>
</body>
</html>`;
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
