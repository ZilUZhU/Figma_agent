import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { PORT, NODE_ENV } from "./config"; // Import NODE_ENV
import { corsMiddleware } from "./middleware/cors";
import routes from "./routes"; // Now only contains /health
import { setupWebSocketServer } from "./services/websocket";
import { logger } from "./utils/logger"; // Import logger

// Initialize Express App
const app = express();
// Create HTTP server needed for WebSocket upgrade
const server = http.createServer(app);

// Setup WebSocket Server, passing the HTTP server instance
const wss = new WebSocketServer({ server });
setupWebSocketServer(wss); // Initialize WebSocket logic

// --- Express Middleware ---
// Enable JSON body parsing for potential future HTTP endpoints (like /health)
app.use(express.json());
// Apply CORS middleware for HTTP requests
app.use(corsMiddleware);

// --- HTTP Routes ---
// Register basic routes (e.g., /health)
app.use(routes);

// --- Global Error Handling for HTTP (Optional but Recommended) ---
// Add a simple global error handler for unhandled errors in HTTP routes
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error(err, "Unhandled error in HTTP request handler");
    res.status(500).json({ error: "Internal Server Error" });
});


// --- Start Server ---
server.listen(PORT, () => {
  logger.info({}, `Server environment: ${NODE_ENV}`);
  logger.info({}, `HTTP server listening on http://localhost:${PORT}`);
  logger.info({}, `WebSocket server ready and listening on the same port (ws://localhost:${PORT})`);
});

// Optional: Graceful shutdown handling
process.on('SIGTERM', () => {
    logger.info({}, 'SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info({}, 'HTTP server closed');
        // Add any other cleanup here (e.g., close DB connections)
        process.exit(0);
    });
    // Force close server after 10 seconds
    setTimeout(() => {
        logger.error({}, 'Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
});

process.on('SIGINT', () => {
    logger.info({}, 'SIGINT signal received: closing HTTP server');
    server.close(() => {
        logger.info({}, 'HTTP server closed');
        process.exit(0);
    });
    setTimeout(() => {
        logger.error({}, 'Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
});