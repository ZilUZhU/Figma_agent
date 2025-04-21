import { on, showUI, emit } from "@create-figma-plugin/utilities";
import {
  CloseHandler,
  RequestFigmaFunctionHandler,
  FigmaFunctionResultHandler,
  SetLoadingHandler,
  FunctionCallData,
  ActionResultPayload,
} from "./types";
// Import the central dispatcher function
import { handleFunctionCall } from "./handlers/functionCalls"; // <--- Corrected import
import { safeJsonStringify } from "./utils/jsonUtils";

export default function () {
  console.log("[main.ts] Plugin Main Thread Started");

  const uiOptions = { width: 320, height: 480 };
  showUI(uiOptions);
  console.log("[main.ts] UI Shown", uiOptions);

  // Listen for function execution requests from the UI
  on<RequestFigmaFunctionHandler>(
    "REQUEST_FIGMA_FUNCTION",
    async (functionCallData: FunctionCallData) => {
      console.log(
        `[main.ts] Received request: ${functionCallData.name} (Call ID: ${functionCallData.call_id})`
      );
      emit<SetLoadingHandler>("SET_LOADING", true);

      let resultString: string;
      try {
        // Use the central dispatcher
        resultString = await handleFunctionCall(functionCallData); // handleFunctionCall returns stringified JSON

        console.log(
          `[main.ts] Function ${functionCallData.name} handled. Result string length: ${resultString.length}`
        );
      } catch (error) {
        // Catch unexpected errors during dispatch itself (should be rare if handleFunctionCall catches errors)
        console.error(
          `[main.ts] Unexpected error handling function ${functionCallData.name}:`,
          error
        );
        const errorPayload: ActionResultPayload = {
          success: false,
          error: `Failed to handle function ${functionCallData.name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
        resultString = safeJsonStringify(errorPayload);
      }

      // Send the stringified result back to the UI
      emit<FigmaFunctionResultHandler>("FIGMA_FUNCTION_RESULT", {
        call_id: functionCallData.call_id,
        output: resultString, // Send the stringified JSON result
      });

      emit<SetLoadingHandler>("SET_LOADING", false);
    }
  );

  // Handle Plugin Close Request
  on<CloseHandler>("CLOSE", () => {
    console.log("[main.ts] Plugin Close Requested");
    figma.closePlugin();
  });

  console.log("[main.ts] Event listeners ready.");
}
