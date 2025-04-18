/**
 * 函数调用处理模块
 * 负责处理从WebSocket接收的函数调用请求
 */

// 导入工具函数
const safeJsonParse = (jsonString: string, defaultValue: any = {}): any => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("JSON解析错误:", error);
    return defaultValue;
  }
};

// Figma函数实现
// 注意：由于无法直接导入figmaFunctions.ts，我们在这里直接实现核心函数

// 获取当前选中节点ID
async function getCurrentNodeId(): Promise<string> {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    return JSON.stringify({ 
      message: "当前没有选中任何节点", 
      nodeId: null
    });
  }
  return JSON.stringify({
    message: `已选中${selection.length}个节点`,
    nodeIds: selection.map(node => node.id),
    primaryNodeId: selection[0].id
  });
}

// 创建矩形
async function createRectangle(args: any): Promise<string> {
  try {
    // 默认值处理
    const x = args.x ?? 0;
    const y = args.y ?? 0;
    const width = args.width || 100;
    const height = args.height || 100;
    const name = args.name || "Rectangle";
    
    // 创建矩形
    const rect = figma.createRectangle();
    rect.x = x;
    rect.y = y;
    rect.resize(width, height);
    rect.name = name;
    
    // 处理填充颜色
    if (args.fill) {
      const rgb = hexToRgb(args.fill);
      if (rgb) {
        const { r, g, b } = rgb;
        rect.fills = [{ type: 'SOLID', color: { r, g, b } }];
      }
    }
    
    figma.currentPage.appendChild(rect);
    figma.currentPage.selection = [rect];
    
    return JSON.stringify({
      success: true,
      message: `已创建矩形 "${name}"`,
      nodeId: rect.id
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// 创建文本
async function createText(args: any): Promise<string> {
  try {
    // 加载字体
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    
    const x = args.x ?? 0;
    const y = args.y ?? 0;
    const text = args.text || "新文本";
    const fontSize = args.fontSize || 14;
    
    const textNode = figma.createText();
    textNode.x = x;
    textNode.y = y;
    textNode.characters = text;
    textNode.fontSize = fontSize;
    
    figma.currentPage.appendChild(textNode);
    figma.currentPage.selection = [textNode];
    
    return JSON.stringify({
      success: true,
      message: `已创建文本`,
      nodeId: textNode.id
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// 颜色转换工具
function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  if (hex.length !== 6) {
    return null;
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return {
    r: r / 255,
    g: g / 255,
    b: b / 255
  };
}

// 可用函数映射表
const availableFunctions: Record<string, (args: any) => Promise<string | object>> = {
  getCurrentNodeId,
  createRectangle,
  createText,
  // 可根据需要添加更多函数
};

/**
 * 处理函数调用
 * @param functionCall 函数调用信息
 * @returns 函数执行结果（字符串）
 */
export async function handleFunctionCall(functionCall: {
  name: string;
  arguments: string;
  call_id: string;
}): Promise<string> {
  try {
    console.log(`[functionCalls] 处理函数调用: ${functionCall.name}`);
    
    // 解析参数
    const args = safeJsonParse(functionCall.arguments);
    
    // 获取函数
    const targetFunction = availableFunctions[functionCall.name];
    if (!targetFunction) {
      throw new Error(`未知函数: ${functionCall.name}`);
    }
    
    // 执行函数
    console.log(`[functionCalls] 执行 ${functionCall.name} 参数:`, args);
    const result = await targetFunction(args);
    
    // 将结果转为字符串
    const resultStr = typeof result === 'string' 
      ? result 
      : JSON.stringify(result, null, 2);
    
    console.log(`[functionCalls] ${functionCall.name} 结果:`, resultStr);
    return resultStr;
  } catch (error) {
    console.error(`[functionCalls] 函数 ${functionCall.name} 执行错误:`, error);
    return JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      function: functionCall.name
    });
  }
} 