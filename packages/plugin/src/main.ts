// packages/plugin/src/main.ts

import { on, showUI, emit } from "@create-figma-plugin/utilities";
import {
  CloseHandler,
  RequestFigmaFunctionHandler, // Listen for this
  FigmaFunctionResultHandler, // Emit this
  SetLoadingHandler, // Can still emit this
  FunctionCallData, // Type for received data
} from "./types";
// Import the actual function execution logic
// Assuming handleFunctionCall is appropriately defined in functionCalls.ts or similar
import { handleFunctionCall } from "./handlers/functionCalls";

export default function () {
  console.log("[main.ts] Plugin Main Thread Started");

  showUI({
    width: 320,
    height: 480,
  });
  console.log("[main.ts] UI Shown");

  // --- Listen for requests from the UI ---

  on<RequestFigmaFunctionHandler>(
    "REQUEST_FIGMA_FUNCTION",
    async (functionCallData: FunctionCallData) => {
      console.log(
        `[main.ts] Received request to execute function: ${functionCallData.name}`
      );
      emit<SetLoadingHandler>("SET_LOADING", true); // Inform UI we are working

      try {
        // Execute the function using the imported handler
        const resultString = await handleFunctionCall(functionCallData); // handleFunctionCall should return stringified JSON

        console.log(
          `[main.ts] Function ${functionCallData.name} executed. Result length: ${resultString.length}`
        );

        // Send the result back to the UI
        emit<FigmaFunctionResultHandler>("FIGMA_FUNCTION_RESULT", {
          call_id: functionCallData.call_id,
          output: resultString,
        });
      } catch (error) {
        console.error(
          `[main.ts] Error executing function ${functionCallData.name}:`,
          error
        );
        // Send an error result back to the UI
        emit<FigmaFunctionResultHandler>("FIGMA_FUNCTION_RESULT", {
          call_id: functionCallData.call_id,
          output: JSON.stringify({
            // Send error details as stringified JSON
            error: `Failed to execute function ${functionCallData.name}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          }),
        });
      } finally {
        emit<SetLoadingHandler>("SET_LOADING", false); // Inform UI we are done
      }
    }
  );

  // --- Handle Plugin Close ---
  on<CloseHandler>("CLOSE", function () {
    console.log("[main.ts] Plugin Close Requested");
    // No WebSocket connection to close here anymore
    figma.closePlugin();
  });

  console.log("[main.ts] Event listeners set up.");
}
