/**
 * WebSocket服务
 * 负责与后端WebSocket服务器的连接和通信
 */

import { config } from "../config";
import { ConnectionStatus } from "../types";

// 回调函数接口
export interface WebSocketCallbacks {
  onMessage: (message: string) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  onFunctionCall: (functionCall: any) => void;
  onChunk: (chunk: string) => void;
}

// WebSocket服务类
export class WebSocketService {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private callbacks: WebSocketCallbacks;
  private reconnectAttempts = 0;
  // Use NodeJS.Timeout type for compatibility in different environments
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isManualClose = false;

  /**
   * 构造函数
   * @param callbacks 回调函数集合
   */
  constructor(callbacks: WebSocketCallbacks) {
    this.callbacks = callbacks;
    console.log("[WebSocket] 服务初始化");
  }

  /**
   * 连接到WebSocket服务器
   */
  connect(): void {
    if (this.ws) {
      console.log("[WebSocket] 关闭现有连接并重新连接");
      // Ensure previous timeout is cleared before attempting to close/reconnect
      if (this.reconnectTimeout !== null) {
        clearTimeout(this.reconnectTimeout); // Use global clearTimeout
        this.reconnectTimeout = null;
      }
      this.ws.close();
      this.ws = null; // Reset ws state
    }

    this.callbacks.onStatusChange("connecting");
    console.log("[WebSocket] 连接到:", config.wsBaseUrl);

    try {
      this.ws = new WebSocket(config.wsBaseUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error("[WebSocket] 连接错误:", error);
      this.callbacks.onStatusChange("error");
      // Don't call attemptReconnect directly from catch, handleClose will trigger it if needed
      // this.attemptReconnect(); // Remove this direct call
    }
  }

  /**
   * 断开WebSocket连接
   */
  disconnect(): void {
    console.log("[WebSocket] 手动断开连接");
    this.isManualClose = true; // Set flag *before* closing

    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout); // Use global clearTimeout
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    // Update status explicitly on manual close if needed, though handleClose might also fire
    this.callbacks.onStatusChange("disconnected");
  }

  /**
   * 发送聊天消息
   * @param message 用户消息内容
   */
  sendMessage(message: string): void {
    if (!this.ensureConnection()) {
        // ensureConnection might trigger a connect attempt, but sending should wait
        console.warn("[WebSocket] Cannot send message: Connection not open.");
        this.callbacks.onMessage("错误: 连接未建立，无法发送消息。请稍后重试。");
        return;
    }

    console.log(`[WebSocket] 发送消息: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);

    try {
        this.ws!.send(JSON.stringify({
            type: 'chat_message',
            payload: { // Ensure payload structure matches backend expectation
                message,
                sessionId: this.sessionId
            }
        }));
    } catch (error) {
        console.error("[WebSocket] Error sending message:", error);
        this.callbacks.onMessage(`错误: 发送消息失败 (${error instanceof Error ? error.message : 'Unknown'})`);
        // Consider triggering reconnect or error state
        this.callbacks.onStatusChange("error");
    }
  }

  /**
   * 发送函数调用结果
   * @param functionCallOutput 函数执行结果 (should be { call_id: string, output: string })
   */
  sendFunctionResult(functionCallOutput: { call_id: string, output: string }): void {
    if (!this.ensureConnection()) {
      console.warn("[WebSocket] Cannot send function result: Connection not open.");
      this.callbacks.onMessage("错误: 连接未建立，无法发送函数结果。请稍后重试。");
      return;
    }

    if (!this.sessionId) {
      console.error("[WebSocket] 发送函数结果错误: 未建立会话");
      this.callbacks.onMessage("错误: 未建立会话，无法发送函数结果");
      // Optionally trigger error state
      this.callbacks.onStatusChange("error");
      return;
    }

    console.log(`[WebSocket] 发送函数结果: ${functionCallOutput.call_id}`);

    try {
        this.ws!.send(JSON.stringify({
            type: 'function_result',
            payload: { // Ensure payload structure matches backend expectation
                functionCallOutput: functionCallOutput, // Send the object directly
                sessionId: this.sessionId
            }
        }));
    } catch (error) {
        console.error("[WebSocket] Error sending function result:", error);
        this.callbacks.onMessage(`错误: 发送函数结果失败 (${error instanceof Error ? error.message : 'Unknown'})`);
        this.callbacks.onStatusChange("error");
    }
  }

  /**
   * 确保WebSocket连接已建立
   * @returns boolean 是否已连接
   */
  private ensureConnection(): boolean {
    // Only return true if connection is actively OPEN
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 处理连接打开事件
   */
  private handleOpen(): void {
    console.log("[WebSocket] 连接已建立");
    this.reconnectAttempts = 0; // Reset attempts on successful connection
    this.isManualClose = false;
    this.callbacks.onStatusChange("connected");
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      console.log(`[WebSocket] 收到消息类型: ${data.type}`);

      // Ensure payload exists before accessing its properties
      const payload = data.payload || {};

      switch (data.type) {
        case 'connection_established':
          console.log(`[WebSocket] 连接已确认，客户端ID: ${payload.clientId}`);
          // Optionally store clientId if needed
          break;

        case 'stream_start':
          if (payload.sessionId && !this.sessionId) {
            this.sessionId = payload.sessionId;
            console.log(`[WebSocket] 会话ID 已设置: ${this.sessionId}`);
          }
          console.log("[WebSocket] 流式响应开始");
          break;

        case 'stream_chunk':
          if (payload.text !== undefined) { // Check specifically for text chunk
            this.callbacks.onChunk(payload.text);
          }
          if (payload.functionCall) {
            console.log(`[WebSocket] 收到函数调用: ${payload.functionCall.name}`);
            this.callbacks.onFunctionCall(payload.functionCall);
          }
          break;

        case 'stream_end':
          console.log("[WebSocket] 流式响应结束");
          if (payload.sessionId && !this.sessionId) { // Set session ID if missed earlier
            this.sessionId = payload.sessionId;
             console.log(`[WebSocket] 会话ID 在流结束时设置: ${this.sessionId}`);
          }
          // Potentially reset loading state here if backend doesn't send explicit loading=false
          break;

        case 'stream_error':
          console.error("[WebSocket] 流式响应错误:", payload.message);
          this.callbacks.onMessage(`流错误: ${payload.message}`);
          // Consider setting status to error
          this.callbacks.onStatusChange("error");
          break;

        case 'error': // General backend error
          console.error("[WebSocket] 收到错误:", payload.message, `(Code: ${payload.code})`);
          this.callbacks.onMessage(`错误 (${payload.code}): ${payload.message}`);
          this.callbacks.onStatusChange("error");
          break;

        default:
          console.warn(`[WebSocket] 未知消息类型: ${data.type}`, data);
      }
    } catch (error) {
      console.error("[WebSocket] 解析消息错误:", error, event.data);
      // Notify UI about parsing error
      this.callbacks.onMessage("错误: 收到无法解析的消息");
      this.callbacks.onStatusChange("error");
    }
  }

  /**
   * 处理连接关闭事件
   */
  private handleClose(event: CloseEvent): void {
    console.log(`[WebSocket] 连接已关闭: ${event.code} ${event.reason || 'No reason provided'}`);
    this.ws = null; // Clear the WebSocket instance

    // Check if the closure was unexpected (not manual)
    if (!this.isManualClose) {
      this.callbacks.onStatusChange("error"); // Indicate error before attempting reconnect
      this.attemptReconnect();
    } else {
      this.callbacks.onStatusChange("disconnected"); // Expected disconnection
    }
    // Reset manual close flag after handling
    this.isManualClose = false;
  }

  /**
   * 处理连接错误事件
   */
  private handleError(event: Event): void {
    // This often precedes the 'close' event
    console.error("[WebSocket] 连接发生错误:", event);
    // Avoid changing status directly here if handleClose will also fire and manage status/reconnect
    // Only change status if handleClose might not fire (e.g., before connection established)
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
         this.callbacks.onStatusChange("error");
    }
  }

  /**
   * 尝试重新连接
   */
  private attemptReconnect(): void {
    if (this.isManualClose || this.reconnectTimeout !== null) {
      // Don't reconnect if manually closed or already trying
      console.log("[WebSocket] Skipping reconnect attempt.");
      return;
    }

    if (this.reconnectAttempts >= config.reconnectMaxAttempts) {
      console.log(`[WebSocket] 达到最大重连次数 (${config.reconnectMaxAttempts})，停止重连`);
      this.callbacks.onStatusChange("error"); // Stay in error state
      this.callbacks.onMessage("连接失败，请稍后重试或刷新插件");
      return;
    }

    const delay = Math.min(
      config.reconnectInitialDelay * Math.pow(2, this.reconnectAttempts),
      config.reconnectMaxDelay
    );

    this.reconnectAttempts++;
    console.log(`[WebSocket] ${delay}ms后尝试重连 (${this.reconnectAttempts}/${config.reconnectMaxAttempts})...`);

    // Use global setTimeout directly
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null; // Clear the timeout ID before connecting
      this.connect();
    }, delay);
  }
}