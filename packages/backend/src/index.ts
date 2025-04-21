import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { PORT, NODE_ENV } from "./config";
import { corsMiddleware } from "./middleware/cors";
import routes from "./routes";
import { setupWebSocketServer } from "./services/websocket";
import { logger } from "./utils/logger";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

setupWebSocketServer(wss);

app.use(express.json());
app.use(corsMiddleware);
app.use(routes); // Health check route

// Global HTTP error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error(err, "Unhandled error in HTTP request handler");
    res.status(500).json({ error: "Internal Server Error" });
  }
);

server.listen(PORT, () => {
  logger.info({}, `Server environment: ${NODE_ENV}`);
  logger.info({}, `HTTP server listening on http://localhost:${PORT}`);
  logger.info(
    {},
    `WebSocket server ready and listening on ws://localhost:${PORT}`
  );
});

// Graceful shutdown handling (simplified for brevity)
const shutdown = (signal: string) => {
  logger.info({}, `${signal} signal received: closing server`);
  server.close(() => {
    logger.info({}, "Server closed");
    process.exit(0);
  });
  setTimeout(() => {
    logger.error(
      {},
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 10000); // Force shutdown after 10s
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
