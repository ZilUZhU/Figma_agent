/** @jsx h */
import { h } from "preact";
import styles from "../ChatStyles.module.css";

interface MessageBubbleProps {
  message: string;
  isUser: boolean;
  isComplete?: boolean; // 是否是完整的消息
  id?: string; // 消息ID
}

/**
 * 消息气泡组件
 */
export function MessageBubble({
  message,
  isUser,
  isComplete = true,
  id,
}: MessageBubbleProps) {
  // 为正在流式传输的消息添加不同的样式
  const bubbleClass = `${styles.bubble} ${isUser ? styles.user : styles.ai} ${
    !isComplete ? styles.streaming : ""
  }`;

  return (
    <div className={bubbleClass} data-id={id}>
      {message}
      {!isComplete && <span className={styles.typingIndicator}>•••</span>}
    </div>
  );
}
