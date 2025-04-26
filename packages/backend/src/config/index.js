"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsOptions = exports.DEBUG_HEADERS = exports.LOG_LEVEL = exports.isDevMode = exports.NODE_ENV = exports.PORT = exports.OPENAI_MODEL = exports.OPENAI_API_KEY = void 0;
require("dotenv/config");
exports.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!exports.OPENAI_API_KEY) {
    console.warn("⚠️ WARNING: OPENAI_API_KEY environment variable is not set.");
}
exports.OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-2025-04-14";
exports.PORT = Number(process.env.PORT) || 3000;
exports.NODE_ENV = process.env.NODE_ENV || "development";
exports.isDevMode = exports.NODE_ENV === "development";
exports.LOG_LEVEL = process.env.LOG_LEVEL || (exports.isDevMode ? "debug" : "info");
exports.DEBUG_HEADERS = process.env.DEBUG_HEADERS === "true";
exports.corsOptions = {
    origin: [
        "https://www.figma.com",
        "https://figma.com",
        "https://www.figjam.com",
        "https://figjam.com",
        "http://localhost:3000", // Keep for local dev
        "null", // Keep for local dev if needed
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
};
