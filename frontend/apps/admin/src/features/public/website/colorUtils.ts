// The theme color is an arbitrary hex an admin picks from a plain color
// input, so it can land anywhere from a deep navy to a pale pastel. Using
// it directly as text-on-white or as a solid badge fill made labels/badges
// /buttons wash out or vanish whenever an admin chose a light color. Every
// brand-colored surface on the public site goes through one of these
// helpers so text always stays legible regardless of the picked color.

export function hexToRgb(hex: string) {
  let c = (hex || "").replace("#", "");
  if (c.length === 3)
    c = c
      .split("")
      .map((ch) => ch + ch)
      .join("");
  const num = parseInt(c, 16);
  if (!c || Number.isNaN(num)) return { r: 37, g: 99, b: 235 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function rgbToHex(r: number, g: number, b: number) {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function mixHex(hexA: string, hexB: string, t: number) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}

/** Darkened just enough to stay a solid, confident badge/button/icon fill. */
export function accentStrong(hex: string) {
  let color = hex;
  let guard = 0;
  while (relativeLuminance(color) > 0.42 && guard < 8) {
    color = mixHex(color, "#000000", 0.16);
    guard++;
  }
  return color;
}

/** Darkened just enough to read clearly as text/label color on a white card. */
export function accentText(hex: string) {
  let color = hex;
  let guard = 0;
  while (relativeLuminance(color) > 0.38 && guard < 8) {
    color = mixHex(color, "#000000", 0.14);
    guard++;
  }
  return color;
}

export function pickTextOn(hex: string) {
  return relativeLuminance(hex) > 0.5 ? "#0f172a" : "#ffffff";
}

export function initials(name?: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "M";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}
