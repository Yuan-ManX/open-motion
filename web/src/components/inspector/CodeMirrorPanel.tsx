import { useState, useMemo, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { renderSpec } from "../../motion/cssRenderer.js";

type CodeFormat = "css" | "json" | "react" | "html";

const FORMATS: Array<{ id: CodeFormat; label: string }> = [
  { id: "css", label: "CSS" },
  { id: "json", label: "JSON" },
  { id: "react", label: "React" },
  { id: "html", label: "HTML" },
];

function generateJson(projectName: string, components: ReturnType<typeof useProjectStore.getState>["components"]): string {
  const spec = {
    project: { name: projectName },
    components: components.map((c) => ({
      id: c.id,
      name: c.name,
      durationMs: c.durationMs,
      delayMs: c.delayMs,
      iterationCount: c.iterationCount,
      direction: c.direction,
      fillMode: c.fillMode,
      playState: c.playState,
      trigger: c.trigger,
      easing: c.easing,
      keyframes: c.keyframes,
      style: c.style,
    })),
  };
  return JSON.stringify(spec, null, 2);
}

function generateReact(projectName: string, components: ReturnType<typeof useProjectStore.getState>["components"]): string {
  const { css, nodes } = renderSpec(components);
  const componentName = projectName.replace(/[^a-zA-Z0-9]/g, "") || "MotionScene";
  const elements = nodes
    .map((n) => {
      const content = n.content ? `>{${JSON.stringify(n.content)}}` : " />";
      const tag = n.tag || "div";
      return `        <${tag} className="${n.className}"${content}`;
    })
    .join("\n");

  return `import { useEffect, useRef } from "react";

const STYLES = ${JSON.stringify(css, null, 2)};

export function ${componentName}() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const styleEl = document.createElement("style");
    styleEl.textContent = STYLES;
    containerRef.current.appendChild(styleEl);
    return () => { styleEl.remove(); };
  }, []);

  return (
    <div ref={containerRef} className="motion-scene">
${elements}
    </div>
  );
}
`;
}

function generateHtml(projectName: string, components: ReturnType<typeof useProjectStore.getState>["components"]): string {
  const { css, nodes } = renderSpec(components);
  const body = nodes
    .map((n) => {
      const tag = n.tag || "div";
      const content = n.content || "";
      return `    <${tag} class="${n.className}">${content}</${tag}>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName}</title>
  <style>
${css.split("\n").map((l) => "    " + l).join("\n")}

    @media (prefers-reduced-motion: reduce) {
      [class^="om-c-"] {
        animation: none !important;
        transition: none !important;
      }
    }
  </style>
</head>
<body>
${body}
</body>
</html>
`;
}

export function CodeMirrorPanel() {
  const [format, setFormat] = useState<CodeFormat>("css");
  const [copied, setCopied] = useState(false);
  const projectName = useProjectStore((s) => s.project?.name ?? "Untitled");
  const components = useProjectStore((s) => s.components);

  const code = useMemo(() => {
    if (components.length === 0) return "// No components yet — add a layer to see generated code.";
    switch (format) {
      case "css": {
        const { css } = renderSpec(components);
        return css;
      }
      case "json":
        return generateJson(projectName, components);
      case "react":
        return generateReact(projectName, components);
      case "html":
        return generateHtml(projectName, components);
      default:
        return "";
    }
  }, [format, components, projectName]);

  const lineCount = useMemo(() => code.split("\n").length, [code]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      // Clipboard API may be unavailable in non-secure contexts.
    });
  }, [code]);

  return (
    <div className="flex flex-col h-full">
      {/* Format selector + copy */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-edge flex-shrink-0">
        <div className="flex gap-0.5">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                format === f.id
                  ? "bg-panel2 text-white border border-edge"
                  : "text-gray-500 hover:text-gray-300 border border-transparent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-[9px] text-gray-700 font-mono">{lineCount} lines</span>
        <button
          onClick={handleCopy}
          className="px-2 py-0.5 text-[10px] rounded bg-panel2 border border-edge text-gray-400 hover:text-white hover:border-accent transition-colors"
          title="Copy code to clipboard"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      {/* Code display */}
      <div className="flex-1 min-h-0 overflow-auto bg-black/40">
        <pre className="text-[10px] leading-relaxed font-mono text-gray-300 p-3 whitespace-pre-wrap break-all">
          {code}
        </pre>
      </div>

      {/* Footer with component count */}
      <div className="px-3 py-1 border-t border-edge flex-shrink-0 flex items-center justify-between">
        <span className="text-[9px] text-gray-600">
          {components.length} component{components.length !== 1 ? "s" : ""} · {format.toUpperCase()}
        </span>
        <span className="text-[9px] text-gray-700">auto-updates</span>
      </div>
    </div>
  );
}
