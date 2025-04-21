import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { on, emit } from "@create-figma-plugin/utilities";
import {
  ConnectionStatus,
  FunctionCallData,
  RequestFigmaFunctionHandler,
  FigmaFunctionResultHandler,
  SetLoadingHandler,
} from "../types";
import { WebSocketService } from "../services/websocket";

// Message structure for UI display
export interface Message {
  text: string;
  isUser: boolean;
  id?: string;
  isComplete?: boolean;
}

export function useChatConnection() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [inputValue, setInputValue] = useState("");

  const currentStreamId = useRef<string | null>(null);
  const wsServiceRef = useRef<WebSocketService | null>(null);

  // --- WebSocket Connection and Callbacks ---
  useEffect(() => {
    console.log("[useChatConnection] Initializing WebSocketService...");

    const wsCallbacks = {
      onStatusChange: (status: ConnectionStatus) => {
        console.log(`[useChatConnection] WS Status Changed: ${status}`);
        setConnectionStatus(status);
        if (status === "error" || status === "disconnected") {
          setIsLoading(false); // Stop loading indicator
          currentStreamId.current = null; // Reset stream tracking
        }
      },
      onChunk: (chunk: string) => {
        // Append chunk to the current streaming message or start a new one
        setMessages((prev) => {
          if (currentStreamId.current) {
            // Find and update existing streaming message
            return prev.map((msg) =>
              msg.id === currentStreamId.current
                ? { ...msg, text: msg.text + chunk }
                : msg
            );
          } else {
            // Start new streaming message
            const streamId = `stream-${Date.now()}`;
            currentStreamId.current = streamId;
            console.log(
              "[useChatConnection] Started receiving new stream:",
              streamId
            );
            return [
              ...prev,
              { text: chunk, isUser: false, id: streamId, isComplete: false },
            ];
          }
        });
      },
      onFunctionCall: (functionCall: FunctionCallData) => {
        // Backend requested a Figma function -> Send to Main Thread
        console.log(
          `[useChatConnection] Received function call request: ${functionCall.name} (Call ID: ${functionCall.call_id})`
        );
        // Stop any active text streaming UI updates
        if (currentStreamId.current) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === currentStreamId.current
                ? { ...msg, isComplete: true }
                : msg
            )
          ); // Mark current stream as 'complete' visually
          currentStreamId.current = null;
        }
        // setIsLoading(true); // Indicate work is happening in Figma
        emit<RequestFigmaFunctionHandler>(
          "REQUEST_FIGMA_FUNCTION",
          functionCall
        );
      },
      onStreamEnd: (responseId: string) => {
        // Stream finished -> Mark message as complete
        console.log(
          `[useChatConnection] Stream ended. Response ID: ${responseId}`
        );
        if (currentStreamId.current) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === currentStreamId.current
                ? { ...msg, isComplete: true }
                : msg
            )
          );
          currentStreamId.current = null; // Reset stream tracking
        }
        setIsLoading(false); // Stop loading indicator
      },
      onMessage: (message: string) => {
        // Handle general messages/errors from WebSocketService itself
        console.log(`[useChatConnection] Received general message: ${message}`);
        setMessages((prev) => [
          ...prev,
          {
            text: message,
            isUser: false,
            id: `msg-${Date.now()}`,
            isComplete: true,
          },
        ]);
        setIsLoading(false); // Ensure loading stops
        currentStreamId.current = null; // Reset stream tracking
      },
    };

    // Create and connect WebSocketService
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
        // Received result from Main Thread -> Send back to Backend via WS
        console.log(
          `[useChatConnection] Received Figma function result for Call ID: ${result.call_id}`
        );
        if (wsServiceRef.current) {
          wsServiceRef.current.sendFunctionResult({
            call_id: result.call_id,
            output: result.output,
          });
        } else {
          console.error(
            "[useChatConnection] WebSocket service unavailable, cannot send function result."
          );
          // Show error to user
          setMessages((prev) => [
            ...prev,
            {
              text: "Error: Failed to send function result back to server.",
              isUser: false,
              id: `error-${Date.now()}`,
              isComplete: true,
            },
          ]);
          setConnectionStatus("error");
        }
      }
    );

    // Cleanup on unmount
    return () => {
      console.log(
        "[useChatConnection] Cleaning up WebSocket connection and listeners."
      );
      wsServiceRef.current?.disconnect();
      unbindLoading();
      unbindFigmaResult();
    };
  }, []);

  // --- UI Actions ---

  const sendMessageCallback = useCallback(() => {
    if (
      inputValue.trim() === "" ||
      isLoading ||
      connectionStatus !== "connected"
    ) {
      console.warn("[useChatConnection] Send message prevented:", {
        inputValueEmpty: inputValue.trim() === "",
        isLoading,
        connectionStatus,
      });
      return;
    }

    const userMessageText = inputValue;
    setMessages((prev) => [
      ...prev,
      {
        text: userMessageText,
        isUser: true,
        id: `user-${Date.now()}`,
        isComplete: true,
      },
    ]);
    setInputValue(""); // Clear input

    // Reset stream tracking and set loading for backend response
    currentStreamId.current = null;
    setIsLoading(true);

    if (wsServiceRef.current) {
      console.log("[useChatConnection] Sending user message via WebSocket.");
      wsServiceRef.current.sendMessage(userMessageText);
    } else {
      console.error(
        "[useChatConnection] WebSocket service unavailable, cannot send message."
      );
      setMessages((prev) => [
        ...prev,
        {
          text: "Error: Cannot send message, connection lost.",
          isUser: false,
          id: `error-${Date.now()}`,
          isComplete: true,
        },
      ]);
      setConnectionStatus("error");
      setIsLoading(false);
    }
  }, [inputValue, isLoading, connectionStatus]);

  const handleInputChangeCallback = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const retryConnectionCallback = useCallback(() => {
    console.log("[useChatConnection] Retry connection requested.");
    if (
      wsServiceRef.current &&
      connectionStatus !== "connected" &&
      connectionStatus !== "connecting"
    ) {
      wsServiceRef.current.connect();
    }
  }, [connectionStatus]);

  return {
    messages,
    isLoading,
    connectionStatus,
    inputValue,
    sendMessage: sendMessageCallback,
    handleInputChange: handleInputChangeCallback,
    retryConnection: retryConnectionCallback,
    currentStreamId: currentStreamId.current,
  };
}
