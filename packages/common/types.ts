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

// 聊天响应接口
export interface ChatResponse {
  message: string;
  responseId?: string; // 添加可选的响应ID字段，用于跟踪对话
  sessionId?: string; // 添加会话ID字段，用于持续对话
}
