/**
 * Tool Definition: Detect All Nodes
 */
import { Tool } from "../types";

export const detectAllNodesTool: Tool = {
  type: "function",
  name: "detectAllNodes",
  description:
    "Scans the current FigJam or Figma canvas and retrieves metadata for all available nodes. Useful for automation tasks, bulk updates, or inventory purposes.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      nodeTypes: {
        type: ["array", "null"],
        description:
          "Optional list of node types to filter the results (e.g., 'RECTANGLE', 'TEXT', 'STICKY'). If null, all node types are included.",
        items: {
          type: "string",
        },
      },
      includeHidden: {
        type: ["boolean", "null"],
        description:
          "Whether to include hidden nodes in the result. Defaults to false if null.",
      },
      parentNodeId: {
        type: ["string", "null"],
        description:
          "Optional ID of a parent node to restrict the search to its descendants. If null, the entire canvas is scanned.",
      },
    },
    required: ["nodeTypes", "includeHidden", "parentNodeId"],
    additionalProperties: false,
  },
};
