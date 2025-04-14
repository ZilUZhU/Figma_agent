import { once, on, showUI, emit } from "@create-figma-plugin/utilities";
import {
  SendMessageHandler,
  CloseHandler,
  ChatHistory,
  SetLoadingHandler,
  ReceiveMessageHandler,
  SetConnectionStatusHandler,
} from "./types";
import { apiService } from "./services/api";

// 插件入口函数
export default function () {
  // 存储聊天历史
  const chatHistory: ChatHistory = [
    {
      role: "system",
      content: "你是一个帮助设计师的AI助手，你可以回答有关设计和Figma的问题。",
    },
  ];

  // 显示UI
  showUI({
    width: 320,
    height: 480,
    position: { x: 0, y: 0 },
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

  // 处理用户发送消息事件
  on<SendMessageHandler>("SEND_MESSAGE", async function (message: string) {
    try {
      // 设置加载状态
      emit<SetLoadingHandler>("SET_LOADING", true);

      // 将用户消息添加到历史
      chatHistory.push({
        role: "user",
        content: message,
      });

      // 尝试检查连接
      const isConnected = await checkConnection();
      if (!isConnected) {
        throw new Error("无法连接到后端服务");
      }

      // 调用API服务发送聊天请求
      const data = await apiService.sendChatRequest(chatHistory);
      const assistantMessage = data.message;

      // 将助手回复添加到历史
      chatHistory.push({
        role: "assistant",
        content: assistantMessage,
      });

      // 发送消息到UI
      emit<ReceiveMessageHandler>("RECEIVE_MESSAGE", assistantMessage);
    } catch (error) {
      // 显示友好的错误消息
      let errorMessage = "抱歉，发生了一个错误。请稍后再试。";

      if (error instanceof Error) {
        errorMessage = `错误: ${error.message}`;
      }

      emit<ReceiveMessageHandler>("RECEIVE_MESSAGE", errorMessage);
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

  // 启动时检查连接状态
  checkConnection();
}
