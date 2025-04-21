/**
 * Calculates relative position for placing new nodes.
 */
export function calculateRelativePosition(
  targetBounds: { x: number; y: number; width: number; height: number },
  relation: string | null,
  newNodeWidth: number,
  newNodeHeight: number
): { x: number; y: number } {
  const gap = 30; // Default gap
  let x = targetBounds.x;
  let y = targetBounds.y;

  switch (relation?.toUpperCase()) {
    case "RIGHT":
      x = targetBounds.x + targetBounds.width + gap;
      y = targetBounds.y + targetBounds.height / 2 - newNodeHeight / 2; // Align vertically center
      break;
    case "LEFT":
      x = targetBounds.x - newNodeWidth - gap;
      y = targetBounds.y + targetBounds.height / 2 - newNodeHeight / 2; // Align vertically center
      break;
    case "BELOW":
      x = targetBounds.x + targetBounds.width / 2 - newNodeWidth / 2; // Align horizontally center
      y = targetBounds.y + targetBounds.height + gap;
      break;
    case "ABOVE":
      x = targetBounds.x + targetBounds.width / 2 - newNodeWidth / 2; // Align horizontally center
      y = targetBounds.y - newNodeHeight - gap;
      break;
    case "NEAR": // Treat NEAR as RIGHT for now
    default:
      x = targetBounds.x + targetBounds.width + gap;
      y = targetBounds.y + targetBounds.height / 2 - newNodeHeight / 2;
      break;
  }
  console.log(
    `[position.ts] Calculated relative position for relation '${relation}': { x: ${x.toFixed(
      0
    )}, y: ${y.toFixed(0)} } based on target bounds:`,
    targetBounds
  );
  return { x, y };
}
