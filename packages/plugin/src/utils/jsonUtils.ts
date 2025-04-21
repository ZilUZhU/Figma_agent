/**
 * Safely parses JSON without throwing errors.
 */
export function safeJsonParse<T = any>(
  jsonString: string,
  defaultValue: T | null = null
): T {
  try {
    // Basic check for empty or obviously non-JSON strings
    if (
      !jsonString ||
      typeof jsonString !== "string" ||
      jsonString.trim() === ""
    ) {
      console.warn("safeJsonParse: Input string is empty or invalid.");
      return defaultValue !== null ? defaultValue : ({} as T);
    }
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error("JSON parse error:", error, "Input:", jsonString); // Log input on error
    if (defaultValue !== null) {
      return defaultValue;
    }
    // Return an empty object or potentially throw a custom error if preferred
    return {} as T;
  }
}

/**
 * Safely stringifies a value to JSON without throwing errors.
 */
export function safeJsonStringify(
  value: any,
  defaultValue: string = "{}"
): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.error("JSON stringify error:", error, "Value:", value); // Log value on error
    return defaultValue;
  }
}
