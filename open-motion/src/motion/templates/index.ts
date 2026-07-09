import type { MotionComponent } from "@openmotion/shared";
import { createId, now } from "../../utils/id.js";
import { fadeTemplate } from "./fade.js";
import { slideTemplate } from "./slide.js";
import { bounceTemplate } from "./bounce.js";
import { spinTemplate } from "./spin.js";
import { pulseTemplate } from "./pulse.js";
import { scaleTemplate } from "./scale.js";
import { rotateTemplate } from "./rotate.js";
import { squashStretchTemplate } from "./squashStretch.js";
import { logoRevealTemplate } from "./logoReveal.js";
import { resizeTemplate } from "./resize.js";
import { springTemplate } from "./spring.js";
import { flipCardTemplate } from "./flipCard.js";
import { typewriterTemplate } from "./typewriter.js";
import { shimmerTemplate } from "./shimmer.js";
import { morphTemplate } from "./morph.js";
import { notificationTemplate } from "./notification.js";
import { progressBarTemplate } from "./progressBar.js";
import { rippleTemplate } from "./ripple.js";
import { marqueeTemplate } from "./marquee.js";
import type { ComponentDraft, TemplateDef } from "./helper.js";

export const TEMPLATES: TemplateDef[] = [
  fadeTemplate,
  slideTemplate,
  bounceTemplate,
  scaleTemplate,
  rotateTemplate,
  logoRevealTemplate,
  pulseTemplate,
  squashStretchTemplate,
  spinTemplate,
  resizeTemplate,
  springTemplate,
  flipCardTemplate,
  typewriterTemplate,
  shimmerTemplate,
  morphTemplate,
  notificationTemplate,
  progressBarTemplate,
  rippleTemplate,
  marqueeTemplate,
];

export function getTemplate(id: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Materialize a template's drafts into full components bound to a project. */
export function instantiateTemplate(
  templateId: string,
  projectId: string,
): MotionComponent[] {
  const tpl = getTemplate(templateId);
  if (!tpl) return [];
  const drafts = tpl.build();
  const ts = now();
  return drafts.map((d) => ({
    ...d,
    id: createId("c_"),
    projectId,
    templateId,
    createdAt: ts,
    updatedAt: ts,
  }));
}

export type { ComponentDraft, TemplateDef };
