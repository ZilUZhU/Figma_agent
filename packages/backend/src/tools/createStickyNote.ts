/**
 * 创建便签(Sticky Note)工具
 * 允许AI创建FigJam便签
 */

// 定义创建便签的工具
export const createStickyNote = {
  type: "function" as const, // 使用const断言确保类型正确
  name: "createStickyNote",
  description: "Creates a new sticky note on the FigJam canvas. Places it near the center of the current view or relative to another node if specified.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The text content to write on the sticky note."
      },
      color: {
        type: ["string", "null"],
        description: "The color of the sticky note. Defaults to YELLOW if null. Use standard FigJam color names.",
        enum: [null, "GRAY", "LIGHT_GRAY", "BLUE", "LIGHT_BLUE", "GREEN", "LIGHT_GREEN", "YELLOW", "LIGHT_YELLOW", "PINK", "VIOLET", "LIGHT_VIOLET", "ORANGE", "LIGHT_ORANGE", "RED", "LIGHT_RED", "WHITE", "BLACK"]
      },
      x: {
        type: ["number", "null"],
        description: "Absolute X coordinate on the canvas for the center of the new sticky note. If null, position might be calculated automatically."
      },
      y: {
        type: ["number", "null"],
        description: "Absolute Y coordinate on the canvas for the center of the new sticky note. If null, position might be calculated automatically."
      },
      relativeToNodeId: {
        type: ["string", "null"],
        description: "Optional ID of an existing node to place the new sticky note relative to. If provided, x and y are ignored."
      },
      positionRelation: {
        type: ["string", "null"],
        description: "Describes the placement relative to 'relativeToNodeId'. Used only if 'relativeToNodeId' is set.",
        enum: [null, "RIGHT", "LEFT", "ABOVE", "BELOW", "NEAR"]
      }
    },
    required: ["text", "color", "x", "y", "relativeToNodeId", "positionRelation"],
    additionalProperties: false
  },
}; 