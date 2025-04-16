import OpenAI from "openai";
import { OPENAI_API_KEY } from "../config";
import { ChatMessage } from "../types";
import { DEFAULT_MODEL, getFullConversation } from "../config/ai";
import { availableTools } from "../tools"; 

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
    tools: availableTools, // 使用导入的工具列表
    tool_choice: "auto", // 让模型自动决定是否使用工具
    store: true, // 启用存储以便跟踪对话
    ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
  });

  // 处理潜在的函数调用
  if (response.output && response.output.length > 0) {
    // 检查是否有函数调用输出
    const functionCall = response.output.find(item => item.type === "function_call");
    
    if (functionCall) {
      // 找到了函数调用
      console.log("检测到函数调用:", functionCall.name);
      
      // 解析函数参数
      const args = JSON.parse(functionCall.arguments);
      
      // 这里返回函数调用信息，让插件端执行对应的Figma API操作
      return {
        output_text: response.output_text,
        function_call: {
          name: functionCall.name,
          arguments: args,
          call_id: functionCall.call_id // 添加call_id用于function_call_output回传
        },
        responseId: response.id,
      };
    }
  }

  // 常规文本响应
  return {
    output_text: response.output_text,
    responseId: response.id,
  };
} 