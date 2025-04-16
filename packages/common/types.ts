/**
 * 共享类型定义
 * 这个文件包含在后端和前端之间共享的类型定义
 */

// 消息角色类型，与OpenAI API一致
export type MessageRole = "system" | "user" | "assistant";

// 单个聊天消息的接口
export interface ChatMessage {
  role: MessageRole;
  content: string;
}

// 聊天历史的类型
export type ChatHistory = ChatMessage[];

// 函数调用参数接口
export interface FunctionCallArguments {
  text: string;
  x: number | null;
  y: number | null;
  color: string | null;
  relativeToNodeId: string | null;
  positionRelation: "RIGHT" | "LEFT" | "ABOVE" | "BELOW" | "NEAR" | null;
}

// 函数调用接口
export interface FunctionCall {
  name: string;
  arguments: FunctionCallArguments;
}

// 聊天响应接口
export interface ChatResponse {
  message: string;
  responseId: string; // 响应ID字段(用于跟踪对话)，改为必需
  sessionId: string; // 会话ID字段(用于持续对话)，改为必需
  output_text?: string; // OpenAI输出文本
  function_call?: FunctionCall; // 函数调用信息，如果AI决定调用函数
}
