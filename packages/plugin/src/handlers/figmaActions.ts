import { FunctionCallArguments, ActionResultPayload } from "../types";
import { mapColorNameToPaint, figJamColorMap, calculateRelativePosition } from "../utils";

/**
 * 处理创建便签的操作
 * @param args - 从 AI 获取的参数
 * @returns Promise<ActionResultPayload> - 执行结果对象
 */
export async function handleCreateStickyNote(args: FunctionCallArguments): Promise<ActionResultPayload> {
  console.log("[figmaActions.ts] Handling createStickyNote with args:", args);
  if (figma.editorType !== "figjam") {
    const errorMsg = "创建便签功能仅在 FigJam 中可用。";
    console.warn(`[figmaActions.ts] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  try {
    const text = (args.text as string) || "新便签";
    const requestedColor = args.color as string | null; // 让 mapColorNameToPaint 处理 null 和无效值
    const x = args.x as number | null;
    const y = args.y as number | null;
    const relativeToNodeId = args.relativeToNodeId as string | null;
    const positionRelation = args.positionRelation as string | null;

    console.log(`[figmaActions.ts] createStickyNote - Parsed args: text='${text}', color='${requestedColor}', x=${x}, y=${y}, relativeTo='${relativeToNodeId}', relation='${positionRelation}'`);

    // 1. 创建节点
    const sticky = figma.createSticky();
    console.log(`[figmaActions.ts] Created sticky node: ${sticky.id}`);

    // 2. 设置文本 (健壮的字体加载)
    let fontLoaded = false;
    try {
      console.log("[figmaActions.ts] Attempting to load font: Inter Medium");
      await figma.loadFontAsync({ family: "Inter", style: "Medium" });
      fontLoaded = true;
    } catch (fontError) {
      console.warn("[figmaActions.ts] Failed to load Inter Medium, trying Inter Regular:", fontError);
      try {
        console.log("[figmaActions.ts] Attempting to load font: Inter Regular");
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
        fontLoaded = true;
      } catch (fallbackError) {
        console.error("[figmaActions.ts] Failed to load fallback font Inter Regular:", fallbackError);
        figma.notify("无法加载所需字体，文本可能显示不正确。", { error: true, timeout: 5000 });
      }
    }
    if (fontLoaded) {
      sticky.text.characters = text;
      console.log(`[figmaActions.ts] Set sticky text: "${text}"`);
    } else {
       console.warn("[figmaActions.ts] Font not loaded, setting text might not render correctly.");
       sticky.text.characters = text; // 仍然尝试设置
    }

    // 3. 设置颜色
    const paint = mapColorNameToPaint(requestedColor); // 使用工具函数
    sticky.fills = [paint]; // mapColorNameToPaint 保证返回有效的 Paint 或默认值
    console.log(`[figmaActions.ts] Set sticky color. Requested: '${requestedColor}', Applied RGB:`, paint.color);

    // 4. 设置位置
    let finalX: number;
    let finalY: number;

    if (relativeToNodeId) {
      console.log(`[figmaActions.ts] Calculating position relative to node: ${relativeToNodeId}`);
      const referenceNode = await figma.getNodeByIdAsync(relativeToNodeId);

      // 类型守卫: 确保 referenceNode 是 SceneNode 并且有 absoluteBoundingBox
      if (referenceNode && 'absoluteBoundingBox' in referenceNode && referenceNode.absoluteBoundingBox) {
        const pos = calculateRelativePosition(
          referenceNode.absoluteBoundingBox, // 现在类型安全了
          positionRelation,
          sticky.width,
          sticky.height
        );
        finalX = pos.x;
        finalY = pos.y;
        console.log(`[figmaActions.ts] Calculated relative position: x=${finalX.toFixed(0)}, y=${finalY.toFixed(0)}`);
      } else {
        console.warn(`[figmaActions.ts] Relative node ${relativeToNodeId} not found, not a SceneNode, or has no bounds. Placing at viewport center.`);
        const viewportCenter = figma.viewport.center;
        finalX = viewportCenter.x - sticky.width / 2;
        finalY = viewportCenter.y - sticky.height / 2;
      }
    } else if (x !== null && y !== null) {
      console.log(`[figmaActions.ts] Using absolute position: x=${x}, y=${y}`);
      finalX = x;
      finalY = y;
    } else {
      console.log("[figmaActions.ts] No position specified. Placing at viewport center.");
      const viewportCenter = figma.viewport.center;
      finalX = viewportCenter.x - sticky.width / 2;
      finalY = viewportCenter.y - sticky.height / 2;
    }

    sticky.x = finalX;
    sticky.y = finalY;
    console.log(`[figmaActions.ts] Set final sticky position: x=${sticky.x.toFixed(0)}, y=${sticky.y.toFixed(0)}`);

    // 5. 选中并缩放
    figma.currentPage.selection = [sticky];
    figma.viewport.scrollAndZoomIntoView([sticky]);
    console.log(`[figmaActions.ts] Selected and zoomed to new sticky: ${sticky.id}`);

    // 6. 返回成功结果
    const successMessage = `已创建${mapPaintToColorName(paint)}便签，内容为 "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"。`;
    console.log("[figmaActions.ts] handleCreateStickyNote successful.");
    return { success: true, nodeId: sticky.id, data: successMessage };

  } catch (error) {
    console.error("[figmaActions.ts] Error in handleCreateStickyNote:", error);
    return { success: false, error: `创建便签时出错: ${error instanceof Error ? error.message : "未知内部错误"}` };
  }
}

/**
* 辅助函数：将 SolidPaint 映射回大概的颜色名称（用于反馈）
*/
export function mapPaintToColorName(paint: SolidPaint): string {
   // 确保从 utils/colors.ts 导入了 figJamColorMap
   if (!figJamColorMap) {
     console.error("[figmaActions.ts] figJamColorMap is not defined. Make sure it's properly imported.");
     return "彩色";
   }
   
   // 这只是一个简单的反向查找示例，可能不完全准确
   // 你可能需要更复杂的颜色距离计算
   const colors = Object.entries(figJamColorMap) as [string, RGB][];
   let closestColorName: string = 'GRAY'; // 默认灰色
   let minDistance = Infinity;

   const targetColor = paint.color;

   for (const [name, rgb] of colors) {
       // 简单的欧几里得距离平方计算
       const distance = Math.pow(targetColor.r - rgb.r, 2) +
                        Math.pow(targetColor.g - rgb.g, 2) +
                        Math.pow(targetColor.b - rgb.b, 2);
       if (distance < minDistance) {
           minDistance = distance;
           closestColorName = name;
       }
   }
   // 如果距离非常小，认为是精确匹配
   if (minDistance < 0.01) {
       return closestColorName.toLowerCase().replace('_', ' ');
   }
   // 否则，可以返回一个近似描述或 HEX 值
   const hex = `#${Math.round(targetColor.r * 255).toString(16).padStart(2, '0')}${Math.round(targetColor.g * 255).toString(16).padStart(2, '0')}${Math.round(targetColor.b * 255).toString(16).padStart(2, '0')}`;
   return `颜色 (${hex}) `; // 返回 HEX
}

// --- 在这里添加其他 handleXXX 函数的实现 ---
// export async function handleCreateShapeWithText(args: FunctionCallArguments): Promise<ActionResultPayload> { ... }
// export async function handleCreateConnector(args: FunctionCallArguments): Promise<ActionResultPayload> { ... }
// ...等等 