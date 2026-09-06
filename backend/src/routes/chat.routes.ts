import { Router } from "express";
import { sendMessageHandler } from "../controllers/chat.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { sendMessageSchema } from "../schemas/chat.schemas";

const router = Router();

router.post("/", requireAuth, validate(sendMessageSchema), sendMessageHandler);

export default router;
