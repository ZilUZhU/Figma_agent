/**
 * Figma AI Tools Index
 * Consolidates and exports all available function/tool definitions for the OpenAI API.
 */
import { createStickyNoteTool } from "./createStickyNote";
// Import other tool definitions here if added later
import { detectAllNodesTool } from "./detectAllNodes";
import { createTextTool } from "./createText";
import { trackUserActivityTool } from "./trackUserActivity";

import { Tool } from "../types"; // Use type from backend/src/types.ts

// Array containing all tools to be made available to the AI
export const availableTools: Tool[] = [
  createStickyNoteTool,
  // Add other imported tools here
  detectAllNodesTool,
  createTextTool,
  trackUserActivityTool,
];

// Optional: Export individual tools if they need to be referenced directly elsewhere
export {
  createStickyNoteTool,
  // Export other tools if needed
  detectAllNodesTool,
  createTextTool,
  trackUserActivityTool,
};
