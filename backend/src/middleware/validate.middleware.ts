import { NextFunction, Request, Response } from "express";
import { ZodType, ZodTypeDef } from "zod";
import { HttpError } from "./error.middleware";

/**
 * The query-string counterpart to validate(). Express 4 exposes `req.query`
 * through a prototype getter, so the parsed value is returned rather than
 * written back onto the request.
 */
// Typed on the parsed output, not the input: schemas here apply defaults,
// so what comes out is narrower than what went in.
export function parseQuery<T>(schema: ZodType<T, ZodTypeDef, unknown>, req: Request): T {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    throw new HttpError(400, "Validation failed", result.error.flatten().fieldErrors);
  }
  return result.data;
}

export function validate(schema: ZodType<unknown, ZodTypeDef, unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Validation failed", details: result.error.flatten().fieldErrors });
    }
    req.body = result.data;
    next();
  };
}
