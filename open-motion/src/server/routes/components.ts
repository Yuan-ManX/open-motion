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
  TriggerSchema,
} from "@openmotion/shared";
import { validate, validated } from "../middleware/validate.js";
import { runAsync } from "../../utils/async.js";
import {
  listProjectComponents,
  createProjectComponent,
  getProjectComponent,
  patchProjectComponent,
  deleteProjectComponent,
  batchDeleteProjectComponents,
  batchUpdateComponents,
  duplicateProjectComponent,
  reorderProjectComponents,
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
  trigger: TriggerSchema.optional(),
  easing: EasingSchema.optional(),
  keyframes: z.array(KeyframeSchema).optional(),
  style: CssStyleSchema.optional(),
  orderIndex: z.number().optional(),
  parentId: z.string().nullable().optional(),
});

const BatchUpdateSchema = z.object({
  updates: z.array(
    z.object({
      componentId: z.string(),
      patch: ComponentInputSchema,
    }),
  ),
});

const ReorderSchema = z.object({
  orderedIds: z.array(z.string()),
});

const BatchDeleteSchema = z.object({
  componentIds: z.array(z.string()).min(1),
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

componentsRouter.post(
  "/reorder",
  validate(ReorderSchema),
  runAsync(async (req, res) => {
    const { orderedIds } = validated<z.infer<typeof ReorderSchema>>(req);
    res.json(reorderProjectComponents(req.params.id, orderedIds));
  }),
);

componentsRouter.patch(
  "/batch",
  validate(BatchUpdateSchema),
  runAsync(async (req, res) => {
    const { updates } = validated<z.infer<typeof BatchUpdateSchema>>(req);
    res.json(batchUpdateComponents(req.params.id, updates));
  }),
);

componentsRouter.delete(
  "/batch",
  validate(BatchDeleteSchema),
  runAsync(async (req, res) => {
    const { componentIds } = validated<z.infer<typeof BatchDeleteSchema>>(req);
    const removed = batchDeleteProjectComponents(req.params.id, componentIds);
    res.json({ removed });
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

componentsRouter.post(
  "/:cid/duplicate",
  runAsync(async (req, res) => {
    res.status(201).json(duplicateProjectComponent(req.params.id, req.params.cid));
  }),
);

componentsRouter.delete(
  "/:cid",
  runAsync(async (req, res) => {
    deleteProjectComponent(req.params.id, req.params.cid);
    res.status(204).end();
  }),
);
