import type { Easing, Keyframe, MotionComponent } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";

/** A component before it is persisted — id/projectId/timestamps assigned at creation. */
export type ComponentDraft = Omit<MotionComponent, "id" | "projectId" | "createdAt" | "updatedAt">;

export interface TemplateDef {
  id: string;
  name: string;
  category: "entrance" | "exit" | "emphasis" | "transition" | "load";
  description: string;
  tags: string[];
  build: () => ComponentDraft[];
}

let orderCounter = 0;
export function resetOrder() {
  orderCounter = 0;
}

/** Build a component draft with sensible defaults. */
export function draft(
  name: string,
  opts: Partial<
    Pick<
      MotionComponent,
      | "durationMs"
      | "delayMs"
      | "iterationCount"
      | "direction"
      | "fillMode"
      | "easing"
      | "keyframes"
      | "style"
      | "selector"
      | "sceneId"
    >
  > = {},
): ComponentDraft {
  const draft: ComponentDraft = {
    sceneId: null,
    name,
    selector: null,
    templateId: null,
    durationMs: opts.durationMs ?? 800,
    delayMs: opts.delayMs ?? 0,
    iterationCount: opts.iterationCount ?? 1,
    direction: opts.direction ?? "normal",
    fillMode: opts.fillMode ?? "forwards",
    playState: "running",
    trigger: "onLoad",
    easing: opts.easing ?? easingPreset("ease-out"),
    keyframes: opts.keyframes ?? [],
    style: opts.style ?? {},
    orderIndex: orderCounter++,
  };
  return draft;
}

export const kf = (offset: number, properties: Keyframe["properties"], easing?: Easing): Keyframe => ({
  offset,
  properties,
  easing,
});
