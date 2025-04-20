/**
 * Backend Type Definitions
 * Includes types shared with the frontend (from common) and backend-specific types.
 */

// Use proper path alias for imports from common package
import { ChatMessage as CommonChatMessage, MessageRole } from "@common/types"; // Import and alias
// Re-export common types if needed elsewhere in the backend
export * from "@common/types";

// Extend the common ChatMessage for backend's internal history storage
// This allows adding backend-specific context like tool_calls
export interface BackendChatMessage extends CommonChatMessage {
  // role and content are inherited from CommonChatMessage
  role: MessageRole; // Explicitly redefining helps clarity, but inherited
  content: string | null; // Inherited
  // Add backend-specific properties:
  tool_calls?: Array<{
    // Store tool calls made by the assistant for history context
    id: string; // This is the tool_call_id from OpenAI
    type: "function";
    function: {
      // Note: The *response* from OpenAI uses this nested structure for tool_calls
      name: string;
      arguments: string; // JSON string
    };
  }>;
  // timestamp?: string; // Example: if backend adds timestamps
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
// Note: OpenAI expects the basic message structure (role, content) or function output
// So we use the imported CommonChatMessage here, not the extended BackendChatMessage
export type InputMessage = CommonChatMessage | FunctionCallOutputMessage;

// Define the structure for Tool definitions sent in the API *request*
// Matches the structure expected by OpenAI's API `tools` parameter.
export interface Tool {
  type: "function";
  // Properties are direct children
  name: string;
  description: string;
  // *** THE FIX IS HERE: 'strict' is now required boolean ***
  strict: boolean; // Changed from strict?: boolean
  parameters: Record<string, unknown>; // JSON Schema object for parameters
}

// --- Add other backend-specific types below ---

// Type for structured logging entries
export interface LogEntry {
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  timestamp: string;
  message: string;
  [key: string]: any; // Allow additional context fields
}
