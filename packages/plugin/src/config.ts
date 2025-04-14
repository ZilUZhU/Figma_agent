/**
 * 插件配置文件
 * 用于管理配置项，提高代码可维护性
 */

// 定义环境类型
export type Environment = "development" | "production";

// 在Figma插件环境中，设置默认为development
export const ENV: Environment = "development";

// API基础URL
const API_BASE_URL = "http://localhost:3000";

// 导出配置
export const config = {
  // API基础URL
  apiBaseUrl: API_BASE_URL,

  // 其他全局配置项
  timeoutMs: 30000, // API请求超时时间（毫秒）
  retryAttempts: 3, // 请求失败重试次数
};
