// packages/plugin/src/utils/colors.ts
// No changes needed from the previous step. hexToRgb and mapPaintToColorName remain here.
/**
 * Color utility functions for Figma plugin.
 */

export type FigJamColor =
  | "GRAY"
  | "LIGHT_GRAY"
  | "BLUE"
  | "LIGHT_BLUE"
  | "GREEN"
  | "LIGHT_GREEN"
  | "YELLOW"
  | "LIGHT_YELLOW"
  | "PINK"
  | "VIOLET"
  | "LIGHT_VIOLET"
  | "ORANGE"
  | "LIGHT_ORANGE"
  | "RED"
  | "LIGHT_RED"
  | "WHITE"
  | "BLACK";

export const figJamColorMap: Record<FigJamColor, RGB> = {
  /* ... colors ... */ GRAY: { r: 0.50196, g: 0.50196, b: 0.50196 },
  BLUE: { r: 0.29804, g: 0.6, b: 0.99608 },
  GREEN: { r: 0.07843, g: 0.68235, b: 0.36078 },
  YELLOW: { r: 1, g: 0.77647, b: 0.16078 },
  PINK: { r: 1, g: 0.4549, b: 0.76078 },
  VIOLET: { r: 0.59216, g: 0.27843, b: 1 },
  ORANGE: { r: 1, g: 0.54902, b: 0.16078 },
  RED: { r: 0.94902, g: 0.28235, b: 0.13333 },
  WHITE: { r: 1, g: 1, b: 1 },
  BLACK: { r: 0.11765, g: 0.11765, b: 0.11765 },
  LIGHT_GRAY: { r: 0.90196, g: 0.90196, b: 0.90196 },
  LIGHT_BLUE: { r: 0.74118, g: 0.8902, b: 0.99608 },
  LIGHT_GREEN: { r: 0.68627, g: 0.95686, b: 0.77647 },
  LIGHT_YELLOW: { r: 1, g: 0.9098, b: 0.63922 },
  LIGHT_VIOLET: { r: 0.89412, g: 0.8, b: 1 },
  LIGHT_ORANGE: { r: 1, g: 0.81961, b: 0.61176 },
  LIGHT_RED: { r: 1, g: 0.78039, b: 0.76078 },
};
export const DEFAULT_COLOR: FigJamColor = "YELLOW";

export function hexToRgb(
  hex: string
): { r: number; g: number; b: number } | null {
  if (!hex || typeof hex !== "string") return null;
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (hex.length !== 6 || !/^[0-9A-F]{6}$/i.test(hex)) {
    console.warn(`[colors.ts] Invalid hex color format: #${hex}`);
    return null;
  }
  const bigint = parseInt(hex, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  return { r, g, b };
}

export function mapColorNameToPaint(
  colorInput: string | null | undefined
): SolidPaint {
  const defaultPaint: SolidPaint = {
    type: "SOLID",
    color: figJamColorMap[DEFAULT_COLOR],
  };
  if (!colorInput) {
    return defaultPaint;
  }
  const normalizedInput = colorInput.toUpperCase().replace(/\s+/g, "");
  if (normalizedInput in figJamColorMap) {
    return {
      type: "SOLID",
      color: figJamColorMap[normalizedInput as FigJamColor],
    };
  }
  const rgbFromHex = hexToRgb(normalizedInput);
  if (rgbFromHex) {
    return { type: "SOLID", color: rgbFromHex };
  }
  console.warn(
    `[colors.ts] Invalid color input "${colorInput}". Using default: ${DEFAULT_COLOR}.`
  );
  return defaultPaint;
}

export function mapPaintToColorName(paint: SolidPaint): string {
  if (paint.type !== "SOLID") return "gradient or image";
  const targetColor = paint.color;
  let closestColorName: string = "GRAY";
  let minDistance = Infinity;
  for (const [name, rgb] of Object.entries(figJamColorMap)) {
    const distance =
      Math.pow(targetColor.r - rgb.r, 2) +
      Math.pow(targetColor.g - rgb.g, 2) +
      Math.pow(targetColor.b - rgb.b, 2);
    if (distance < minDistance) {
      minDistance = distance;
      closestColorName = name;
    }
  }
  if (minDistance < 0.01) {
    return closestColorName.toLowerCase().replace("_", " ");
  }
  const rHex = Math.round(targetColor.r * 255)
    .toString(16)
    .padStart(2, "0");
  const gHex = Math.round(targetColor.g * 255)
    .toString(16)
    .padStart(2, "0");
  const bHex = Math.round(targetColor.b * 255)
    .toString(16)
    .padStart(2, "0");
  return `color (#${rHex}${gHex}${bHex})`;
}
