/**
 * 函数调用处理模块
 * 负责处理从WebSocket接收的函数调用请求
 * 并分发到相应的 Figma 操作函数
 */

// Import the actual action handlers
import { handleCreateStickyNote } from "./figmaActions"; // <-- IMPORT THE ACTION
// Import other necessary action handlers if they exist in figmaActions.ts
// import { handleCreateRectangle, handleCreateText } from './figmaActions';

// Import utility functions if needed here, or rely on them within figmaActions.ts
import { safeJsonParse } from "../utils/jsonUtils";
import { FunctionCallData } from "../types"; // Import necessary type

// --- Define Figma Functions that might be directly callable (if any) ---
// Or remove these if all logic is in figmaActions.ts
async function getCurrentNodeId(): Promise<string> {
  // (Keep implementation if needed directly)
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    return JSON.stringify({ message: "当前没有选中任何节点", nodeId: null });
  }
  return JSON.stringify({
    message: `已选中${selection.length}个节点`,
    nodeIds: selection.map((node) => node.id),
    primaryNodeId: selection[0].id,
  });
}

// --- Map Function Names to Implementations ---

// Map function names (as defined in backend tools) to the actual functions that execute them
// Note: The function signature should ideally accept parsed arguments and return a Promise<ActionResultPayload>
// The handleFunctionCall wrapper will stringify the result.
const availableFunctions: Record<
  string,
  (args: any) => Promise<any> // Use 'any' for args flexibility, return 'any' as wrapper handles stringify
> = {
  // Register functions from figmaActions.ts
  createStickyNote: handleCreateStickyNote, // <-- REGISTER THE CORRECT FUNCTION

  // Register others if they are also moved to figmaActions.ts
  // createRectangle: handleCreateRectangle,
  // createText: handleCreateText,

  // Keep direct implementations if necessary
  getCurrentNodeId: getCurrentNodeId,

  // Add other functions defined in figmaActions.ts here
};

/**
 * 处理函数调用 - Dispatches to registered functions
 * @param functionCallData - Object containing { name, arguments (string), call_id }
 * @returns Promise<string> - Stringified JSON result (success or error)
 */
export async function handleFunctionCall(
  functionCallData: FunctionCallData
): Promise<string> {
  const { name, arguments: argsString, call_id } = functionCallData; // Destructure for clarity

  try {
    console.log(
      `[functionCalls] Handling function call: ${name} (Call ID: ${call_id})`
    );

    // Safely parse arguments string
    const args = safeJsonParse(argsString);
    console.log(`[functionCalls] Parsed arguments for ${name}:`, args);

    // Find the target function in our map
    const targetFunction = availableFunctions[name];

    if (!targetFunction) {
      console.error(`[functionCalls] Unknown function requested: ${name}`);
      // Throw specific error to be caught below
      throw new Error(`未知函数: ${name}`);
    }

    // Execute the target function
    console.log(`[functionCalls] Executing ${name}...`);
    const resultObject = await targetFunction(args); // Execute the actual Figma action function

    // The resultObject should ideally be ActionResultPayload { success: boolean, ... }
    console.log(
      `[functionCalls] Function ${name} execution completed. Result object:`,
      resultObject
    );

    // Stringify the entire result object to send back
    // The backend expects a string in the 'output' field of the function_result message
    return JSON.stringify(resultObject);
  } catch (error) {
    console.error(
      `[functionCalls] Error during execution of ${name} (Call ID: ${call_id}):`,
      error
    );
    // Return a stringified error object
    return JSON.stringify({
      // Consistent error structure
      success: false, // Indicate failure clearly
      error:
        error instanceof Error
          ? error.message
          : `执行函数 ${name} 时发生未知错误`,
      function: name, // Include function name for context
    });
  }
}

// Remove redundant inline implementations if they are now handled by figmaActions.ts
// Remove hexToRgb if it's only used within figmaActions.ts (or move it to utils)
