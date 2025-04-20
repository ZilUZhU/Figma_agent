import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
// Import availableTools here to pass it when needed
import { generateChatResponseStream, DetectedFunctionCall } from "./openai";
import { availableTools } from "../tools"; // Import the tools array
import {
  getOrCreateSession,
  updateSessionData,
  isValidSession,
  addMessageToHistory,
  FunctionCallOutputMessage,
  HistoryMessage,
} from "./session";
import {
  ChatMessage,
  InputMessage,
  BackendChatMessage,
  Tool as LocalToolType,
} from "../types"; // Import Tool type
import { logger } from "../utils/logger"; // Import logger
import { ensureSystemInstruction } from "../config/ai"; // Import helper

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
  | "chat_message" // User sends a new chat message
  | "function_result"; // Client sends the result of executing a function

type ServerToClientMessageType =
  | "connection_established" // Server confirms connection
  | "stream_start" // AI response stream is starting
  | "stream_chunk" // A piece of the AI response (text or function call)
  | "stream_end" // AI response stream finished
  | "stream_error" // An error occurred during streaming
  | "session_update" // Update session ID info
  | "error"; // A general error occurred (parsing, session, etc.)

// Base interface for messages
interface WSMessageBase {
  type: ClientToServerMessageType | ServerToClientMessageType;
}

// --- Client to Server Message Interfaces ---
interface ChatMessageRequest extends WSMessageBase {
  type: "chat_message";
  payload: {
    message: string;
    sessionId?: string; // Client can suggest a session to resume
  };
}

interface FunctionResultRequest extends WSMessageBase {
  type: "function_result";
  payload: {
    // Expecting structure like { call_id: string, output: string }
    functionCallOutput: Omit<FunctionCallOutputMessage, "type">;
    sessionId: string; // Session MUST be provided for function results
  };
}

// --- Type Guards ---
function isChatMessageRequest(message: any): message is ChatMessageRequest {
  return (
    message?.type === "chat_message" &&
    typeof message.payload?.message === "string"
  );
}

function isFunctionResultRequest(
  message: any
): message is FunctionResultRequest {
  return (
    message?.type === "function_result" &&
    typeof message.payload?.sessionId === "string" &&
    typeof message.payload?.functionCallOutput?.call_id === "string" &&
    message.payload?.functionCallOutput?.output !== undefined
  ); // Output can be various types before stringification
}

// Type guard to check for BackendChatMessage (used in filter)
function isBackendChatMessage(msg: HistoryMessage): msg is BackendChatMessage {
  return msg && typeof msg === "object" && "role" in msg && "content" in msg;
}

// Type guard to check for FunctionCallOutputMessage
function isFunctionCallOutputMessage(
  msg: HistoryMessage
): msg is FunctionCallOutputMessage {
  return (
    msg &&
    typeof msg === "object" &&
    "type" in msg &&
    msg.type === "function_call_output"
  );
}

// --- WebSocket Server Setup ---

export function setupWebSocketServer(wss: WebSocketServer) {
  logger.info({}, "[WebSocket] Initializing WebSocket server...");

  // Heartbeat mechanism to detect and close broken connections
  setupHeartbeat(wss);

  wss.on("connection", (ws: WebSocket, req) => {
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
      "null", // Keep null origin if needed for Postman/local dev, but be mindful
      // Add other specific origins if necessary
    ];

    // Allow connections without origin only in development mode
    const isOriginAllowed =
      (origin && allowedOrigins.includes(origin)) ||
      (!origin && process.env.NODE_ENV === "development");

    if (!isOriginAllowed) {
      logger.warn(
        { clientId: client.clientId, origin },
        "[WebSocket] Connection rejected: Invalid origin"
      );
      client.terminate();
      return;
    }

    clients.set(client.clientId, client); // Store client by its unique connection ID
    logger.info(
      { clientId: client.clientId, origin: origin || "N/A" },
      "[WebSocket] Client connected"
    );

    // Send connection confirmation to the client
    sendMessage(client, {
      type: "connection_established",
      payload: {
        clientId: client.clientId,
        message: "Connection successful. Please send your first message.",
      }, // Add confirmation message
    });

    // Setup heartbeat listeners
    client.on("pong", () => {
      client.isAlive = true;
    });

    // Handle incoming messages
    client.on("message", async (rawMessage: Buffer) => {
      // Use try-catch within the message handler for per-message errors
      try {
        const messageString = rawMessage.toString();
        // Basic protection against excessively large messages
        if (messageString.length > 10000) {
          // Example limit: 10KB
          logger.warn(
            { clientId: client.clientId, size: messageString.length },
            "[WebSocket] Received excessively large message, discarding."
          );
          sendError(client, "Message size exceeds limit.", "BAD_REQUEST");
          return;
        }

        const message: unknown = JSON.parse(messageString);
        logger.debug(
          { clientId: client.clientId, messageType: (message as any)?.type },
          "[WebSocket] Received message"
        );

        if (isChatMessageRequest(message)) {
          // Ensure session is associated before handling chat
          if (!client.sessionId) {
            // Establish session on first chat message if not already done
            // Use provided sessionId if valid, otherwise create new
            const { sessionId, isNewSession } = getOrCreateSession(
              message.payload.sessionId
            );
            client.sessionId = sessionId;
            if (isNewSession) {
              logger.info(
                { clientId: client.clientId, sessionId, isNewSession },
                "[WebSocket] New session created and associated with client"
              );
            }
            // Optionally inform client of the definitive sessionId if it was newly created or validated
            sendMessage(client, {
              type: "session_update",
              payload: { sessionId },
            }); // Add a message type for this
          }
          // Use client.sessionId which is now guaranteed to be set
          await handleChatMessage(client, client.sessionId, message);
        } else if (isFunctionResultRequest(message)) {
          // Function results require a valid session provided in the payload
          logger.info(
            {
              clientId: client.clientId,
              sessionId: message.payload.sessionId,
              callId: message.payload.functionCallOutput.call_id,
              // Log the raw output received from the client
              functionOutput: message.payload.functionCallOutput.output,
            },
            "[WebSocket] Received function_result payload from client"
          );
          if (!isValidSession(message.payload.sessionId)) {
            logger.warn(
              {
                clientId: client.clientId,
                requestedSessionId: message.payload.sessionId,
              },
              "[WebSocket] Function result received for invalid/expired session"
            );
            sendError(
              client,
              "Session not found or expired. Cannot process function result.",
              "SESSION_ERROR"
            );
            return;
          }
          // Associate client if necessary (e.g., reconnect scenario)
          if (
            !client.sessionId ||
            client.sessionId !== message.payload.sessionId
          ) {
            logger.warn(
              {
                clientId: client.clientId,
                currentSession: client.sessionId,
                requestedSession: message.payload.sessionId,
              },
              "Client session ID mismatch on function result, updating client's session ID."
            );
            client.sessionId = message.payload.sessionId;
          }
          await handleFunctionResult(
            client,
            message.payload.sessionId,
            message
          );
        } else {
          logger.warn(
            { clientId: client.clientId, message },
            "[WebSocket] Received unknown message type or format"
          );
          sendError(
            client,
            "Unknown message type or invalid format.",
            "BAD_REQUEST"
          );
        }
      } catch (error) {
        const logContext = { clientId: client.clientId };
        logger.error(
          error instanceof Error
            ? error
            : { error: String(error), ...logContext }, // Ensure error object is logged
          "[WebSocket] Error processing message"
        );
        // Determine error type for client message
        let errorCode: ErrorCode = "INTERNAL_ERROR";
        let errorMessage = "Failed to process message.";
        if (error instanceof SyntaxError) {
          errorCode = "BAD_REQUEST";
          errorMessage = "Invalid JSON format.";
        } else if (error instanceof Error) {
          errorMessage = error.message; // Use specific error message if available
        }
        sendError(client, errorMessage, errorCode);
      }
    });

    // Handle client disconnection
    client.on("close", (code, reason) => {
      logger.info(
        { clientId: client.clientId, code, reason: reason.toString() },
        "[WebSocket] Client disconnected"
      );
      clients.delete(client.clientId); // Remove client from map
      // Note: Session data in session.ts persists until TTL expiry
    });

    // Handle client errors
    client.on("error", (err) => {
      logger.error(
        err instanceof Error
          ? err
          : { error: String(err), clientId: client.clientId }, // Log the error
        "[WebSocket] Client connection error"
      );
      // Ensure client is removed if error causes disconnection
      if (
        client.readyState !== WebSocket.OPEN &&
        client.readyState !== WebSocket.CONNECTING
      ) {
        clients.delete(client.clientId);
      }
    });
  });

  logger.info(
    {},
    `[WebSocket] Server setup complete, listening on port associated with HTTP server.`
  );
}

// --- Message Handlers ---

async function handleChatMessage(
  client: WebSocketClient,
  sessionId: string,
  request: ChatMessageRequest
) {
  const userMessageContent = request.payload.message;

  // Log user message info
  logger.info(
    {
      clientId: client.clientId,
      sessionId,
      messageLength: userMessageContent.length,
      messagePreview:
        userMessageContent.substring(0, 50) +
        (userMessageContent.length > 50 ? "..." : ""),
    },
    "[WebSocket] Handling user chat message"
  );

  // Retrieve session data
  const { sessionData } = getOrCreateSession(sessionId);
  const previousResponseId = sessionData.previousResponseId;

  // Create the user message object
  const newUserMessage: ChatMessage = {
    role: "user",
    content: userMessageContent,
  };

  // Add user message to conceptual history
  addMessageToHistory(sessionId, newUserMessage);

  // Prepare input for OpenAI
  let messagesForAPI: Array<InputMessage | FunctionCallOutputMessage>;
  if (!previousResponseId) {
    // Starting a new chain: send history including the new user message, ensure system prompt
    messagesForAPI = ensureSystemInstruction(sessionData.chatHistory);
    logger.trace(
      { sessionId, historyLength: messagesForAPI.length },
      "[WebSocket] Preparing API input for new chain (includes history)"
    );
  } else {
    // Continuing a chain: only send the new user message
    messagesForAPI = [newUserMessage];
    logger.trace(
      { sessionId },
      "[WebSocket] Preparing API input for continuation (only new message)"
    );
  }

  // Send stream start notification
  sendMessage(client, { type: "stream_start", payload: { sessionId } });
  logger.info(
    {
      clientId: client.clientId,
      sessionId,
      isNewChain: !previousResponseId,
      historyLength: sessionData.chatHistory.length,
    },
    previousResponseId
      ? "[WebSocket] Initiating AI stream (Continuation)"
      : "[WebSocket] Initiating AI stream (New Chain)"
  );

  try {
    // Always pass availableTools so the model can decide whether to use them
    await generateChatResponseStream(
      messagesForAPI,
      previousResponseId || undefined,
      availableTools, // Pass tools here
      // onChunk: Handle text delta
      (chunk) => {
        sendMessage(client, { type: "stream_chunk", payload: { text: chunk } });
      },
      // onFunctionCall: Handle detected function call
      (functionCall) => {
        logger.info(
          {
            clientId: client.clientId,
            sessionId,
            functionName: functionCall.name,
            callId: functionCall.call_id,
          },
          "[WebSocket] Function call detected in response, forwarding to client"
        );

        // *** THE FIX IS HERE ***
        // Store the assistant's request with content: "" instead of null
        const assistantMessageWithCall: BackendChatMessage = {
          role: "assistant",
          content: "", // Use empty string instead of null
          tool_calls: [
            {
              id: functionCall.call_id, // Use call_id from DetectedFunctionCall
              type: "function",
              function: {
                // Match the nested structure expected by BackendChatMessage.tool_calls
                name: functionCall.name,
                arguments: functionCall.arguments,
              },
            },
          ],
        };
        addMessageToHistory(sessionId, assistantMessageWithCall);

        // Send function call details to the client
        sendMessage(client, {
          type: "stream_chunk",
          payload: { functionCall }, // Send the DetectedFunctionCall structure
        });
      },
      // onComplete: Handle stream completion
      (finalText, responseId) => {
        logger.info(
          {
            clientId: client.clientId,
            sessionId,
            responseId,
            responseLength: finalText ? finalText.length : 0,
            responsePreview: finalText
              ? finalText.substring(0, 50) +
                (finalText.length > 50 ? "..." : "")
              : null,
          },
          "[WebSocket] AI stream completed for chat message"
        );

        // Use the type guard for filtering history robustly
        const assistantRequestMessage = sessionData.chatHistory
          .filter(isBackendChatMessage) // Use the type guard here
          .filter((msg) => msg.role === "assistant" && !!msg.tool_calls)
          .pop(); // Get the last one

        // Create the final assistant message only if there's text output
        if (finalText && finalText.trim().length > 0) {
          const finalAssistantMessage: BackendChatMessage = {
            role: "assistant",
            content: finalText,
          };
          updateSessionData(sessionId, responseId, finalAssistantMessage);
        } else if (assistantRequestMessage) {
          // If no text, update session using the assistant message that requested the tool call
          updateSessionData(sessionId, responseId, assistantRequestMessage);
        } else {
          // Fallback if no text and no tool call request found (should be rare)
          logger.warn(
            { sessionId, responseId },
            "No text generated and couldn't find assistant function request message in history to update session."
          );
          // Create a minimal message with empty content string to satisfy potential API constraints
          const minimalAssistantMessage: BackendChatMessage = {
            role: "assistant",
            content: "",
          };
          updateSessionData(sessionId, responseId, minimalAssistantMessage);
        }

        sendMessage(client, {
          type: "stream_end",
          payload: { responseId, sessionId },
        });
      },
      // onError: Handle errors during the stream
      (error) => {
        const logContext = { clientId: client.clientId, sessionId };
        logger.error(
          error instanceof Error ? error : logContext,
          "[WebSocket] OpenAI stream error callback triggered for chat message"
        );
        sendMessage(client, {
          type: "stream_error",
          payload: { message: error.message },
        });
        sendError(client, `AI stream failed: ${error.message}`, "AI_ERROR");
      }
    );
  } catch (error) {
    // Catch errors setting up the stream itself
    const logContext = { clientId: client.clientId, sessionId };
    logger.error(
      error instanceof Error ? error : logContext,
      "[WebSocket] Error setting up OpenAI stream for chat message"
    );
    sendError(client, "Failed to initiate AI stream.", "INTERNAL_ERROR");
  }
}

async function handleFunctionResult(
  client: WebSocketClient,
  sessionId: string,
  request: FunctionResultRequest
) {
  logger.info(
    {
      clientId: client.clientId,
      sessionId,
      callId: request.payload.functionCallOutput.call_id,
    },
    "[WebSocket] Handling function result"
  );

  const { call_id, output } = request.payload.functionCallOutput;

  // Ensure output is a string as required by OpenAI API
  const stringOutput =
    typeof output === "string" ? output : JSON.stringify(output);

  // Create the function result message object for the API input
  const functionResultMessage: FunctionCallOutputMessage = {
    type: "function_call_output",
    call_id: call_id,
    output: stringOutput,
  };

  // Add the function result to the conceptual history *before* calling AI again
  addMessageToHistory(sessionId, functionResultMessage);

  // Retrieve session data to get the previousResponseId
  const { sessionData } = getOrCreateSession(sessionId);
  const previousResponseId = sessionData.previousResponseId;

  // If previousResponseId is missing here, something is wrong with session state
  if (!previousResponseId) {
    logger.error(
      { clientId: client.clientId, sessionId },
      "[WebSocket] CRITICAL: previousResponseId missing when handling function result. Aborting."
    );
    sendError(
      client,
      "Internal session state error: Missing previous response ID.",
      "INTERNAL_ERROR"
    );
    return;
  }

  // Prepare input for OpenAI: MUST include the assistant's function_call message
  // that preceded this function result.

  // Find the assistant message that requested the call (should be second to last)
  // And the function result message (should be last)
  const history = sessionData.chatHistory;
  let assistantMessageForApiInput: BackendChatMessage | undefined = undefined; // Renamed for clarity
  let functionResultForApi: FunctionCallOutputMessage | undefined = undefined;

  if (history.length >= 2) {
    const lastMessage = history[history.length - 1];
    const secondLastMessage = history[history.length - 2];

    // Check if the last message is the function result we just added
    if (
      isFunctionCallOutputMessage(lastMessage) &&
      lastMessage.call_id === call_id
    ) {
      functionResultForApi = lastMessage;
    }

    // Check if the second-to-last message is the assistant's request
    if (
      isBackendChatMessage(secondLastMessage) &&
      secondLastMessage.role === "assistant" &&
      secondLastMessage.tool_calls?.some((tc) => tc.id === call_id)
    ) {
      // Format correctly for the API input (role, content, tool_calls)
      assistantMessageForApiInput = {
        role: secondLastMessage.role,
        // Content was fixed to "" when created, so it should be valid here
        content: secondLastMessage.content,
        tool_calls: secondLastMessage.tool_calls,
      };
    }
  }

  if (!assistantMessageForApiInput || !functionResultForApi) {
    logger.error(
      {
        clientId: client.clientId,
        sessionId,
        historyLength: history.length,
        callId: call_id,
        foundAssistantMsg: !!assistantMessageForApiInput,
        foundFunctionResult: !!functionResultForApi,
      },
      "[WebSocket] CRITICAL: Could not find expected assistant call or function result in history for API input. Aborting."
    );
    sendError(
      client,
      "Internal session state error: History structure mismatch.",
      "INTERNAL_ERROR"
    );
    return;
  }

  // Construct the messagesForAPI array with the required context
  // Use InputMessage type which includes BackendChatMessage and FunctionCallOutputMessage
  const messagesForAPI: InputMessage[] = [
    assistantMessageForApiInput, // Assistant's message requesting the call (content should be "")
    functionResultForApi, // The function result itself
  ];
  logger.debug(
    // Use debug or trace level
    {
      clientId: client.clientId,
      sessionId: sessionId,
      callId: call_id,
      // Log the exact structure being sent to OpenAI
      messagesSentToOpenAI: messagesForAPI,
    },
    "[WebSocket] Preparing to send function result context to OpenAI"
  );
  // Send stream start notification
  sendMessage(client, { type: "stream_start", payload: { sessionId } });
  logger.info(
    { clientId: client.clientId, sessionId, callId: call_id },
    "[WebSocket] Initiating AI stream after function result"
  );

  try {
    // Call OpenAI again with the function result context, using the previous response ID
    // **Crucially, provide the availableTools here**
    await generateChatResponseStream(
      messagesForAPI, // Send the assistant call + function result
      previousResponseId, // Must have a valid ID here
      availableTools, // Pass the tools list here
      // onChunk: Handle text delta
      (chunk) => {
        sendMessage(client, { type: "stream_chunk", payload: { text: chunk } });
      },
      // onFunctionCall: Handle potential *subsequent* function calls
      (functionCall) => {
        logger.info(
          {
            clientId: client.clientId,
            sessionId,
            functionName: functionCall.name,
            callId: functionCall.call_id,
          },
          "[WebSocket] Subsequent function call detected in response, forwarding to client"
        );
        // Store the assistant message requesting this *new* call
        const subsequentAssistantCall: BackendChatMessage = {
          role: "assistant",
          content: "", // Use empty string here too for consistency
          tool_calls: [
            {
              id: functionCall.call_id,
              type: "function",
              function: {
                name: functionCall.name,
                arguments: functionCall.arguments,
              },
            },
          ],
        };
        addMessageToHistory(sessionId, subsequentAssistantCall);
        // Send to client
        sendMessage(client, {
          type: "stream_chunk",
          payload: { functionCall },
        });
      },
      // onComplete: Handle stream completion after function result processing
      (finalText, responseId) => {
        logger.info(
          {
            clientId: client.clientId,
            sessionId,
            responseId,
            responseLength: finalText ? finalText.length : 0,
          },
          "[WebSocket] AI stream completed after function result"
        );

        // Use the type guard for filtering history robustly
        const lastAssistantRequest = sessionData.chatHistory
          .filter(isBackendChatMessage) // Use the type guard here
          .filter((msg) => msg.role === "assistant" && !!msg.tool_calls)
          .pop(); // Get the last one

        // Create the final assistant message if text was generated
        if (finalText && finalText.trim().length > 0) {
          const finalAssistantMessage: BackendChatMessage = {
            role: "assistant",
            content: finalText,
          };
          updateSessionData(sessionId, responseId, finalAssistantMessage);
        } else if (lastAssistantRequest) {
          // If only another function call was made, update session using that message
          updateSessionData(sessionId, responseId, lastAssistantRequest);
        } else {
          logger.warn(
            { sessionId, responseId },
            "No text generated after function result and couldn't find assistant function request message in history."
          );
          const minimalAssistantMessage: BackendChatMessage = {
            role: "assistant",
            content: "", // Use empty string
          };
          updateSessionData(sessionId, responseId, minimalAssistantMessage);
        }

        sendMessage(client, {
          type: "stream_end",
          payload: { responseId, sessionId },
        });
      },
      // onError: Handle errors during the stream
      (error) => {
        const logContext = { clientId: client.clientId, sessionId };
        logger.error(
          error instanceof Error ? error : logContext,
          "[WebSocket] OpenAI stream error callback triggered after function result"
        );
        sendMessage(client, {
          type: "stream_error",
          payload: { message: error.message },
        });
        sendError(
          client,
          `AI stream failed after function result: ${error.message}`,
          "AI_ERROR"
        );
      }
    );
  } catch (error) {
    // Catch errors setting up the stream itself
    const logContext = { clientId: client.clientId, sessionId };
    logger.error(
      error instanceof Error ? error : logContext,
      "[WebSocket] Error setting up OpenAI stream after function result"
    );
    sendError(
      client,
      "Failed to initiate AI stream after function result.",
      "INTERNAL_ERROR"
    );
  }
}

// --- Helper Functions ---

type ErrorCode =
  | "BAD_REQUEST"
  | "SESSION_ERROR"
  | "AI_ERROR"
  | "INTERNAL_ERROR"
  | "UNKNOWN";

// Send structured error messages to the client
function sendError(
  client: WebSocketClient,
  message: string,
  code: ErrorCode = "UNKNOWN"
) {
  if (client.readyState === WebSocket.OPEN) {
    try {
      const errorPayload = { type: "error", payload: { code, message } };
      client.send(JSON.stringify(errorPayload));
      logger.warn(
        {
          clientId: client.clientId,
          sessionId: client.sessionId,
          code,
          message,
        },
        "[WebSocket] Sent error to client"
      );
    } catch (stringifyError) {
      logger.error(
        { clientId: client.clientId, error: stringifyError },
        "[WebSocket] Failed to stringify error message for client."
      );
    }
  } else {
    logger.warn(
      { clientId: client.clientId, sessionId: client.sessionId, code, message },
      "[WebSocket] Tried to send error to closed client"
    );
  }
}

// Send structured messages to the client
function sendMessage(
  client: WebSocketClient,
  message: WSMessageBase & { payload: any }
) {
  if (client.readyState === WebSocket.OPEN) {
    try {
      const messageString = JSON.stringify(message);
      client.send(messageString);

      // Use trace level for stream chunks, debug level for other messages
      if (message.type === "stream_chunk") {
        logger.trace(
          {
            clientId: client.clientId,
            sessionId: client.sessionId,
            type: message.type,
          },
          "[WebSocket] Sent message to client"
        );
      } else {
        logger.debug(
          {
            clientId: client.clientId,
            sessionId: client.sessionId,
            type: message.type,
          },
          "[WebSocket] Sent message to client"
        );
      }
    } catch (error) {
      const logContext = {
        clientId: client.clientId,
        messageType: message.type,
      };
      logger.error(
        error instanceof Error ? error : logContext,
        "[WebSocket] Failed to stringify or send message"
      );
      // Avoid infinite loop if error is in sendError itself
      if (message.type !== "error") {
        sendError(
          client,
          "Failed to serialize message for sending.",
          "INTERNAL_ERROR"
        );
      }
    }
  } else {
    logger.warn(
      {
        clientId: client.clientId,
        sessionId: client.sessionId,
        type: message.type,
      },
      "[WebSocket] Tried to send message to closed client"
    );
  }
}

// Setup ping/pong for heartbeat
function setupHeartbeat(wss: WebSocketServer) {
  const interval = setInterval(() => {
    clients.forEach((client) => {
      if (!client || client.readyState !== WebSocket.OPEN) {
        // Clean up if client somehow still in map but not open
        if (client) clients.delete(client.clientId);
        return;
      }
      if (client.isAlive === false) {
        logger.warn(
          { clientId: client.clientId, sessionId: client.sessionId },
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
    logger.info({}, "[WebSocket] Server closing, heartbeat interval stopped.");
  });
}
