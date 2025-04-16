/**
 * 计算相对位置
 * @param targetBounds - 目标节点的边界矩形
 * @param relation - 相对位置关系
 * @param newNodeWidth - 新节点的宽度
 * @param newNodeHeight - 新节点的高度
 * @returns 新节点应该放置的位置坐标
 */
export function calculateRelativePosition(
  targetBounds: { x: number; y: number; width: number; height: number },
  relation: string | null,
  newNodeWidth: number,
  newNodeHeight: number
): { x: number; y: number } {
  const gap = 30; // 默认间距
  let x = targetBounds.x;
  let y = targetBounds.y;

  switch (relation?.toUpperCase()) {
    case 'RIGHT':
      x = targetBounds.x + targetBounds.width + gap;
      y = targetBounds.y + (targetBounds.height / 2) - (newNodeHeight / 2); // 垂直居中对齐
      break;
    case 'LEFT':
      x = targetBounds.x - newNodeWidth - gap;
      y = targetBounds.y + (targetBounds.height / 2) - (newNodeHeight / 2); // 垂直居中对齐
      break;
    case 'BELOW':
      x = targetBounds.x + (targetBounds.width / 2) - (newNodeWidth / 2); // 水平居中对齐
      y = targetBounds.y + targetBounds.height + gap;
      break;
    case 'ABOVE':
      x = targetBounds.x + (targetBounds.width / 2) - (newNodeWidth / 2); // 水平居中对齐
      y = targetBounds.y - newNodeHeight - gap;
      break;
    case 'NEAR':
    default: // 默认放在右侧垂直居中
      x = targetBounds.x + targetBounds.width + gap;
      y = targetBounds.y + (targetBounds.height / 2) - (newNodeHeight / 2);
      break;
  }
  console.log(`[position.ts] Calculated relative position for relation '${relation}': { x: ${x.toFixed(0)}, y: ${y.toFixed(0)} } based on target bounds:`, targetBounds);
  return { x, y };
} 