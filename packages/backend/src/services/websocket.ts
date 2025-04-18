import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { generateChatResponseStream, DetectedFunctionCall } from './openai';
import {
    getOrCreateSession,
    updateSessionData,
    isValidSession,
    addMessageToHistory,
    FunctionCallOutputMessage,
    HistoryMessage
} from './session';
import { ChatMessage, InputMessage, BackendChatMessage } from '../types';
import { logger } from '../utils/logger'; // Import logger
import { ensureSystemInstruction } from '../config/ai'; // Import helper


// Interface for WebSocket clients, adding session info and heartbeat flag
interface WebSocketClient extends WebSocket {
  clientId: string; // Unique ID for this specific connection instance
  sessionId?: string; // Associated session ID (once established)
  isAlive?: boolean; // For heartbeat mechanism
}

// Store active connections using clientId as the key
const clients = new Map<string, WebSocketClient>();

// Define WebSocket message types for client-server communication
type ClientToServerMessageType =
  | 'chat_message'           // User sends a new chat message
  | 'function_result';       // Client sends the result of executing a function

type ServerToClientMessageType =
  | 'connection_established' // Server confirms connection
  | 'stream_start'           // AI response stream is starting
  | 'stream_chunk'           // A piece of the AI response (text or function call)
  | 'stream_end'             // AI response stream finished
  | 'stream_error'           // An error occurred during streaming
  | 'error';                 // A general error occurred (parsing, session, etc.)
  // Removed 'status' message type for simplicity, client can infer state

// Base interface for messages
interface WSMessageBase {
  type: ClientToServerMessageType | ServerToClientMessageType;
}

// --- Client to Server Message Interfaces ---
interface ChatMessageRequest extends WSMessageBase {
  type: 'chat_message';
  payload: {
    message: string;
    sessionId?: string; // Client can suggest a session to resume
  };
}

interface FunctionResultRequest extends WSMessageBase {
  type: 'function_result';
  payload: {
    // Expecting structure like { call_id: string, output: string }
    functionCallOutput: Omit<FunctionCallOutputMessage, 'type'>;
    sessionId: string; // Session MUST be provided for function results
  };
}

// Type guard for incoming messages
function isChatMessageRequest(message: any): message is ChatMessageRequest {
    return message?.type === 'chat_message' && typeof message.payload?.message === 'string';
}

function isFunctionResultRequest(message: any): message is FunctionResultRequest {
    return message?.type === 'function_result' &&
           typeof message.payload?.sessionId === 'string' &&
           typeof message.payload?.functionCallOutput?.call_id === 'string' &&
           message.payload?.functionCallOutput?.output !== undefined; // Output can be various types before stringification
}


// --- WebSocket Server Setup ---

export function setupWebSocketServer(wss: WebSocketServer) {
  logger.info({}, '[WebSocket] Initializing WebSocket server...');

  // Heartbeat mechanism to detect and close broken connections
  setupHeartbeat(wss);

  wss.on('connection', (ws: WebSocket, req) => {
    const client = ws as WebSocketClient;
    client.clientId = uuidv4(); // Assign unique ID to this connection
    client.isAlive = true;

    // **Important**: Add Origin Validation (even without auth)
    const origin = req.headers.origin;
    const allowedOrigins = [
        "https://www.figma.com",
        "https://figma.com",
        "https://www.figjam.com",
        "https://figjam.com",
        "http://localhost:3000", // Adjust dev origin if needed
        // Add other specific origins if necessary
    ];

    // Allow connections without origin only in development mode
    const isOriginAllowed = (origin && allowedOrigins.includes(origin)) || (!origin && process.env.NODE_ENV === 'development');

    if (!isOriginAllowed) {
        logger.warn({ clientId: client.clientId, origin }, "[WebSocket] Connection rejected: Invalid origin");
        client.terminate();
        return;
    }

    clients.set(client.clientId, client); // Store client by its unique connection ID
    logger.info({ clientId: client.clientId, origin: origin || 'N/A' }, "[WebSocket] Client connected");

    // Send connection confirmation to the client
    sendMessage(client, {
      type: 'connection_established',
      payload: { clientId: client.clientId }
    });

    // Setup heartbeat listeners
    client.on('pong', () => {
      client.isAlive = true;
    });

    // Handle incoming messages
    client.on('message', async (rawMessage: Buffer) => {
      // Use try-catch within the message handler for per-message errors
      try {
        const messageString = rawMessage.toString();
        // Basic protection against excessively large messages
        if (messageString.length > 10000) { // Example limit: 10KB
            logger.warn({ clientId: client.clientId, size: messageString.length }, "[WebSocket] Received excessively large message, discarding.");
            sendError(client, "Message size exceeds limit.", 'BAD_REQUEST');
            return;
        }

        const message: unknown = JSON.parse(messageString);
        logger.debug({ clientId: client.clientId, messageType: (message as any)?.type }, "[WebSocket] Received message");

        if (isChatMessageRequest(message)) {
          // Ensure session is associated before handling chat
          if (!client.sessionId) {
             // Establish session on first chat message if not already done
             const { sessionId } = getOrCreateSession(message.payload.sessionId);
             client.sessionId = sessionId;
             logger.info({ clientId: client.clientId, sessionId }, "[WebSocket] Session associated with client");
          }
          // Use client.sessionId which is now guaranteed to be set
          await handleChatMessage(client, client.sessionId, message);
        } else if (isFunctionResultRequest(message)) {
          // Function results require a valid session provided in the payload
          if (!isValidSession(message.payload.sessionId)) {
              logger.warn({ clientId: client.clientId, requestedSessionId: message.payload.sessionId }, "[WebSocket] Function result received for invalid/expired session");
              sendError(client, "Session not found or expired. Cannot process function result.", 'SESSION_ERROR');
              return;
          }
          // Associate client if necessary (e.g., reconnect scenario, though unlikely with function result first)
          if (!client.sessionId) client.sessionId = message.payload.sessionId;
          await handleFunctionResult(client, message.payload.sessionId, message);
        } else {
          logger.warn({ clientId: client.clientId, message }, "[WebSocket] Received unknown message type or format");
          sendError(client, "Unknown message type or invalid format.", 'BAD_REQUEST');
        }
      } catch (error) {
        const logContext = { clientId: client.clientId };
        logger.error(error instanceof Error ? error : logContext, "[WebSocket] Error processing message");
        // Determine error type for client message
        let errorCode: ErrorCode = 'INTERNAL_ERROR';
        let errorMessage = "Failed to process message.";
        if (error instanceof SyntaxError) {
            errorCode = 'BAD_REQUEST';
            errorMessage = "Invalid JSON format.";
        } else if (error instanceof Error) {
            errorMessage = error.message; // Use specific error message if available
        }
        sendError(client, errorMessage, errorCode);
      }
    });

    // Handle client disconnection
    client.on('close', (code, reason) => {
      logger.info({ clientId: client.clientId, code, reason: reason.toString() }, "[WebSocket] Client disconnected");
      clients.delete(client.clientId); // Remove client from map
      // Note: Session data in session.ts persists until TTL expiry
    });

    // Handle client errors
    client.on('error', (err) => {
      logger.error(err instanceof Error ? err : { clientId: client.clientId }, "[WebSocket] Client connection error");
      clients.delete(client.clientId); // Clean up on error too
    });
  });

  logger.info({}, `[WebSocket] Server setup complete, listening on port associated with HTTP server.`);
}

// --- Message Handlers ---

async function handleChatMessage(client: WebSocketClient, sessionId: string, request: ChatMessageRequest) {
  logger.info({ clientId: client.clientId, sessionId }, "[WebSocket] Handling chat message");
  const userMessageContent = request.payload.message;

  // Retrieve session data (we know sessionId is valid here)
  const { sessionData, isNewSession } = getOrCreateSession(sessionId);
  const previousResponseId = sessionData.previousResponseId;

  // Create the user message object
  const newUserMessage: ChatMessage = { role: "user", content: userMessageContent };

  // Add user message to conceptual history (important *before* AI call)
  addMessageToHistory(sessionId, newUserMessage);

  // Prepare input for OpenAI: only the new message if using previousResponseId,
  // otherwise potentially the full history (prepended with system prompt if new).
  let messagesForAPI: Array<InputMessage | FunctionCallOutputMessage> = [newUserMessage];

  // If it's a truly new session chain (no previous ID), ensure system prompt is included
  if (!previousResponseId) {
      messagesForAPI = ensureSystemInstruction(messagesForAPI);
      logger.debug({ sessionId }, "Prepending system instruction for new conversation chain");
  }

  // Send stream start notification
  sendMessage(client, { type: 'stream_start', payload: { sessionId } });

  try {
    await generateChatResponseStream(
      messagesForAPI,
      // Convert null to undefined for type compatibility
      previousResponseId || undefined,
      // onChunk: Handle text delta
      (chunk) => {
        sendMessage(client, { type: 'stream_chunk', payload: { text: chunk } });
      },
      // onFunctionCall: Handle detected function call
      (functionCall) => {
        // We need to store the function call request message in history before sending to client
         const assistantMessageWithCall: BackendChatMessage = {
             role: "assistant",
             // Content might be null or empty if only a function call is made
             content: null, // Or potentially store any preceding text from the stream if needed
             // Attach tool call information for history context (optional but good practice)
             tool_calls: [{
                 id: functionCall.call_id, // Use the call_id here
                 type: "function",
                 function: { name: functionCall.name, arguments: functionCall.arguments }
             }]
         };
         addMessageToHistory(sessionId, assistantMessageWithCall);

         // Send the function call details to the client for execution
         sendMessage(client, { type: 'stream_chunk', payload: { functionCall } });
      },
      // onComplete: Handle stream completion
      (finalText, responseId) => {
        logger.info({ clientId: client.clientId, sessionId, responseId }, "[WebSocket] Stream completed successfully");

        // Create the final assistant message (might just be text, or follow a function call)
        const finalAssistantMessage: BackendChatMessage = { role: "assistant", content: finalText };

        // Update session with the new response ID and the final assistant message
        // Note: If a function call occurred, the history already contains the assistant's
        // message *requesting* the call thanks to the onFunctionCall handler.
        updateSessionData(sessionId, responseId, finalAssistantMessage);

        sendMessage(client, { type: 'stream_end', payload: { responseId, sessionId } });
      },
      // onError: Handle errors during the stream
      (error) => {
        const logContext = { clientId: client.clientId, sessionId };
        logger.error(error instanceof Error ? error : logContext, "[WebSocket] OpenAI stream error callback triggered");
        sendMessage(client, { type: 'stream_error', payload: { message: error.message } });
        // Also send a general error to ensure client knows something went wrong
        sendError(client, `AI stream failed: ${error.message}`, 'AI_ERROR');
      }
    );
  } catch (error) {
    // Catch errors setting up the stream itself (rare)
    const logContext = { clientId: client.clientId, sessionId };
    logger.error(error instanceof Error ? error : logContext, "[WebSocket] Error setting up OpenAI stream");
    sendError(client, "Failed to initiate AI stream.", 'INTERNAL_ERROR');
  }
}


async function handleFunctionResult(client: WebSocketClient, sessionId: string, request: FunctionResultRequest) {
  logger.info({ clientId: client.clientId, sessionId, callId: request.payload.functionCallOutput.call_id }, "[WebSocket] Handling function result");

  const { call_id, output } = request.payload.functionCallOutput;

  // Ensure output is a string as required by OpenAI API
  const stringOutput = (typeof output === 'string') ? output : JSON.stringify(output);

  // Create the function result message object for the API input
  const functionResultMessage: FunctionCallOutputMessage = {
      type: "function_call_output",
      call_id: call_id,
      output: stringOutput,
  };

  // Add the function result to the conceptual history *before* calling AI again
  addMessageToHistory(sessionId, functionResultMessage);

  // Retrieve session data to get the previousResponseId
  // We know the session is valid from the check in the main message handler
  const { sessionData } = getOrCreateSession(sessionId);
  const previousResponseId = sessionData.previousResponseId;

  // Prepare input for OpenAI: only the function result message
  const messagesForAPI = [functionResultMessage];

  // Send stream start notification
  sendMessage(client, { type: 'stream_start', payload: { sessionId } });

  try {
    // Call OpenAI again with the function result, using the previous response ID
    await generateChatResponseStream(
      messagesForAPI,
      // Convert null to undefined for type compatibility
      previousResponseId || undefined, // Crucial for continuing the conversation context
      // onChunk: Handle text delta
      (chunk) => {
        sendMessage(client, { type: 'stream_chunk', payload: { text: chunk } });
      },
      // onFunctionCall: Handle potential *subsequent* function calls
      (functionCall) => {
         // Store the assistant message requesting this *new* call
         const assistantMessageWithCall: BackendChatMessage = {
             role: "assistant", content: null,
             tool_calls: [{ id: functionCall.call_id, type: "function", function: { name: functionCall.name, arguments: functionCall.arguments } }]
         };
         addMessageToHistory(sessionId, assistantMessageWithCall);
         // Send to client
         sendMessage(client, { type: 'stream_chunk', payload: { functionCall } });
      },
      // onComplete: Handle stream completion after function result processing
      (finalText, responseId) => {
        logger.info({ clientId: client.clientId, sessionId, responseId }, "[WebSocket] Stream completed successfully after function result");

        const finalAssistantMessage: BackendChatMessage = { role: "assistant", content: finalText };
        // Update session with the new response ID and the final assistant message
        updateSessionData(sessionId, responseId, finalAssistantMessage);

        sendMessage(client, { type: 'stream_end', payload: { responseId, sessionId } });
      },
      // onError: Handle errors during the stream
      (error) => {
        const logContext = { clientId: client.clientId, sessionId };
        logger.error(error instanceof Error ? error : logContext, "[WebSocket] OpenAI stream error callback triggered after function result");
        sendMessage(client, { type: 'stream_error', payload: { message: error.message } });
        sendError(client, `AI stream failed after function result: ${error.message}`, 'AI_ERROR');
      }
    );
  } catch (error) {
     // Catch errors setting up the stream itself
    const logContext = { clientId: client.clientId, sessionId };
    logger.error(error instanceof Error ? error : logContext, "[WebSocket] Error setting up OpenAI stream after function result");
    sendError(client, "Failed to initiate AI stream after function result.", 'INTERNAL_ERROR');
  }
}

// --- Helper Functions ---

type ErrorCode = 'BAD_REQUEST' | 'SESSION_ERROR' | 'AI_ERROR' | 'INTERNAL_ERROR' | 'UNKNOWN';

// Send structured error messages to the client
function sendError(client: WebSocketClient, message: string, code: ErrorCode = 'UNKNOWN') {
  if (client.readyState === WebSocket.OPEN) {
      const errorPayload = { type: 'error', payload: { code, message } };
      client.send(JSON.stringify(errorPayload));
      logger.warn({ clientId: client.clientId, sessionId: client.sessionId, code, message }, "[WebSocket] Sent error to client");
  } else {
      logger.warn({ clientId: client.clientId, sessionId: client.sessionId, code, message }, "[WebSocket] Tried to send error to closed client");
  }
}

// Send structured messages to the client
function sendMessage(client: WebSocketClient, message: WSMessageBase & { payload: any }) {
  if (client.readyState === WebSocket.OPEN) {
    try {
        const messageString = JSON.stringify(message);
        client.send(messageString);
        logger.debug({ clientId: client.clientId, sessionId: client.sessionId, type: message.type }, "[WebSocket] Sent message to client");
    } catch (error) {
        const logContext = { clientId: client.clientId, messageType: message.type };
        logger.error(error instanceof Error ? error : logContext, "[WebSocket] Failed to stringify or send message");
        // Avoid infinite loop if error is in sendError itself
        if (message.type !== 'error') {
            sendError(client, "Failed to serialize message for sending.", 'INTERNAL_ERROR');
        }
    }
  } else {
      logger.warn({ clientId: client.clientId, sessionId: client.sessionId, type: message.type }, "[WebSocket] Tried to send message to closed client");
  }
}

// Setup ping/pong for heartbeat
function setupHeartbeat(wss: WebSocketServer) {
  const interval = setInterval(() => {
    clients.forEach((client) => {
      if (client.isAlive === false) {
        logger.warn({ clientId: client.clientId, sessionId: client.sessionId }, "[WebSocket] Heartbeat failed, terminating connection.");
        client.terminate();
        clients.delete(client.clientId); // Ensure cleanup from map
        return;
      }
      client.isAlive = false; // Expect a pong response to set it back to true
      client.ping();
    });
  }, 30000); // Ping every 30 seconds

  wss.on('close', () => {
    clearInterval(interval);
    logger.info({}, "[WebSocket] Server closing, heartbeat interval stopped.");
  });
}