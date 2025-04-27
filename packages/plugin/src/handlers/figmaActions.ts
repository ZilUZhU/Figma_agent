// packages/plugin/src/handlers/figmaActions.ts
// Restored: Contains only the specific action handlers like createStickyNote.
// Imports utilities from the utils directory.
import { FunctionCallArguments, ActionResultPayload } from "../types";
import {
  mapColorNameToPaint, // Import from utils
  mapPaintToColorName, // Import from utils
  calculateRelativePosition, // Import from utils
} from "../utils";

/**
 * Handles the 'createStickyNote' action.
 * @param args - Parsed arguments from the AI function call.
 * @returns Promise<ActionResultPayload> - Result object for the action.
 */
export async function handleCreateStickyNote(
  args: FunctionCallArguments
): Promise<ActionResultPayload> {
  console.log("[figmaActions] Handling createStickyNote with args:", args);
  if (figma.editorType !== "figjam") {
    const errorMsg = "Create sticky note action is only available in FigJam.";
    console.warn(`[figmaActions] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  try {
    // Validate and extract arguments
    const text = typeof args.text === "string" ? args.text : "New Sticky";
    const requestedColor =
      typeof args.color === "string" || args.color === null ? args.color : null;
    const x = typeof args.x === "number" ? args.x : null;
    const y = typeof args.y === "number" ? args.y : null;
    const relativeToNodeId =
      typeof args.relativeToNodeId === "string" ? args.relativeToNodeId : null;
    const positionRelation =
      typeof args.positionRelation === "string" ? args.positionRelation : null;

    console.log(
      `[figmaActions] Parsed args: text='${text}', color='${requestedColor}', x=${x}, y=${y}, relativeTo='${relativeToNodeId}', relation='${positionRelation}'`
    );

    // 1. Create node
    const sticky = figma.createSticky();
    console.log(`[figmaActions] Created sticky node: ${sticky.id}`);

    // 2. Set text (with robust font loading)
    let fontLoaded = false;
    try {
      await figma.loadFontAsync({ family: "Inter", style: "Medium" });
      fontLoaded = true;
    } catch (fontError) {
      console.warn(
        "[figmaActions] Failed to load Inter Medium, trying Inter Regular:",
        fontError
      );
      try {
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
        fontLoaded = true;
      } catch (fallbackError) {
        console.error(
          "[figmaActions] Failed to load fallback font Inter Regular:",
          fallbackError
        );
        figma.notify(
          "Could not load required font, text might not display correctly.",
          { error: true }
        );
      }
    }
    if (fontLoaded) {
      sticky.text.characters = text;
      console.log(`[figmaActions] Set sticky text: "${text}"`);
    } else {
      sticky.text.characters = text; // Attempt to set anyway
    }

    // 3. Set color (using utility)
    const paint = mapColorNameToPaint(requestedColor); // Use util
    sticky.fills = [paint];
    console.log(
      `[figmaActions] Set sticky color. Requested: '${requestedColor}', Applied RGB:`,
      paint.color
    );

    // 4. Set position (using utility)
    let finalX: number;
    let finalY: number;

    if (relativeToNodeId) {
      console.log(
        `[figmaActions] Calculating position relative to node: ${relativeToNodeId}`
      );
      const referenceNode = await figma.getNodeByIdAsync(relativeToNodeId);

      if (
        referenceNode &&
        "absoluteBoundingBox" in referenceNode &&
        referenceNode.absoluteBoundingBox
      ) {
        const pos = calculateRelativePosition(
          // Use util
          referenceNode.absoluteBoundingBox,
          positionRelation,
          sticky.width,
          sticky.height
        );
        finalX = pos.x;
        finalY = pos.y;
        console.log(
          `[figmaActions] Calculated relative position: x=${finalX.toFixed(
            0
          )}, y=${finalY.toFixed(0)}`
        );
      } else {
        console.warn(
          `[figmaActions] Relative node ${relativeToNodeId} not found or invalid. Placing at viewport center.`
        );
        const viewportCenter = figma.viewport.center;
        finalX = viewportCenter.x - sticky.width / 2;
        finalY = viewportCenter.y - sticky.height / 2;
      }
    } else if (x !== null && y !== null) {
      console.log(`[figmaActions] Using absolute position: x=${x}, y=${y}`);
      finalX = x;
      finalY = y;
    } else {
      console.log(
        "[figmaActions] No position specified. Placing at viewport center."
      );
      const viewportCenter = figma.viewport.center;
      finalX = viewportCenter.x - sticky.width / 2;
      finalY = viewportCenter.y - sticky.height / 2;
    }

    sticky.x = finalX;
    sticky.y = finalY;
    console.log(
      `[figmaActions] Set final sticky position: x=${sticky.x.toFixed(
        0
      )}, y=${sticky.y.toFixed(0)}`
    );

    // 5. Select and zoom
    figma.currentPage.selection = [sticky];
    figma.viewport.scrollAndZoomIntoView([sticky]);
    console.log(
      `[figmaActions] Selected and zoomed to new sticky: ${sticky.id}`
    );

    // 6. Return success
    const successMessage = `Created ${mapPaintToColorName(
      paint
    )} sticky note with text "${text.substring(0, 20)}${
      text.length > 20 ? "..." : ""
    }".`; // Use util
    console.log("[figmaActions] handleCreateStickyNote successful.");
    return { success: true, nodeId: sticky.id, data: successMessage };
  } catch (error) {
    console.error("[figmaActions] Error in handleCreateStickyNote:", error);
    return {
      success: false,
      error: `Error creating sticky note: ${
        error instanceof Error ? error.message : "Unknown internal error"
      }`,
    };
  }
}

// Add other specific action handlers here as needed, e.g.:
// export async function handleDeleteNode(args: { nodeId: string }): Promise<ActionResultPayload> { ... }

/**
 * Handles the 'detectAllNodes' action.
 * @param args - Parsed arguments from the AI function call.
 * @returns Promise<ActionResultPayload> - Result object containing detected nodes.
 */
export async function handleDetectAllNodes(
  args: FunctionCallArguments
): Promise<ActionResultPayload> {
  console.log("[figmaActions] Handling detectAllNodes with args:", args);

  try {
    // Validate and extract arguments
    const nodeTypes =
      Array.isArray(args.nodeTypes) && args.nodeTypes.every((t) => typeof t === "string")
        ? args.nodeTypes
        : null;
    const includeHidden = false;
      // typeof args.includeHidden === "boolean" ? args.includeHidden : false;
    const parentNodeId =
      typeof args.parentNodeId === "string" ? args.parentNodeId : null;

    console.log(
      `[figmaActions] Parsed args: nodeTypes=${JSON.stringify(
        nodeTypes
      )}, includeHidden=${includeHidden}, parentNodeId=${parentNodeId}`
    );

    // 1. Determine the search root
    let allFoundNodes: readonly BaseNode[];
    if (parentNodeId) {
      console.log(`[figmaActions] Searching under parent node: ${parentNodeId}`);
      const parentNode = await figma.getNodeByIdAsync(parentNodeId);
      if (parentNode && "findAll" in parentNode) {
        allFoundNodes = parentNode.findAll(() => true);
      } else {
        const errorMsg = `Parent node ${parentNodeId} not found or invalid.`;
        console.warn(`[figmaActions] ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
    } else {
      console.log("[figmaActions] Searching across the entire current page.");
      allFoundNodes = figma.currentPage.findAll(() => true);
    }

    // 2. Filter to SceneNodes only
    const rootNodes: SceneNode[] = allFoundNodes.filter(
      (node): node is SceneNode => node.type !== "PAGE"
    );
    // 3. Apply filters
    const filteredNodes = rootNodes.filter((node) => {
      if (!includeHidden && node.visible === false) {
        return false;
      }
      if (nodeTypes && !nodeTypes.includes(node.type)) {
        return false;
      }
      return true;
    });

    console.log(
      `[figmaActions] Found ${filteredNodes.length} matching nodes after filters.`
    );

    // 3. Construct node summaries
    const nodeSummaries = filteredNodes.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
    }));

    console.log("[figmaActions] Constructed node summaries.");

    // 4. Return success
    return {
      success: true,
      data: {
        count: nodeSummaries.length,
        nodes: nodeSummaries,
      },
    };
  } catch (error) {
    console.error("[figmaActions] Error in handleDetectAllNodes:", error);
    return {
      success: false,
      error: `Error detecting nodes: ${
        error instanceof Error ? error.message : "Unknown internal error"
      }`,
    };
  }
}



/**
 * Handles the 'createText' action.
 * @param args - Parsed arguments from the AI function call.
 * @returns Promise<ActionResultPayload> - Result object containing created text node info.
 */
export async function handleCreateText(
  args: FunctionCallArguments
): Promise<ActionResultPayload> {
  console.log("[figmaActions] Handling createText with args:", args);

  try {
    if (figma.editorType !== "figma") {
      const errorMsg = "Create text action is only available in Figma (not FigJam).";
      console.warn(`[figmaActions] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // Validate and extract arguments
    const content = typeof args.text === "string" ? args.text : "New Text";
    const fontSize = typeof args.fontsize === "number" ? args.fontsize : 12;
    const x = typeof args.x === "number" ? args.x : null;
    const y = typeof args.y === "number" ? args.y : null;
    const relativeToNodeId =
      typeof args.relativeToNodeId === "string" ? args.relativeToNodeId : null;
    const positionRelation =
      typeof args.positionRelation === "string" ? args.positionRelation : null;

    console.log(
      `[figmaActions] Parsed args: content='${content}', fontSize=${fontSize}, x=${x}, y=${y}, relativeTo='${relativeToNodeId}', relation='${positionRelation}'`
    );

    // 1. Create node
    const textNode = figma.createText();
    console.log(`[figmaActions] Created text node: ${textNode.id}`);

    // 2. Load font before setting text
    let fontLoaded = false;
    try {
      await figma.loadFontAsync({ family: "Inter", style: "Medium" });
      fontLoaded = true;
    } catch (fontError) {
      console.error("[figmaActions] Failed to load font Inter Medium:", fontError);
      figma.notify("Could not load required font for text.", { error: true });
    }
    if (fontLoaded) {
      textNode.characters = content;
      textNode.fontSize = fontSize;
      console.log(`[figmaActions] Set text content and font size.`);
    }

    // 3. Set position
    let finalX: number;
    let finalY: number;

    if (relativeToNodeId) {
      console.log(`[figmaActions] Calculating position relative to node: ${relativeToNodeId}`);
      const referenceNode = await figma.getNodeByIdAsync(relativeToNodeId);

      if (
        referenceNode &&
        "absoluteBoundingBox" in referenceNode &&
        referenceNode.absoluteBoundingBox
      ) {
        const pos = calculateRelativePosition(
          referenceNode.absoluteBoundingBox,
          positionRelation,
          textNode.width,
          textNode.height
        );
        finalX = pos.x;
        finalY = pos.y;
        console.log(
          `[figmaActions] Calculated relative position: x=${finalX.toFixed(
            0
          )}, y=${finalY.toFixed(0)}`
        );
      } else {
        console.warn(
          `[figmaActions] Relative node ${relativeToNodeId} not found or invalid. Placing at viewport center.`
        );
        const viewportCenter = figma.viewport.center;
        finalX = viewportCenter.x;
        finalY = viewportCenter.y;
      }
    } else if (x !== null && y !== null) {
      console.log(`[figmaActions] Using absolute position: x=${x}, y=${y}`);
      finalX = x;
      finalY = y;
    } else {
      console.log("[figmaActions] No position specified. Placing at viewport center.");
      const viewportCenter = figma.viewport.center;
      finalX = viewportCenter.x;
      finalY = viewportCenter.y;
    }

    textNode.x = finalX;
    textNode.y = finalY;
    console.log(
      `[figmaActions] Set final text position: x=${textNode.x.toFixed(0)}, y=${textNode.y.toFixed(
        0
      )}`
    );

    // 4. Select and zoom
    figma.currentPage.selection = [textNode];
    figma.viewport.scrollAndZoomIntoView([textNode]);
    console.log(`[figmaActions] Selected and zoomed to new text node: ${textNode.id}`);

    // 5. Return success
    const successMessage = `Created text node with content "${content.substring(0, 20)}${
      content.length > 20 ? "..." : ""
    }".`;
    console.log("[figmaActions] handleCreateText successful.");
    return { success: true, nodeId: textNode.id, data: successMessage };
  } catch (error) {
    console.error("[figmaActions] Error in handleCreateText:", error);
    return {
      success: false,
      error: `Error creating text node: ${
        error instanceof Error ? error.message : "Unknown internal error"
      }`,
    };
  }
}



/**
 * Handles the 'trackUserActivity' action.
 * @param args - Parsed arguments from the AI function call (not used here).
 * @returns Promise<ActionResultPayload> - Result object for activity tracking initialization.
 */
export async function handleTrackUserActivity(
  args: FunctionCallArguments
): Promise<ActionResultPayload> {
  console.log("[figmaActions] Handling trackUserActivity with args:", args);

  try {
    let activityList: any[] = []; // Will track user activities
    console.log("[figmaActions] Initialized empty activityList.");

    figma.on("selectionchange", async () => {
      const selection = figma.currentPage.selection;

      if (selection.length === 0) {
        console.log("[figmaActions] No selection detected, skipping.");
        return;
      }

      console.log("[figmaActions] Selection changed:", selection);

      let selectionDetails: any[] = [];

      for (const item of selection) {
        const details = getAllNodes(item); // Assuming you want simple info
        selectionDetails.push({
          node: item.id,
          content: details,
        });
      }

      // Add activity record
      activityList.push({
        timestamp: new Date().toISOString(),
        action: "selection",
        details: selectionDetails,
      });

      console.log("[figmaActions] Activity logged:", activityList[activityList.length - 1]);
    });

    console.log("[figmaActions] Event listener for selectionchange registered.");

    return {
      success: true,
      data: {
        status: "active",
        message: "User activity tracking initialized successfully.",
        trackedEvents: ["selectionchange"],
      },
    };
  } catch (error) {
    console.error("[figmaActions] Error in handleTrackUserActivity:", error);
    return {
      success: false,
      error: `Error initializing user activity tracking: ${
        error instanceof Error ? error.message : "Unknown internal error"
      }`,
    };
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