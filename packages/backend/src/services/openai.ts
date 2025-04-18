/**
 * OpenAI API Service using the Responses API
 * Handles chat generation, function/tool calling, and streaming.
 */

import OpenAI, { APIError } from "openai";
// Import specific types needed from the library
import { Stream } from "openai/streaming"; // Correct import for Stream type
import { ResponseStreamEvent } from "openai/resources/responses/responses"; // Correct import for event type

import { OPENAI_API_KEY, OPENAI_MODEL } from "@config/index";
import { InputMessage, FunctionCallOutputMessage, Tool as LocalToolType } from "@types"; // Use our local Tool definition alias
import { availableTools } from "@tools/index";
import { logger } from "@utils/logger";

// Initialize OpenAI Client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Type guard to check if a message is a FunctionCallOutput
function isFunctionCallOutput(message: any): message is FunctionCallOutputMessage {
  return message?.type === "function_call_output" && typeof message.call_id === 'string' && typeof message.output === 'string';
}

// Prepares messages for the OpenAI Responses API input.
function prepareApiInput(messages: Array<InputMessage>): Array<any> {
    return messages.map(msg => {
        if (isFunctionCallOutput(msg)) {
            return {
                ...msg,
                output: typeof msg.output === 'string' ? msg.output : JSON.stringify(msg.output)
            };
        }
        // Ensure we only send properties the API expects for standard messages
        if ('role' in msg && 'content' in msg) {
            return { role: msg.role, content: msg.content };
        }
        // Filter out unexpected message structures silently, or log a warning
        logger.warn({ messageStructure: msg }, "prepareApiInput encountered unexpected message structure");
        return null; // Or handle appropriately
    }).filter(msg => msg !== null); // Remove any null entries
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
 * Handles text generation and function/tool calls.
 */
export async function generateChatResponseStream(
  conversationHistory: Array<InputMessage>,
  previousResponseId: string | undefined,
  onChunk: (chunk: string) => void,
  onFunctionCall: (functionCall: DetectedFunctionCall) => void,
  onComplete: (finalText: string | null, responseId: string) => void,
  onError: (error: Error) => void
): Promise<void> {

  try {
      // Use any type for payload to bypass type checking issues
      const requestPayload: any = {
        model: OPENAI_MODEL,
        input: prepareApiInput(conversationHistory),
        tools: availableTools,
        tool_choice: "auto",
        stream: true,
        store: true,
      };

      if (previousResponseId) {
        requestPayload.previous_response_id = previousResponseId;
        logger.info({ previousResponseId, messageCount: conversationHistory.length }, "[OpenAI Stream] Continuing conversation with previous_response_id");
      } else {
         logger.info({ messageCount: conversationHistory.length }, "[OpenAI Stream] Starting new conversation chain");
      }

      logger.debug({ model: OPENAI_MODEL, tools: availableTools.map(t => t.function.name) }, "[OpenAI Stream] Sending request to Responses API");

      // Execute the API call
      const response = await openai.responses.create(requestPayload);
      
      // Verify we received a streamable response (has Symbol.asyncIterator)
      if (!response || typeof (response as any)[Symbol.asyncIterator] !== 'function') {
        throw new Error("Expected a streaming response but received a non-streamable result");
      }
      
      // Now we can safely cast to a Stream and iterate
      const stream = response as any;

      // Process the stream events
      let fullTextResponse = "";
      let responseId = "";
      let currentFunctionCall: DetectedFunctionCall | null = null;
      let functionArgumentsBuffer = "";

      // Process stream events based on type
      for await (const event of stream) {
        // Check if we have a response ID from the event
        if (!responseId && 'response' in event && event.response?.id) {
            responseId = event.response.id;
            logger.info({ responseId }, "[OpenAI Stream] Stream started, received response ID");
        }

        switch (event.type) {
          case "response.output_item.added":
            if ('item' in event && event.item?.type === "function_call") {
              functionArgumentsBuffer = "";
              currentFunctionCall = {
                  type: "function_call",
                  id: event.item.id || "", // Ensure we have a string, using empty string as fallback
                  call_id: event.item.call_id,
                  name: event.item.name,
                  arguments: "",
              };
              if (currentFunctionCall) {
                logger.info({ functionName: currentFunctionCall.name, callId: currentFunctionCall.call_id }, "[OpenAI Stream] Function call started");
              }
            }
            break;

          case "response.function_call_arguments.delta":
            if (currentFunctionCall && 'delta' in event) {
              functionArgumentsBuffer += event.delta;
            }
            break;

          case "response.function_call_arguments.done":
            if (currentFunctionCall) {
              currentFunctionCall.arguments = functionArgumentsBuffer;
              logger.info({ functionName: currentFunctionCall.name, arguments: functionArgumentsBuffer }, "[OpenAI Stream] Function call arguments complete");
              onFunctionCall(currentFunctionCall);
              currentFunctionCall = null;
              functionArgumentsBuffer = "";
            }
            break;

          case "response.output_text.delta":
            if ('delta' in event) {
              fullTextResponse += event.delta;
              onChunk(event.delta);
            }
            break;

          case "response.refusal.delta":
            if ('delta' in event) {
              logger.warn({ refusalChunk: event.delta }, "[OpenAI Stream] Received refusal delta");
              onChunk(`[Refusal]: ${event.delta}`);
            }
            break;

          case "response.completed":
            logger.info({ responseId, status: 'response' in event ? event.response?.status : 'unknown' }, "[OpenAI Stream] Stream completed");
            if ('response' in event) {
              if (event.response?.status === 'completed' || event.response?.status === 'incomplete') {
                onComplete(fullTextResponse || null, responseId);
              } else if (event.response?.status === 'failed') {
                // Handle failure without accessing missing properties
                logger.error({ responseId, details: 'Failed response' }, "[OpenAI Stream] Stream completed with failure status");
                onError(new Error(`OpenAI stream failed: Unknown reason`));
              }
            } else {
              onComplete(fullTextResponse || null, responseId);
            }
            break;

          case "error":
            logger.error({ error: 'Streaming error occurred' }, "[OpenAI Stream] Stream error event");
            onError(new Error("Unknown stream error"));
            break;
        }
      }
    } catch (error) {
      logger.error(
        error instanceof Error ? error : { message: String(error) },
        "[OpenAI Stream] Error processing OpenAI Responses API stream events"
      );
      if (error instanceof APIError) {
        onError(new Error(`OpenAI API Error: Status ${error.status}, Type: ${error.type}, Message: ${error.message}`));
      } else if (error instanceof Error) {
        onError(error);
      } else {
        onError(new Error("An unknown error occurred while processing the OpenAI stream."));
      }
    }
}