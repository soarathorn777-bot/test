import { promises as fs } from "fs";
import { Request, Response } from "express";
import { asyncHandler, HttpError } from "../middleware/error.middleware";
import { parseQuery } from "../middleware/validate.middleware";
import { readingsQuerySchema } from "../schemas/cgm.schemas";
import type { UpdateCommentInput } from "../schemas/cgm.schemas";
import {
  deleteUpload,
  getUpload,
  listReadings,
  listUploads,
  startIngest,
  toPublicReading,
  toPublicUpload,
  updateComment,
} from "../services/cgm.service";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guards before hitting Postgres, so a malformed id is a 404 rather than a 500. */
function requireUuid(id: string, subject: string): string {
  if (!UUID_PATTERN.test(id)) throw new HttpError(404, `${subject} not found`);
  return id;
}

export const uploadWorkbookHandler = asyncHandler(async (req: Request, res: Response) => {
  // Multipart bodies bypass the zod validate() middleware, so check inline.
  if (!req.file) {
    throw new HttpError(400, "No file uploaded");
  }

  try {
    const upload = await startIngest({
      userId: req.user!.userId,
      filename: req.file.originalname,
      filePath: req.file.path,
      byteSize: req.file.size,
    });

    // 202: the row exists and parsing has begun. The client polls its status.
    res.status(202).json({ upload: toPublicUpload(upload) });
  } catch (err) {
    // startIngest owns the spool file only once it has a row to attach it to.
    await fs.unlink(req.file.path).catch(() => {});
    throw err;
  }
});

export const listUploadsHandler = asyncHandler(async (req: Request, res: Response) => {
  const uploads = await listUploads(req.user!.userId);
  res.status(200).json({ uploads: uploads.map(toPublicUpload) });
});

export const getUploadHandler = asyncHandler(async (req: Request, res: Response) => {
  const upload = await getUpload(requireUuid(req.params.id, "Upload"), req.user!.userId);
  if (!upload) throw new HttpError(404, "Upload not found");
  res.status(200).json({ upload: toPublicUpload(upload) });
});

export const deleteUploadHandler = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await deleteUpload(requireUuid(req.params.id, "Upload"), req.user!.userId);
  if (!deleted) throw new HttpError(404, "Upload not found");
  res.status(204).send();
});

export const listReadingsHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(readingsQuerySchema, req);
  const page = await listReadings({ ...query, userId: req.user!.userId });
  res.status(200).json(page);
});

export const updateCommentHandler = asyncHandler(async (req: Request, res: Response) => {
  const { comment } = req.body as UpdateCommentInput;

  const reading = await updateComment({
    id: requireUuid(req.params.id, "Reading"),
    userId: req.user!.userId,
    comment,
  });
  if (!reading) throw new HttpError(404, "Reading not found");

  res.status(200).json({ reading: toPublicReading(reading) });
});
