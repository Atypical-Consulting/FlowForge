/**
 * Layout constants and helpers for the insights charts.
 *
 * `@visx/responsive`'s `ParentSize` (v4+) renders its children inside an
 * absolutely-positioned measurement div, so the chart no longer contributes to
 * the height of its container. Every chart therefore needs a container with an
 * explicit height, otherwise `ParentSize` measures `height: 0` and the
 * `overflow: hidden` measurement div clips the SVG entirely.
 */

/** Fixed pixel height of the commit activity chart area. */
export const COMMIT_CHART_HEIGHT = 220;

/** Margins inside the chart SVG (room for the axes without wasting space). */
export const COMMIT_CHART_MARGIN = { top: 16, right: 16, bottom: 32, left: 40 };

/** Inner padding ratio between adjacent bars of the band scale. */
export const COMMIT_CHART_PADDING_INNER = 0.3;

/** Widest a single bar is allowed to become when there are few data points. */
export const COMMIT_CHART_MAX_BAR_WIDTH = 48;

/**
 * Computes the `paddingOuter` of a d3 band scale so that no bar grows wider
 * than `maxBarWidth`. With few data points (e.g. a single day of activity)
 * a band scale otherwise stretches one bar across most of the chart.
 *
 * d3-band: `step = innerWidth / (count - paddingInner + 2 * paddingOuter)` and
 * `bandwidth = step * (1 - paddingInner)`.
 */
export function computeBandPaddingOuter(
  innerWidth: number,
  count: number,
  paddingInner = COMMIT_CHART_PADDING_INNER,
  maxBarWidth = COMMIT_CHART_MAX_BAR_WIDTH,
): number {
  if (count <= 0 || innerWidth <= 0 || maxBarWidth <= 0) return 0;
  const bandsNeeded = (innerWidth * (1 - paddingInner)) / maxBarWidth;
  const paddingOuter = (bandsNeeded - count + paddingInner) / 2;
  return Math.max(0, paddingOuter);
}

/**
 * The bar width a d3 band scale produces for the given configuration.
 * Exposed for tests and to reason about the padding computation above.
 */
export function bandScaleBarWidth(
  innerWidth: number,
  count: number,
  paddingInner: number,
  paddingOuter: number,
): number {
  const step =
    innerWidth / Math.max(1, count - paddingInner + 2 * paddingOuter);
  return step * (1 - paddingInner);
}
