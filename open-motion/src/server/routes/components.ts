import { Router } from "express";
import { z } from "zod";
import {
  EasingSchema,
  KeyframeSchema,
  CssStyleSchema,
  IterationCountSchema,
  DirectionSchema,
  FillModeSchema,
  PlayStateSchema,
} from "@openmotion/shared";
import { validate, validated } from "../middleware/validate.js";
import { runAsync } from "../../utils/async.js";
import {
  listProjectComponents,
  createProjectComponent,
  getProjectComponent,
  patchProjectComponent,
  deleteProjectComponent,
} from "../services/componentService.js";

const ComponentInputSchema = z.object({
  name: z.string().optional(),
  templateId: z.string().optional(),
  sceneId: z.string().optional(),
  selector: z.string().optional(),
  durationMs: z.number().optional(),
  delayMs: z.number().optional(),
  iterationCount: IterationCountSchema.optional(),
  direction: DirectionSchema.optional(),
  fillMode: FillModeSchema.optional(),
  playState: PlayStateSchema.optional(),
  easing: EasingSchema.optional(),
  keyframes: z.array(KeyframeSchema).optional(),
  style: CssStyleSchema.optional(),
  orderIndex: z.number().optional(),
});

export const componentsRouter = Router({ mergeParams: true });

componentsRouter.get(
  "/",
  runAsync(async (req, res) => {
    res.json(listProjectComponents(req.params.id));
  }),
);

componentsRouter.post(
  "/",
  validate(ComponentInputSchema),
  runAsync(async (req, res) => {
    const input = validated<z.infer<typeof ComponentInputSchema>>(req);
    res.status(201).json(createProjectComponent(req.params.id, input));
  }),
);

componentsRouter.get(
  "/:cid",
  runAsync(async (req, res) => {
    res.json(getProjectComponent(req.params.id, req.params.cid));
  }),
);

componentsRouter.patch(
  "/:cid",
  validate(ComponentInputSchema),
  runAsync(async (req, res) => {
    const patch = validated<z.infer<typeof ComponentInputSchema>>(req);
    res.json(patchProjectComponent(req.params.id, req.params.cid, patch));
  }),
);

componentsRouter.delete(
  "/:cid",
  runAsync(async (req, res) => {
    deleteProjectComponent(req.params.id, req.params.cid);
    res.status(204).end();
  }),
);
