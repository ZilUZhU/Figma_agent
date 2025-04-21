import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@utils/logger"; // Use path alias
import { FunctionCallOutputMessage } from "@types"; // Use path alias

// --- Interfaces and Types ---

// Interface for WebSocket clients, adding session info and heartbeat flag
export interface WebSocketClient extends WebSocket {
  clientId: string; // Unique ID for this specific connection instance
  sessionId?: string; // Associated session ID (once established)
  isAlive?: boolean; // For heartbeat mechanism
}

// Store active connections using clientId as the key
export const clients = new Map<string, WebSocketClient>();

// Define WebSocket message types for client-server communication
export type ClientToServerMessageType = "chat_message" | "function_result";

export type ServerToClientMessageType =
  | "connection_established"
  | "stream_start"
  | "stream_chunk"
  | "stream_end"
  | "stream_error"
  | "session_update"
  | "error";

// Base interface for messages
export interface WSMessageBase {
  type: ClientToServerMessageType | ServerToClientMessageType;
}

// Client to Server Message Interfaces
export interface ChatMessageRequest extends WSMessageBase {
  type: "chat_message";
  payload: {
    message: string;
    sessionId?: string;
  };
}

export interface FunctionResultRequest extends WSMessageBase {
  type: "function_result";
  payload: {
    functionCallOutput: Omit<FunctionCallOutputMessage, "type">; // Expecting { call_id, output }
    sessionId: string;
  };
}

// Error codes for structured errors
export type ErrorCode =
  | "BAD_REQUEST"
  | "SESSION_ERROR"
  | "AI_ERROR"
  | "INTERNAL_ERROR"
  | "UNKNOWN";

// --- Type Guards ---

export function isChatMessageRequest(
  message: any
): message is ChatMessageRequest {
  return (
    message?.type === "chat_message" &&
    typeof message.payload?.message === "string"
  );
}

export function isFunctionResultRequest(
  message: any
): message is FunctionResultRequest {
  return (
    message?.type === "function_result" &&
    typeof message.payload?.sessionId === "string" &&
    typeof message.payload?.functionCallOutput?.call_id === "string" &&
    message.payload?.functionCallOutput?.output !== undefined
  );
}

// --- Helper Functions ---

/**
 * Sends structured error messages to the client.
 */
export function sendError(
  client: WebSocketClient,
  message: string,
  code: ErrorCode = "UNKNOWN"
) {
  if (client.readyState === WebSocket.OPEN) {
    try {
      const errorPayload = { type: "error", payload: { code, message } };
      client.send(JSON.stringify(errorPayload));
      // WARN: Sending an error to the client is significant
      logger.warn(
        { clientId: client.clientId, code, message },
        "[WebSocket] Sent error to client"
      );
    } catch (err) {
      // 确保错误是 Error 类型
      const stringifyError =
        err instanceof Error ? err : new Error(String(err));
      logger.error(
        stringifyError,
        "[WebSocket] Failed to stringify error message for client.",
        { clientId: client.clientId }
      );
    }
  } else {
    // WARN: Trying to communicate with closed client indicates potential issue
    logger.warn(
      { clientId: client.clientId, code, message },
      "[WebSocket] Attempted to send error to closed client"
    );
  }
}

/**
 * Sends structured messages to the client.
 */
export function sendMessage(
  client: WebSocketClient,
  message: WSMessageBase & { payload: any }
) {
  if (client.readyState === WebSocket.OPEN) {
    try {
      const messageString = JSON.stringify(message);
      client.send(messageString);

      // Use TRACE for noisy stream chunks, DEBUG for others
      const level = message.type === "stream_chunk" ? "trace" : "debug";
      logger[level](
        // Dynamic level based on type
        { clientId: client.clientId, type: message.type },
        "[WebSocket] Sent message to client"
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error(error, "[WebSocket] Failed to stringify/send message", {
        clientId: client.clientId,
        messageType: message.type,
      });
      if (message.type !== "error") {
        sendError(client, "Failed to serialize message.", "INTERNAL_ERROR");
      }
    }
  } else {
    // DEBUG is sufficient for trying to send to a closed client unless it happens frequently
    logger.debug(
      { clientId: client.clientId, type: message.type },
      "[WebSocket] Attempted to send message to closed client"
    );
  }
}

/**
 * Sets up ping/pong heartbeat mechanism.
 */
export function setupHeartbeat(wss: WebSocketServer) {
  const interval = setInterval(() => {
    clients.forEach((client) => {
      if (!client || client.readyState !== WebSocket.OPEN) {
        if (client) clients.delete(client.clientId); // Clean up if somehow still in map but not open
        return;
      }
      if (client.isAlive === false) {
        // WARN: Heartbeat failure leads to termination
        logger.warn(
          { clientId: client.clientId },
          "[WebSocket] Heartbeat failed, terminating connection."
        );
        client.terminate();
        clients.delete(client.clientId); // Ensure cleanup from map
        return;
      }
      client.isAlive = false; // Expect a pong response to set it back to true
      client.ping();
    });
  }, 30000); // Ping every 30 seconds

  wss.on("close", () => {
    clearInterval(interval);
    logger.info({}, "[WebSocket] Server closing, heartbeat stopped.");
  });
}

/**
 * Validates the origin of the WebSocket connection request.
 */
export function validateOrigin(origin: string | undefined): boolean {
  const allowedOrigins = [
    "https://www.figma.com",
    "https://figma.com",
    "https://www.figjam.com",
    "https://figjam.com",
    "http://localhost:3000", // Adjust dev origin if needed
    "null", // Keep null origin if needed for Postman/local dev
  ];

  // Allow connections without origin only in development mode
  return (
    (origin && allowedOrigins.includes(origin)) ||
    (!origin && process.env.NODE_ENV === "development")
  );
}
