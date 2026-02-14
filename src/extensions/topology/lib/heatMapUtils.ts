/**
 * Heat map color utilities for commit recency visualization.
 *
 * Maps commit timestamps to a green (recent) -> yellow (mid) -> red (old)
 * gradient using Catppuccin Mocha palette colors.
 */

/** Catppuccin Mocha palette colors for the heat map gradient */
export const HEAT_COLORS = {
  recent: "#a6e3a1", // ctp-green
  mid: "#f9e2af", // ctp-yellow
  old: "#f38ba8", // ctp-red
} as const;

/**
 * Parse a hex color string (#RRGGBB) into [r, g, b] components.
 */
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

/**
 * Convert [r, g, b] components back to a hex color string.
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Linearly interpolate between two hex colors.
 *
 * @param c1 - Start color (hex string, e.g. "#a6e3a1")
 * @param c2 - End color (hex string, e.g. "#f38ba8")
 * @param t  - Interpolation factor (0 = c1, 1 = c2)
 * @returns Interpolated hex color string
 */
export function interpolateColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);

  const r = r1 + (r2 - r1) * t;
  const g = g1 + (g2 - g1) * t;
  const b = b1 + (b2 - b1) * t;

  return rgbToHex(r, g, b);
}

/**
 * Map a commit timestamp to a heat color on the green -> yellow -> red gradient.
 *
 * - Green (#a6e3a1) = most recent commit
 * - Yellow (#f9e2af) = midpoint age
 * - Red (#f38ba8)   = oldest commit
 *
 * Uses two-segment interpolation:
 * - t in [0, 0.5): interpolate recent (green) -> mid (yellow)
 * - t in [0.5, 1]: interpolate mid (yellow) -> old (red)
 *
 * @param timestampMs - Commit timestamp in milliseconds
 * @param minTs       - Oldest timestamp in the dataset (ms)
 * @param maxTs       - Newest timestamp in the dataset (ms)
 * @returns Hex color string
 */
export function getHeatColor(
  timestampMs: number,
  minTs: number,
  maxTs: number,
): string {
  // All commits at the same time — treat as recent
  if (maxTs === minTs) {
    return HEAT_COLORS.recent;
  }

  // Normalize: 0 = most recent, 1 = oldest
  const t = (maxTs - timestampMs) / (maxTs - minTs);

  if (t < 0.5) {
    // Recent -> mid (green -> yellow)
    return interpolateColor(HEAT_COLORS.recent, HEAT_COLORS.mid, t * 2);
  }

  // Mid -> old (yellow -> red)
  return interpolateColor(HEAT_COLORS.mid, HEAT_COLORS.old, (t - 0.5) * 2);
}
