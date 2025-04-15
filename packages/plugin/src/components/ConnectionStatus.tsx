/** @jsx h */
import { h } from "preact";
import { ConnectionStatus } from "../types";
import styles from "../ChatStyles.module.css";

interface ConnectionStatusProps {
  status: ConnectionStatus;
}

/**
 * 连接状态组件
 */
export function ConnectionStatusIndicator({ status }: ConnectionStatusProps) {
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