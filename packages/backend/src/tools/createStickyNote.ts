/**
 * Tool Definition: Create Sticky Note
 */
import { Tool } from "../types";
export const createStickyNoteTool: Tool = {
  type: "function",
  name: "createStickyNote",
  description:
    "Creates a new sticky note on the FigJam canvas. Places it near the center of the current view or relative to another node if specified.",
  strict: true, // Ensure strict mode is explicitly defined
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The text content to write on the sticky note.",
      },
      color: {
        type: ["string", "null"],
        description:
          "The color of the sticky note. Defaults to YELLOW if null. Use standard FigJam color names (e.g., 'BLUE', 'LIGHT_GREEN').",
        enum: [
          null,
          "GRAY",
          "LIGHT_GRAY",
          "BLUE",
          "LIGHT_BLUE",
          "GREEN",
          "LIGHT_GREEN",
          "YELLOW",
          "LIGHT_YELLOW",
          "PINK",
          "VIOLET",
          "LIGHT_VIOLET",
          "ORANGE",
          "LIGHT_ORANGE",
          "RED",
          "LIGHT_RED",
          "WHITE",
          "BLACK",
        ],
      },
      x: {
        type: ["number", "null"],
        description:
          "Absolute X coordinate on the canvas for the center of the new sticky note. If null or relativeToNodeId is set, position might be calculated automatically.",
      },
      y: {
        type: ["number", "null"],
        description:
          "Absolute Y coordinate on the canvas for the center of the new sticky note. If null or relativeToNodeId is set, position might be calculated automatically.",
      },
      relativeToNodeId: {
        type: ["string", "null"],
        description:
          "Optional ID of an existing node to place the new sticky note relative to. If provided, explicit x and y might be ignored or used as offsets depending on client implementation.",
      },
      positionRelation: {
        type: ["string", "null"],
        description:
          "Describes the placement relative to 'relativeToNodeId' (e.g., 'RIGHT', 'BELOW'). Used only if 'relativeToNodeId' is set.",
        enum: [null, "RIGHT", "LEFT", "ABOVE", "BELOW", "NEAR"],
      },
    },
    required: [
      "text",
      "color",
      "x",
      "y",
      "relativeToNodeId",
      "positionRelation",
    ],
    additionalProperties: false,
  },
};
