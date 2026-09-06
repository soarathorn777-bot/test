import { Router } from "express";
import {
  deleteUploadHandler,
  getUploadHandler,
  listReadingsHandler,
  listUploadsHandler,
  updateCommentHandler,
  uploadWorkbookHandler,
} from "../controllers/cgm.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { uploadLimiter } from "../middleware/rateLimit.middleware";
import { uploadWorkbook } from "../middleware/upload.middleware";
import { validate } from "../middleware/validate.middleware";
import { updateCommentSchema } from "../schemas/cgm.schemas";

const router = Router();

router.use(requireAuth);

router.get("/readings", listReadingsHandler);
router.patch("/readings/:id", validate(updateCommentSchema), updateCommentHandler);

router.post("/uploads", uploadLimiter, uploadWorkbook, uploadWorkbookHandler);
router.get("/uploads", listUploadsHandler);
router.get("/uploads/:id", getUploadHandler);
router.delete("/uploads/:id", deleteUploadHandler);

export default router;
