export type MessageRole = "user" | "assistant" | "developer" | "system";

export interface ChatMessage {
  role: MessageRole;
  content: string | null;
}

export type ChatHistory = ChatMessage[];

export interface FunctionCallArguments {
  text: string;
  x: number | null;
  y: number | null;
  color: string | null;
  relativeToNodeId: string | null;
  positionRelation: "RIGHT" | "LEFT" | "ABOVE" | "BELOW" | "NEAR" | null;
  // test arguments
  nodeTypes: string | null;
  parentNodeId: string | null;
}

export interface FunctionCall {
  name: string;
  arguments: string | FunctionCallArguments;
  call_id?: string;
}

export interface FunctionCallOutput {
  type: "function_call_output";
  call_id: string;
  output: string; // Result as a string
}

export interface ChatResponse {
  message: string;
  responseId: string;
  sessionId: string;
  output_text?: string;
  function_call?: FunctionCall;
}

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";
