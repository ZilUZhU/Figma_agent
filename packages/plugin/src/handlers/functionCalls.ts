import { ActionResultPayload, FunctionCall, FunctionCallArguments } from "../types";
import { apiService } from "../services/api";
import { handleCreateStickyNote } from "./figmaActions";

/**
 * 分发并执行具体的 Figma 函数调用
 * @param functionCall - 要执行的函数调用对象
 * @returns Promise<ActionResultPayload> - 执行结果对象
 */
export async function handleFunctionCall(functionCall: FunctionCall): Promise<ActionResultPayload> {
  const { name, arguments: args } = functionCall;
  console.log(`[functionCalls.ts] Dispatching Figma function: ${name}`);
  // console.log(`[functionCalls.ts] Arguments for ${name}:`, args); // Debug: Log arguments

  switch (name) {
    case "createStickyNote":
      return await handleCreateStickyNote(args);
    // --- 在这里添加其他 FigJam 操作的处理函数 ---
    // case "createShapeWithText":
    //   return await handleCreateShapeWithText(args);
    // case "createConnector":
    //   return await handleCreateConnector(args);
    // case "createText":
    //    return await handleCreateText(args);
    // case "updateNodeText":
    //   return await handleUpdateNodeText(args);
    // case "updateNodeColor":
    //    return await handleUpdateNodeColor(args);
    // case "resizeNode":
    //    return await handleResizeNode(args);
    // case "moveNode":
    //    return await handleMoveNode(args);
    // case "alignNodes":
    //    return await handleAlignNodes(args);
    // case "distributeNodes":
    //     return await handleDistributeNodes(args);
    // case "getSelectedNodes":
    //     return await handleGetSelectedNodes(); // 可能不需要 args
    // case "findNodes":
    //     return await handleFindNodes(args);
    // case "getNodeProperties":
    //      return await handleGetNodeProperties(args);
    // case "selectNodesById":
    //      return await handleSelectNodesById(args);
    // case "zoomToNodes":
    //      return await handleZoomToNodes(args);
    // case "getCurrentViewport":
    //      return await handleGetCurrentViewport(); // 可能不需要 args
    // --- ------------------------------------ ---
    default:
      console.warn(`[functionCalls.ts] Received unhandled function call: ${name}`);
      return { success: false, error: `不支持的操作: ${name}` };
  }
}

/**
 * 处理 OpenAI 的函数调用请求 (Agent Loop)
 * @param functionCall - 从后端收到的函数调用对象
 * @param sessionId - 当前会话 ID
 */
export async function processFunctionCallLoop(
  functionCall: FunctionCall, 
  sessionId: string,
  setLoading: (loading: boolean) => void,
  receiveMessage: (message: string) => void
): Promise<void> {
  console.log(`[functionCalls.ts] Processing function call loop for: ${functionCall.name}`, functionCall.arguments);
  let executionResult: ActionResultPayload; // 使用统一的载荷类型

  try {
    // 1. 在 UI 中显示"正在执行..."的消息 (可选，但建议)
    receiveMessage(`正在为您执行: ${functionCall.name}...`);
    setLoading(true);

    // 2. 执行 Figma 操作
    executionResult = await handleFunctionCall(functionCall);
    console.log(`[functionCalls.ts] Figma action result for ${functionCall.name}:`, executionResult);

  } catch (error) {
    // 捕获 handleFunctionCall 可能抛出的同步错误
    console.error(`[functionCalls.ts] Immediate error during function call handling (${functionCall.name}):`, error);
    executionResult = {
      success: false,
      error: `执行本地操作时出错: ${error instanceof Error ? error.message : "未知错误"}`,
    };
  }

  try {
    // 3. 构造 function_call_output (结果必须是字符串)
    const functionOutputString = JSON.stringify(executionResult);

    const functionCallOutput = {
      type: "function_call_output", // 确保这个类型与后端期望的一致
      call_id: functionCall.call_id,
      output: functionOutputString,
    };

    console.log(`[functionCalls.ts] Sending function result back to backend for session: ${sessionId}...`);

    // 4. 将函数执行结果发送回后端
    const response = await apiService.sendFunctionResult(functionCallOutput, sessionId);
    console.log("[functionCalls.ts] Received response after sending function result.");
    // console.log("[functionCalls.ts] Backend response data:", JSON.stringify(response, null, 2)); // Debug

    // 5. 处理后端的响应
    if (response.function_call) {
      console.log("[functionCalls.ts] Nested function call detected. Continuing loop.");
      await processFunctionCallLoop(response.function_call, response.sessionId, setLoading, receiveMessage);
    } else {
      console.log("[functionCalls.ts] No more function calls. Sending final message to UI.");
      receiveMessage(response.message || "操作完成。");
    }

  } catch (error) {
    console.error(`[functionCalls.ts] Error sending function result or processing response (${functionCall.name}):`, error);
    receiveMessage(
      `与 AI 服务通信时出错: ${error instanceof Error ? error.message : "未知错误"}`
    );
  } finally {
    setLoading(false);
  }
} 