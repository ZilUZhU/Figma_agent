/**
 * WebSocket Service
 * Handles connection and communication with the backend WebSocket server.
 */
import { config } from "../config";
import { ConnectionStatus, FunctionCallData } from "../types"; // Use local types

// Define the structure of callbacks the UI hook will provide
export interface WebSocketCallbacks {
  onMessage: (message: string) => void; // For general messages/errors from this service
  onStatusChange: (status: ConnectionStatus) => void;
  onFunctionCall: (functionCall: FunctionCallData) => void; // Use FunctionCallData type
  onChunk: (chunk: string) => void; // For text chunks
  onStreamEnd: (responseId: string) => void; // Stream finished successfully
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null; // Store session ID received from backend
  private callbacks: WebSocketCallbacks;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isManualClose = false; // Flag to prevent reconnect on manual close

  constructor(callbacks: WebSocketCallbacks) {
    this.callbacks = callbacks;
    console.log("[WebSocketService] Initialized");
  }

  connect(): void {
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      console.log("[WebSocketService] Already connected or connecting.");
      return; // Avoid multiple connections
    }

    // Clear any pending reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.isManualClose = false;
    this.callbacks.onStatusChange("connecting");
    console.log("[WebSocketService] Connecting to:", config.wsBaseUrl);

    try {
      this.ws = new WebSocket(config.wsBaseUrl);
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error("[WebSocketService] Connection failed:", error);
      this.callbacks.onStatusChange("error");
      this.attemptReconnect(); // Attempt reconnect on initial connection error
    }
  }

  disconnect(): void {
    console.log("[WebSocketService] Manual disconnect requested.");
    this.isManualClose = true; // Set flag *before* closing
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    // Explicitly set status, handleClose might not fire reliably on manual close
    this.callbacks.onStatusChange("disconnected");
  }

  sendMessage(message: string): void {
    if (!this.ensureConnection()) {
      console.warn("[WebSocketService] Cannot send message: Not connected.");
      this.callbacks.onMessage(
        "Error: Not connected. Please wait or retry connection."
      );
      // Optionally trigger connect attempt if disconnected
      if (
        this.ws?.readyState === WebSocket.CLOSED ||
        this.ws?.readyState === WebSocket.CLOSING
      ) {
        this.connect();
      }
      return;
    }

    console.log("[WebSocketService] Sending chat message..."); // Avoid logging content
    try {
      this.ws!.send(
        JSON.stringify({
          type: "chat_message",
          payload: { message, sessionId: this.sessionId }, // Include current sessionId
        })
      );
    } catch (error) {
      console.error("[WebSocketService] Send message error:", error);
      this.callbacks.onMessage(
        `Error sending message: ${
          error instanceof Error ? error.message : "Unknown"
        }`
      );
      this.callbacks.onStatusChange("error");
    }
  }

  sendFunctionResult(functionCallOutput: {
    call_id: string;
    output: string;
  }): void {
    if (!this.ensureConnection()) {
      console.warn(
        "[WebSocketService] Cannot send function result: Not connected."
      );
      this.callbacks.onMessage(
        "Error: Not connected. Cannot send function result."
      );
      return;
    }
    if (!this.sessionId) {
      console.error(
        "[WebSocketService] Cannot send function result: Session ID not established."
      );
      this.callbacks.onMessage(
        "Error: Session ID missing. Cannot send function result."
      );
      this.callbacks.onStatusChange("error"); // Indicate a problem
      return;
    }

    console.log(
      `[WebSocketService] Sending function result for call ID: ${functionCallOutput.call_id}`
    );
    try {
      this.ws!.send(
        JSON.stringify({
          type: "function_result",
          payload: { functionCallOutput, sessionId: this.sessionId },
        })
      );
    } catch (error) {
      console.error("[WebSocketService] Send function result error:", error);
      this.callbacks.onMessage(
        `Error sending function result: ${
          error instanceof Error ? error.message : "Unknown"
        }`
      );
      this.callbacks.onStatusChange("error");
    }
  }

  private ensureConnection(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private handleOpen(): void {
    console.log("[WebSocketService] Connection established.");
    this.reconnectAttempts = 0; // Reset on successful connection
    this.callbacks.onStatusChange("connected");
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);

      // Log only non-chunk messages for clarity
      if (data.type !== "stream_chunk") {
        console.log(
          `[WebSocketService] Received message type: ${data.type}`,
          data.payload || ""
        );
      }

      const payload = data.payload || {};

      switch (data.type) {
        case "connection_established":
          console.log(
            `[WebSocketService] Connection confirmed by server. Client ID: ${payload.clientId}`
          );
          // Store session ID if provided on initial connection (though usually comes later)
          if (payload.sessionId) {
            this.sessionId = payload.sessionId;
            console.log(
              `[WebSocketService] Session ID set on connection: ${this.sessionId}`
            );
          }
          break;
        case "session_update":
          if (payload.sessionId) {
            this.sessionId = payload.sessionId;
            console.log(
              `[WebSocketService] Session ID updated: ${this.sessionId}`
            );
          }
          break;
        case "stream_start":
          console.log("[WebSocketService] Stream starting...");
          // Ensure session ID is captured if sent with start event
          if (payload.sessionId && !this.sessionId) {
            this.sessionId = payload.sessionId;
            console.log(
              `[WebSocketService] Session ID set at stream start: ${this.sessionId}`
            );
          }
          break;
        case "stream_chunk":
          if (payload.text !== undefined) {
            this.callbacks.onChunk(payload.text);
          }
          if (payload.functionCall) {
            console.log(
              `[WebSocketService] Received function call request: ${payload.functionCall.name}`
            );
            this.callbacks.onFunctionCall(payload.functionCall); // Pass FunctionCallData
          }
          break;
        case "stream_end":
          console.log(
            `[WebSocketService] Stream ended. Response ID: ${payload.responseId}`
          );
          // Ensure session ID is captured if sent with end event
          if (payload.sessionId && !this.sessionId) {
            this.sessionId = payload.sessionId;
            console.log(
              `[WebSocketService] Session ID set at stream end: ${this.sessionId}`
            );
          }
          this.callbacks.onStreamEnd(payload.responseId || ""); // Pass responseId
          break;
        case "stream_error":
          console.error(
            "[WebSocketService] Stream error from server:",
            payload.message
          );
          this.callbacks.onMessage(`Stream Error: ${payload.message}`);
          this.callbacks.onStatusChange("error");
          break;
        case "error": // General error from backend
          console.error(
            `[WebSocketService] Error from server (Code: ${payload.code}):`,
            payload.message
          );
          this.callbacks.onMessage(
            `Error (${payload.code}): ${payload.message}`
          );
          this.callbacks.onStatusChange("error");
          break;
        default:
          console.warn(
            "[WebSocketService] Received unknown message type:",
            data.type
          );
      }
    } catch (error) {
      console.error(
        "[WebSocketService] Error parsing message:",
        error,
        "Data:",
        event.data
      );
      this.callbacks.onMessage(
        "Error: Received unparsable message from server."
      );
      this.callbacks.onStatusChange("error");
    }
  }

  private handleClose(event: CloseEvent): void {
    console.log(
      `[WebSocketService] Connection closed. Code: ${event.code}, Reason: ${
        event.reason || "N/A"
      }, Manual: ${this.isManualClose}`
    );
    this.ws = null; // Clear instance

    if (!this.isManualClose) {
      this.callbacks.onStatusChange("disconnected"); // Show disconnected first
      this.attemptReconnect();
    } else {
      this.callbacks.onStatusChange("disconnected"); // Stay disconnected
    }
    // Reset flag after handling close
    // this.isManualClose = false; // No, keep it true until next connect attempt
  }

  private handleError(event: Event): void {
    // This often precedes 'close'. Log it but rely on 'close' for reconnect logic.
    console.error("[WebSocketService] WebSocket error occurred:", event);
    // Only update status if we know we aren't connected/connecting anymore
    if (
      !this.ws ||
      (this.ws.readyState !== WebSocket.OPEN &&
        this.ws.readyState !== WebSocket.CONNECTING)
    ) {
      this.callbacks.onStatusChange("error");
    }
  }

  private attemptReconnect(): void {
    if (this.isManualClose || this.reconnectTimeout !== null) {
      console.log(
        "[WebSocketService] Skipping reconnect attempt (manual close or already scheduled)."
      );
      return;
    }

    if (this.reconnectAttempts >= config.reconnectMaxAttempts) {
      console.log(
        `[WebSocketService] Max reconnect attempts (${config.reconnectMaxAttempts}) reached. Stopping.`
      );
      this.callbacks.onStatusChange("error"); // Stay in error state
      this.callbacks.onMessage(
        "Connection failed. Please try refreshing the plugin later."
      );
      return;
    }

    const delay = Math.min(
      config.reconnectInitialDelay * Math.pow(2, this.reconnectAttempts),
      config.reconnectMaxDelay
    );

    this.reconnectAttempts++;
    console.log(
      `[WebSocketService] Attempting reconnect (${this.reconnectAttempts}/${config.reconnectMaxAttempts}) in ${delay}ms...`
    );
    this.callbacks.onStatusChange("connecting"); // Show connecting during wait

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null; // Clear timeout ID before connecting
      this.connect(); // Attempt connection again
    }, delay);
  }
}
