/**
 * 服务器配置
 */

import 'dotenv/config'; // Load environment variables from .env file

// Required: OpenAI API Key
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn("⚠️ WARNING: OPENAI_API_KEY environment variable is not set.");
  // Consider throwing an error or exiting if the key is absolutely required
  // process.exit(1);
}

// Default OpenAI Model (using gpt-4o as recommended)
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

// Server Port
export const PORT = Number(process.env.PORT) || 3000;

// Environment Settings
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const isDevMode = NODE_ENV === 'development';

// Debugging flag for request headers (optional)
export const DEBUG_HEADERS = process.env.DEBUG_HEADERS === 'true';

// CORS Configuration
export const corsOptions = {
  // Allowed origins for CORS checks (primarily for HTTP requests like health checks)
  origin: [
    "https://www.figma.com",
    "https://figma.com",
    "https://www.figjam.com",
    "https://figjam.com",
    // Local development origin for the frontend plugin UI
    "http://localhost:3000", // Adjust if your plugin UI runs on a different port
    // Null origin might be needed for certain Figma environments or local setups
    "null",
  ],
  methods: ["GET", "POST", "OPTIONS"], // Allowed HTTP methods
  allowedHeaders: ["Content-Type", "Authorization"], // Allowed HTTP headers
  credentials: true, // Allow credentials (cookies, authorization headers)
};