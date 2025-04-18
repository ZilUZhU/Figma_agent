import { Request, Response, NextFunction } from "express";
import { corsOptions, isDevMode } from "../config";
import { logger } from "../utils/logger"; // Import the logger

/**
 * CORS middleware to handle allowed origins for HTTP requests.
 * WebSocket origin validation happens separately during the WS handshake.
 */
export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  let allowedOrigin: string | undefined = undefined;

  if (origin) {
      // Allow specific origins defined in config OR allow any origin in development mode
      if (corsOptions.origin.includes(origin) || isDevMode) {
          allowedOrigin = origin;
      }
  } else if (isDevMode) {
      // Allow requests with no origin in development mode (e.g., server-side tools, curl)
      // In production, you might want to disallow requests without an origin.
      allowedOrigin = "*";
  }

  if (allowedOrigin) {
      res.header("Access-Control-Allow-Origin", allowedOrigin);
      res.header("Access-Control-Allow-Methods", corsOptions.methods.join(", "));
      res.header("Access-Control-Allow-Headers", corsOptions.allowedHeaders.join(", "));
      res.header("Access-Control-Allow-Credentials", String(corsOptions.credentials));
  } else if (origin) {
      // Log disallowed origins but don't send CORS headers (effectively rejecting)
      logger.warn({ origin }, "Disallowed Origin for HTTP request");
  }

  // Handle OPTIONS preflight requests
  if (req.method === "OPTIONS") {
      // Ensure preflight responses also have necessary headers if origin was allowed
      if (allowedOrigin) {
          return res.status(204).end(); // Use 204 No Content for preflight success
      } else {
          // If origin wasn't allowed, OPTIONS request should also fail
          return res.status(403).json({ error: "Origin not allowed" });
      }
  }

  next();
};