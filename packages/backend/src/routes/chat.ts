import { Router, Request, Response } from "express";
import { ChatMessage, MessageRole } from "../types";
import { generateChatResponse } from "../services/openai";
import { getOrCreateSession, updateSessionData, isValidSession } from "../services/session";

const router = Router();

/**
 * 聊天API端点
 * Expects: { message: string, sessionId?: string }
 * Returns: { message: string, responseId: string, sessionId: string }
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    // 从请求体获取新消息和会话ID
    const {
      message: userMessageContent,
      sessionId: requestSessionId,
    }: { message: string; sessionId?: string } = req.body;

    if (!userMessageContent || typeof userMessageContent !== 'string') {
      return res
        .status(400)
        .json({ error: "无效的消息格式。需要提供 'message' 字符串。" });
    }

    // 如果提供了会话ID，验证其有效性
    if (requestSessionId && !isValidSession(requestSessionId)) {
      return res
        .status(404)
        .json({ error: "会话不存在或已过期，请开始新的会话。" });
    }

    // 获取或创建会话 (包含历史记录)
    const { sessionId, sessionData, isNewSession } = getOrCreateSession(requestSessionId);
    const currentHistory = sessionData.chatHistory; // Get history from session

    // Append the new user message to the history
    const newUserMessage: ChatMessage = { role: "user", content: userMessageContent };
    const updatedHistory = [...currentHistory, newUserMessage];

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
    console.log(`当前历史消息数: ${currentHistory.length}`);
    console.log(`新用户消息: ${userMessageContent}`);
    console.log(`会话状态: ${isNewSession ? "新会话" : "继续会话"}`);
    if (sessionData.lastResponseId) {
      console.log(`前一个响应ID: ${sessionData.lastResponseId}`);
    }

    // 使用 OpenAI 服务生成回复 (传入更新后的历史)
    const response = await generateChatResponse(
      updatedHistory, // Pass the history including the new user message
      sessionData.lastResponseId
    );

    // 从响应中提取文本
    const assistantMessageContent = response.output_text;

    // 将助手回复添加到历史记录，准备存储
    const assistantMessage: ChatMessage = { role: "assistant", content: assistantMessageContent };
    const finalHistory = [...updatedHistory, assistantMessage];

    // 更新会话 (包括最后响应ID和最终历史)
    updateSessionData(sessionId, response.id, finalHistory); 

    // 使用OpenAI响应的原始结构进行日志记录
    console.log("\n===== OpenAI响应完整结构 =====");
    console.log(JSON.stringify(response, null, 2));
    console.log("==============================\n");

    // 返回回复 (始终包含必需的responseId和sessionId)
    res.json({
      message: assistantMessageContent,
      responseId: response.id,
      sessionId: sessionId,
    });
  } catch (error) {
    console.error("OpenAI API 错误:", error);
    
    // 更详细的错误处理，区分不同类型的错误
    if (error instanceof Error) {
      // 处理不同类型的错误
      if (error.message.includes("Rate limit")) {
        return res.status(429).json({
          error: "请求过于频繁，请稍后再试",
          details: error.message
        });
      } else if (error.message.includes("Authentication")) {
        return res.status(401).json({
          error: "AI服务认证失败",
          details: error.message
        });
      }
    }
    
    // 默认错误响应
    res.status(500).json({
      error: "与AI服务通信时出错",
      details: error instanceof Error ? error.message : "未知错误",
    });
  }
});

export default router; 