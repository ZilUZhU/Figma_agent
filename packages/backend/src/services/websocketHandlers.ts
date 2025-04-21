import {
  WebSocketClient,
  ChatMessageRequest,
  FunctionResultRequest,
  sendMessage,
  sendError,
} from "./websocketUtils";
import {
  getOrCreateSession,
  updateSessionData,
  isValidSession,
  addMessageToHistory,
  FunctionCallOutputMessage,
  HistoryMessage,
} from "./session";
import { generateChatResponseStream, DetectedFunctionCall } from "./openai";
import { availableTools } from "@tools/index";
import { ensureSystemInstruction } from "@config/ai";
import { ChatMessage, InputMessage, BackendChatMessage } from "@types";
import { logger } from "@utils/logger";

interface EnhancedFunctionCall extends DetectedFunctionCall {
  name: string;
  call_id: string;
  arguments: string;
}

// --- Type Guards (needed for history processing within handlers) ---

function isBackendChatMessage(msg: HistoryMessage): msg is BackendChatMessage {
  return (
    msg !== null && typeof msg === "object" && "role" in msg && "content" in msg
  );
}

function isFunctionCallOutputMessage(
  msg: HistoryMessage
): msg is FunctionCallOutputMessage {
  return (
    msg !== null &&
    typeof msg === "object" &&
    "type" in msg &&
    msg.type === "function_call_output" &&
    "call_id" in msg &&
    "output" in msg
  );
}

// --- Message Handlers ---

/**
 * Handles incoming 'chat_message' requests.
 */
export async function handleChatMessage(
  client: WebSocketClient,
  sessionId: string,
  request: ChatMessageRequest
) {
  const userMessageContent = request.payload.message;
  // INFO log for starting processing
  logger.info(
    { sessionId, messageLength: userMessageContent.length },
    "[WebSocket] Processing user message"
  );

  // Retrieve session data - still needed for history and previousResponseId
  const { sessionData } = getOrCreateSession(sessionId);
  const previousResponseId = sessionData.previousResponseId;

  // Create the user message object
  const newUserMessage: ChatMessage = {
    role: "user",
    content: userMessageContent,
  };

  // Add user message to conceptual history
  addMessageToHistory(sessionId, newUserMessage); // TRACE log in session.ts

  // Prepare input for OpenAI
  let messagesForAPI: Array<InputMessage | FunctionCallOutputMessage>;
  if (!previousResponseId) {
    // Starting a new chain: send history including the new user message, ensure system prompt
    messagesForAPI = ensureSystemInstruction(sessionData.chatHistory);
  } else {
    // Continuing a chain: only send the new user message
    messagesForAPI = [newUserMessage];
  }

  // Send stream start notification - DEBUG log via sendMessage
  sendMessage(client, { type: "stream_start", payload: { sessionId } });

  // INFO log for initiating AI call
  logger.info(
    { sessionId, isNewChain: !previousResponseId },
    "[WebSocket] Initiating AI stream"
  );

  try {
    // Always pass availableTools so the model can decide whether to use them
    await generateChatResponseStream(
      messagesForAPI,
      previousResponseId || undefined,
      availableTools, // Pass tools here
      // onChunk: Handle text delta - TRACE log via sendMessage
      (chunk) => {
        sendMessage(client, { type: "stream_chunk", payload: { text: chunk } });
      },
      // onFunctionCall: Handle detected function call
      (functionCall) => {
        // Use type assertion if necessary, or ensure DetectedFunctionCall has needed props
        const enhancedCall = functionCall as EnhancedFunctionCall;

        // INFO log for function call request
        logger.info(
          {
            sessionId,
            function: enhancedCall.name,
            callId: enhancedCall.call_id,
          },
          "[WebSocket] Function call requested by AI"
        );
        // DEBUG log for raw function call data - 简化日志以减少输出
        const simplifiedCall = {
          type: enhancedCall.type,
          name: enhancedCall.name,
          call_id: enhancedCall.call_id,
          arguments_summary: `${enhancedCall.arguments.substring(0, 50)}${
            enhancedCall.arguments.length > 50 ? "..." : ""
          }`,
        };
        logger.rawJson("FUNCTION_CALL_REQUESTED", simplifiedCall, "debug");

        // Store the assistant's request with content: ""
        const assistantMessageWithCall: BackendChatMessage = {
          role: "assistant",
          content: "", // Use empty string
          tool_calls: [
            {
              id: enhancedCall.call_id,
              type: "function",
              function: {
                name: enhancedCall.name,
                arguments: enhancedCall.arguments,
              },
            },
          ],
        };
        addMessageToHistory(sessionId, assistantMessageWithCall); // TRACE log

        // Send function call details to the client - DEBUG log via sendMessage
        sendMessage(client, {
          type: "stream_chunk",
          payload: { functionCall }, // Send the original DetectedFunctionCall structure
        });
      },
      // onComplete: Handle stream completion
      (finalText, responseId) => {
        // INFO log for completion (OpenAI log has details)
        logger.info(
          {
            sessionId,
            responseId,
            hasText: !!finalText, // Indicate if text was generated
          },
          "[WebSocket] AI response processing complete"
        );

        // Find the assistant message that might have requested a tool call
        const assistantRequestMessage = sessionData.chatHistory
          .filter(isBackendChatMessage)
          .filter((msg) => msg.role === "assistant" && !!msg.tool_calls)
          .pop();

        // Create the final assistant message only if there's text output
        if (finalText && finalText.trim().length > 0) {
          const finalAssistantMessage: BackendChatMessage = {
            role: "assistant",
            content: finalText,
          };
          updateSessionData(sessionId, responseId, finalAssistantMessage); // TRACE log
        } else if (assistantRequestMessage) {
          // If no text, update session using the assistant message that requested the tool call
          updateSessionData(sessionId, responseId, assistantRequestMessage); // TRACE log
        } else {
          // Fallback if no text and no tool call request found
          logger.warn(
            { sessionId, responseId },
            "[WebSocket] No text generated and no assistant function request found."
          );
          const minimalAssistantMessage: BackendChatMessage = {
            role: "assistant",
            content: "",
          };
          updateSessionData(sessionId, responseId, minimalAssistantMessage); // TRACE log
        }

        // Send stream end notification - DEBUG log via sendMessage
        sendMessage(client, {
          type: "stream_end",
          payload: { responseId, sessionId },
        });
      },
      // onError: Handle errors during the stream
      (error) => {
        // ERROR: OpenAI stream error is critical
        logger.error(error, "[WebSocket] OpenAI stream error during chat", {
          sessionId,
        });
        sendMessage(client, {
          type: "stream_error",
          payload: { message: error.message },
        }); // DEBUG log
        sendError(client, `AI stream failed: ${error.message}`, "AI_ERROR"); // WARN log
      }
    );
  } catch (err) {
    // ERROR: Failure to even start the stream is critical
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(error, "[WebSocket] Failed to setup OpenAI stream for chat", {
      sessionId,
    });
    sendError(client, "Failed to initiate AI stream.", "INTERNAL_ERROR"); // WARN log
  }
}

/**
 * Handles incoming 'function_result' requests.
 */
export async function handleFunctionResult(
  client: WebSocketClient,
  sessionId: string, // Session ID is now guaranteed by the caller in websocket.ts
  request: FunctionResultRequest
) {
  const callId = request.payload.functionCallOutput.call_id;
  // INFO log for starting processing
  logger.info({ sessionId, callId }, "[WebSocket] Processing function result");
  // DEBUG log for raw function result data - 简化日志
  const simplifiedResult = {
    ...request.payload.functionCallOutput,
    output:
      typeof request.payload.functionCallOutput.output === "string"
        ? request.payload.functionCallOutput.output.length > 100
          ? request.payload.functionCallOutput.output.substring(0, 100) + "..."
          : request.payload.functionCallOutput.output
        : "(object output, details omitted in logs)",
  };
  logger.rawJson("FUNCTION_RESULT_RECEIVED", simplifiedResult, "debug");

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
  addMessageToHistory(sessionId, functionResultMessage); // TRACE log

  // Retrieve session data to get the previousResponseId
  const { sessionData } = getOrCreateSession(sessionId);
  const previousResponseId = sessionData.previousResponseId;

  // If previousResponseId is missing here, something is wrong with session state
  if (!previousResponseId) {
    // ERROR: Critical state issue
    logger.error(
      { sessionId },
      "[WebSocket] CRITICAL: Missing previousResponseId for function result"
    );
    sendError(client, "Internal session state error.", "INTERNAL_ERROR"); // WARN log
    return;
  }

  // Prepare input for OpenAI: MUST include the assistant's function_call message
  // Find the assistant message that requested the call and the function result message
  const history = sessionData.chatHistory;
  let assistantMessageForApiInput: BackendChatMessage | undefined = undefined;
  let functionResultForApi: FunctionCallOutputMessage | undefined = undefined;

  if (history.length >= 2) {
    const lastMessage = history[history.length - 1];
    const secondLastMessage = history[history.length - 2];

    if (
      isFunctionCallOutputMessage(lastMessage) &&
      lastMessage.call_id === call_id
    ) {
      functionResultForApi = lastMessage;
    }
    if (
      isBackendChatMessage(secondLastMessage) &&
      secondLastMessage.role === "assistant" &&
      secondLastMessage.tool_calls?.some((tc) => tc.id === call_id)
    ) {
      assistantMessageForApiInput = {
        role: secondLastMessage.role,
        content: secondLastMessage.content, // Should be ""
        tool_calls: secondLastMessage.tool_calls,
      };
    }
  }

  if (!assistantMessageForApiInput || !functionResultForApi) {
    // ERROR: Critical state issue
    logger.error(
      { sessionId, callId, historyLength: history.length },
      "[WebSocket] CRITICAL: Invalid history structure for function result"
    );
    sendError(client, "Internal session state error.", "INTERNAL_ERROR"); // WARN log
    return;
  }

  // Construct the messagesForAPI array
  const messagesForAPI: InputMessage[] = [
    assistantMessageForApiInput,
    functionResultForApi,
  ];
  // Optional DEBUG log for context sent to OpenAI
  // logger.debug({ messagesSentToOpenAI: messagesForAPI }, "[WebSocket] Sending function result context to OpenAI");

  // Send stream start notification - DEBUG log via sendMessage
  sendMessage(client, { type: "stream_start", payload: { sessionId } });

  // INFO log for initiating AI call
  logger.info(
    { sessionId, callId },
    "[WebSocket] Initiating AI stream after function result"
  );

  try {
    // Call OpenAI again with the function result context
    await generateChatResponseStream(
      messagesForAPI,
      previousResponseId,
      availableTools, // Pass the tools list again
      // onChunk: Handle text delta - TRACE log via sendMessage
      (chunk) => {
        sendMessage(client, { type: "stream_chunk", payload: { text: chunk } });
      },
      // onFunctionCall: Handle potential *subsequent* function calls
      (functionCall) => {
        // Use type assertion if necessary
        const enhancedCall = functionCall as EnhancedFunctionCall;

        // INFO log for subsequent function call
        logger.info(
          {
            sessionId,
            function: enhancedCall.name,
            callId: enhancedCall.call_id,
          },
          "[WebSocket] Subsequent function call requested by AI"
        );
        // DEBUG log for raw subsequent function call data - 简化日志
        const simplifiedSubsequentCall = {
          type: enhancedCall.type,
          name: enhancedCall.name,
          call_id: enhancedCall.call_id,
          arguments_summary: `${enhancedCall.arguments.substring(0, 50)}${
            enhancedCall.arguments.length > 50 ? "..." : ""
          }`,
        };
        logger.rawJson(
          "SUBSEQUENT_FUNCTION_CALL",
          simplifiedSubsequentCall,
          "debug"
        );

        // Store the assistant message requesting this *new* call
        const subsequentAssistantCall: BackendChatMessage = {
          role: "assistant",
          content: "", // Use empty string
          tool_calls: [
            {
              id: enhancedCall.call_id,
              type: "function",
              function: {
                name: enhancedCall.name,
                arguments: enhancedCall.arguments,
              },
            },
          ],
        };
        addMessageToHistory(sessionId, subsequentAssistantCall); // TRACE log
        // Send to client - DEBUG log via sendMessage
        sendMessage(client, {
          type: "stream_chunk",
          payload: { functionCall },
        });
      },
      // onComplete: Handle stream completion after function result processing
      (finalText, responseId) => {
        // INFO log for completion
        logger.info(
          {
            sessionId,
            responseId,
            hasText: !!finalText,
          },
          "[WebSocket] AI response processing complete (after function result)"
        );

        // Find the last assistant message that might have requested a tool call
        const lastAssistantRequest = sessionData.chatHistory
          .filter(isBackendChatMessage)
          .filter((msg) => msg.role === "assistant" && !!msg.tool_calls)
          .pop();

        // Create the final assistant message if text was generated
        if (finalText && finalText.trim().length > 0) {
          const finalAssistantMessage: BackendChatMessage = {
            role: "assistant",
            content: finalText,
          };
          updateSessionData(sessionId, responseId, finalAssistantMessage); // TRACE log
        } else if (lastAssistantRequest) {
          // If only another function call was made, update session using that message
          updateSessionData(sessionId, responseId, lastAssistantRequest); // TRACE log
        } else {
          logger.warn(
            { sessionId, responseId },
            "[WebSocket] No text generated after function result and no assistant function request found."
          );
          const minimalAssistantMessage: BackendChatMessage = {
            role: "assistant",
            content: "",
          };
          updateSessionData(sessionId, responseId, minimalAssistantMessage); // TRACE log
        }

        // Send stream end notification - DEBUG log via sendMessage
        sendMessage(client, {
          type: "stream_end",
          payload: { responseId, sessionId },
        });
      },
      // onError: Handle errors during the stream
      (error) => {
        // ERROR: Critical
        logger.error(
          error,
          "[WebSocket] OpenAI stream error after function result",
          { sessionId }
        );
        sendMessage(client, {
          type: "stream_error",
          payload: { message: error.message },
        }); // DEBUG log
        sendError(
          client,
          `AI stream failed after function result: ${error.message}`,
          "AI_ERROR"
        ); // WARN log
      }
    );
  } catch (err) {
    // ERROR: Critical
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(
      error,
      "[WebSocket] Failed to setup OpenAI stream after function result",
      { sessionId }
    );
    sendError(
      client,
      "Failed to initiate AI stream after function result.",
      "INTERNAL_ERROR"
    ); // WARN log
  }
}
