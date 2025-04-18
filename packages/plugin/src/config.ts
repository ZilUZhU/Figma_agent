/**
 * 插件配置文件
 * 用于管理配置项，提高代码可维护性
 */

// Define environment type - Note: This is illustrative for config structure,
// but we cannot reliably determine the runtime environment inside Figma easily.
export type Environment = "development" | "production";

// --- Configuration ---
// For development, hardcode the local backend URLs.
// For production builds, you would typically:
// 1. Manually change these URLs before running `npm run build`.
// OR
// 2. Configure your build process (e.g., using environment variables during build)
//    to replace these placeholders with production URLs. See build tool documentation.

const IS_PRODUCTION_BUILD = false; // Set this manually or via build process for production

const DEV_API_URL = "http://localhost:3000";
const DEV_WS_URL = "ws://localhost:3000";

// Replace with your actual production URLs when building for production
const PROD_API_URL = "https://your-production-backend.com"; // Replace with your actual URL
const PROD_WS_URL = "wss://your-production-backend.com"; // Replace with your actual URL

export const config = {
  // API基础URL (Primarily for non-chat requests like /health if used)
  apiBaseUrl: IS_PRODUCTION_BUILD ? PROD_API_URL : DEV_API_URL,

  // WebSocket基础URL
  wsBaseUrl: IS_PRODUCTION_BUILD ? PROD_WS_URL : DEV_WS_URL,

  // 重试配置 (for api.ts, if still used)
  retryAttempts: 3,

  // WebSocket重连配置
  reconnectMaxAttempts: 5,
  reconnectInitialDelay: 1000, // 初始延迟1秒
  reconnectMaxDelay: 30000,    // 最大延迟30秒

  // 会话超时配置 (Not directly used in current code, but kept for reference)
  // sessionTimeout: 30 * 60 * 1000, // 30分钟

  // 心跳/保活间隔 (Not directly used in client-side code, handled by server ping/pong)
  // heartbeatInterval: 30000, // 30秒
};

// Log the configuration being used (helps debugging)
console.log("[Plugin Config] Using Base URLs:", {
  api: config.apiBaseUrl,
  ws: config.wsBaseUrl,
});