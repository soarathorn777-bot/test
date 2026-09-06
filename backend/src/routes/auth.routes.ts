import { Router } from "express";
import { loginHandler, logoutHandler, meHandler, registerHandler } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { authLimiter } from "../middleware/rateLimit.middleware";
import { validate } from "../middleware/validate.middleware";
import { loginSchema, registerSchema } from "../schemas/auth.schemas";

const router = Router();

router.post("/register", authLimiter, validate(registerSchema), registerHandler);
router.post("/login", authLimiter, validate(loginSchema), loginHandler);
router.get("/me", requireAuth, meHandler);
router.post("/logout", requireAuth, logoutHandler);

export default router;
