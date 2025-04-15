import { Router } from "express";
import chatRoutes from "./chat";
import healthRoutes from "./health";

const router = Router();

// 注册路由
router.use("/api/chat", chatRoutes);
router.use("/health", healthRoutes);

export default router; 