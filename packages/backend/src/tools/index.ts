/**
 * Figma AI Tools Index
 * Consolidates and exports all available function/tool definitions for the OpenAI API.
 */

import { createStickyNoteTool } from './createStickyNote';
// Import other tool definitions here
// import { createRectangleTool } from './createRectangle';
// import { createTextTool } from './createText';
// import { getCurrentNodeIdTool } from './getCurrentNodeId';

import { Tool } from '../types'; // Assuming base Tool type

// Array containing all tools to be made available to the AI
export const availableTools: Tool[] = [
  createStickyNoteTool,
  // Add other imported tools here:
  // createRectangleTool,
  // createTextTool,
  // getCurrentNodeIdTool,
];

// Optional: Export individual tools if they need to be referenced directly elsewhere
export {
  createStickyNoteTool,
  // createRectangleTool,
  // createTextTool,
  // getCurrentNodeIdTool,
};

// Generate a union type of available tool names (useful for type checking)
// Note: This relies on the structure Tool having function.name
// Adjust if your Tool type structure is different.
// type AvailableToolNames = typeof availableTools[number]['function']['name'];
// export type FunctionCallTools = Extract<AvailableToolNames, string>;