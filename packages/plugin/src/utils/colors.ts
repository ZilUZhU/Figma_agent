// src/utils/colors.ts

// 定义 FigJam 标准颜色的类型别名
export type FigJamColor =
  | "GRAY" | "LIGHT_GRAY" | "BLUE" | "LIGHT_BLUE" | "GREEN" | "LIGHT_GREEN"
  | "YELLOW" | "LIGHT_YELLOW" | "PINK" | "VIOLET" | "LIGHT_VIOLET"
  | "ORANGE" | "LIGHT_ORANGE" | "RED" | "LIGHT_RED" | "WHITE" | "BLACK";

// FigJam 颜色名称到 RGB 值的映射 (0-1范围)
// 注意：这些 RGB 值是根据 FigJam UI 大致估算的，你可能需要通过检查器精确获取
export const figJamColorMap: Record<FigJamColor, RGB> = {
    // 深色系
    GRAY: { r: 0.50196, g: 0.50196, b: 0.50196 },       // #808080
    BLUE: { r: 0.29804, g: 0.6, b: 0.99608 },           // #4C99FE
    GREEN: { r: 0.07843, g: 0.68235, b: 0.36078 },      // #14AE5C
    YELLOW: { r: 1, g: 0.77647, b: 0.16078 },           // #FFC629
    PINK: { r: 1, g: 0.45490, b: 0.76078 },             // #FF74C2
    VIOLET: { r: 0.59216, g: 0.27843, b: 1 },           // #9747FF
    ORANGE: { r: 1, g: 0.54902, b: 0.16078 },           // #FF8C29
    RED: { r: 0.94902, g: 0.28235, b: 0.13333 },        // #F24822
    WHITE: { r: 1, g: 1, b: 1 },                       // #FFFFFF
    BLACK: { r: 0.11765, g: 0.11765, b: 0.11765 },      // #1E1E1E
    // 浅色系 (估值)
    LIGHT_GRAY: { r: 0.90196, g: 0.90196, b: 0.90196 },   // #E6E6E6
    LIGHT_BLUE: { r: 0.74118, g: 0.89020, b: 0.99608 },   // #BDE3FE
    LIGHT_GREEN: { r: 0.68627, g: 0.95686, b: 0.77647 },  // #AFF4C6
    LIGHT_YELLOW: { r: 1, g: 0.90980, b: 0.63922 },     // #FFE8A3
    // PINK 的浅色可能没有直接对应，这里用 Pink 本身或白色替代，或自定义
    LIGHT_VIOLET: { r: 0.89412, g: 0.8, b: 1 },         // #E4CCFF
    LIGHT_ORANGE: { r: 1, g: 0.81961, b: 0.61176 },     // #FCD19C
    LIGHT_RED: { r: 1, g: 0.78039, b: 0.76078 }        // #FFC7C2
};

// 默认颜色
export const DEFAULT_COLOR: FigJamColor = "YELLOW";

/**
 * 将颜色输入（FigJam 颜色名称或 HEX 字符串）转换为 Figma SolidPaint 对象。
 * @param colorInput - 用户或 AI 提供的颜色字符串 (不区分大小写，忽略空格)。
 * @returns 一个 SolidPaint 对象，如果无法识别则返回默认颜色 (黄色)。
 */
export function mapColorNameToPaint(colorInput: string | null | undefined): SolidPaint {
    const defaultPaint: SolidPaint = { type: 'SOLID', color: figJamColorMap[DEFAULT_COLOR] };

    if (!colorInput) {
        console.log(`[colors.ts] No color provided, using default: ${DEFAULT_COLOR}`);
        return defaultPaint;
    }

    // 规范化输入：转大写，移除空格
    const normalizedInput = colorInput.toUpperCase().replace(/\s+/g, '');

    // 1. 检查是否为 FigJam 标准颜色名称
    if (normalizedInput in figJamColorMap) {
        console.log(`[colors.ts] Mapped color name "${colorInput}" to standard FigJam color.`);
        return { type: 'SOLID', color: figJamColorMap[normalizedInput as FigJamColor] };
    }

    // 2. 尝试解析 HEX 颜色 (#RRGGBB 或 #RGB)
    if (normalizedInput.startsWith('#')) {
        let hex = normalizedInput.substring(1);
        // 扩展 #RGB 为 #RRGGBB
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        // 检查是否为有效的 6 位 HEX
        if (hex.length === 6 && /^[0-9A-F]{6}$/i.test(hex)) {
            const bigint = parseInt(hex, 16);
            const r = ((bigint >> 16) & 255) / 255;
            const g = ((bigint >> 8) & 255) / 255;
            const b = (bigint & 255) / 255;
            console.log(`[colors.ts] Parsed HEX color "${colorInput}" to RGB.`);
            return { type: 'SOLID', color: { r, g, b } };
        }
    }

    // 3. 如果都无法识别，返回默认颜色并告警
    console.warn(`[colors.ts] Could not map color input "${colorInput}" to a known FigJam color or parse as HEX. Using default: ${DEFAULT_COLOR}.`);
    return defaultPaint;
}