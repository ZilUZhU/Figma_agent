/**
 * API服务
 * 负责与后端服务通信的封装
 */

import { config } from "../config";
import { ChatHistory, ChatMessage, ChatResponse } from "../types";

// API错误类
export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// 请求参数接口
interface RequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: any;
  headers?: Record<string, string>;
}

/**
 * API服务类
 */
export class ApiService {
  // 从配置中获取设置
  private baseUrl = config.apiBaseUrl;
  private retryAttempts = config.retryAttempts;

  /**
   * 发送请求，带重试逻辑
   */
  private async request<T>(options: RequestOptions): Promise<T> {
    const { method, path, body, headers = {} } = options;
    const url = `${this.baseUrl}${path}`;

    // 设置请求配置
    const requestInit: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    };

    // 实现重试逻辑
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        // 添加延时（对于重试请求）
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // 发送请求
        const response = await fetch(url, requestInit);

        // 检查响应状态
        if (!response.ok) {
          const errorText = await response.text();
          throw new ApiError(
            `API错误 (${response.status}): ${errorText}`,
            response.status
          );
        }

        // 解析并返回响应
        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 如果是最后一次尝试，抛出错误
        if (attempt === this.retryAttempts - 1) {
          throw lastError;
        }
      }
    }

    // 这段代码理论上不会执行，但TypeScript需要确保函数有返回值
    throw lastError || new Error("未知错误");
  }

  /**
   * 发送聊天请求
   */
  async sendChatRequest(messages: ChatHistory): Promise<ChatResponse> {
    return this.request<ChatResponse>({
      method: "POST",
      path: "/api/chat",
      body: { messages },
    });
  }

  /**
   * 检查API健康状态
   */
  async checkHealth(): Promise<{ status: string }> {
    return this.request<{ status: string }>({
      method: "GET",
      path: "/health",
    });
  }
}

// 导出API服务单例
export const apiService = new ApiService();
