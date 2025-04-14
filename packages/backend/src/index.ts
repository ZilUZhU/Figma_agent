import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { ChatMessage } from "./types";
import { randomUUID } from "crypto"; // 导入UUID生成功能

// 加载环境变量
dotenv.config();

// 初始化 Express 应用
const app = express();
const PORT = process.env.PORT || 3000;
const isDevMode =
  process.env.NODE_ENV === "development" || !process.env.NODE_ENV;

// 确保设置了 OpenAI API 密钥
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("错误: 未设置 OPENAI_API_KEY 环境变量");
  process.exit(1);
}

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: apiKey,
});

// 使用内存存储会话ID (生产环境应使用持久化存储)
interface SessionData {
  lastResponseId: string | null;
}
const sessions: Map<string, SessionData> = new Map();

// CORS配置
const corsOptions = {
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

// 中间件
app.use(express.json());

// 移除请求日志中间件，不再打印每个HTTP请求

// CORS配置 - 处理开发环境和特殊情况
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // 开发环境或特殊情况: null, ngrok域名
  if (
    isDevMode ||
    !origin ||
    origin === "null" ||
    origin?.includes("ngrok.io") ||
    origin?.includes("ngrok-free.app")
  ) {
    res.header("Access-Control-Allow-Origin", origin || "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
  } else if (corsOptions.origin.includes(origin)) {
    // 允许的生产环境源
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", corsOptions.methods.join(", "));
    res.header(
      "Access-Control-Allow-Headers",
      corsOptions.allowedHeaders.join(", ")
    );
    res.header("Access-Control-Allow-Credentials", "true");
  } else {
    console.warn(`不允许的Origin: ${origin}`);
    // 不设置CORS头以拒绝请求
  }

  // 处理预检请求
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

// 路由: 聊天API端点
app.post("/api/chat", async (req: Request, res: Response) => {
  try {
    // 从请求体获取消息历史和会话ID
    const {
      messages,
      sessionId: requestSessionId,
    }: { messages: ChatMessage[]; sessionId?: string } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res
        .status(400)
        .json({ error: "无效的消息格式。需要提供消息数组。" });
    }

    // 如果没有提供sessionId，则自动生成一个
    // (注意: OpenAI不提供自动创建客户端会话ID的功能，这是应用层面的管理)
    const sessionId = requestSessionId || randomUUID();
    let isNewSession = false;

    // 获取或创建会话数据
    let sessionData = sessions.get(sessionId);
    if (!sessionData) {
      sessionData = { lastResponseId: null };
      sessions.set(sessionId, sessionData);
      isNewSession = true;
    }

    if (isNewSession) {
      console.log(`创建新会话 [${sessionId}]`);
    } else {
      console.log(
        `继续会话 [${sessionId}]，上一个响应ID: ${
          sessionData.lastResponseId || "无"
        }`
      );
    }

    // 记录请求基本信息
    console.log(`\n===== OpenAI请求 [${sessionId}] =====`);
    console.log(`消息数量: ${messages.length}`);
    console.log(`会话状态: ${isNewSession ? "新会话" : "继续会话"}`);
    if (sessionData.lastResponseId) {
      console.log(`前一个响应ID: ${sessionData.lastResponseId}`);
    }

    // 使用 OpenAI API 的 responses 接口生成回复
    const response = await openai.responses.create({
      model: "gpt-4o",
      input: messages,
      store: true, // 启用存储以便跟踪对话
      ...(sessionData.lastResponseId
        ? { previous_response_id: sessionData.lastResponseId }
        : {}),
    });

    // 更新会话的最后响应ID
    sessionData.lastResponseId = response.id;

    // 从响应中提取文本
    const assistantMessage = response.output_text;

    // 使用OpenAI响应的原始结构进行日志记录
    console.log("\n===== OpenAI响应完整结构 =====");
    console.log(JSON.stringify(response, null, 2));
    console.log("==============================\n");

    // 返回回复
    res.json({
      message: assistantMessage,
      responseId: response.id,
      sessionId: sessionId, // 总是返回sessionId，这样前端可以保存和重用
    });
  } catch (error) {
    console.error("OpenAI API 错误:", error);
    res.status(500).json({
      error: "与AI服务通信时出错",
      details: error instanceof Error ? error.message : "未知错误",
    });
  }
});

// 健康检查路由
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
