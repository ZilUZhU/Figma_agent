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
import { apiService } from "./services/api";
import { processFunctionCallLoop } from "./handlers/functionCalls";

/**
 * 插件入口函数
 */
export default function () {
  let currentSessionId: string | null = null;
  console.log("[main.ts] Plugin starting...");

  showUI({
    width: 320,
    height: 480,
    // position: { x: 0, y: 0 }, // 可选：设置初始位置
  });
  console.log("[main.ts] UI shown.");

  // --- 消息处理 ---

  on<SendMessageHandler>("SEND_MESSAGE", async (message: string) => {
    console.log("[main.ts] Received SEND_MESSAGE from UI:", message ? `"${message}"` : "(Connection Test)");
    try {
      emit<SetLoadingHandler>("SET_LOADING", true);

      const isConnected = await checkConnection();
      if (!isConnected) {
        console.warn("[main.ts] Connection check failed in SEND_MESSAGE. Aborting.");
        return; // checkConnection 内部会处理 UI 反馈
      }

      if (message.trim() === "") {
        console.log("[main.ts] Empty message received. Skipping chat request.");
        // 即使是空消息，也可能需要更新一下连接状态显示
        emit<SetConnectionStatusHandler>("SET_CONNECTION_STATUS", "connected");
        return;
      }

      console.log(`[main.ts] Sending chat request for session: ${currentSessionId || 'New Session'}...`);
      const data = await apiService.sendChatRequest(message, currentSessionId || undefined);
      console.log("[main.ts] Received chat response from backend.");
      // console.log("[main.ts] Backend response data:", JSON.stringify(data, null, 2)); // Debug: Log full response

      currentSessionId = data.sessionId;
      console.log(`[main.ts] Updated currentSessionId: ${currentSessionId}`);

      if (data.function_call) {
        console.log("[main.ts] Function call detected in chat response. Starting agent loop.");
        // 使用从模块导入的 processFunctionCallLoop
        await processFunctionCallLoop(
          data.function_call, 
          data.sessionId, 
          (loading: boolean) => emit<SetLoadingHandler>("SET_LOADING", loading),
          (message: string) => emit<ReceiveMessageHandler>("RECEIVE_MESSAGE", message)
        );
      } else {
        console.log("[main.ts] No function call. Sending AI text response to UI.");
        emit<ReceiveMessageHandler>("RECEIVE_MESSAGE", data.message || "AI did not provide a text response.");
      }

    } catch (error) {
      console.error("[main.ts] Error in SEND_MESSAGE handler:", error);
      emit<ReceiveMessageHandler>(
        "RECEIVE_MESSAGE",
        `抱歉，处理您的消息时出错: ${error instanceof Error ? error.message : "未知错误"}`
      );
      // 尝试更新连接状态，因为错误可能与连接有关
      await checkConnection();
    } finally {
      emit<SetLoadingHandler>("SET_LOADING", false); // 确保加载状态被重置
    }
  });

  on<CloseHandler>("CLOSE", () => {
    console.log("[main.ts] Received CLOSE event from UI. Closing plugin.");
    figma.closePlugin();
  });

  // --- 初始化 ---
  console.log("[main.ts] Plugin initialized. Performing initial connection check.");
  checkConnection();
}

/**
 * 检查与后端的连接状态，并更新UI
 * @returns Promise<boolean> - 连接是否成功
 */
async function checkConnection(): Promise<boolean> {
  console.log("[main.ts] Checking backend connection...");
  emit<SetConnectionStatusHandler>("SET_CONNECTION_STATUS", "connecting");
  try {
    const health = await apiService.checkHealth();
    console.log("[main.ts] Backend connection check successful:", health);
    emit<SetConnectionStatusHandler>("SET_CONNECTION_STATUS", "connected");
    return true;
  } catch (error) {
    console.error("[main.ts] Backend connection check failed:", error);
    emit<SetConnectionStatusHandler>("SET_CONNECTION_STATUS", "error");
    emit<ReceiveMessageHandler>("RECEIVE_MESSAGE", "错误：无法连接到 AI 服务。请检查网络或稍后再试。");
    return false;
  }
}