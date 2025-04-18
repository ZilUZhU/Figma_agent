/**
 * 共享类型定义
 * 这个文件包含在后端和前端之间共享的类型定义
 */


// Define the possible roles in a conversation
export type MessageRole = "user" | "assistant" | "developer" | "system"; // Add other roles if needed

// Base structure for a chat message used in history and communication
export interface ChatMessage {
  role: MessageRole;
  content: string | null; // Content can be text or null (e.g., for assistant messages with only tool calls)
  // Optional: Add timestamp or other common metadata if needed across packages
  // timestamp?: string;
}


// // 单个聊天消息的接口
// export interface ChatMessage {
//   role: MessageRole;
//   content: string;
//   function_call?: {
//     name: string;
//     arguments: string;
//   };
//   // 其他可能的字段
//   type?: string;
//   name?: string;
//   output?: string;
// }

// 聊天历史的类型
export type ChatHistory = ChatMessage[];

// 函数调用参数接口（旧版定义，为了兼容性保留）
export interface FunctionCallArguments {
  text: string;
  x: number | null;
  y: number | null;
  color: string | null;
  relativeToNodeId: string | null;
  positionRelation: "RIGHT" | "LEFT" | "ABOVE" | "BELOW" | "NEAR" | null;
}

// 函数调用接口（扩展版）
export interface FunctionCall {
  name: string;
  arguments: string | FunctionCallArguments;
  call_id?: string;
}

// 函数调用结果
export interface FunctionCallOutput {
  type: "function_call_output";
  call_id: string;
  output: string;
}

// 聊天响应接口
export interface ChatResponse {
  message: string;
  responseId: string; // 响应ID字段(用于跟踪对话)，改为必需
  sessionId: string; // 会话ID字段(用于持续对话)，改为必需
  output_text?: string; // OpenAI输出文本
  function_call?: FunctionCall; // 函数调用信息，如果AI决定调用函数
}

// WebSocket相关类型
export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";
