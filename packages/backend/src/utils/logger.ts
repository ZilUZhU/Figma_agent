import { NODE_ENV, LOG_LEVEL } from "../config/index";
import { LogEntry } from "../types";

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const logLevelThreshold: Record<LogLevel, number> = {
  trace: 0,
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const minimumLevel: LogLevel =
  (LOG_LEVEL as LogLevel) || (NODE_ENV === "development" ? "info" : "info");
const minimumLevelValue = logLevelThreshold[minimumLevel];

const rawJsonLogLevel: LogLevel =
  (process.env.RAW_JSON_LOG_LEVEL as LogLevel) || "debug";
const rawJsonLogLevelValue = logLevelThreshold[rawJsonLogLevel];

console.log(
  `[Logger] Initialized with minimum log level: ${minimumLevel} (${minimumLevelValue}), rawJson level: ${rawJsonLogLevel} (${rawJsonLogLevelValue})`
);

function log(
  level: LogLevel,
  message: string,
  context?: Record<string, any>
): void {
  if (logLevelThreshold[level] < minimumLevelValue) {
    return;
  }
  const logEntry: LogEntry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...(context || {}),
  };
  console.log(JSON.stringify(logEntry));
}

/**
 * Logs raw JSON data, primarily for debugging complex objects like API responses.
 * Uses separate rawJsonLogLevel configuration to allow granular control.
 * To reduce log volume, set RAW_JSON_LOG_LEVEL=trace in environment variables.
 *
 * @param label A label to identify the logged data.
 * @param data The data object to stringify and log.
 * @param level The log level (defaults to 'debug').
 */
function logRawJson(label: string, data: any, level: LogLevel = "debug"): void {
  // 使用专门的 rawJsonLogLevelValue 来过滤日志
  if (logLevelThreshold[level] < rawJsonLogLevelValue) {
    return;
  }
  try {
    // Use console.dir for potentially better object inspection in some environments
    console.log(`\n--- [RawJSON:${label}] ${new Date().toISOString()} ---`);
    console.dir(data, { depth: null }); // Log object structure
    console.log(`--- [End RawJSON:${label}] ---\n`);
  } catch (err) {
    // Fallback if console.dir fails or JSON stringify is preferred
    try {
      console.log(`\n--- [RawJSON:${label}] ${new Date().toISOString()} ---`);
      console.log(JSON.stringify(data, null, 2));
      console.log(`--- [End RawJSON:${label}] ---\n`);
    } catch (stringifyErr) {
      console.log(
        `\n[RawJSON:${label}:ERROR] Failed to log raw data: ${stringifyErr}`
      );
      console.log("Raw Data:", data); // Attempt to log the raw data directly
      console.log(`--- [End RawJSON:${label}] ---\n`);
    }
  }
}

function createLogContext(
  contextOrError: Record<string, any> | Error,
  additionalContext?: Record<string, any>
): Record<string, any> {
  if (contextOrError instanceof Error) {
    return {
      error: {
        message: contextOrError.message,
        name: contextOrError.name, // Include error name
        // Only include stack trace at debug level or higher for errors
        stack:
          minimumLevelValue <= logLevelThreshold.debug
            ? contextOrError.stack?.split("\n").slice(0, 5).join("\n")
            : undefined, // Limit stack trace length
      },
      ...(additionalContext || {}),
    };
  }
  return { ...contextOrError, ...(additionalContext || {}) };
}

export const logger = {
  trace: (
    contextOrError: Record<string, any> | Error,
    message?: string,
    additionalContext?: Record<string, any>
  ) => {
    const finalContext = createLogContext(contextOrError, additionalContext);
    const finalMessage =
      message ||
      (contextOrError instanceof Error
        ? contextOrError.message
        : "Trace information");
    log("trace", finalMessage, finalContext);
  },
  debug: (
    contextOrError: Record<string, any> | Error,
    message?: string,
    additionalContext?: Record<string, any>
  ) => {
    const finalContext = createLogContext(contextOrError, additionalContext);
    const finalMessage =
      message ||
      (contextOrError instanceof Error
        ? contextOrError.message
        : "Debug information");
    log("debug", finalMessage, finalContext);
  },
  info: (
    contextOrError: Record<string, any> | Error,
    message?: string,
    additionalContext?: Record<string, any>
  ) => {
    const finalContext = createLogContext(contextOrError, additionalContext);
    const finalMessage =
      message ||
      (contextOrError instanceof Error
        ? contextOrError.message
        : "Informational message");
    log("info", finalMessage, finalContext);
  },
  warn: (
    contextOrError: Record<string, any> | Error,
    message?: string,
    additionalContext?: Record<string, any>
  ) => {
    const finalContext = createLogContext(contextOrError, additionalContext);
    const finalMessage =
      message ||
      (contextOrError instanceof Error
        ? contextOrError.message
        : "Warning message");
    log("warn", finalMessage, finalContext);
  },
  error: (
    contextOrError: Record<string, any> | Error,
    message?: string,
    additionalContext?: Record<string, any>
  ) => {
    const finalContext = createLogContext(contextOrError, additionalContext);
    const finalMessage =
      message ||
      (contextOrError instanceof Error
        ? contextOrError.message
        : "Error occurred");
    log("error", finalMessage, finalContext);
  },
  fatal: (
    contextOrError: Record<string, any> | Error,
    message?: string,
    additionalContext?: Record<string, any>
  ) => {
    const finalContext = createLogContext(contextOrError, additionalContext);
    const finalMessage =
      message ||
      (contextOrError instanceof Error
        ? contextOrError.message
        : "Fatal error occurred");
    log("fatal", finalMessage, finalContext);
  },
  // Expose raw JSON logging function, defaulting to 'debug' level
  rawJson: (label: string, data: any, level: LogLevel = "debug") => {
    logRawJson(label, data, level);
  },
};
