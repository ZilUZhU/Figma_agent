import { Router } from "express";
// Removed: import chatRoutes from "./chat"; // Chat routes are now WebSocket only
import healthRoutes from "./health";

const router = Router();

// Register only the remaining HTTP routes
// router.use("/api/chat", chatRoutes); // This line is removed
router.use("/health", healthRoutes);

// Optional: Add a root route or API documentation route if needed
router.get("/", (_req, res) => {
  res.send(`Figma AI Agent Backend - Health Check at /health`);
});


export default router;