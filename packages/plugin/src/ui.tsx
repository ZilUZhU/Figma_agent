/** @jsx h */
import {
  Button,
  LoadingIndicator,
  MiddleAlign,
  render,
  Text,
} from "@create-figma-plugin/ui";
import { emit } from "@create-figma-plugin/utilities";
import { h } from "preact";
import { useCallback, useRef, useEffect } from "preact/hooks";

// 导入组件和样式
import styles from "./ChatStyles.module.css";
import { MessageBubble } from "./components/MessageBubble";
import { ConnectionStatusIndicator } from "./components/ConnectionStatus";
import { useChatConnection } from "./hooks/useChatConnection";
import { CloseHandler } from "./types";

function Plugin() {
  // 使用自定义hook管理聊天状态和连接
  const {
    messages,
    isLoading,
    connectionStatus,
    inputValue,
    sendMessage,
    handleInputChange,
    retryConnection,
    currentStreamId,
  } = useChatConnection();

  // 创建引用用于滚动
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // 处理 textarea 输入变化
  const handleInput = useCallback(
    function (event: Event) {
      const target = event.target as HTMLTextAreaElement;
      handleInputChange(target.value);
    },
    [handleInputChange]
  );

  // 处理 textarea 键盘事件
  const handleKeyDown = useCallback(
    function (event: KeyboardEvent) {
      // Shift + Enter 换行, 单独 Enter 发送
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault(); // 阻止 Enter 默认换行

        // 使用与发送按钮相同的条件逻辑
        const canSend =
          inputValue.trim() !== "" &&
          !isLoading &&
          connectionStatus === "connected";

        if (canSend) {
          sendMessage();
        }
      }
    },
    [sendMessage, inputValue, isLoading, connectionStatus]
  );

  // 是否显示输入区域 (连接错误时隐藏)
  const showInputArea = connectionStatus !== "error";

  return (
    <div className={styles.pluginWrapper}>
      {/* 状态指示器 */}
      <ConnectionStatusIndicator status={connectionStatus} />

      {/* 聊天历史区域 */}
      <div className={styles.chatHistory}>
        {messages.length === 0 && !isLoading ? (
          <MiddleAlign>
            <Text className={styles.initialPrompt}>
              发送消息开始与AI助手对话
            </Text>
          </MiddleAlign>
        ) : (
          messages.map((message, index) => (
            <MessageBubble
              key={message.id || index}
              message={message.text}
              isUser={message.isUser}
              isComplete={message.isComplete !== false}
              id={message.id}
            />
          ))
        )}
        {/* 加载指示器 */}
        {isLoading && !currentStreamId.current && (
          <div className={styles.loadingContainer}>
            <LoadingIndicator />
          </div>
        )}
        {/* 连接错误提示 */}
        {connectionStatus === "error" && messages.length === 0 && (
          <div className={styles.connectionError}>
            <Text className={styles.errorText}>
              无法连接到后端服务。请确保服务已启动并且正确配置。
            </Text>
            <Button onClick={retryConnection}>重试连接</Button>
          </div>
        )}
        {/* 用于自动滚动的空 div */}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 - 仅在连接正常时显示 */}
      {showInputArea && (
        <div className={styles.inputContainer}>
          <textarea
            className={styles.textarea}
            placeholder="发送消息 (Shift + Enter 换行)"
            value={inputValue}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            disabled={connectionStatus !== "connected"}
            rows={4}
          />
          {/* 使用普通button元素替换Button组件 */}
          <button
            className={styles.sendButtonOverlay}
            onClick={sendMessage}
            disabled={
              inputValue.trim() === "" ||
              isLoading ||
              connectionStatus !== "connected"
            }
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}

export default render(Plugin);
