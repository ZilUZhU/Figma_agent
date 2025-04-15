import { Router, Request, Response } from "express";
import { getActiveSessionCount } from "../services/session";

const router = Router();

/**
 * 健康检查路由
 * 返回服务状态和基本信息
 */
router.get("/", async (_req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: "ok",
    version: process.env.npm_package_version || "unknown",
    uptime: process.uptime(), // 服务运行时间（秒）
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + "MB", // 常驻集大小
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + "MB", // 堆总大小
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + "MB", // 已用堆大小
    },
    sessions: {
      active: getActiveSessionCount()
    },
    timestamp: new Date().toISOString()
  });
});

export default router; 