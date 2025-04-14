import { EventHandler } from "@create-figma-plugin/utilities";
import {
  MessageRole,
  ChatMessage,
  ChatHistory,
  ChatResponse,
} from "../../common/types";

// 重导出共享类型
export type { MessageRole, ChatMessage, ChatHistory, ChatResponse };

// 连接状态类型
export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "error"
  | "disconnected";

// UI发送消息到插件的处理器
export interface SendMessageHandler extends EventHandler {
  name: "SEND_MESSAGE";
  handler: (message: string) => void;
}

// 插件发送消息到UI的处理器
export interface ReceiveMessageHandler extends EventHandler {
  name: "RECEIVE_MESSAGE";
  handler: (message: string) => void;
}

// 设置加载状态的处理器
export interface SetLoadingHandler extends EventHandler {
  name: "SET_LOADING";
  handler: (isLoading: boolean) => void;
}

// 设置连接状态的处理器
export interface SetConnectionStatusHandler extends EventHandler {
  name: "SET_CONNECTION_STATUS";
  handler: (status: ConnectionStatus) => void;
}

// 关闭插件的处理器
export interface CloseHandler extends EventHandler {
  name: "CLOSE";
  handler: () => void;
}
