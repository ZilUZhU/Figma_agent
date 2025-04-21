import "dotenv/config";

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn("⚠️ WARNING: OPENAI_API_KEY environment variable is not set.");
}

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-2025-04-14";
export const PORT = Number(process.env.PORT) || 3000;
export const NODE_ENV = process.env.NODE_ENV || "development";
export const isDevMode = NODE_ENV === "development";
export const LOG_LEVEL =
  process.env.LOG_LEVEL || (isDevMode ? "debug" : "info");
export const DEBUG_HEADERS = process.env.DEBUG_HEADERS === "true";

export const corsOptions = {
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
