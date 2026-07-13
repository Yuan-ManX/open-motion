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
import { orbitTemplate } from "./orbit.js";
import { waveTemplate } from "./wave.js";
import { confettiTemplate } from "./confetti.js";
import { parallaxTemplate } from "./parallax.js";
import { kineticTextTemplate } from "./kineticText.js";
import { particleBurstTemplate } from "./particleBurst.js";
import { liquidMorphTemplate } from "./liquidMorph.js";
import { elasticCollapseTemplate } from "./elasticCollapse.js";
import { glitchTemplate } from "./glitch.js";
import { reveal3dTemplate } from "./reveal3d.js";
import { gradientShiftTemplate } from "./gradientShift.js";
import { elasticScaleTemplate } from "./elasticScale.js";
import { textScrambleTemplate } from "./textScramble.js";
import { auroraTemplate } from "./aurora.js";
import { hologramTemplate } from "./hologram.js";
import { prismaticTemplate } from "./prismatic.js";
import { liquidMetalTemplate } from "./liquidMetal.js";
import { neonFlickerTemplate } from "./neonFlicker.js";
import { depthCardTemplate } from "./depthCard.js";
import { glassmorphismTemplate } from "./glassmorphism.js";
import { kineticRibbonTemplate } from "./kineticRibbon.js";
import { magneticPullTemplate } from "./magneticPull.js";
import { scrollRevealTemplate } from "./scrollReveal.js";
import { gestureTapTemplate } from "./gestureTap.js";
import { gestureSwipeTemplate } from "./gestureSwipe.js";
import { skeletonLoaderTemplate } from "./skeletonLoader.js";
import { pageTransitionTemplate } from "./pageTransition.js";
import { microInteractionTemplate } from "./microInteraction.js";
import { hoverLiftTemplate } from "./hoverLift.js";
import { stateTransitionTemplate } from "./stateTransition.js";
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
  orbitTemplate,
  waveTemplate,
  confettiTemplate,
  parallaxTemplate,
  kineticTextTemplate,
  particleBurstTemplate,
  liquidMorphTemplate,
  elasticCollapseTemplate,
  glitchTemplate,
  reveal3dTemplate,
  gradientShiftTemplate,
  elasticScaleTemplate,
  textScrambleTemplate,
  auroraTemplate,
  hologramTemplate,
  prismaticTemplate,
  liquidMetalTemplate,
  neonFlickerTemplate,
  depthCardTemplate,
  glassmorphismTemplate,
  kineticRibbonTemplate,
  magneticPullTemplate,
  scrollRevealTemplate,
  gestureTapTemplate,
  gestureSwipeTemplate,
  skeletonLoaderTemplate,
  pageTransitionTemplate,
  microInteractionTemplate,
  hoverLiftTemplate,
  stateTransitionTemplate,
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

export interface CategorySummary {
  category: string;
  count: number;
  templates: Array<{ id: string; name: string; description: string }>;
}

/** Return all templates grouped by category with counts. */
export function getCategories(): CategorySummary[] {
  const map = new Map<string, CategorySummary>();
  for (const tpl of TEMPLATES) {
    let entry = map.get(tpl.category);
    if (!entry) {
      entry = { category: tpl.category, count: 0, templates: [] };
      map.set(tpl.category, entry);
    }
    entry.count++;
    entry.templates.push({ id: tpl.id, name: tpl.name, description: tpl.description });
  }
  return Array.from(map.values()).sort((a, b) => a.category.localeCompare(b.category));
}

/** Return templates filtered by category. */
export function listTemplatesByCategory(category: string): TemplateDef[] {
  return TEMPLATES.filter((t) => t.category === category);
}
