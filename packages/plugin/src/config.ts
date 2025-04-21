export type Environment = "development" | "production";

// --- Configuration ---
const IS_PRODUCTION_BUILD = false;

const DEV_API_URL = "http://localhost:3000";
const DEV_WS_URL = "ws://localhost:3000";

const PROD_API_URL = "https://temp.com";
const PROD_WS_URL = "wss://temp.com";

export const config = {
  apiBaseUrl: IS_PRODUCTION_BUILD ? PROD_API_URL : DEV_API_URL,
  wsBaseUrl: IS_PRODUCTION_BUILD ? PROD_WS_URL : DEV_WS_URL,
  // retryAttempts: 3, // Removed as api.ts is removed
  reconnectMaxAttempts: 5,
  reconnectInitialDelay: 1000,
  reconnectMaxDelay: 30000,
};

console.log("[Plugin Config] Using Base URLs:", {
  api: config.apiBaseUrl,
  ws: config.wsBaseUrl,
});
