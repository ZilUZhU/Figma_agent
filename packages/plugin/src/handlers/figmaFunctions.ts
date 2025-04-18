/**
 * Figma API函数实现
 * 包含所有可以通过AI调用的Figma操作
 */

/**
 * 获取当前选中节点ID
 */
export async function getCurrentNodeId(): Promise<string> {
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

/**
 * 创建矩形
 */
export async function createRectangle(args: {
  x?: number;
  y?: number;
  width: number;
  height: number;
  fill?: string;
  cornerRadius?: number;
  name?: string;
}): Promise<string> {
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
    
    // 处理圆角
    if (args.cornerRadius) {
      rect.cornerRadius = args.cornerRadius;
    }
    
    // 添加到当前页面并选中
    figma.currentPage.appendChild(rect);
    figma.currentPage.selection = [rect];
    
    // 返回结果
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

/**
 * 创建Frame
 */
export async function createFrame(args: {
  x?: number;
  y?: number;
  width: number;
  height: number;
  name?: string;
  fill?: string;
}): Promise<string> {
  try {
    // 默认值处理
    const x = args.x ?? 0;
    const y = args.y ?? 0;
    const width = args.width || 300;
    const height = args.height || 200;
    const name = args.name || "Frame";
    
    // 创建Frame
    const frame = figma.createFrame();
    frame.x = x;
    frame.y = y;
    frame.resize(width, height);
    frame.name = name;
    
    // 处理填充颜色
    if (args.fill) {
      const rgb = hexToRgb(args.fill);
      if (rgb) {
        const { r, g, b } = rgb;
        frame.fills = [{ type: 'SOLID', color: { r, g, b } }];
      }
    }
    
    // 添加到当前页面并选中
    figma.currentPage.appendChild(frame);
    figma.currentPage.selection = [frame];
    
    // 返回结果
    return JSON.stringify({
      success: true,
      message: `已创建Frame "${name}"`,
      nodeId: frame.id
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * 创建文本
 */
export async function createText(args: {
  x?: number;
  y?: number;
  text: string;
  fontSize?: number;
  fill?: string;
  name?: string;
}): Promise<string> {
  try {
    // 加载字体
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    
    // 默认值处理
    const x = args.x ?? 0;
    const y = args.y ?? 0;
    const text = args.text || "新文本";
    const fontSize = args.fontSize || 14;
    const name = args.name || "Text";
    
    // 创建文本
    const textNode = figma.createText();
    textNode.x = x;
    textNode.y = y;
    textNode.characters = text;
    textNode.fontSize = fontSize;
    textNode.name = name;
    
    // 处理填充颜色
    if (args.fill) {
      const rgb = hexToRgb(args.fill);
      if (rgb) {
        const { r, g, b } = rgb;
        textNode.fills = [{ type: 'SOLID', color: { r, g, b } }];
      }
    }
    
    // 添加到当前页面并选中
    figma.currentPage.appendChild(textNode);
    figma.currentPage.selection = [textNode];
    
    // 返回结果
    return JSON.stringify({
      success: true,
      message: `已创建文本 "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`,
      nodeId: textNode.id
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * 截图节点
 */
export async function screenshotNode(args: { 
  nodeId?: string; 
  scale?: number;
}): Promise<string> {
  try {
    // 获取节点
    const nodeId = args.nodeId;
    let node;
    
    if (nodeId) {
      node = figma.getNodeById(nodeId);
      if (!node) {
        throw new Error(`未找到ID为 ${nodeId} 的节点`);
      }
    } else {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        throw new Error("未选中任何节点");
      }
      node = selection[0];
    }
    
    // 检查节点类型并安全地获取宽高和导出能力
    if ('exportAsync' in node) {
      const scale = args.scale || 1;
      const png = await node.exportAsync({
        format: 'PNG',
        constraint: { type: 'SCALE', value: scale }
      });
      
      // 将图像数据转换为Base64
      const base64 = figma.base64Encode(png);
      
      // 安全地获取宽高
      let width: number | undefined;
      let height: number | undefined;
      
      if ('width' in node && 'height' in node) {
        width = node.width;
        height = node.height;
      }
      
      return JSON.stringify({
        success: true,
        message: `节点 ${node.name || node.id} 的截图已生成`,
        nodeId: node.id,
        imageData: `data:image/png;base64,${base64}`,
        width: width,
        height: height
      });
    } else {
      throw new Error("所选节点不支持导出");
    }
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * 调整节点大小
 */
export async function resizeNode(args: {
  nodeId?: string;
  width?: number;
  height?: number;
}): Promise<string> {
  try {
    // 获取节点
    const nodeId = args.nodeId;
    let node;
    
    if (nodeId) {
      node = figma.getNodeById(nodeId);
      if (!node) {
        throw new Error(`未找到ID为 ${nodeId} 的节点`);
      }
    } else {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        throw new Error("未选中任何节点");
      }
      node = selection[0];
    }
    
    // 确认节点可以调整大小
    if ('resize' in node) {
      const originalWidth = node.width;
      const originalHeight = node.height;
      
      // 如果提供了新尺寸，则调整
      if (args.width !== undefined || args.height !== undefined) {
        const newWidth = args.width !== undefined ? args.width : originalWidth;
        const newHeight = args.height !== undefined ? args.height : originalHeight;
        
        node.resize(newWidth, newHeight);
        
        return JSON.stringify({
          success: true,
          message: `节点已调整大小 (${originalWidth}x${originalHeight} -> ${newWidth}x${newHeight})`,
          nodeId: node.id,
          originalSize: { width: originalWidth, height: originalHeight },
          newSize: { width: newWidth, height: newHeight }
        });
      } else {
        return JSON.stringify({
          success: false,
          error: "未提供新的宽度或高度"
        });
      }
    } else {
      throw new Error("所选节点不支持调整大小");
    }
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * 移动节点
 */
export async function moveNode(args: {
  nodeId?: string;
  x?: number;
  y?: number;
  relative?: boolean;
}): Promise<string> {
  try {
    // 获取节点
    const nodeId = args.nodeId;
    let node;
    
    if (nodeId) {
      node = figma.getNodeById(nodeId);
      if (!node) {
        throw new Error(`未找到ID为 ${nodeId} 的节点`);
      }
    } else {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        throw new Error("未选中任何节点");
      }
      node = selection[0];
    }
    
    // 确认节点可以移动
    if ('x' in node && 'y' in node) {
      const originalX = node.x;
      const originalY = node.y;
      
      // 是否提供了新坐标
      if (args.x !== undefined || args.y !== undefined) {
        // 计算新坐标
        let newX = originalX;
        let newY = originalY;
        
        if (args.relative) {
          // 相对移动
          if (args.x !== undefined) newX += args.x;
          if (args.y !== undefined) newY += args.y;
        } else {
          // 绝对移动
          if (args.x !== undefined) newX = args.x;
          if (args.y !== undefined) newY = args.y;
        }
        
        // 应用新坐标
        node.x = newX;
        node.y = newY;
        
        return JSON.stringify({
          success: true,
          message: `节点已移动 (${originalX},${originalY} -> ${newX},${newY})`,
          nodeId: node.id,
          originalPosition: { x: originalX, y: originalY },
          newPosition: { x: newX, y: newY }
        });
      } else {
        return JSON.stringify({
          success: false,
          error: "未提供新的x或y坐标"
        });
      }
    } else {
      throw new Error("所选节点不支持移动");
    }
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * 将十六进制颜色转换为RGB对象
 */
function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
  // 移除可能的#前缀
  hex = hex.replace(/^#/, '');
  
  // 将3位颜色扩展为6位
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  // 验证格式
  if (hex.length !== 6) {
    console.error(`无效的十六进制颜色: ${hex}`);
    return null;
  }
  
  // 解析RGB值（0-255范围）
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // 转换为Figma使用的0-1范围
  return {
    r: r / 255,
    g: g / 255,
    b: b / 255
  };
} 