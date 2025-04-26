// packages/plugin/src/handlers/functionCalls.ts
// Restored: Acts as the central dispatcher. Imports functions from both other handler files.
/**
 * Function Call Handler/Dispatcher
 * Receives function call requests from the main thread, parses arguments,
 * and calls the appropriate implementation in figmaActions.ts or figmaFunctions.ts.
 */
import { FunctionCallData, ActionResultPayload } from "../types"; // Use local types
import { safeJsonParse, safeJsonStringify } from "../utils/jsonUtils";

// Import specific action handlers
import { handleCreateStickyNote, handleDetectAllNodes } from "./figmaActions";
// Import other specific actions from figmaActions.ts if added

// Import general Figma function handlers
import {
  getCurrentNodeId,
  createRectangle,
  createFrame,
  createText,
  screenshotNode,
  resizeNode,
  moveNode,
} from "./figmaFunctions";

// --- Function Map ---
// Maps the function name string (from AI/backend) to the actual function implementation.
// Note: The functions from figmaFunctions return stringified JSON directly.
// The functions from figmaActions return an ActionResultPayload object.
// The dispatcher needs to handle this difference.
const availableFunctions: Record<
  string,
  (args: any) => Promise<string | ActionResultPayload>
> = {
  // Functions from figmaActions (return ActionResultPayload object)
  createStickyNote: handleCreateStickyNote,
  // Add other specific actions here, e.g., 'deleteNode': handleDeleteNode,

  detectAllNodes: handleDetectAllNodes,

  // Functions from figmaFunctions (return stringified JSON)
  getCurrentNodeId: getCurrentNodeId,
  createRectangle: createRectangle,
  createFrame: createFrame,
  createText: createText,
  screenshotNode: screenshotNode,
  resizeNode: resizeNode,
  moveNode: moveNode,
};

/**
 * Handles function calls requested by the AI.
 * Parses arguments, calls the relevant function, and returns a stringified result.
 * @param functionCallData - Contains function name, stringified arguments, and call ID.
 * @returns Promise<string> - A stringified JSON object representing the result (success/error).
 */
export async function handleFunctionCall(
  functionCallData: FunctionCallData
): Promise<string> {
  const { name, arguments: argsString, call_id } = functionCallData;

  try {
    console.log(`[functionCalls] Handling call: ${name} (ID: ${call_id})`);

    // Safely parse arguments
    const args = safeJsonParse(argsString); // Returns parsed object or {} on error
    if (!args) {
      // safeJsonParse logs the error, we can just throw here
      throw new Error(
        `Failed to parse arguments for function ${name}. Input: ${argsString}`
      );
    }
    console.log(`[functionCalls] Parsed args for ${name}:`, args);

    // Find the target function
    const targetFunction = availableFunctions[name];
    if (!targetFunction) {
      console.error(`[functionCalls] Unknown function requested: ${name}`);
      throw new Error(`Unsupported function call: ${name}`);
    }

    // Execute the function
    console.log(`[functionCalls] Executing: ${name}...`);
    const result = await targetFunction(args); // Result is either string or ActionResultPayload

    console.log(`[functionCalls] Execution finished for ${name}.`);

    // Ensure the result sent back is always stringified JSON
    if (typeof result === "string") {
      // If the function already returned a string (from figmaFunctions.ts),
      // validate it's JSON-like, otherwise wrap it.
      try {
        JSON.parse(result); // Validate if it's valid JSON
        return result; // Return as is
      } catch (e) {
        console.warn(
          `[functionCalls] Function ${name} returned non-JSON string. Wrapping it.`
        );
        // Wrap non-JSON string results for consistency (e.g., simple status messages)
        return safeJsonStringify({ success: true, data: result });
      }
    } else if (typeof result === "object" && result !== null) {
      // If it's an object (from figmaActions.ts), stringify it
      return safeJsonStringify(result);
    } else {
      // Handle unexpected return types (null, undefined, etc.)
      console.warn(
        `[functionCalls] Function ${name} returned unexpected type: ${typeof result}`
      );
      return safeJsonStringify({
        success: false,
        error: `Function ${name} returned unexpected data.`,
      });
    }
  } catch (error) {
    console.error(
      `[functionCalls] Error executing ${name} (ID: ${call_id}):`,
      error
    );
    // Return a stringified error object
    const errorPayload: ActionResultPayload = {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : `Unknown error executing ${name}`,
    };
    return safeJsonStringify(errorPayload); // Use safe stringify
  }
}
