import { ChatMessage as CommonChatMessage, MessageRole } from "@common/types";
// Re-export common types if needed elsewhere in the backend
export * from "@common/types";

// Extend the common ChatMessage for backend's internal history storage
export interface BackendChatMessage extends CommonChatMessage {
  role: MessageRole;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

// Specific type for function call results to be added to history/API input
export type FunctionCallOutputMessage = {
  type: "function_call_output";
  call_id: string; // ID of the function call being responded to
  output: string; // The result of the function execution, as a string
};

// Union type for messages that can be stored in the session history
export type HistoryMessage = BackendChatMessage | FunctionCallOutputMessage;

// Union type for messages sent to the OpenAI API input array
// Uses the base CommonChatMessage structure or function output.
export type InputMessage = CommonChatMessage | FunctionCallOutputMessage;

// Define the structure for Tool definitions sent in the API *request*
// Matches the structure expected by OpenAI's API `tools` parameter.
export interface Tool {
  type: "function";
  name: string;
  description: string;
  strict: boolean;
  parameters: Record<string, unknown>;
}

// Type for structured logging entries
export interface LogEntry {
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  timestamp: string;
  message: string;
  [key: string]: any; // Allow additional context fields
}
