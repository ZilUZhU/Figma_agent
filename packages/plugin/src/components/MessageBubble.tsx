/** @jsx h */
import { h } from "preact";
import styles from "../ChatStyles.module.css";

interface MessageBubbleProps {
  message: string;
  isUser: boolean;
}

/**
 * 消息气泡组件
 */
export function MessageBubble({ message, isUser }: MessageBubbleProps) {
  const bubbleClass = `${styles.bubble} ${isUser ? styles.user : styles.ai}`;
  return (
    <div className={bubbleClass}>
      {message}
    </div>
  );
} 