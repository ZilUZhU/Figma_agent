/**
 * API服务
 * 负责与后端服务通信的封装
 */

import { config } from "../config";
import { ChatResponse } from "../types";

// API错误类
export class ApiError extends Error {
  status?: number;
  data?: any;

  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
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
    let attempt = 0;

    while (attempt < this.retryAttempts) {
      try {
        // 添加延时（对于重试请求）
        if (attempt > 0) {
          console.log(`重试请求 (${attempt}/${this.retryAttempts})...`);
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // 发送请求
        const response = await fetch(url, requestInit);

        // 检查响应状态
        if (!response.ok) {
          let errorData: any;
          
          try {
            // 尝试解析错误响应
            errorData = await response.json();
          } catch (e) {
            // 如果无法解析为JSON，则使用文本
            errorData = { error: await response.text() };
          }
          
          // 构建友好的错误信息
          const errorMessage = errorData.error || `API错误 (${response.status})`;
          
          // 抛出更详细的错误
          throw new ApiError(
            errorMessage,
            response.status,
            errorData
          );
        }

        // 解析并返回响应
        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // 对特定错误类型不进行重试
        if (error instanceof ApiError) {
          // 不重试身份验证错误 (401)、无效请求 (400)、资源不存在 (404)
          if (error.status === 401 || error.status === 400 || error.status === 404) {
            console.log(`不重试错误 (${error.status}): ${error.message}`);
            throw error;
          }
        }

        // 如果是最后一次尝试，抛出错误
        if (attempt === this.retryAttempts - 1) {
          throw lastError;
        }
        
        attempt++;
      }
    }

    // 这段代码理论上不会执行，但TypeScript需要确保函数有返回值
    throw lastError || new Error("未知错误");
  }

  /**
   * 发送聊天请求
   * @param message - The new user message content
   * @param sessionId - The current session ID (optional)
   */
  async sendChatRequest(
    message: string,
    sessionId?: string
  ): Promise<ChatResponse> {
    return this.request<ChatResponse>({
      method: "POST",
      path: "/api/chat",
      body: { message, sessionId },
    });
  }

  /**
   * 发送函数执行结果到后端
   * @param function_call_output - 函数执行结果对象
   * @param sessionId - 当前会话ID
   */
  async sendFunctionResult(
    function_call_output: any,
    sessionId: string
  ): Promise<ChatResponse> {
    return this.request<ChatResponse>({
      method: "POST",
      path: "/api/chat/function-callback",
      body: { function_call_output, sessionId },
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
