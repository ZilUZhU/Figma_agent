/** @jsx h */
import { h } from "preact";
import { ConnectionStatus } from "../types";
import styles from "../ChatStyles.module.css";

interface ConnectionStatusProps {
  status: ConnectionStatus;
}

/**
 * Connection status component
 */
export function ConnectionStatusIndicator({ status }: ConnectionStatusProps) {
  const statusConfig: Record<
    ConnectionStatus,
    { className: string; text: string }
  > = {
    connecting: { className: styles.statusConnecting, text: "connecting..." },
    connected: { className: styles.statusConnected, text: "connected" },
    error: { className: styles.statusError, text: "error" },
    disconnected: {
      className: styles.statusDisconnected,
      text: "disconnected",
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`${styles.connectionStatus} ${config.className}`}>
      <span className={styles.statusDot}></span>
      <span className={styles.statusText}>{config.text}</span>
    </div>
  );
}
