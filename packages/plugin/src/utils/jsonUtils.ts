/**
 * JSON工具函数
 */

/**
 * 安全的JSON解析，不会抛出异常
 * @param jsonString 要解析的JSON字符串
 * @param defaultValue 解析失败时返回的默认值
 * @returns 解析结果或默认值
 */
export function safeJsonParse<T = any>(jsonString: string, defaultValue: T | null = null): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error("JSON解析错误:", error);
    if (defaultValue !== null) {
      return defaultValue;
    }
    return {} as T;
  }
}

/**
 * 安全的JSON序列化，不会抛出异常
 * @param value 要序列化的值
 * @param defaultValue 序列化失败时返回的默认值
 * @returns JSON字符串或默认值
 */
export function safeJsonStringify(value: any, defaultValue: string = "{}"): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.error("JSON序列化错误:", error);
    return defaultValue;
  }
} 