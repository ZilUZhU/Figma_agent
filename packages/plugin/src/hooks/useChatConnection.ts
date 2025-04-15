import { useState, useEffect, useCallback } from "preact/hooks";
import { on, emit } from "@create-figma-plugin/utilities";
import {
  SendMessageHandler,
  ReceiveMessageHandler,
  SetLoadingHandler,
  SetConnectionStatusHandler,
  ConnectionStatus,
} from "../types";

// 消息结构接口
export interface Message {
  text: string;
  isUser: boolean;
}

/**
 * 聊天连接Hook
 * 处理消息发送、接收和连接状态
 */
export function useChatConnection() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [inputValue, setInputValue] = useState("");

  // 监听来自插件主线程的事件
  useEffect(() => {
    const unbindReceive = on<ReceiveMessageHandler>(
      "RECEIVE_MESSAGE",
      function (message) {
        setMessages((prevMessages) => [
          ...prevMessages,
          { text: message, isUser: false },
        ]);
      }
    );
    
    const unbindLoading = on<SetLoadingHandler>(
      "SET_LOADING",
      function (loading) {
        setIsLoading(loading);
      }
    );
    
    const unbindConnectionStatus = on<SetConnectionStatusHandler>(
      "SET_CONNECTION_STATUS",
      function (status) {
        setConnectionStatus(status);
      }
    );
    
    // 清理监听器
    return () => {
      unbindReceive();
      unbindLoading();
      unbindConnectionStatus();
    };
  }, []);

  // 发送消息
  const sendMessage = useCallback(
    function () {
      // 如果消息为空或正在加载，则不发送
      if (
        inputValue.trim() === "" ||
        isLoading ||
        connectionStatus !== "connected"
      )
        return;

      // 添加用户消息到列表并清空输入框
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: inputValue, isUser: true },
      ]);
      
      emit<SendMessageHandler>("SEND_MESSAGE", inputValue);
      setInputValue("");
    },
    [inputValue, isLoading, connectionStatus]
  );

  // 处理输入变化
  const handleInputChange = useCallback(function (value: string) {
    setInputValue(value);
  }, []);

  // 重试连接
  const retryConnection = useCallback(function () {
    emit<SendMessageHandler>("SEND_MESSAGE", "");
  }, []);

  return {
    messages,
    isLoading,
    connectionStatus,
    inputValue,
    sendMessage,
    handleInputChange,
    retryConnection
  };
} 