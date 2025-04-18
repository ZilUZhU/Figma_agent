// src/main.ts

import { on, showUI, emit } from "@create-figma-plugin/utilities";
import {
  // 确保从你的 types.ts 导入所有需要的类型
  SendMessageHandler,
  CloseHandler,
  SetLoadingHandler,
  ReceiveMessageHandler,
  SetConnectionStatusHandler,
  ConnectionStatus,
} from "./types";
import { handleFunctionCall } from "./handlers/functionCalls";
import { WebSocketService } from "./services/websocket";

/**
 * 插件入口函数
 */
export default function () {
  console.log("[main.ts] 插件启动中...");

  showUI({
    width: 320,
    height: 480,
  });
  console.log("[main.ts] UI已显示");

  // 创建WebSocket服务
  const wsService = new WebSocketService({
    // 收到消息时发送到UI
    onMessage: (message: string) => {
      console.log("[main.ts] 收到完整消息");
      emit<ReceiveMessageHandler>("RECEIVE_MESSAGE", message);
    },
    
    // 连接状态变更时通知UI
    onStatusChange: (status: ConnectionStatus) => {
      console.log(`[main.ts] WebSocket连接状态: ${status}`);
      emit<SetConnectionStatusHandler>("SET_CONNECTION_STATUS", status);
    },
    
    // 收到流式文本块时发送到UI
    onChunk: (chunk: string) => {
      console.log("[main.ts] 收到流式文本块");
      emit("STREAM_CHUNK", chunk);
    },
    
    // 收到函数调用时执行
    onFunctionCall: async (functionCall: any) => {
      console.log(`[main.ts] 收到函数调用: ${functionCall.name}`);
      
      // 开始加载状态
      emit<SetLoadingHandler>("SET_LOADING", true);
      
      try {
        // 执行函数调用
        console.log(`[main.ts] 执行函数: ${functionCall.name}`);
        const result = await handleFunctionCall(functionCall);
        
        // 将结果发送回服务器
        wsService.sendFunctionResult({
          call_id: functionCall.call_id,
          output: result
        });
      } catch (error) {
        console.error("[main.ts] 函数调用错误:", error);
        
        // 通知用户错误
        emit<ReceiveMessageHandler>(
          "RECEIVE_MESSAGE",
          `函数执行错误: ${error instanceof Error ? error.message : String(error)}`
        );
        
        // 结束加载状态
        emit<SetLoadingHandler>("SET_LOADING", false);
      }
    }
  });

  // 立即连接
  wsService.connect();

  // --- 消息处理 ---

  // 处理用户发送消息
  on<SendMessageHandler>("SEND_MESSAGE", async (message: string) => {
    console.log(`[main.ts] 收到用户消息: ${message || "(空消息/连接测试)"}`);
    
    try {
      // 如果是空消息，仅检查连接
      if (message.trim() === "") {
        console.log("[main.ts] 空消息，仅检查连接");
        return;
      }
      
      // 设置加载状态
      emit<SetLoadingHandler>("SET_LOADING", true);
      
      // 发送消息到WebSocket服务器
      wsService.sendMessage(message);
      
    } catch (error) {
      console.error("[main.ts] 发送消息错误:", error);
      
      // 通知用户错误
      emit<ReceiveMessageHandler>(
        "RECEIVE_MESSAGE",
        `错误: ${error instanceof Error ? error.message : "未知错误"}`
      );
      
      // 重置加载状态
      emit<SetLoadingHandler>("SET_LOADING", false);
    }
  });

  // 处理关闭事件
  on<CloseHandler>("CLOSE", function () {
    console.log("[main.ts] 插件关闭");
    wsService.disconnect();
    figma.closePlugin();
  });
}