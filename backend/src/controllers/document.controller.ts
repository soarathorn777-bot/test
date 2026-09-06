import { Request, Response } from "express";
import { asyncHandler, HttpError } from "../middleware/error.middleware";
import {
  deleteDocument,
  ingestDocument,
  listDocuments,
  toPublicDocument,
} from "../services/document.service";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const uploadDocumentHandler = asyncHandler(async (req: Request, res: Response) => {
  // Multipart bodies bypass the zod validate() middleware, so check inline.
  if (!req.file) {
    throw new HttpError(400, "No file uploaded");
  }

  const document = await ingestDocument({
    userId: req.user!.userId,
    filename: req.file.originalname,
    buffer: req.file.buffer,
  });

  res.status(201).json({ document: toPublicDocument(document) });
});

export const listDocumentsHandler = asyncHandler(async (req: Request, res: Response) => {
  const documents = await listDocuments(req.user!.userId);
  res.status(200).json({ documents: documents.map(toPublicDocument) });
});

export const deleteDocumentHandler = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Guard before hitting Postgres so a malformed id is a 404, not a 500.
  if (!UUID_PATTERN.test(id)) {
    throw new HttpError(404, "Document not found");
  }

  const deleted = await deleteDocument(id, req.user!.userId);
  if (!deleted) {
    throw new HttpError(404, "Document not found");
  }

  res.status(204).send();
});
