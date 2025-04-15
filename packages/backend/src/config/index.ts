import dotenv from "dotenv";

// 加载环境变量
dotenv.config();

// 服务器配置
export const PORT = process.env.PORT || 3000;
export const isDevMode = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;

// API配置
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// CORS配置
export const corsOptions = {
  origin: [
    // Figma域名
    "https://www.figma.com",
    "https://figma.com",
    "https://www.figjam.com",
    "https://figjam.com",
    // 本地开发
    "http://localhost:3000",
    // 额外情况(ngrok和null源)会在逻辑中处理
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}; 