import { describe, expect, it } from "vitest";
import {
  bandScaleBarWidth,
  COMMIT_CHART_HEIGHT,
  COMMIT_CHART_MARGIN,
  COMMIT_CHART_MAX_BAR_WIDTH,
  COMMIT_CHART_PADDING_INNER,
  computeBandPaddingOuter,
} from "../lib/chartLayout";

const INNER_WIDTH = 1165 - COMMIT_CHART_MARGIN.left - COMMIT_CHART_MARGIN.right;

describe("chart layout", () => {
  it("has a positive fixed chart height", () => {
    expect(COMMIT_CHART_HEIGHT).toBeGreaterThan(0);
  });

  it("caps a single bar to the maximum bar width", () => {
    const paddingOuter = computeBandPaddingOuter(INNER_WIDTH, 1);
    const barWidth = bandScaleBarWidth(
      INNER_WIDTH,
      1,
      COMMIT_CHART_PADDING_INNER,
      paddingOuter,
    );

    expect(paddingOuter).toBeGreaterThan(0);
    expect(barWidth).toBeCloseTo(COMMIT_CHART_MAX_BAR_WIDTH, 6);

    // Without the cap the single bar would span most of the chart.
    const uncapped = bandScaleBarWidth(
      INNER_WIDTH,
      1,
      COMMIT_CHART_PADDING_INNER,
      0,
    );
    expect(uncapped).toBeGreaterThan(INNER_WIDTH / 2);
  });

  it("does not add outer padding once bars are naturally narrow enough", () => {
    // 90 days of data on a 1165px card: bars are ~9px wide already.
    expect(computeBandPaddingOuter(INNER_WIDTH, 90)).toBe(0);
  });

  it("never returns negative padding or NaN for degenerate inputs", () => {
    expect(computeBandPaddingOuter(0, 1)).toBe(0);
    expect(computeBandPaddingOuter(INNER_WIDTH, 0)).toBe(0);
    expect(computeBandPaddingOuter(INNER_WIDTH, 1, 0.3, 0)).toBe(0);
  });
});
