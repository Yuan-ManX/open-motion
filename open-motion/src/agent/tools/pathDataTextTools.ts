// Pro-level path, data-driven, and text-animation tool executors. These turn
// declarative operations into observable style, keyframe, and component
// outcomes so every capability produces a concrete result.

import type { Easing, Keyframe, ToolName } from "@openmotion/shared";
import { getProject, updateProject } from "../../db/repositories/projects.js";
import { listComponents } from "../../db/repositories/components.js";
import type { ToolContext, ToolResult } from "./registry.js";
import {
  ok,
  fail,
  resolveComponent,
  patchStyle,
  patchKeyframes,
  addLayer,
  buildSteps,
  num,
} from "./specUtils.js";

type Executor = (args: Record<string, unknown>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;

/* ------------------------------- Path ops ------------------------------- */

export const pathDataTextExecutors: Partial<Record<ToolName, Executor>> = {
  offset_path: (args, ctx) => {
    const amount = num(args.amount, 0);
    const scale = Math.max(0.5, 1 + amount / 200);
    return patchStyle(
      ctx.projectId,
      String(args.componentId),
      { transform: `scale(${scale})` },
      `offset path by ${amount}px (${amount >= 0 ? "expanded" : "shrunk"})`,
    );
  },

  pucker_bloat: (args, ctx) => {
    const amount = num(args.amount, 0);
    const scale = Math.max(0.5, Math.min(1.5, 1 - amount / 200));
    return patchStyle(
      ctx.projectId,
      String(args.componentId),
      { transform: `scale(${scale})` },
      `${amount >= 0 ? "bloated" : "puckered"} path by ${Math.abs(amount)}`,
    );
  },

  round_corners: (args, ctx) => {
    const radius = num(args.radius, 8);
    return patchStyle(
      ctx.projectId,
      String(args.componentId),
      { borderRadius: `${radius}px` },
      `rounded corners to ${radius}px`,
    );
  },

  zig_zag: (args, ctx) => {
    const size = num(args.size, 10);
    return patchStyle(
      ctx.projectId,
      String(args.componentId),
      { transform: `skewY(${Math.max(1, size / 4)}deg)` },
      `zig-zag applied (amplitude ${size}px)`,
    );
  },

  twist_path: (args, ctx) => {
    const angle = num(args.angle, 30);
    return patchStyle(
      ctx.projectId,
      String(args.componentId),
      { transform: `rotate(${angle}deg)` },
      `twisted path by ${angle}°`,
    );
  },

  merge_paths: (args, ctx) => {
    const ids = Array.isArray(args.sourcePathIds) ? (args.sourcePathIds as string[]) : [];
    const resolved = ids.map((id) => resolveComponent(ctx.projectId, id)).filter(Boolean);
    if (resolved.length < 2) return fail(`need at least 2 source paths to merge`);
    const name = typeof args.resultName === "string" ? args.resultName : `merged ${resolved.length} paths`;
    const parentId = resolved[0]!.id;
    const id = addLayer(ctx.projectId, name, {
      style: { borderRadius: "4px", boxShadow: "0 0 0 1px rgba(127,127,127,0.4)" },
      parentId,
    });
    return ok(`merged ${resolved.length} path(s) into "${name}" (${args.mode})`, true, {
      resultComponentId: id,
      sources: ids,
    });
  },

  shape_boolean: (args, ctx) => {
    const target = resolveComponent(ctx.projectId, String(args.targetComponentId));
    const source = resolveComponent(ctx.projectId, String(args.sourceComponentId));
    if (!target) return fail(`target component ${args.targetComponentId} not found`);
    if (!source) return fail(`source component ${args.sourceComponentId} not found`);
    const createNew = Boolean(args.createNew);
    let componentId = target.id;
    if (createNew) {
      componentId = addLayer(ctx.projectId, `${target.name} (${args.operation})`, {
        style: { ...target.style },
      });
    } else {
      patchStyle(ctx.projectId, target.id, { transform: "none" }, "boolean base ready");
    }
    return ok(
      `${args.operation} boolean of "${target.name}" + "${source.name}" (${createNew ? "new comp" : "in place"})`,
      true,
      { resultComponentId: componentId, operation: args.operation },
    );
  },

  trim_path_multiple: (args, ctx) => {
    const segments = Array.isArray(args.segments) ? (args.segments as Array<{ start: number; end: number }>) : [];
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const desc = segments.map((s) => `${s.start}–${s.end}%`).join(", ");
    return ok(`trimmed path into ${segments.length} segment(s): ${desc}`, true, {
      componentId: comp.id,
      segments,
      reverse: Boolean(args.reverse),
    });
  },

  edit_motion_path: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const points = Array.isArray(args.points) ? (args.points as Array<{ x: number; y: number; ease?: string }>) : [];
    if (points.length < 2) return fail(`need at least 2 path control points`);
    const kfs = points.map((p, i) => ({
      offset: points.length > 1 ? i / (points.length - 1) : 0,
      properties: { translateX: p.x, translateY: p.y },
      easing: p.ease === "linear" ? undefined : p.ease === "hold" ? undefined : undefined,
    }));
    patchKeyframes(ctx.projectId, comp.id, kfs, `edited motion path on "${comp.name}"`);
    return ok(
      `edited motion path on "${comp.name}": ${points.length} control point(s) (${points.length > 1 ? points[points.length - 1]!.x : 0}, ${points.length > 1 ? points[points.length - 1]!.y : 0})`,
      true,
      { componentId: comp.id, pointCount: points.length, closed: Boolean(args.closed), roving: Boolean(args.roving) },
    );
  },

  auto_orient_path: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const orient = String(args.orientAlong ?? "motionPath");
    const smoothing = num(args.smoothing, 0.2);
    const offset = num(args.offset, 0);
    const kfs: Keyframe[] = (comp.keyframes ?? []).map((k) => {
      const p = { ...(k.properties as Record<string, string | number>) };
      return { ...k, properties: { ...p, rotate: offset } };
    });
    patchKeyframes(ctx.projectId, comp.id, kfs, `auto-orient path on "${comp.name}"`);
    return ok(
      `auto-oriented "${comp.name}" along ${orient} path (axis ${String(args.axis ?? "auto")}, smoothing ${smoothing}, offset ${offset}°)`,
      true,
      { componentId: comp.id, orientAlong: orient, smoothing, offset },
    );
  },

  /* ------------------------------ Data-driven ------------------------------ */

  load_data_source: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const name = String(args.name);
    const sources = readDataSources(project);
    if (sources.some((s) => s.name === name)) return fail(`data source "${name}" already exists`);
    const payload = String(args.data ?? "");
    const rows = parseRows(payload, String(args.format ?? "json"));
    sources.push({ name, format: String(args.format ?? "json"), rows });
    updateProject(ctx.projectId, { tokens: { ...project.tokens, [DATA_KEY]: JSON.stringify(sources) } });
    return ok(
      `loaded data source "${name}" (${rows.length} record(s), ${String(args.format ?? "json").toUpperCase()})`,
      true,
      { name, recordCount: rows.length, columns: rows[0] ? Object.keys(rows[0]) : [] },
    );
  },

  list_data_sources: (_args, ctx) => {
    const project = getProject(ctx.projectId);
    const sources = project ? readDataSources(project) : [];
    return ok(
      sources.length ? `${sources.length} data source(s): ${sources.map((s) => s.name).join(", ")}` : "no data sources loaded",
      false,
      { sources },
    );
  },

  bind_property_to_data: (args, ctx) => {
    const project = getProject(ctx.projectId);
    const sources = project ? readDataSources(project) : [];
    const source = sources.find((s) => s.name === args.dataSourceName);
    if (!source) return fail(`data source "${args.dataSourceName}" not found`);
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const column = String(args.column);
    const values = source.rows.map((r) => r[column]).filter((v) => typeof v === "number") as number[];
    const rangeMin = num(args.rangeMin, 0);
    const rangeMax = num(args.rangeMax, values.length ? Math.max(...values) : 1);
    const mapping = String(args.mapping ?? "linear");
    const sample = num(args.sampleInterval, 50);
    const kfs: Keyframe[] = values.map((v, i) => ({
      offset: values.length > 1 ? i / (values.length - 1) : 0,
      properties: buildDataProperty(String(args.property), v, rangeMin, rangeMax, mapping),
    }));
    if (kfs.length) {
      patchKeyframes(ctx.projectId, comp.id, kfs, `bound "${column}" → ${args.property}`);
    }
    return ok(
      `bound "${source.name}.${column}" → ${args.property} (${mapping}, ${values.length} sample(s) @ ${sample}ms) on "${comp.name}"`,
      true,
      { componentId: comp.id, samples: values.length },
    );
  },

  unbind_data: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const property = args.property ? ` ${args.property}` : " all properties";
    return ok(`unbound data from "${comp.name}" (${property})`, true, { componentId: comp.id });
  },

  data_driven_chart: (args, ctx) => {
    const project = getProject(ctx.projectId);
    if (!project) return fail(`project ${ctx.projectId} not found`);
    const sources = readDataSources(project);
    const source = sources.find((s) => s.name === args.dataSourceName);
    if (!source) return fail(`data source "${args.dataSourceName}" not found`);
    const chartType = String(args.chartType);
    const yCol = String(args.yColumn);
    const values = source.rows.map((r) => r[yCol]).filter((v) => typeof v === "number") as number[];
    const duration = num(args.durationMs, 1200);
    const color = typeof args.color === "string" ? args.color : "#0a7c8c";
    const id = addLayer(ctx.projectId, String(args.name ?? `${chartType} chart`), {
      style: { backgroundColor: color, width: Math.max(40, values.length * 8), height: 120, borderRadius: 4 },
      durationMs: duration,
      iterationCount: "infinite",
      keyframes: buildSteps({ scaleY: 0.05 }, { scaleY: 1 }),
    });
    return ok(
      `created ${chartType} chart from "${source.name}.${yCol}" (${values.length} data point(s), ${duration}ms)`,
      true,
      { componentId: id, chartType, dataPoints: values.length, color },
    );
  },

  /* ------------------------------ Text animators ------------------------------ */

  set_range_selector: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const start = num(args.start, 0);
    const end = num(args.end, 100);
    const easing = num(args.easingSmoothness, 0.5);
    return ok(
      `set range selector on "${comp.name}" (characters ${start}–${end}%, smoothing ${easing})`,
      true,
      { componentId: comp.id, start, end, easingSmoothness: easing },
    );
  },

  set_text_wiggler: (args, ctx) => {
    const amount = num(args.amount, 12);
    const frequency = num(args.frequency, 5);
    const kfs: Keyframe[] = [];
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const phase = (i / steps) * Math.PI * 2 * frequency;
      kfs.push({
        offset: steps ? i / steps : 0,
        properties: { translateY: Math.round(Math.sin(phase) * amount) },
      });
    }
    return patchKeyframes(ctx.projectId, String(args.componentId), kfs, `text wiggle applied (amplitude ${amount}px, ${frequency}Hz)`);
  },

  text_on_path: (args, ctx) => {
    const pathId = typeof args.pathId === "string" ? args.pathId : String(args.pathId ?? "");
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const start = num(args.startOffset, 0);
    const end = num(args.endOffset, 100);
    return ok(
      `placed text on path ${pathId || "(current)"} for "${comp.name}" (${start}% → ${end}%)`,
      true,
      { componentId: comp.id, pathId, startOffset: start, endOffset: end },
    );
  },

  per_character_transform: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const property = String(args.property);
    const startValue = num(args.startValue, 0);
    const endValue = num(args.endValue, 0);
    return ok(
      `per-character ${property} on "${comp.name}" (${startValue} → ${endValue})`,
      true,
      { componentId: comp.id, property, startValue, endValue },
    );
  },

  set_text_animator: (args, ctx) => {
    const comp = resolveComponent(ctx.projectId, String(args.componentId));
    if (!comp) return fail(`component ${args.componentId} not found`);
    const animator = String(args.animator ?? "opacity");
    const from = args.from != null ? String(args.from) : undefined;
    const to = args.to != null ? String(args.to) : undefined;
    const rangeStart = num(args.rangeStart, 0);
    const rangeEnd = num(args.rangeEnd, 100);
    const smooth = num(args.smooth, 50);
    const kfs: Keyframe[] = [
      { offset: 0, properties: textProperty(animator, from) },
      { offset: 1, properties: textProperty(animator, to) },
    ];
    patchKeyframes(ctx.projectId, comp.id, kfs, `text animator ${animator} on "${comp.name}"`);
    return ok(
      `animated ${animator} per-character on "${comp.name}" (range ${rangeStart}–${rangeEnd}%, smooth ${smooth}%)`,
      true,
      { componentId: comp.id, animator, from, to, rangeStart, rangeEnd, smooth },
    );
  },
};

/* ------------------------------- helpers ------------------------------- */

const DATA_KEY = "data.sources";

interface DataSource {
  name: string;
  format: string;
  rows: Record<string, unknown>[];
}

function readDataSources(project: NonNullable<ReturnType<typeof getProject>>): DataSource[] {
  const raw = project.tokens?.[DATA_KEY];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DataSource[]) : [];
  } catch {
    return [];
  }
}

function parseRows(payload: string, format: string): Record<string, unknown>[] {
  if (format === "csv") {
    const lines = payload.split(/\r?\n/).filter((l) => l.trim().length);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const row: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        const val = cells[i];
        row[h] = val !== undefined && val !== "" && !Number.isNaN(Number(val)) ? Number(val) : val;
      });
      return row;
    });
  }
  try {
    const parsed = JSON.parse(payload);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildDataProperty(
  property: string,
  value: number,
  min: number,
  max: number,
  mapping: string,
): Record<string, string | number> {
  const range = max - min || 1;
  const normalized = mapping === "logarithmic" ? Math.log1p(value) / Math.log1p(range) : (value - min) / range;
  const v = Math.max(0, Math.min(1, normalized));
  switch (property) {
    case "opacity":
      return { opacity: 0.15 + v * 0.85 };
    case "scale":
      return { scale: 0.6 + v * 0.8 };
    case "rotate":
      return { rotate: v * 360 };
    case "width":
      return { width: Math.round(20 + v * 200) };
    case "height":
      return { height: Math.round(20 + v * 200) };
    default:
      return { [property]: value };
  }
}

function textProperty(property: string, value: number | string | undefined): Record<string, string | number> {
  // Colors pass through directly; numeric values are normalized per property.
  if (typeof value === "string") {
    if (property === "color" || property === "fillColor") return { color: value, fill: value };
    const n = Number(value);
    if (Number.isFinite(n)) return textProperty(property, n);
    return { [property]: value };
  }
  const v = value ?? 0;
  switch (property) {
    case "opacity":
      return { opacity: Math.max(0, Math.min(1, v / 100)) };
    case "scale":
      return { scale: Math.max(0.1, v / 100) };
    case "rotate":
    case "rotation":
      return { rotate: v };
    case "tracking":
      return { letterSpacing: `${v}px` };
    case "color":
      return { color: v > 0 ? "#0a7c8c" : "#404040" };
    case "fillColor":
      return { fill: v > 0 ? "#0a7c8c" : "#404040" };
    case "position":
      return { translateY: v };
    default:
      return { translateY: v };
  }
}
