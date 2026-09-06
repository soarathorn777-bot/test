import { z } from "zod";

/** Query strings arrive as text, so the bounds are coerced here. */
export const readingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // Capped so one request can never ask for the whole history at once.
  pageSize: z.coerce.number().int().min(1).max(1000).default(200),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export const updateCommentSchema = z.object({
  comment: z.string().max(1000).default(""),
});

export type ReadingsQueryInput = z.infer<typeof readingsQuerySchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
