import { Request, Response, NextFunction } from "express";
import { corsOptions, isDevMode } from "../config";

/**
 * CORS middleware to handle different origins based on environment
 */
export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  // 开发环境或特殊情况: null, ngrok域名
  if (
    isDevMode ||
    !origin ||
    origin === "null" ||
    origin?.includes("ngrok.io") ||
    origin?.includes("ngrok-free.app")
  ) {
    res.header("Access-Control-Allow-Origin", origin || "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
  } else if (corsOptions.origin.includes(origin)) {
    // 允许的生产环境源
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", corsOptions.methods.join(", "));
    res.header(
      "Access-Control-Allow-Headers",
      corsOptions.allowedHeaders.join(", ")
    );
    res.header("Access-Control-Allow-Credentials", "true");
  } else {
    console.warn(`不允许的Origin: ${origin}`);
    // 不设置CORS头以拒绝请求
  }

  // 处理预检请求
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
}; 