// packages/plugin/src/hooks/useChatConnection.ts

import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { on, emit } from "@create-figma-plugin/utilities";
import {
  ConnectionStatus,
  FunctionCallData, // Type for function call data
  RequestFigmaFunctionHandler, // Emit this to main thread
  FigmaFunctionResultHandler, // Listen for this from main thread
  SetLoadingHandler, // Listen for this from main thread
} from "../types";
import { WebSocketService } from "../services/websocket"; // Import WS Service

// Message structure for UI display
export interface Message {
  text: string;
  isUser: boolean;
  id?: string; // 添加唯一ID用于标识消息
  isComplete?: boolean; // 标记流式响应是否已完成
}

export function useChatConnection() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [inputValue, setInputValue] = useState("");

  // 使用ref来跟踪当前正在处理的流式响应消息
  const currentStreamId = useRef<string | null>(null);
  const wsServiceRef = useRef<WebSocketService | null>(null);

  // --- WebSocket Connection and Callbacks ---
  useEffect(() => {
    console.log("[useChatConnection] Initializing WebSocketService...");

    // Define callbacks for WebSocketService
    const wsCallbacks = {
      onStatusChange: (status: ConnectionStatus) => {
        console.log(`[useChatConnection] WS Status Changed: ${status}`);
        setConnectionStatus(status);
        if (status === "error" || status === "disconnected") {
          setIsLoading(false); // Stop loading on disconnect/error
        }
      },
      onChunk: (chunk: string) => {
        // 处理流式文本块 - 减少日志输出
        // 只在首次创建新消息时输出日志，避免为每个分片输出日志
        if (!currentStreamId.current) {
          // 这是一个新的响应流的开始，创建一个新的消息ID
          const streamId = `stream-${Date.now()}`;
          currentStreamId.current = streamId;

          console.log("[useChatConnection] 开始接收流式响应");

          // 添加新的助手消息
          setMessages((prev) => [
            ...prev,
            {
              text: chunk,
              isUser: false,
              id: streamId,
              isComplete: false,
            },
          ]);
        } else {
          // 更新现有的流式消息 - 不输出日志
          setMessages((prev) => {
            return prev.map((msg) => {
              if (msg.id === currentStreamId.current) {
                // 找到当前流消息并附加新块
                return {
                  ...msg,
                  text: msg.text + chunk,
                };
              }
              return msg;
            });
          });
        }
      },
      onFunctionCall: (functionCall: FunctionCallData) => {
        // Received function call from backend -> Send to Main Thread
        console.log(
          `[useChatConnection] 接收到函数调用请求: ${functionCall.name}`
        );
        emit<RequestFigmaFunctionHandler>(
          "REQUEST_FIGMA_FUNCTION",
          functionCall
        );
        // 重置当前流ID，因为函数调用中断了文本流
        currentStreamId.current = null;
      },
      onStreamEnd: (responseId: string) => {
        // 流式响应已结束，标记消息为完成状态
        console.log(
          `[useChatConnection] 流式响应已完成, responseId: ${responseId}`
        );

        if (currentStreamId.current) {
          setMessages((prev) => {
            return prev.map((msg) => {
              if (msg.id === currentStreamId.current) {
                // 标记当前流消息为完成
                return {
                  ...msg,
                  isComplete: true,
                };
              }
              return msg;
            });
          });

          // 重置当前流ID和加载状态
          currentStreamId.current = null;
          setIsLoading(false);
        }
      },
      onMessage: (message: string) => {
        // Handle non-streaming, complete messages (e.g., errors from WS service itself)
        console.log(
          `[useChatConnection] Received non-streaming message: ${message}`
        );
        setMessages((prev) => [
          ...prev,
          {
            text: message,
            isUser: false,
            id: `msg-${Date.now()}`,
            isComplete: true,
          },
        ]);
        setIsLoading(false);
        currentStreamId.current = null;
      },
    };

    // Create and connect WebSocketService instance
    wsServiceRef.current = new WebSocketService(wsCallbacks);
    wsServiceRef.current.connect();

    // --- Listeners for events FROM Main Thread ---
    const unbindLoading = on<SetLoadingHandler>("SET_LOADING", (loading) => {
      console.log(
        `[useChatConnection] Received SET_LOADING from main: ${loading}`
      );
      setIsLoading(loading);
    });

    const unbindFigmaResult = on<FigmaFunctionResultHandler>(
      "FIGMA_FUNCTION_RESULT",
      (result) => {
        console.log(`[useChatConnection] 收到函数执行结果: ${result.call_id}`);
        if (wsServiceRef.current) {
          // Send the result back to the backend via WebSocket
          wsServiceRef.current.sendFunctionResult({
            call_id: result.call_id,
            output: result.output, // output is already stringified by main.ts
          });
        } else {
          console.error(
            "[useChatConnection] WebSocket服务不可用，无法发送函数结果"
          );
        }
      }
    );

    // Cleanup function: Disconnect WebSocket and remove listeners on component unmount
    return () => {
      console.log(
        "[useChatConnection] Cleaning up WebSocket connection and listeners."
      );
      wsServiceRef.current?.disconnect();
      unbindLoading();
      unbindFigmaResult();
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- UI Actions ---

  const sendMessage = useCallback(() => {
    if (
      inputValue.trim() === "" ||
      isLoading ||
      connectionStatus !== "connected"
    ) {
      console.warn("[useChatConnection] 消息发送被阻止:", {
        inputValueEmpty: inputValue.trim() === "",
        isLoading,
        connectionStatus,
      });
      return;
    }

    const userMessage = inputValue;
    setMessages((prev) => [
      ...prev,
      {
        text: userMessage,
        isUser: true,
        id: `user-${Date.now()}`,
        isComplete: true,
      },
    ]);
    setInputValue(""); // Clear input immediately

    // 重置当前流ID以准备新的响应
    currentStreamId.current = null;

    // Send message via WebSocket service
    if (wsServiceRef.current) {
      setIsLoading(true); // Set loading true when sending user message
      console.log("[useChatConnection] 发送用户消息");
      wsServiceRef.current.sendMessage(userMessage);
    } else {
      console.error("[useChatConnection] WebSocket服务不可用，无法发送消息");
      // Optionally show an error message to the user
      setMessages((prev) => [
        ...prev,
        {
          text: "错误: 无法发送消息，连接已断开。",
          isUser: false,
          id: `error-${Date.now()}`,
          isComplete: true,
        },
      ]);
      setConnectionStatus("error");
    }
  }, [inputValue, isLoading, connectionStatus]);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const retryConnection = useCallback(() => {
    console.log("[useChatConnection] Retry connection requested.");
    if (
      wsServiceRef.current &&
      connectionStatus !== "connected" &&
      connectionStatus !== "connecting"
    ) {
      wsServiceRef.current.connect(); // Attempt to reconnect
    }
  }, [connectionStatus]);

  return {
    messages,
    isLoading,
    connectionStatus,
    inputValue,
    sendMessage,
    handleInputChange,
    retryConnection,
    currentStreamId,
  };
}
