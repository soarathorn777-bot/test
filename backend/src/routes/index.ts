import { Router } from "express";
import authRoutes from "./auth.routes";
import chatRoutes from "./chat.routes";
import documentRoutes from "./document.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/chat", chatRoutes);
router.use("/documents", documentRoutes);

// Future: router.use("/conversations", conversationRoutes);

export default router;
