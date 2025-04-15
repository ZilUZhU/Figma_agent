import { once, on, showUI, emit } from "@create-figma-plugin/utilities";
import {
  SendMessageHandler,
  CloseHandler,
  SetLoadingHandler,
  ReceiveMessageHandler,
  SetConnectionStatusHandler,
} from "./types";
import { apiService } from "./services/api";

/**
 * 插件入口函数
 */
export default function () {
  // 本地存储会话ID
  let currentSessionId: string | null = null;
  
  // 显示UI
  showUI({
    width: 320,
    height: 480,
    position: { x: 0, y: 0 },
  });

  // 处理用户发送消息事件
  on<SendMessageHandler>("SEND_MESSAGE", async function (message: string) {
    try {
      // 设置加载状态
      emit<SetLoadingHandler>("SET_LOADING", true);
      
      // 检查连接状态
      const isConnected = await checkConnection();
      if (!isConnected) {
        throw new Error("无法连接到后端服务");
      }

      // 如果是空消息（连接测试），则不发送请求，仅检查连接
      if (message.trim() === "") {
        return;
      }

      // 发送聊天请求 (只发送新消息和当前会话ID)
      const data = await apiService.sendChatRequest(message, currentSessionId || undefined);
      const assistantMessage = data.message;
      
      // 更新本地会话ID (后端会返回，确保同步)
      currentSessionId = data.sessionId;

      // 发送助手消息到UI
      emit<ReceiveMessageHandler>("RECEIVE_MESSAGE", assistantMessage);

    } catch (error) {
      // 如果遇到会话不存在或已过期的错误，清除本地会话ID
      if (error instanceof Error && 
          (error.message.includes("会话不存在") || 
           error.message.includes("会话已过期"))) {
        console.log("重置会话ID：会话不存在或已过期");
        currentSessionId = null;
      }
      
      // 显示友好的错误消息
      let errorMessage = "抱歉，发生了一个错误。请稍后再试。";

      if (error instanceof Error) {
        errorMessage = `错误: ${error.message}`;
      }
      
      // 只有在尝试发送实际消息时才在UI显示错误
      if (message.trim() !== "") {
        emit<ReceiveMessageHandler>("RECEIVE_MESSAGE", errorMessage);
      }
      emit<SetConnectionStatusHandler>("SET_CONNECTION_STATUS", "error");
      
    } finally {
      // 取消加载状态
      emit<SetLoadingHandler>("SET_LOADING", false);
    }
  });

  // 处理关闭插件事件
  once<CloseHandler>("CLOSE", function () {
    figma.closePlugin();
  });

  // 检查与后端的连接状态
  async function checkConnection() {
    try {
      emit<SetConnectionStatusHandler>("SET_CONNECTION_STATUS", "connecting");
      const health = await apiService.checkHealth();

      if (health.status === "ok") {
        emit<SetConnectionStatusHandler>("SET_CONNECTION_STATUS", "connected");
        return true;
      } else {
        emit<SetConnectionStatusHandler>("SET_CONNECTION_STATUS", "error");
        return false;
      }
    } catch (error) {
      emit<SetConnectionStatusHandler>("SET_CONNECTION_STATUS", "error");
      return false;
    }
  }

  // 启动时检查连接状态
  checkConnection();
}
