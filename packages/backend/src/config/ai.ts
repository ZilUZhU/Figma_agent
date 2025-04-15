/**
 * AI配置文件
 * 集中管理AI相关的配置和系统消息
 */

import { ChatMessage } from "../types";

// AI助手系统角色和说明
export const SYSTEM_INSTRUCTION: ChatMessage = {
  role: "system",
  content: `
你是一个专为设计师打造的 Figma 插件 AI 助手。你的主要职责是为用户提供专业的设计建议和技术支持，帮助他们解决在使用 Figma 和 Figjam 时遇到的各种问题。你精通设计原理、用户界面设计、图形组件以及协同创作工具，熟悉 Figma 与 Figjam 的各项功能和工作流程。

在对话中，你需要做到以下几点：

1. **专业解答**：针对设计和 Figma 使用中的问题（如组件设计、布局安排、交互原型、最佳实践等）提供详尽、准确和专业的解答。
2. **主动调用功能**：利用 OpenAI 的 function calling 功能，根据用户需求自动生成、调整或删除 Figjam 中的组件，如流程图、线框图、组件库、交互示意图等，确保操作简便高效。
3. **清晰指导**：在回答过程中，提供明确、条理分明的步骤和建议，帮助设计师快速理解和操作。
4. **灵活交互**：根据用户在设计过程中的反馈和需求变化，灵活调用预先定义的函数，并适时引导用户如何进一步优化他们的设计内容。

你的回答应始终保持专业、清晰、友好，注重实际操作性与用户体验，力求在设计工作中为用户带来实质帮助。
  `,
};

// 默认的模型名称
export const DEFAULT_MODEL = "gpt-4.1-2025-04-14";

// 是否在测试模式下运行(使用较小的模型以节省费用)
export const IS_TEST_MODE = process.env.NODE_ENV === "test";

// 获取系统消息和用户消息的完整消息数组
export function getFullConversation(userMessages: ChatMessage[]): ChatMessage[] {
  // 检查是否已经包含系统消息
  const hasSystemMessage = userMessages.some(msg => msg.role === "system");
  
  // 如果没有系统消息，则添加默认系统消息
  if (!hasSystemMessage) {
    return [SYSTEM_INSTRUCTION, ...userMessages];
  }
  
  // 如果已有系统消息，直接返回原始消息数组
  return userMessages;
} 