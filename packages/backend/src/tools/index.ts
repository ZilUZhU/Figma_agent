/**
 * Figma AI工具索引
 * 集中导出所有可用的function calling工具
 */

import { createStickyNote } from './createStickyNote';

// 可用工具列表，可以根据需要启用或禁用特定工具
export const availableTools = [
  createStickyNote,
  // 添加更多工具，例如：
  // createConnector,
  // createShape,
  // createText,
  // 等等
];

// 导出所有单独的工具以供直接引用
export {
  createStickyNote,
  // 在这里添加其他工具导出
};

// 导出函数调用类型
export type FunctionCallTools = (typeof availableTools)[number]['name']; 