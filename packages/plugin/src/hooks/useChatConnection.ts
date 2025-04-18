import { useState, useEffect, useCallback, useRef } from "preact/hooks";
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
 * 处理消息发送、接收、流式显示和连接状态
 */
export function useChatConnection() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [inputValue, setInputValue] = useState("");
  
  // 存储当前生成中的消息和流状态
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingMessageRef = useRef("");
  
  // 监听来自插件主线程的事件
  useEffect(() => {
    // 处理完整消息接收
    const unbindReceive = on<ReceiveMessageHandler>(
      "RECEIVE_MESSAGE",
      function (message) {
        setMessages((prevMessages) => [
          ...prevMessages,
          { text: message, isUser: false },
        ]);
      }
    );
    
    // 处理加载状态变更
    const unbindLoading = on<SetLoadingHandler>(
      "SET_LOADING",
      function (loading) {
        setIsLoading(loading);
        // 结束加载状态时，也结束流状态
        if (!loading) {
          setIsStreaming(false);
        }
      }
    );
    
    // 处理连接状态变更
    const unbindConnectionStatus = on<SetConnectionStatusHandler>(
      "SET_CONNECTION_STATUS",
      function (status) {
        setConnectionStatus(status);
      }
    );
    
    // 监听流式文本块
    const unbindStreamChunk = on("STREAM_CHUNK", function (chunk: string) {
      if (!isStreaming) {
        // 首次接收块，创建新的AI消息
        setIsStreaming(true);
        streamingMessageRef.current = chunk;
        
        setMessages((prevMessages) => [
          ...prevMessages,
          { text: chunk, isUser: false },
        ]);
      } else {
        // 更新现有流消息
        streamingMessageRef.current += chunk;
        
        // 更新最后一条消息
        setMessages((prevMessages) => {
          const newMessages = [...prevMessages];
          newMessages[newMessages.length - 1] = {
            text: streamingMessageRef.current,
            isUser: false
          };
          return newMessages;
        });
      }
    });
    
    // 清理监听器
    return () => {
      unbindReceive();
      unbindLoading();
      unbindConnectionStatus();
      unbindStreamChunk();
    };
  }, [isStreaming]);

  // 发送消息
  const sendMessage = useCallback(
    function () {
      // 如果消息为空或正在加载，则不发送
      if (
        inputValue.trim() === "" ||
        isLoading ||
        connectionStatus !== "connected"
      ) {
        return;
      }

      // 添加用户消息到列表并清空输入框
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: inputValue, isUser: true },
      ]);
      
      // 设置状态为非流式（准备新的AI响应）
      setIsStreaming(false);
      streamingMessageRef.current = "";
      
      // 发送消息到主线程
      emit<SendMessageHandler>("SEND_MESSAGE", inputValue);
      setInputValue("");
    },
    [inputValue, isLoading, connectionStatus]
  );
  
  // 监听Enter键发送
  const handleKeyDown = useCallback(
    function (event: KeyboardEvent) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
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
    handleKeyDown,
    retryConnection,
    isStreaming,
  };
} 