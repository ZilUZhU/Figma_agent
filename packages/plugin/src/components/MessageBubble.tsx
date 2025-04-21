/** @jsx h */
import { h } from "preact";
import styles from "../ChatStyles.module.css";

interface MessageBubbleProps {
  message: string;
  isUser: boolean;
  isComplete?: boolean;
  id?: string;
}

/**
 * Message bubble component
 */
export function MessageBubble({
  message,
  isUser,
  isComplete = true,
  id,
}: MessageBubbleProps) {
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
