// src/types.ts

import { EventHandler } from "@create-figma-plugin/utilities";
// 假设你的共享类型在 ../../common/types
import {
  MessageRole as ImportedMessageRole,
  ChatMessage as ImportedChatMessage,
  ChatHistory as ImportedChatHistory,
  ChatResponse as ImportedChatResponse,
  FunctionCall as ImportedFunctionCallBase, // 重命名基础类型以避免冲突
  FunctionCallArguments as ImportedFunctionCallArguments,
} from "../../common/types"; // 确认这个路径是正确的

// --- 重新导出和扩展共享类型 ---

export type MessageRole = ImportedMessageRole;
export type ChatMessage = ImportedChatMessage;
export type ChatHistory = ImportedChatHistory;
export type FunctionCallArguments = ImportedFunctionCallArguments; // 可以直接重导出

// 扩展 FunctionCall 接口，添加 call_id
export interface FunctionCall extends ImportedFunctionCallBase {
  call_id: string; // 用于将函数调用请求与结果关联
}

// 扩展 ChatResponse 接口，使用我们带有 call_id 的 FunctionCall 类型
export interface ChatResponse extends ImportedChatResponse {
  function_call?: FunctionCall; // 使用扩展后的 FunctionCall
}

// --- 插件内部通信和状态类型 ---

// 连接状态类型
export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "error"
  | "disconnected";

// UI -> 插件: 请求执行 Figma 操作
export interface ExecuteFigmaActionMessage extends EventHandler {
  name: "EXECUTE_FIGMA_ACTION";
  handler: (message: {
    functionName: string;
    args: FunctionCallArguments;
    call_id: string; // 必须包含 call_id，以便结果可以正确关联
  }) => void;
}

// 插件 -> UI: 返回 Figma 操作的执行结果
export interface ActionResultPayload {
  success: boolean;
  nodeId?: string; // 创建/修改的节点ID
  data?: any;      // 成功时的附加信息或描述
  error?: string;  // 失败时的错误信息
}

export interface ActionResultMessage extends EventHandler {
  name: "ACTION_RESULT";
  handler: (message: {
    call_id: string; // 用于 UI 匹配请求和结果
    functionName: string;
    result: ActionResultPayload;
  }) => void;
}

// UI -> 插件: 用户发送聊天消息
export interface SendMessageHandler extends EventHandler {
  name: "SEND_MESSAGE";
  handler: (message: string) => void;
}

// 插件 -> UI: AI 或系统发送消息
export interface ReceiveMessageHandler extends EventHandler {
  name: "RECEIVE_MESSAGE";
  handler: (message: string) => void;
}

// 插件 -> UI: 更新加载状态
export interface SetLoadingHandler extends EventHandler {
  name: "SET_LOADING";
  handler: (isLoading: boolean) => void;
}

// 插件 -> UI: 更新连接状态
export interface SetConnectionStatusHandler extends EventHandler {
  name: "SET_CONNECTION_STATUS";
  handler: (status: ConnectionStatus) => void;
}

// UI -> 插件: 请求关闭插件
export interface CloseHandler extends EventHandler {
  name: "CLOSE";
  handler: () => void;
}

// --- 其他可能需要的辅助类型 ---

// (如果需要，可以在这里添加更多特定于插件逻辑的类型)