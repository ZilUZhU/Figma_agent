import { Router, Request, Response } from "express";
import { getActiveSessionCount } from "../services/session";
import { logger } from "../utils/logger";
const router = Router();

/**
 * Health check route
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    const activeSessions = getActiveSessionCount();

    const healthStatus = {
      status: "ok",
      version: process.env.npm_package_version || "unknown",
      uptime: `${Math.floor(uptime / 60 / 60)}h ${Math.floor(
        (uptime / 60) % 60
      )}m ${Math.floor(uptime % 60)}s`,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
      },
      sessions: {
        active: activeSessions,
      },
      timestamp: new Date().toISOString(),
    };

    logger.debug({ healthStatus }, "Health check successful");
    res.json(healthStatus);
  } catch (error) {
    logger.error(
      error instanceof Error ? error : { message: String(error) },
      "Error during health check"
    );
    res.status(500).json({
      status: "error",
      message: "Health check failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
