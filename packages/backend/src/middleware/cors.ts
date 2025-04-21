import { Request, Response, NextFunction } from "express";
import { corsOptions, isDevMode } from "../config"; // Corrected path alias usage
import { logger } from "../utils/logger";

/**
 * CORS middleware to handle allowed origins for HTTP requests.
 */
export const corsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const origin = req.headers.origin;
  let allowedOrigin: string | undefined = undefined;

  if (origin) {
    if (corsOptions.origin.includes(origin) || isDevMode) {
      allowedOrigin = origin;
    }
  } else if (isDevMode) {
    allowedOrigin = "*"; // Allow no origin in dev
  }

  if (allowedOrigin) {
    res.header("Access-Control-Allow-Origin", allowedOrigin);
    res.header("Access-Control-Allow-Methods", corsOptions.methods.join(", "));
    res.header(
      "Access-Control-Allow-Headers",
      corsOptions.allowedHeaders.join(", ")
    );
    res.header(
      "Access-Control-Allow-Credentials",
      String(corsOptions.credentials)
    );
  } else if (origin) {
    logger.warn({ origin }, "Disallowed Origin for HTTP request");
  }

  if (req.method === "OPTIONS") {
    if (allowedOrigin) {
      return res.status(204).end();
    } else {
      return res.status(403).json({ error: "Origin not allowed" });
    }
  }

  next();
};
