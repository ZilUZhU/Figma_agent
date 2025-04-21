/** @jsx h */
import {
  Button,
  LoadingIndicator,
  MiddleAlign,
  render,
  Text,
} from "@create-figma-plugin/ui";
import { h } from "preact";
import { useCallback, useRef, useEffect } from "preact/hooks";

import styles from "./ChatStyles.module.css";
import { MessageBubble } from "./components/MessageBubble";
import { ConnectionStatusIndicator } from "./components/ConnectionStatus";
import { useChatConnection } from "./hooks/useChatConnection";

function Plugin() {
  const {
    messages,
    isLoading,
    connectionStatus,
    inputValue,
    sendMessage,
    handleInputChange,
    retryConnection,
  } = useChatConnection();

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInput = useCallback(
    (event: Event) => {
      const target = event.target as HTMLTextAreaElement;
      handleInputChange(target.value);
    },
    [handleInputChange]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (
          inputValue.trim() !== "" &&
          !isLoading &&
          connectionStatus === "connected"
        ) {
          sendMessage();
        }
      }
    },
    [sendMessage, inputValue, isLoading, connectionStatus]
  );

  const showInputArea = connectionStatus !== "error";
  const isSendDisabled =
    inputValue.trim() === "" || isLoading || connectionStatus !== "connected";

  return (
    <div className={styles.pluginWrapper}>
      <ConnectionStatusIndicator status={connectionStatus} />

      <div className={styles.chatHistory}>
        {/* Initial Prompt */}
        {messages.length === 0 &&
          !isLoading &&
          connectionStatus !== "error" && (
            <MiddleAlign>
              <Text className={styles.initialPrompt}>
                Send a message to start chatting.
              </Text>
            </MiddleAlign>
          )}
        {/* Messages */}
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id || `msg-${index}`}
            message={message.text}
            isUser={message.isUser}
            isComplete={message.isComplete !== false}
            id={message.id}
          />
        ))}
        {/* Loading Indicator */}
        {isLoading && (
          <div className={styles.loadingContainer}>
            <LoadingIndicator />
          </div>
        )}
        {/* Connection Error Display */}
        {connectionStatus === "error" && (
          <div className={styles.connectionError}>
            <Text className={styles.errorText}>
              Connection failed. Please ensure the backend service is running
              and try again.
            </Text>
            {/* FIX: Removed the redundant disabled check here */}
            <Button onClick={retryConnection}>Retry Connection</Button>
          </div>
        )}
        <div ref={messagesEndRef} /> {/* Scroll target */}
      </div>

      {/* Input Area */}
      {showInputArea && (
        <div className={styles.inputContainer}>
          <textarea
            className={styles.textarea}
            placeholder={
              connectionStatus === "connected"
                ? "Send a message (Shift+Enter for newline)"
                : "Connecting..."
            }
            value={inputValue}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            disabled={connectionStatus !== "connected"}
            rows={4}
          />
          <button
            className={styles.sendButtonOverlay}
            onClick={sendMessage}
            disabled={isSendDisabled}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}

export default render(Plugin);
