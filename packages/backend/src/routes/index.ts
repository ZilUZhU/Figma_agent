import { Router } from "express";
import healthRoutes from "./health";

const router = Router();

// Register HTTP routes
router.use("/health", healthRoutes);

router.get("/", (_req, res) => {
  res.send(`Figma AI Agent Backend - Health Check at /health`);
});

export default router;
