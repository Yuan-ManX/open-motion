import type {
  MotionComponent,
  MotionProject,
  MotionSpec,
  Easing,
} from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";
import { parseJson } from "./index.js";

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  scenes_json: string;
  tokens_json: string;
  global_timing_json: string;
  status: string;
  source_template_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ComponentRow {
  id: string;
  project_id: string;
  scene_id: string | null;
  name: string;
  selector: string | null;
  template_id: string | null;
  duration_ms: number;
  delay_ms: number;
  iteration_count: string;
  direction: string;
  fill_mode: string;
  play_state: string;
  trigger: string;
  easing_json: string;
  keyframes_json: string;
  style_json: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export function rowToProject(r: ProjectRow): MotionProject {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    scenes: parseJson(r.scenes_json, []),
    tokens: parseJson(r.tokens_json, {}),
    globalTiming: parseJson(r.global_timing_json, {}),
    status: (r.status as MotionProject["status"]) ?? "draft",
    sourceTemplateId: r.source_template_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function rowToComponent(r: ComponentRow): MotionComponent {
  const easing = parseJson<Easing | null>(r.easing_json, null) ?? easingPreset("ease-out");
  const iterRaw = r.iteration_count;
  const iterationCount: MotionComponent["iterationCount"] =
    iterRaw === "infinite" ? "infinite" : Number(iterRaw) || 1;
  return {
    id: r.id,
    projectId: r.project_id,
    sceneId: r.scene_id,
    name: r.name,
    selector: r.selector,
    templateId: r.template_id,
    durationMs: r.duration_ms,
    delayMs: r.delay_ms,
    iterationCount,
    direction: r.direction as MotionComponent["direction"],
    fillMode: r.fill_mode as MotionComponent["fillMode"],
    playState: r.play_state as MotionComponent["playState"],
    trigger: (r.trigger as MotionComponent["trigger"]) ?? "onLoad",
    easing,
    keyframes: parseJson(r.keyframes_json, []),
    style: parseJson(r.style_json, {}),
    orderIndex: r.order_index,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function assembleSpec(
  project: MotionProject,
  components: MotionComponent[],
): MotionSpec {
  return { project, components: components.sort((a, b) => a.orderIndex - b.orderIndex) };
}

export type { ProjectRow, ComponentRow };
