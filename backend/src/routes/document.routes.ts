import { Router } from "express";
import {
  deleteDocumentHandler,
  listDocumentsHandler,
  uploadDocumentHandler,
} from "../controllers/document.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { uploadLimiter } from "../middleware/rateLimit.middleware";
import { uploadSingle } from "../middleware/upload.middleware";

const router = Router();

router.post("/", requireAuth, uploadLimiter, uploadSingle, uploadDocumentHandler);
router.get("/", requireAuth, listDocumentsHandler);
router.delete("/:id", requireAuth, deleteDocumentHandler);

export default router;
