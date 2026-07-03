import type { MotionSpec } from "@openmotion/shared";
import { generateSpecCss } from "./css.js";

const RESERVED_STYLE_KEYS = new Set(["_content", "_tag", "_label"]);

/** Strip reserved (non-CSS) keys from a style record, returning CSS-only style + meta. */
function splitStyle(style: Record<string, string | number>): {
  cssStyle: Record<string, string | number>;
  content: string;
  tag: string;
} {
  const cssStyle: Record<string, string | number> = {};
  let content = "";
  let tag = "div";
  for (const [k, v] of Object.entries(style)) {
    if (k === "_content") content = String(v);
    else if (k === "_tag") tag = String(v);
    else if (RESERVED_STYLE_KEYS.has(k)) continue;
    else cssStyle[k] = v;
  }
  return { cssStyle, content, tag };
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
      const content = c._meta.content
        ? escapeHtml(c._meta.content)
        : escapeHtml(c.name);
      return `    <${c._meta.tag}${cls} data-om-name="${escapeHtml(c.name)}">${content}</${c._meta.tag}>`;
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
