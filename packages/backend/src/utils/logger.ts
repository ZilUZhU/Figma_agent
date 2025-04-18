/**
 * Basic Structured Logger
 * Uses console.log but outputs JSON for easier parsing by logging services.
 * Replace with a more robust library like Pino or Winston for production.
 */

// 修正导入路径，使用相对路径
import { NODE_ENV } from "../config/index";
import { LogEntry } from "../types";

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const logLevelThreshold: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    fatal: 50,
};

// Determine minimum log level based on environment
const minimumLevel: LogLevel = NODE_ENV === 'development' ? 'debug' : 'info';
const minimumLevelValue = logLevelThreshold[minimumLevel];

function log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (logLevelThreshold[level] < minimumLevelValue) {
        return; // Skip logging if below threshold
    }

    const logEntry: LogEntry = {
        level,
        timestamp: new Date().toISOString(),
        message,
        ...(context || {}), // Merge context object
        // service: 'figma-ai-backend', // Example static context
        // environment: NODE_ENV,      // Example static context
    };

    // Output JSON string to the console
    console.log(JSON.stringify(logEntry));
}

// Export logger functions
export const logger = {
    debug: (context: Record<string, any> | Error, message?: string) => {
        if (context instanceof Error) log('debug', message || context.message, { error: { message: context.message, stack: context.stack }});
        else log('debug', message || 'Debug information', context);
    },
    info: (context: Record<string, any> | Error, message?: string) => {
        if (context instanceof Error) log('info', message || context.message, { error: { message: context.message, stack: context.stack }});
        else log('info', message || 'Informational message', context);
    },
    warn: (context: Record<string, any> | Error, message?: string) => {
        if (context instanceof Error) log('warn', message || context.message, { error: { message: context.message, stack: context.stack }});
        else log('warn', message || 'Warning message', context);
    },
    error: (context: Record<string, any> | Error, message?: string) => {
        if (context instanceof Error) log('error', message || context.message, { error: { message: context.message, stack: context.stack }});
        else log('error', message || 'Error occurred', context);
    },
    fatal: (context: Record<string, any> | Error, message?: string) => {
        if (context instanceof Error) log('fatal', message || context.message, { error: { message: context.message, stack: context.stack }});
        else log('fatal', message || 'Fatal error occurred', context);
    },
};