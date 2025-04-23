// packages/plugin/src/handlers/figmaFunctions.ts
// Corrected: Added type guards to ensure node is a SceneNode and supports the required operations.

import { hexToRgb } from "../utils/colors";

/**
 * Type guard to check if a node is a SceneNode.
 */
function isSceneNode(node: BaseNode | null): node is SceneNode {
  // SceneNodes have a 'parent' property which is a BaseNode,
  // while DocumentNode and PageNode have null or specific parent types.
  // A more robust check might involve checking for properties common to SceneNodes
  // like 'visible', 'locked', etc., but checking parent type is often sufficient.
  // We also need to ensure it's not the document or a page.
  return node !== null && node.type !== "DOCUMENT" && node.type !== "PAGE";
}

/**
 * Gets the ID(s) of the currently selected node(s).
 * Returns stringified JSON.
 */
export async function getCurrentNodeId(): Promise<string> {
  const selection = figma.currentPage.selection; // selection is already SceneNode[]
  if (selection.length === 0) {
    return JSON.stringify({
      message: "No nodes are currently selected.",
      nodeId: null,
    });
  }
  return JSON.stringify({
    message: `Selected ${selection.length} node(s).`,
    nodeIds: selection.map((node) => node.id),
    primaryNodeId: selection[0].id,
  });
}

/**
 * Creates a rectangle node.
 * Returns stringified JSON result.
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
    // Default position to center of viewport if not provided
    const width = args.width || 100;
    const height = args.height || 100;
    const x = args.x ?? figma.viewport.center.x - width / 2;
    const y = args.y ?? figma.viewport.center.y - height / 2;
    const name = args.name || "Rectangle";

    const rect = figma.createRectangle();
    rect.x = x;
    rect.y = y;
    rect.resize(width, height); // resize is available on RectangleNode
    rect.name = name;

    if (args.fill) {
      const rgb = hexToRgb(args.fill);
      if (rgb) rect.fills = [{ type: "SOLID", color: rgb }];
      else
        console.warn(
          `[figmaFunctions] Invalid fill color provided for rectangle: ${args.fill}`
        );
    }
    if (args.cornerRadius !== undefined) {
      rect.cornerRadius = args.cornerRadius;
    }

    figma.currentPage.appendChild(rect);
    figma.currentPage.selection = [rect];
    figma.viewport.scrollAndZoomIntoView([rect]);

    return JSON.stringify({
      success: true,
      message: `Created rectangle "${name}"`,
      nodeId: rect.id,
    });
  } catch (error) {
    console.error("[figmaFunctions] Error creating rectangle:", error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Creates a frame node.
 * Returns stringified JSON result.
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
    const width = args.width || 300;
    const height = args.height || 200;
    const x = args.x ?? figma.viewport.center.x - width / 2;
    const y = args.y ?? figma.viewport.center.y - height / 2;
    const name = args.name || "Frame";

    const frame = figma.createFrame();
    frame.x = x;
    frame.y = y;
    frame.resize(width, height); // resize is available on FrameNode
    frame.name = name;

    if (args.fill) {
      const rgb = hexToRgb(args.fill);
      if (rgb) frame.fills = [{ type: "SOLID", color: rgb }];
      else
        console.warn(
          `[figmaFunctions] Invalid fill color provided for frame: ${args.fill}`
        );
    } else {
      frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    }

    figma.currentPage.appendChild(frame);
    figma.currentPage.selection = [frame];
    figma.viewport.scrollAndZoomIntoView([frame]);

    return JSON.stringify({
      success: true,
      message: `Created frame "${name}"`,
      nodeId: frame.id,
    });
  } catch (error) {
    console.error("[figmaFunctions] Error creating frame:", error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Creates a text node.
 * Returns stringified JSON result.
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
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });

    const textContent = args.text || "New Text";
    const fontSize = args.fontSize || 14;
    const name = args.name || "Text";
    // Position text based on its potential size if possible, otherwise center
    const tempText = figma.createText();
    tempText.characters = textContent;
    tempText.fontSize = fontSize;
    const textWidth = tempText.width;
    const textHeight = tempText.height;
    tempText.remove(); // Remove temporary node

    const x = args.x ?? figma.viewport.center.x - textWidth / 2;
    const y = args.y ?? figma.viewport.center.y - textHeight / 2;

    const textNode = figma.createText();
    textNode.x = x;
    textNode.y = y;
    textNode.characters = textContent;
    textNode.fontSize = fontSize;
    textNode.name = name;

    if (args.fill) {
      const rgb = hexToRgb(args.fill);
      if (rgb) textNode.fills = [{ type: "SOLID", color: rgb }];
      else
        console.warn(
          `[figmaFunctions] Invalid fill color provided for text: ${args.fill}`
        );
    }

    figma.currentPage.appendChild(textNode);
    figma.currentPage.selection = [textNode];
    figma.viewport.scrollAndZoomIntoView([textNode]);

    return JSON.stringify({
      success: true,
      message: `Created text "${textContent.substring(0, 20)}${
        textContent.length > 20 ? "..." : ""
      }"`,
      nodeId: textNode.id,
    });
  } catch (error) {
    console.error("[figmaFunctions] Error creating text:", error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Takes a screenshot of a node.
 * Returns stringified JSON result containing base64 image data.
 */
export async function screenshotNode(args: {
  nodeId?: string;
  scale?: number;
}): Promise<string> {
  try {
    let node: BaseNode | null = null; // Start with BaseNode
    if (args.nodeId) {
      node = await figma.getNodeByIdAsync(args.nodeId);
      if (!node) throw new Error(`Node not found: ${args.nodeId}`);
    } else {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) throw new Error("No node selected.");
      node = selection[0]; // Selection guarantees SceneNode
    }

    // FIX: Add type guard for SceneNode and ExportMixin
    if (isSceneNode(node) && "exportAsync" in node) {
      const scale = args.scale || 1;
      const pngBytes = await node.exportAsync({
        // Now safe to call
        format: "PNG",
        constraint: { type: "SCALE", value: scale },
      });
      const base64 = figma.base64Encode(pngBytes);

      return JSON.stringify({
        success: true,
        message: `Screenshot generated for node ${node.name || node.id}`,
        nodeId: node.id,
        imageData: `data:image/png;base64,${base64}`,
        width: "width" in node ? node.width : undefined, // Check width/height exist
        height: "height" in node ? node.height : undefined,
      });
    } else {
      // Throw specific error if not exportable
      throw new Error("Selected node type does not support exporting.");
    }
  } catch (error) {
    console.error("[figmaFunctions] Error taking screenshot:", error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Resizes a node.
 * Returns stringified JSON result.
 */
export async function resizeNode(args: {
  nodeId?: string;
  width?: number;
  height?: number;
}): Promise<string> {
  try {
    let node: BaseNode | null = null; // Start with BaseNode
    if (args.nodeId) {
      node = await figma.getNodeByIdAsync(args.nodeId);
      if (!node) throw new Error(`Node not found: ${args.nodeId}`);
    } else {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) throw new Error("No node selected.");
      node = selection[0]; // Selection guarantees SceneNode
    }

    // FIX: Add type guard for SceneNode and methods/properties
    if (
      isSceneNode(node) &&
      "resize" in node &&
      "width" in node &&
      "height" in node
    ) {
      const originalWidth = node.width;
      const originalHeight = node.height;

      if (args.width === undefined && args.height === undefined) {
        throw new Error("No new width or height provided for resize.");
      }

      const newWidth = args.width !== undefined ? args.width : originalWidth;
      const newHeight =
        args.height !== undefined ? args.height : originalHeight;

      if (newWidth <= 0 || newHeight <= 0) {
        throw new Error("Width and height must be positive values.");
      }

      node.resize(newWidth, newHeight); // Now safe to call

      return JSON.stringify({
        success: true,
        message: `Node resized (${originalWidth.toFixed(
          0
        )}x${originalHeight.toFixed(0)} -> ${newWidth.toFixed(
          0
        )}x${newHeight.toFixed(0)})`,
        nodeId: node.id,
        originalSize: { width: originalWidth, height: originalHeight },
        newSize: { width: newWidth, height: newHeight },
      });
    } else {
      // Throw specific error if not resizable
      throw new Error(
        "Selected node type does not support resizing or lacks dimensions."
      );
    }
  } catch (error) {
    console.error("[figmaFunctions] Error resizing node:", error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Moves a node.
 * Returns stringified JSON result.
 */
export async function moveNode(args: {
  nodeId?: string;
  x?: number;
  y?: number;
  relative?: boolean;
}): Promise<string> {
  try {
    let node: BaseNode | null = null; // Start with BaseNode
    if (args.nodeId) {
      node = await figma.getNodeByIdAsync(args.nodeId);
      if (!node) throw new Error(`Node not found: ${args.nodeId}`);
    } else {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) throw new Error("No node selected.");
      node = selection[0]; // Selection guarantees SceneNode
    }

    // FIX: Add type guard for SceneNode and properties
    if (isSceneNode(node) && "x" in node && "y" in node) {
      const originalX = node.x;
      const originalY = node.y;

      if (args.x === undefined && args.y === undefined) {
        throw new Error("No new x or y coordinate provided for move.");
      }

      let newX = originalX;
      let newY = originalY;

      if (args.relative) {
        if (args.x !== undefined) newX += args.x;
        if (args.y !== undefined) newY += args.y;
      } else {
        if (args.x !== undefined) newX = args.x;
        if (args.y !== undefined) newY = args.y;
      }

      // Assigning x/y is safe now due to type guard
      node.x = newX;
      node.y = newY;

      return JSON.stringify({
        success: true,
        message: `Node moved (${originalX.toFixed(0)},${originalY.toFixed(
          0
        )} -> ${newX.toFixed(0)},${newY.toFixed(0)})`,
        nodeId: node.id,
        originalPosition: { x: originalX, y: originalY },
        newPosition: { x: newX, y: newY },
      });
    } else {
      // Throw specific error if not movable
      throw new Error(
        "Selected node type does not support moving or lacks coordinates."
      );
    }
  } catch (error) {
    console.error("[figmaFunctions] Error moving node:", error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}


/**
 * Detects all nodes on the current screen
 */
export async function detectAllNodes(): Promise<string> {
  try {
    // Get the current page
    const currentPage = figma.currentPage;
    
    
    // Get all top-level nodes
    const topLevelNodes = currentPage.children;
    
    // Collect all nodes including nested ones
    const allNodes: SceneNode[] = [];
    topLevelNodes.forEach(node => {
      allNodes.push(...getAllNodes(node));
    });
    
    // Create a simpler representation to send to the UI
    const nodeData = allNodes.map(node => ({
      id: node.id,
      name: node.name,
      type: node.type,
      content: node.type === "TEXT" ? (node as TextNode).characters : "",
      // Additional properties is necessary
    }));
    
    console.log("node data", nodeData);
    
    // TODO: send data to backend
    
    return JSON.stringify({
      success: true,
      nodes: nodeData,
      details: allNodes
    });
  } catch (error) {
    console.error("Error detecting nodes:", error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/** 
 * Helper function
 * Get all nodes (including nested ones)
 */
function getAllNodes(node: SceneNode): SceneNode[] {
  let nodes: SceneNode[] = [node];
  
  if ("children" in node) {
    for (const child of node.children) {
      nodes = nodes.concat(getAllNodes(child));
    }
  }
  
  return nodes;
}

/**
 * Track user activities
 * @returns stringified node details
 */
// TODO: determine if we want to add time constraints
export async function trackUserActivity(): Promise<string> {
  try {
    let activityList = []; // track a series of user activities
    
    // Set up selection change listener
    figma.on('selectionchange', async () => {
      const selection = figma.currentPage.selection;
      
      // If nothing is selected, don't do anything
      if (selection.length === 0) {
        return;
      }
      console.log("selections: ", selection);
      
      // Process all selected items
      let selectionDetails = [];
      for (let item of selection) {
        // const content = await getDetailedNodeContent(item);
        // const coords = await getCoordinates(item);
        let details = getAllNodes(item);
        
        selectionDetails.push({
          node: item.id,
          content: details
        });
        
      }
      
      // Add to activity list
      activityList.push({
        timestamp: new Date().toISOString(),
        action: "selection",
        details: selectionDetails
      });
      
      
    });
    
    // Send to agent
    return JSON.stringify({
      success: true,
      message: "User activity tracking initialized",
      data: {
        status: "active",
        trackedEvents: ["selectionchange"]
      }
    });
  } catch (error) {
    console.error("[figmaFunctions] Error initializing activity tracking:", error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}