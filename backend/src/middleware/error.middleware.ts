import { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";

export type FieldErrors = Record<string, string[] | undefined>;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Field-level messages, matching what validate() returns for bodies. */
    public details?: FieldErrors,
  ) {
    super(message);
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    return res
      .status(err.status)
      .json(err.details ? { error: err.message, details: err.details } : { error: err.message });
  }

  if (err instanceof MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "File is too large" : "Invalid file upload";
    return res.status(status).json({ error: message });
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
