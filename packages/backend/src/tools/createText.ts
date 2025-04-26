/**
 * Tool Definition: Create Text Node
 */
import { Tool } from "../types";

export const createTextTool: Tool = {
  type: "function",
  name: "createText",
  description:
    "Creates a new text node on the Figma canvas. Places it near the center of the current view or relative to another node if specified. Allows setting initial text content and font size.",
  strict: true, // Ensure strict mode is explicitly defined
  parameters: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "The text content to write inside the new text node.",
      },
      fontSize: {
        type: ["number", "null"],
        description:
          "The font size to apply to the text content. Defaults to 12 if null.",
      },
      x: {
        type: ["number", "null"],
        description:
          "Absolute X coordinate on the canvas for the center of the new text node. If null or relativeToNodeId is set, position might be calculated automatically.",
      },
      y: {
        type: ["number", "null"],
        description:
          "Absolute Y coordinate on the canvas for the center of the new text node. If null or relativeToNodeId is set, position might be calculated automatically.",
      },
      relativeToNodeId: {
        type: ["string", "null"],
        description:
          "Optional ID of an existing node to place the new text node relative to. If provided, explicit x and y might be ignored or used as offsets depending on client implementation.",
      },
      positionRelation: {
        type: ["string", "null"],
        description:
          "Describes the placement relative to 'relativeToNodeId' (e.g., 'RIGHT', 'BELOW'). Used only if 'relativeToNodeId' is set.",
        enum: [null, "RIGHT", "LEFT", "ABOVE", "BELOW", "NEAR"],
      },
    },
    required: [
      "content",
      "fontSize",
      "x",
      "y",
      "relativeToNodeId",
      "positionRelation",
    ],
    additionalProperties: false,
  },
};
