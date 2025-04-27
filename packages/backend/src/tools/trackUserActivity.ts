/**
 * Tool Definition: Track User Activity
 */
import { Tool } from "../types";

export const trackUserActivityTool: Tool = {
  type: "function",
  name: "trackUserActivity",
  description:
    "Initializes tracking of user selection changes on the Figma or FigJam canvas. Records selected node details and timestamps. Useful for monitoring user behavior or automating reactions to user actions.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      // No configurable parameters for now
    //   TODO: possibily take duration conditions
    },
    required: [],
    additionalProperties: false,
  },
};
