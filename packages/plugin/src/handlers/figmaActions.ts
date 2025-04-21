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
