import type { MotionSpec, MotionComponent } from "@openmotion/shared";

/** Shader-Field Engine — material-level analysis of GPU-shaded motion. */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PropertySafety = "gpu_safe" | "gpu_unsafe" | "unknown";

/** A property found animated on a component, classified by GPU safety. */
export interface PropertyAudit {
  /** Property name (e.g. "translateX", "width", "filter"). */
  property: string;
  /** GPU safety classification. */
  safety: PropertySafety;
  /** Whether the property appears in any keyframe. */
  animated: boolean;
  /** Whether the property is set in static style. */
  styled: boolean;
}

/** Per-component shader-field audit. */
export interface ShaderFieldComponent {
  /** Component id. */
  componentId: string;
  /** Display label. */
  label: string;
  /** Whether the component is shader-rich. */
  shaderRich: boolean;
  /** Why it is (or is not) shader-rich. */
  shaderReason: string;
  /** Property-level audit. */
  properties: PropertyAudit[];
  /** Count of animated GPU-unsafe properties. */
  unsafeAnimatedCount: number;
  /** Whether the component violates prefers-reduced-motion. */
  reducedMotionHazard: boolean;
  /** Estimated compositor layers consumed (1..N). */
  compositorLayerCost: number;
  /** Overall GPU risk score 0..1. */
  risk: number;
}

/** A finding emitted by the shader-field engine. */
export interface ShaderFieldFinding {
  /** "unsafe_animated" | "reduced_motion_hazard" | "layer_budget_exceeded" | "shader_loop_conflict". */
  kind: "unsafe_animated" | "reduced_motion_hazard" | "layer_budget_exceeded" | "shader_loop_conflict";
  /** Component id or "composition". */
  subject: string;
  /** Human-readable description. */
  detail: string;
  /** Severity 0..1. */
  severity: number;
}

/** The full shader-field report. */
export interface ShaderFieldReport {
  /** Per-component audit. */
  components: ShaderFieldComponent[];
  /** Findings. */
  findings: ShaderFieldFinding[];
  /** Number of shader-rich components. */
  shaderRichCount: number;
  /** Total compositor layers consumed. */
  totalLayerCost: number;
  /** Compositor layer budget (heuristic ceiling). */
  layerBudget: number;
  /** Whether the composition exceeds the layer budget. */
  overLayerBudget: boolean;
  /** Number of components with reduced-motion hazards. */
  hazardCount: number;
  /** Number of components animating GPU-unsafe properties. */
  unsafeComponentCount: number;
  /** Aggregate GPU risk 0..1. */
  aggregateRisk: number;
  /** Component count the analysis ran against. */
  componentCount: number;
  /** Human-readable summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Property classification
// ---------------------------------------------------------------------------

const GPU_SAFE_PROPS = new Set([
  "translateX", "translateY", "translateZ",
  "rotate", "rotateX", "rotateY", "rotateZ",
  "scale", "scaleX", "scaleY", "scaleZ",
  "opacity",
  "filter",          // compositor-friendly on most modern browsers
  "backdropFilter",
  "transform",
  "willChange",
]);

const GPU_UNSAFE_PROPS = new Set([
  "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight",
  "left", "top", "right", "bottom",
  "margin", "marginLeft", "marginRight", "marginTop", "marginBottom",
  "padding", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom",
  "borderWidth", "borderRadius",
  "fontSize", "lineHeight", "letterSpacing", "wordSpacing",
  "backgroundPosition", "backgroundPositionX", "backgroundPositionY",
  "gridTemplateColumns", "gridTemplateRows", "gap",
  "flexBasis", "flexGrow", "flexShrink",
]);

function classifyProperty(name: string): PropertySafety {
  if (GPU_SAFE_PROPS.has(name)) return "gpu_safe";
  if (GPU_UNSAFE_PROPS.has(name)) return "gpu_unsafe";
  // Unknown properties (custom / vendor) default to unknown.
  return "unknown";
}

// ---------------------------------------------------------------------------
// Shader-richness detection
// ---------------------------------------------------------------------------

function isShaderRich(c: MotionComponent): { rich: boolean; reason: string } {
  const style = c.style ?? {};
  if ((c.templateId ?? "").startsWith("tpl-shader")) {
    return { rich: true, reason: "templateId starts with tpl-shader-" };
  }
  if (typeof style.filter === "string" && style.filter.length > 0) {
    return { rich: true, reason: `style.filter = "${style.filter}"` };
  }
  if (typeof style.backdropFilter === "string" && style.backdropFilter.length > 0) {
    return { rich: true, reason: `style.backdropFilter set` };
  }
  const keys = Object.keys(style);
  const perspectiveKey = keys.find((k) => /perspective/i.test(k));
  if (perspectiveKey) {
    return { rich: true, reason: `style.${perspectiveKey} set (3D context)` };
  }
  const has3dTransform = keys.some((k) => /rotate[XYZ]|translateZ|scaleZ/i.test(k));
  if (has3dTransform) {
    return { rich: true, reason: "3D transform property present in style" };
  }
  return { rich: false, reason: "no shader / filter / 3D signals" };
}

// ---------------------------------------------------------------------------
// Property audit
// ---------------------------------------------------------------------------

function auditProperties(c: MotionComponent): PropertyAudit[] {
  const animated = new Set<string>();
  for (const kf of c.keyframes) {
    for (const key of Object.keys(kf.properties)) animated.add(key);
  }
  const styled = new Set<string>();
  for (const key of Object.keys(c.style ?? {})) styled.add(key);

  const all = new Set<string>([...animated, ...styled]);
  const audits: PropertyAudit[] = [];
  for (const prop of all) {
    audits.push({
      property: prop,
      safety: classifyProperty(prop),
      animated: animated.has(prop),
      styled: styled.has(prop),
    });
  }
  // Stable ordering: animated first, then by name.
  audits.sort((a, b) => {
    if (a.animated !== b.animated) return a.animated ? -1 : 1;
    return a.property.localeCompare(b.property);
  });
  return audits;
}

// ---------------------------------------------------------------------------
// Reduced-motion hazard
// ---------------------------------------------------------------------------

function maxDisplacement(c: MotionComponent): number {
  let max = 0;
  for (const kf of c.keyframes) {
    for (const prop of ["translateX", "translateY", "rotate", "scale"] as const) {
      const v = kf.properties[prop];
      if (typeof v === "number") {
        max = Math.max(max, prop === "scale" ? Math.abs(v - 1) * 100 : Math.abs(v));
      } else if (typeof v === "string") {
        const m = v.match(/-?\d+\.?\d*/);
        if (m) max = Math.max(max, Math.abs(parseFloat(m[0])));
      }
    }
  }
  return max;
}

function isReducedMotionHazard(c: MotionComponent, shaderRich: boolean): boolean {
  const loops = c.iterationCount === "infinite" || (typeof c.iterationCount === "number" && c.iterationCount > 2);
  if (!loops) return false;
  // Any looping component with large displacement is a hazard; shader-rich
  // ones are worse because they force continuous recomposition.
  const displacement = maxDisplacement(c);
  if (shaderRich && displacement > 20) return true;
  return displacement > 80;
}

// ---------------------------------------------------------------------------
// Compositor layer cost
// ---------------------------------------------------------------------------

function compositorLayerCost(c: MotionComponent, shaderRich: boolean): number {
  let cost = 1;
  if (shaderRich) cost += 2;
  const style = c.style ?? {};
  if (typeof style.filter === "string") cost += 1;
  if (typeof style.backdropFilter === "string") cost += 2;
  if (Object.keys(style).some((k) => /perspective|translateZ|rotate[XY]/i.test(k))) cost += 1;
  if (typeof style.willChange === "string" && /transform|opacity|filter/i.test(style.willChange)) cost += 1;
  return cost;
}

// ---------------------------------------------------------------------------
// Risk scoring
// ---------------------------------------------------------------------------

function componentRisk(
  shaderRich: boolean,
  unsafeAnimatedCount: number,
  hazard: boolean,
  layerCost: number,
): number {
  let risk = 0;
  if (shaderRich) risk += 0.3;
  risk += Math.min(0.4, unsafeAnimatedCount * 0.15);
  if (hazard) risk += 0.35;
  risk += Math.min(0.2, (layerCost - 1) * 0.05);
  return Math.min(1, Math.round(risk * 100) / 100);
}

// ---------------------------------------------------------------------------
// Finding detection
// ---------------------------------------------------------------------------

function detectFindings(
  components: ShaderFieldComponent[],
  layerBudget: number,
  totalLayerCost: number,
): ShaderFieldFinding[] {
  const findings: ShaderFieldFinding[] = [];

  for (const comp of components) {
    if (comp.unsafeAnimatedCount > 0) {
      findings.push({
        kind: "unsafe_animated",
        subject: comp.label,
        detail: `"${comp.label}" animates ${comp.unsafeAnimatedCount} GPU-unsafe property (layout-triggering). Prefer transform / opacity.`,
        severity: Math.min(1, 0.3 + comp.unsafeAnimatedCount * 0.15),
      });
    }
    if (comp.reducedMotionHazard && comp.shaderRich) {
      findings.push({
        kind: "shader_loop_conflict",
        subject: comp.label,
        detail: `"${comp.label}" is shader-rich AND loops with displacement — forces continuous GPU recomposition. Suppress under prefers-reduced-motion.`,
        severity: 0.85,
      });
    } else if (comp.reducedMotionHazard) {
      findings.push({
        kind: "reduced_motion_hazard",
        subject: comp.label,
        detail: `"${comp.label}" loops with large displacement — vestibular hazard under prefers-reduced-motion.`,
        severity: 0.6,
      });
    }
  }

  if (totalLayerCost > layerBudget) {
    findings.push({
      kind: "layer_budget_exceeded",
      subject: "composition",
      detail: `Compositor layer cost ${totalLayerCost} exceeds budget ${layerBudget} — GPU will thrash on low-end devices.`,
      severity: Math.min(1, 0.5 + (totalLayerCost - layerBudget) * 0.05),
    });
  }

  findings.sort((a, b) => b.severity - a.severity);
  return findings;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Run shader-field analysis on a project spec. */
export function analyzeShaderField(spec: MotionSpec): ShaderFieldReport {
  const components = spec.components;
  if (components.length === 0) {
    return {
      components: [],
      findings: [],
      shaderRichCount: 0,
      totalLayerCost: 0,
      layerBudget: 16,
      overLayerBudget: false,
      hazardCount: 0,
      unsafeComponentCount: 0,
      aggregateRisk: 0,
      componentCount: 0,
      summary: "Empty project — no shader field to audit.",
    };
  }

  // Heuristic layer budget: 16 layers is a conservative ceiling for
  // mobile-class GPUs; desktop browsers tolerate more but the engine
  // stays conservative so compositions remain portable.
  const layerBudget = 16;

  const audited: ShaderFieldComponent[] = [];
  let shaderRichCount = 0;
  let totalLayerCost = 0;
  let hazardCount = 0;
  let unsafeComponentCount = 0;
  let riskSum = 0;

  for (const c of components) {
    const { rich: shaderRich, reason } = isShaderRich(c);
    if (shaderRich) shaderRichCount += 1;
    const properties = auditProperties(c);
    const unsafeAnimatedCount = properties.filter(
      (p) => p.animated && p.safety === "gpu_unsafe",
    ).length;
    if (unsafeAnimatedCount > 0) unsafeComponentCount += 1;
    const hazard = isReducedMotionHazard(c, shaderRich);
    if (hazard) hazardCount += 1;
    const layerCost = compositorLayerCost(c, shaderRich);
    totalLayerCost += layerCost;
    const risk = componentRisk(shaderRich, unsafeAnimatedCount, hazard, layerCost);
    riskSum += risk;
    audited.push({
      componentId: c.id,
      label: c.name || c.id,
      shaderRich,
      shaderReason: reason,
      properties,
      unsafeAnimatedCount,
      reducedMotionHazard: hazard,
      compositorLayerCost: layerCost,
      risk,
    });
  }

  const overLayerBudget = totalLayerCost > layerBudget;
  const aggregateRisk = Math.round((riskSum / components.length) * 100) / 100;
  const findings = detectFindings(audited, layerBudget, totalLayerCost);

  const summary = `${shaderRichCount} shader-rich component(s); ${unsafeComponentCount} animating GPU-unsafe props; ${hazardCount} reduced-motion hazard(s); layer cost ${totalLayerCost}/${layerBudget}; aggregate risk ${aggregateRisk}.`;

  return {
    components: audited,
    findings,
    shaderRichCount,
    totalLayerCost,
    layerBudget,
    overLayerBudget,
    hazardCount,
    unsafeComponentCount,
    aggregateRisk,
    componentCount: components.length,
    summary,
  };
}

/** Format a shader-field report as a human-readable string. */
export function formatShaderFieldReport(report: ShaderFieldReport): string {
  const lines: string[] = [];
  lines.push("=== Motion Shader-Field ===");
  lines.push("");
  lines.push(`Components: ${report.componentCount}`);
  lines.push(`Shader-rich: ${report.shaderRichCount}`);
  lines.push(`GPU-unsafe animators: ${report.unsafeComponentCount}`);
  lines.push(`Reduced-motion hazards: ${report.hazardCount}`);
  lines.push(`Compositor layers: ${report.totalLayerCost}/${report.layerBudget}${report.overLayerBudget ? " (over budget)" : ""}`);
  lines.push(`Aggregate risk: ${report.aggregateRisk}`);
  lines.push("");

  if (report.components.length > 0) {
    lines.push("--- Components (top 8 by risk) ---");
    const sorted = [...report.components].sort((a, b) => b.risk - a.risk);
    for (const c of sorted.slice(0, 8)) {
      const flag = c.reducedMotionHazard ? "!" : c.shaderRich ? "*" : " ";
      lines.push(`[${flag}] ${c.label.padEnd(16)} risk=${c.risk} rich=${c.shaderRich} layers=${c.compositorLayerCost} unsafe=${c.unsafeAnimatedCount}`);
      if (c.shaderRich) lines.push(`    reason: ${c.shaderReason}`);
    }
    lines.push("");
  }

  if (report.findings.length > 0) {
    lines.push("--- Findings ---");
    for (const f of report.findings) {
      lines.push(`• [${f.kind}] ${f.subject} — severity ${f.severity}`);
      lines.push(`    ${f.detail}`);
    }
    lines.push("");
  }

  lines.push(`Summary: ${report.summary}`);
  return lines.join("\n");
}
