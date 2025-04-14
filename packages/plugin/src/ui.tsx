/** @jsx h */
import {
  Button, // 仍然使用 UI 库的按钮
  LoadingIndicator,
  MiddleAlign,
  render,
  Text,
  // Textbox, // 移除了 Textbox
  // VerticalSpace, // 不再需要
} from "@create-figma-plugin/ui";
import { emit, on } from "@create-figma-plugin/utilities";
import { h } from "preact";
import { useCallback, useState, useRef, useEffect } from "preact/hooks";

// 导入 CSS Modules
import styles from "./ChatStyles.module.css";

// 导入类型定义 (确保你的 types.ts 文件是正确的)
import {
  CloseHandler,
  ReceiveMessageHandler,
  SendMessageHandler,
  SetLoadingHandler,
  SetConnectionStatusHandler,
  ConnectionStatus,
} from "./types";

// 消息结构接口
interface Message {
  text: string;
  isUser: boolean;
}

// 消息气泡组件
function MessageBubble({
  message,
  isUser,
}: {
  message: string;
  isUser: boolean;
}) {
  const bubbleClass = `${styles.bubble} ${isUser ? styles.user : styles.ai}`;
  return (
    <div className={bubbleClass}>
      {message} {/* 移除Text组件，直接显示文本 */}
    </div>
  );
}

// 连接状态组件
function ConnectionStatusIndicator({ status }: { status: ConnectionStatus }) {
  // 状态样式和文本映射
  const statusConfig: Record<
    ConnectionStatus,
    { className: string; text: string }
  > = {
    connecting: { className: styles.statusConnecting, text: "正在连接..." },
    connected: { className: styles.statusConnected, text: "已连接" },
    error: { className: styles.statusError, text: "连接错误" },
    disconnected: { className: styles.statusDisconnected, text: "未连接" },
  };

  const config = statusConfig[status];

  return (
    <div className={`${styles.connectionStatus} ${config.className}`}>
      <span className={styles.statusDot}></span>
      <span className={styles.statusText}>{config.text}</span>
    </div>
  );
}

function Plugin() {
  // --- 状态管理 ---
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const messagesEndRef = useRef<HTMLDivElement | null>(null); // 用于滚动

  // --- 监听来自 main.ts 的事件 ---
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
  }, []); // 空依赖数组，仅在挂载和卸载时运行

  // --- 自动滚动到底部 ---
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]); // 依赖于 messages 数组

  // --- 事件处理函数 ---
  const handleSendMessage = useCallback(
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
    [inputValue, isLoading, connectionStatus] // 依赖项增加connectionStatus
  );

  // 处理 textarea 输入变化的 Handler
  const handleInput = useCallback(function (event: Event) {
    const target = event.target as HTMLTextAreaElement;
    setInputValue(target.value);
  }, []);

  // 处理 textarea 键盘事件的 Handler
  const handleKeyDown = useCallback(
    function (event: KeyboardEvent) {
      // Shift + Enter 换行, 单独 Enter 发送
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault(); // 阻止 Enter 默认换行
        handleSendMessage();
      }
    },
    [handleSendMessage] // 依赖 handleSendMessage
  );

  // 连接失败时的重试函数
  const handleRetryConnection = useCallback(function () {
    // 重新发送一个空消息以触发连接检查
    emit<SendMessageHandler>("SEND_MESSAGE", "");
  }, []);

  // (可选) 关闭插件按钮逻辑
  // const handleCloseButtonClick = useCallback(function () { emit<CloseHandler>('CLOSE'); }, []);

  // 是否显示输入区域 (连接错误时隐藏)
  const showInputArea = connectionStatus !== "error";

  // --- JSX 渲染 ---
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
              key={index}
              message={message.text}
              isUser={message.isUser}
            />
          ))
        )}
        {/* 加载指示器 */}
        {isLoading && (
          <div className={styles.loadingContainer}>
            <LoadingIndicator />
          </div>
        )}
        {/* 连接错误提示 */}
        {connectionStatus === "error" && messages.length === 0 && (
          <div className={styles.connectionError}>
            <Text className={styles.errorText}>
              无法连接到后端服务。请确保服务已启动并且正确配置了ngrok。
            </Text>
            <Button onClick={handleRetryConnection}>重试连接</Button>
          </div>
        )}
        {/* 用于自动滚动的空 div */}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 - 仅在连接正常时显示 */}
      {showInputArea && (
        <div className={styles.inputContainer}>
          <textarea
            className={styles.textarea} // 应用自定义样式
            placeholder="发送消息 (Shift + Enter 换行)"
            value={inputValue}
            onInput={handleInput} // 使用 onInput 处理变化
            onKeyDown={handleKeyDown} // 处理键盘事件
            disabled={isLoading || connectionStatus !== "connected"} // 加载或未连接时禁用
            rows={4} // 初始行数 (高度主要由 CSS 控制)
          />
          {/* 使用普通button元素替换Button组件 */}
          <button
            className={styles.sendButtonOverlay}
            onClick={handleSendMessage}
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

// 渲染插件 UI
export default render(Plugin);
