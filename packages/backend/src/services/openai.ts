/**
 * OpenAI API Service using the Responses API
 * Handles chat generation, function/tool calling, and streaming.
 */

import OpenAI, { APIError } from "openai";
// Import specific types needed from the library
import { Stream } from "openai/streaming";
// Import the specific type for Response Tools if available, otherwise use our corrected LocalToolType
// Example: import { Tool as OpenAITool } from "openai/resources/responses/responses"; // Adjust based on actual SDK export

import { OPENAI_API_KEY, OPENAI_MODEL } from "@config/index";
import {
  InputMessage,
  FunctionCallOutputMessage,
  Tool as LocalToolType, // Use our local (now corrected) Tool definition alias
} from "@types";
// availableTools is imported but used directly now
// import { availableTools } from "@tools/index";
import { logger } from "@utils/logger";

// Initialize OpenAI Client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Type guard to check if a message is a FunctionCallOutput
function isFunctionCallOutput(
  message: any
): message is FunctionCallOutputMessage {
  return (
    message?.type === "function_call_output" &&
    typeof message.call_id === "string" &&
    typeof message.output === "string"
  );
}

// Prepares messages for the OpenAI Responses API input.
function prepareApiInput(messages: Array<InputMessage>): Array<any> {
  return messages
    .map((msg) => {
      if (isFunctionCallOutput(msg)) {
        // Ensure output is stringified if it's not already
        return {
          ...msg,
          output:
            typeof msg.output === "string"
              ? msg.output
              : JSON.stringify(msg.output),
        };
      }
      // Ensure we only send properties the API expects for standard messages
      if ("role" in msg && "content" in msg) {
        return { role: msg.role, content: msg.content };
      }
      // Filter out unexpected message structures silently, or log a warning
      logger.warn(
        { messageStructure: msg },
        "prepareApiInput encountered unexpected message structure, filtering out."
      );
      return null; // Or handle appropriately
    })
    .filter((msg) => msg !== null); // Remove any null entries
}

// Define the structure for a function call detected in the response
export interface DetectedFunctionCall {
  type: "function_call";
  id: string; // ID of the function call item in the response output array
  call_id: string; // ID used to link function results back
  name: string;
  arguments: string; // JSON string arguments
}

/**
 * Generates a chat response using the OpenAI Responses API (Streaming).
 * Handles text generation and optionally function/tool calls.
 *
 * @param conversationHistory Messages forming the input context.
 * @param previousResponseId Optional ID to continue a conversation thread.
 * @param toolsToUse Optional array of tools (using the corrected LocalToolType) to make available.
 * @param onChunk Callback for text delta chunks.
 * @param onFunctionCall Callback when a function call is detected.
 * @param onComplete Callback when the stream finishes successfully.
 * @param onError Callback for stream errors.
 */
export async function generateChatResponseStream(
  conversationHistory: Array<InputMessage>,
  previousResponseId: string | undefined,
  toolsToUse: LocalToolType[] | undefined, // Expects the corrected Tool type now
  onChunk: (chunk: string) => void,
  onFunctionCall: (functionCall: DetectedFunctionCall) => void,
  onComplete: (finalText: string | null, responseId: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    // Prepare the base payload
    const requestPayload: OpenAI.Responses.ResponseCreateParamsStreaming = {
      model: OPENAI_MODEL,
      input: prepareApiInput(conversationHistory),
      stream: true,
      store: true,
    };

    // Only add tools and tool_choice if toolsToUse is provided and not empty
    if (toolsToUse && toolsToUse.length > 0) {
      // *** Direct assignment should now work due to corrected LocalToolType ***
      requestPayload.tools = toolsToUse; // Assign directly
      requestPayload.tool_choice = "auto";
    }

    // Logging logic remains the same...
    if (previousResponseId) {
      requestPayload.previous_response_id = previousResponseId;
      let userMsgPreview = null;
      const userMsg = conversationHistory.find(
        (msg) => "role" in msg && msg.role === "user"
      );
      if (
        userMsg &&
        "content" in userMsg &&
        typeof userMsg.content === "string"
      ) {
        userMsgPreview =
          userMsg.content.substring(0, 50) +
          (userMsg.content.length > 50 ? "..." : "");
      }
      logger.info(
        {
          previousResponseId,
          messageCount: conversationHistory.length,
          hasFunctionResult: conversationHistory.some(
            (msg) => "type" in msg && msg.type === "function_call_output"
          ),
          hasTools: !!(toolsToUse && toolsToUse.length > 0),
          toolCount: toolsToUse ? toolsToUse.length : 0,
          userMessagePreview: userMsgPreview,
        },
        "[OpenAI] Continuing existing conversation"
      );
    } else {
      let userMsgPreview = null;
      const userMsg = conversationHistory.find(
        (msg) => "role" in msg && msg.role === "user"
      );
      if (
        userMsg &&
        "content" in userMsg &&
        typeof userMsg.content === "string"
      ) {
        userMsgPreview =
          userMsg.content.substring(0, 50) +
          (userMsg.content.length > 50 ? "..." : "");
      }
      logger.info(
        {
          messageCount: conversationHistory.length,
          hasTools: !!(toolsToUse && toolsToUse.length > 0),
          toolCount: toolsToUse ? toolsToUse.length : 0,
          userMessagePreview: userMsgPreview,
        },
        "[OpenAI] Starting new conversation chain"
      );
    }
    logger.trace(
      { payload: requestPayload },
      "[OpenAI] Sending complete request payload"
    );

    // Execute the API call
    const stream = await openai.responses.create(requestPayload);

    // Process the stream events (event handling logic remains the same...)
    let fullTextResponse = "";
    let responseId = "";
    let currentFunctionCall: DetectedFunctionCall | null = null;
    let functionArgumentsBuffer = "";
    let finalStatus: OpenAI.Responses.Response["status"] | undefined =
      undefined;
    let finalError: OpenAI.Responses.Response["error"] | undefined = undefined;
    let finalIncompleteDetails:
      | OpenAI.Responses.Response["incomplete_details"]
      | undefined = undefined;

    for await (const event of stream) {
      if (
        !responseId &&
        event.type === "response.created" &&
        event.response?.id
      ) {
        responseId = event.response.id;
        logger.info(
          { responseId, model: event.response?.model || OPENAI_MODEL },
          "[OpenAI] Response stream created, assigned ID"
        );
      }

      switch (event.type) {
        case "response.output_item.added":
          if (event.item?.type === "function_call") {
            functionArgumentsBuffer = "";
            currentFunctionCall = {
              type: "function_call",
              id: event.item.id || `temp_fc_${Date.now()}`,
              call_id: event.item.call_id,
              name: event.item.name,
              arguments: "",
            };
            logger.info(
              {
                functionName: currentFunctionCall.name,
                callId: currentFunctionCall.call_id,
              },
              "[OpenAI] Function call started"
            );
          }
          break;

        case "response.function_call_arguments.delta":
          if (currentFunctionCall && event.delta) {
            functionArgumentsBuffer += event.delta;
          }
          break;

        case "response.function_call_arguments.done":
          if (currentFunctionCall && event.arguments !== undefined) {
            currentFunctionCall.arguments = event.arguments;
            logger.info(
              {
                functionName: currentFunctionCall.name,
                callId: currentFunctionCall.call_id,
                argumentsLength: currentFunctionCall.arguments.length,
                argumentsPreview:
                  currentFunctionCall.arguments.length > 100
                    ? currentFunctionCall.arguments.substring(0, 100) + "..."
                    : currentFunctionCall.arguments,
              },
              "[OpenAI] Function call arguments complete"
            );
            onFunctionCall(currentFunctionCall);
            currentFunctionCall = null;
            functionArgumentsBuffer = "";
          }
          break;

        case "response.output_text.delta":
          if (event.delta) {
            fullTextResponse += event.delta;
            onChunk(event.delta);
          }
          break;

        case "response.refusal.delta":
          if (event.delta) {
            logger.warn(
              { refusalChunk: event.delta },
              "[OpenAI] Received refusal content delta"
            );
            const refusalText = `[Refusal]: ${event.delta}`;
            fullTextResponse += refusalText;
            onChunk(refusalText);
          }
          break;

        case "response.completed":
          const usage = event.response?.usage;
          const output = event.response?.output || [];
          const functionCalls = output.filter(
            (item) => item.type === "function_call"
          );

          logger.info(
            {
              responseId,
              status: event.response?.status,
              model: event.response?.model || OPENAI_MODEL,
              completionTokens: usage
                ? (usage as any).completion_tokens || 0
                : 0,
              promptTokens: usage ? (usage as any).prompt_tokens || 0 : 0,
              totalTokens: usage ? (usage as any).total_tokens || 0 : 0,
              responseLength: fullTextResponse.length,
              hasFunctionCalls: functionCalls.length > 0,
              functionCallCount: functionCalls.length || 0,
            },
            "[OpenAI] Response stream completed"
          );
          finalStatus = event.response?.status;
          finalError = event.response?.error;
          finalIncompleteDetails = event.response?.incomplete_details;

          if (finalStatus === "completed") {
            onComplete(fullTextResponse || null, responseId);
          } else if (finalStatus === "incomplete") {
            logger.warn(
              { responseId, reason: finalIncompleteDetails?.reason },
              "[OpenAI] Response stream finished incomplete"
            );
            onComplete(fullTextResponse || null, responseId);
          } else if (finalStatus === "failed") {
            logger.error(
              { responseId, error: finalError },
              "[OpenAI] Response stream finished with failure status"
            );
            onError(
              new Error(
                `OpenAI stream failed: ${
                  finalError?.message || "Unknown API error"
                }`
              )
            );
          } else {
            logger.warn(
              { responseId, finalStatus },
              "[OpenAI] Response stream completed event with unexpected status, treating as complete."
            );
            onComplete(fullTextResponse || null, responseId);
          }
          break;

        case "error":
          const streamError = event as any; // Cast needed as SDK type might not include error details directly
          logger.error(
            { errorEvent: streamError },
            "[OpenAI] Response stream error event occurred"
          );
          onError(
            new Error(
              `Stream error: ${streamError?.message || "Unknown stream error"}`
            )
          );
          return;
      }
    }

    if (finalStatus === undefined) {
      logger.warn(
        { responseId },
        "[OpenAI Stream] Stream loop finished without a completion event. Calling onComplete as fallback."
      );
      onComplete(fullTextResponse || null, responseId);
    }
  } catch (error) {
    logger.error(
      error instanceof Error ? error : { message: String(error) },
      "[OpenAI Stream] Error executing or processing OpenAI Responses API stream"
    );
    if (error instanceof APIError) {
      onError(
        new Error(
          `OpenAI API Error: Status ${error.status}, Type: ${error.type}, Message: ${error.message}`
        )
      );
    } else if (error instanceof Error) {
      onError(error);
    } else {
      onError(
        new Error(
          "An unknown error occurred while processing the OpenAI stream."
        )
      );
    }
  }
}
