import { EventHandler } from "@create-figma-plugin/utilities";
import {
  MessageRole as ImportedMessageRole,
  ChatMessage as ImportedChatMessage,
  ChatHistory as ImportedChatHistory,
  ChatResponse as ImportedChatResponse,
  FunctionCall as ImportedFunctionCallBase,
  FunctionCallArguments as ImportedFunctionCallArguments,
} from "../../common/types";

// --- Re-export and extend shared types ---
export type MessageRole = ImportedMessageRole;
export type ChatMessage = ImportedChatMessage;
export type ChatHistory = ImportedChatHistory;
export type FunctionCallArguments = ImportedFunctionCallArguments;

export interface FunctionCall extends ImportedFunctionCallBase {
  call_id: string;
}

export interface ChatResponse extends ImportedChatResponse {
  function_call?: FunctionCall;
}

// --- Plugin internal communication and state types ---
export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "error"
  | "disconnected";

// Data structure for function calls received from backend
export interface FunctionCallData {
  call_id: string;
  name: string;
  arguments: string;
}

// UI -> Main: Request execution of a Figma function
export interface RequestFigmaFunctionHandler extends EventHandler {
  name: "REQUEST_FIGMA_FUNCTION";
  handler: (functionCallData: FunctionCallData) => void;
}

// Main -> UI: Send back the result (stringified JSON)
export interface FigmaFunctionResultHandler extends EventHandler {
  name: "FIGMA_FUNCTION_RESULT";
  handler: (result: { call_id: string; output: string }) => void;
}

// Main -> UI: Update loading state
export interface SetLoadingHandler extends EventHandler {
  name: "SET_LOADING";
  handler: (isLoading: boolean) => void;
}

// UI -> Main: Request plugin close
export interface CloseHandler extends EventHandler {
  name: "CLOSE";
  handler: () => void;
}

// Payload structure for results of Figma actions (used within main thread)
export interface ActionResultPayload {
  success: boolean;
  nodeId?: string;
  data?: any;
  error?: string;
}
