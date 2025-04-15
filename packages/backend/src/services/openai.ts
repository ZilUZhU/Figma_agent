import OpenAI from "openai";
import { OPENAI_API_KEY } from "../config";
import { ChatMessage } from "../types";
import { DEFAULT_MODEL, getFullConversation } from "../config/ai";

// 确保设置了 OpenAI API 密钥
if (!OPENAI_API_KEY) {
  console.error("错误: 未设置 OPENAI_API_KEY 环境变量");
  process.exit(1);
}

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/**
 * 生成AI响应
 * @param messages 用户消息数组
 * @param previousResponseId 前一个响应ID (用于连续对话)
 */
export async function generateChatResponse(
  messages: ChatMessage[],
  previousResponseId: string | null
) {
  // 添加系统指令到消息数组的开头
  const fullMessages = getFullConversation(messages);

  console.log("发送到OpenAI的完整消息:", JSON.stringify(fullMessages, null, 2));

  const response = await openai.responses.create({
    model: DEFAULT_MODEL,
    input: fullMessages,
    store: true, // 启用存储以便跟踪对话
    ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
  });

  return response;
} 