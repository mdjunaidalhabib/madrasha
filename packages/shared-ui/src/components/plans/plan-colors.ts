export const PLAN_PALETTE = [
  "#047857",
  "#0369A1",
  "#4338CA",
  "#7E22CE",
  "#A21CAF",
  "#BE123C",
  "#B45309",
  "#0E7490",
  "#334155",
] as const;

export function planAccent(
  color: string | null | undefined,
  order = 1,
): string {
  if (color && /^#[a-f\d]{6}$/i.test(color)) return color;
  if (color && /^#[a-f\d]{3}$/i.test(color))
    return `#${[...color.slice(1)].map((c) => c + c).join("")}`;
  return PLAN_PALETTE[
    (Math.max(1, Math.floor(order)) - 1) % PLAN_PALETTE.length || 0
  ];
}

export function luminance(hex: string): number {
  const rgb = [1, 3, 5]
    .map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

export function readableAccentText(hex: string): "#000000" | "#FFFFFF" {
  return luminance(hex) > 0.179 ? "#000000" : "#FFFFFF";
}

export function contrastRatio(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
