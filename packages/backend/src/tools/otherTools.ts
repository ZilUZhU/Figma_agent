/**
 * Tool Definition to all other tools
 */
import { Tool } from "../types";

/**
 * Tool Definition: Create Rectangle
 */
export const createRectangleTool: Tool = {
  type: "function",
  name: "createRectangle",
  description:
    "Creates a rectangle node on the Figma canvas with customizable size, position, fill color, and corner radius. Places it at the specified location or centers it by default.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      x: {
        type: ["number", "null"],
        description:
          "Absolute X coordinate on the canvas for the rectangle's top-left corner. Defaults to centering horizontally if null.",
      },
      y: {
        type: ["number", "null"],
        description:
          "Absolute Y coordinate on the canvas for the rectangle's top-left corner. Defaults to centering vertically if null.",
      },
      width: {
        type: "number",
        description: "The width of the rectangle in pixels. Must be a positive number.",
      },
      height: {
        type: "number",
        description: "The height of the rectangle in pixels. Must be a positive number.",
      },
      fill: {
        type: ["string", "null"],
        description:
          "Optional fill color in hex format (e.g., '#FF0000'). If omitted or invalid, default fill will be applied.",
      },
      cornerRadius: {
        type: ["number", "null"],
        description:
          "Optional corner radius in pixels to round the rectangle's corners. Defaults to 0 if null.",
      },
      name: {
        type: ["string", "null"],
        description:
          "Optional name to assign to the rectangle node. Defaults to 'Rectangle' if null.",
      },
    },
    required: ["width", "height", "x", "y", "fill", "cornerRadius", "name"],
    additionalProperties: false,
  },
};


/**
 * Tool Definition: Create Frame
 */
export const createFrameTool: Tool = {
  type: "function",
  name: "createFrame",
  description:
    "Creates a frame node on the Figma canvas with customizable size, position, name, and optional fill color. Places it at the specified location or centers it by default.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      x: {
        type: ["number", "null"],
        description:
          "Absolute X coordinate on the canvas for the frame's top-left corner. Defaults to centering horizontally if null.",
      },
      y: {
        type: ["number", "null"],
        description:
          "Absolute Y coordinate on the canvas for the frame's top-left corner. Defaults to centering vertically if null.",
      },
      width: {
        type: "number",
        description: "The width of the frame in pixels. Must be a positive number.",
      },
      height: {
        type: "number",
        description: "The height of the frame in pixels. Must be a positive number.",
      },
      name: {
        type: ["string", "null"],
        description:
          "Optional name to assign to the frame node. Defaults to 'Frame' if null.",
      },
      fill: {
        type: ["string", "null"],
        description:
          "Optional fill color for the frame in hex format (e.g., '#FFFFFF'). Defaults to white if not provided.",
      },
    },
    required: ["width", "height", "x", "y", "name", "fill"],
    additionalProperties: false,
  },
};
