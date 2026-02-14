import { buildChartTheme } from "@visx/xychart";

// Catppuccin Mocha palette for chart series (8 distinct colors)
export const CATPPUCCIN_CHART_COLORS = [
  "#89b4fa", // blue
  "#a6e3a1", // green
  "#f9e2af", // yellow
  "#fab387", // peach
  "#cba6f7", // mauve
  "#f38ba8", // red
  "#94e2d5", // teal
  "#f5c2e7", // pink
];

export const insightsChartTheme = buildChartTheme({
  backgroundColor: "transparent",
  colors: CATPPUCCIN_CHART_COLORS,
  gridColor: "rgba(49, 50, 68, 0.5)",
  gridColorDark: "rgba(69, 71, 90, 0.3)",
  svgLabelSmall: { fill: "#a6adc8", fontSize: 11, fontFamily: "inherit" },
  svgLabelBig: { fill: "#cdd6f4", fontSize: 13, fontFamily: "inherit" },
  tickLength: 4,
});
