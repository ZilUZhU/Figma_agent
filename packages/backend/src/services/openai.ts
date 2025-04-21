import OpenAI, { APIError } from "openai";
import { Stream } from "openai/streaming";
import { OPENAI_API_KEY, OPENAI_MODEL } from "@config/index";
import {
  InputMessage,
  FunctionCallOutputMessage,
  Tool as LocalToolType,
  ChatMessage as CommonChatMessage,
  MessageRole,
} from "@types";
import { logger } from "@utils/logger";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Type guard to check if a message is a FunctionCallOutput
function isFunctionCallOutput(
  message: any
): message is FunctionCallOutputMessage {
  return (
    message?.type === "function_call_output" &&
    typeof message.call_id === "string" &&
    message.output !== undefined
  );
}

// Helper function to convert messages into the format accepted by OpenAI Responses API
function prepareApiInput(
  messages: Array<InputMessage>
): string | OpenAI.Responses.ResponseInput {
  // If we have a single message that's a string, return it directly
  if (
    messages.length === 1 &&
    "role" in messages[0] &&
    "content" in messages[0] &&
    typeof messages[0].content === "string"
  ) {
    return messages[0].content;
  }

  // Otherwise, format as expected by OpenAI Responses API
  return messages
    .map((msg) => {
      // Handle function call output
      if (isFunctionCallOutput(msg)) {
        return {
          type: "function_call_output" as const,
          call_id: msg.call_id,
          output:
            typeof msg.output === "string"
              ? msg.output
              : JSON.stringify(msg.output),
        };
      }

      // Handle standard messages with content
      if ("role" in msg && "content" in msg) {
        // Create a valid EasyInputMessage as described in the ResponseInput type
        return {
          role: msg.role,
          content: typeof msg.content === "string" ? msg.content : "",
          // type: 'message' is optional according to OpenAI docs
        };
      }

      // Log warning for invalid message format and return null
      logger.warn(
        { messageStructure: msg },
        "[OpenAI] prepareApiInput skipping unexpected message structure"
      );

      // We'll filter these out
      return null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

// Define the structure for a function call detected in the response stream
export interface DetectedFunctionCall {
  type: "function_call";
  id: string;
  call_id: string;
  name: string;
  arguments: string;
}

/**
 * Generates a chat response using the OpenAI Responses API (Streaming).
 * Handles text generation and optionally function/tool calls.
 * Incorporates refined logging.
 */
export async function generateChatResponseStream(
  conversationHistory: Array<InputMessage>,
  previousResponseId: string | undefined,
  toolsToUse: LocalToolType[] | undefined,
  onChunk: (chunk: string) => void,
  onFunctionCall: (functionCall: DetectedFunctionCall) => void,
  onComplete: (finalText: string | null, responseId: string) => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    const requestPayload: OpenAI.Responses.ResponseCreateParamsStreaming = {
      model: OPENAI_MODEL,
      input: prepareApiInput(conversationHistory),
      stream: true,
      store: true,
    };
    if (toolsToUse && toolsToUse.length > 0) {
      requestPayload.tools = toolsToUse;
      requestPayload.tool_choice = "auto";
    }

    if (previousResponseId) {
      requestPayload.previous_response_id = previousResponseId;
      logger.info(
        {
          previousResponseId,
          inputMessages: conversationHistory.length,
          hasTools: !!requestPayload.tools,
        },
        "[OpenAI] Continuing conversation"
      );
    } else {
      logger.info(
        {
          inputMessages: conversationHistory.length,
          hasTools: !!requestPayload.tools,
        },
        "[OpenAI] Starting new conversation"
      );
    }

    const stream = await openai.responses.create(requestPayload);

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
          "[OpenAI] Response stream created"
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
            logger.rawJson("OPENAI_FUNCTION_CALL_ITEM", event.item, "debug");
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
                argsLength: currentFunctionCall.arguments.length,
              },
              "[OpenAI] Function call arguments complete"
            );
            logger.rawJson(
              "OPENAI_FUNCTION_ARGS_DONE",
              {
                name: currentFunctionCall.name,
                args: currentFunctionCall.arguments,
              },
              "debug"
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
          finalStatus = event.response?.status;
          finalError = event.response?.error;
          finalIncompleteDetails = event.response?.incomplete_details;
          const usage = event.response?.usage;
          const outputItems = event.response?.output || [];
          const outputSummary =
            outputItems.map((item) => item.type).join(", ") || "none";

          logger.info(
            {
              responseId: event.response?.id,
              status: finalStatus,
              model: event.response?.model || OPENAI_MODEL,
              usage: usage
                ? {
                    input_tokens: usage.input_tokens,
                    output_tokens: usage.output_tokens,
                    total_tokens: usage.total_tokens,
                    reasoning_tokens:
                      usage.output_tokens_details?.reasoning_tokens,
                  }
                : null,
              outputItems: outputSummary,
            },
            "[OpenAI] Response stream completed"
          );

          if (event.response) {
            const logResponse = { ...event.response };

            if (logResponse.tools && logResponse.tools.length > 0) {
              const { tools, ...restResponse } = logResponse;
              const logObject = {
                ...restResponse,
                tools_info: `${tools.length} tools available (details omitted in logs)`,
              };
              logger.rawJson(
                "OPENAI_RESPONSE_COMPLETED_RAW",
                logObject,
                "debug"
              );
            } else {
              logger.rawJson(
                "OPENAI_RESPONSE_COMPLETED_RAW",
                logResponse,
                "debug"
              );
            }
          } else {
            logger.rawJson(
              "OPENAI_RESPONSE_COMPLETED_RAW",
              event.response,
              "debug"
            );
          }

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
              "[OpenAI] Response stream finished with failure"
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
              "[OpenAI] Response stream completed with unexpected status"
            );
            onComplete(fullTextResponse || null, responseId);
          }
          break;

        case "error":
          const streamError = event as any;
          logger.error(streamError, "[OpenAI] Response stream error event");
          onError(
            new Error(
              `Stream error: ${streamError?.message || "Unknown stream error"}`
            )
          );
          return;
      }
    }

    if (finalStatus === undefined && responseId) {
      logger.warn(
        { responseId },
        "[OpenAI] Stream loop finished without completion event, calling onComplete"
      );
      onComplete(fullTextResponse || null, responseId);
    } else if (finalStatus === undefined && !responseId) {
      logger.error(
        {},
        "[OpenAI] Stream loop finished without *any* events or completion."
      );
      onError(
        new Error("OpenAI stream ended unexpectedly without completing.")
      );
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(error, "[OpenAI] Error during stream execution/processing");
    if (err instanceof APIError) {
      logger.error(
        {
          status: err.status,
          type: err.type,
          code: err.code,
          param: err.param,
        },
        "[OpenAI] API Error details"
      );
      onError(
        new Error(
          `OpenAI API Error: Status ${err.status}, Type: ${err.type}, Message: ${err.message}`
        )
      );
    } else if (err instanceof Error) {
      onError(err);
    } else {
      onError(
        new Error("An unknown error occurred processing the OpenAI stream.")
      );
    }
  }
}
