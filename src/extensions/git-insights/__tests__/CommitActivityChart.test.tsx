import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { CommitActivityChart } from "../components/CommitActivityChart";
import { COMMIT_CHART_HEIGHT } from "../lib/chartLayout";
import type { DailyCommitCount } from "../types";

const MOCK_WIDTH = 800;

// jsdom has no layout, so ParentSize would always report 0x0. Inject a width
// but keep ParentSize's real markup shape (children inside an absolutely
// positioned box) to make sure the chart still relies on an explicit height.
vi.mock("@visx/responsive", () => ({
  ParentSize: ({
    children,
  }: {
    children: (size: {
      width: number;
      height: number;
      top: number;
      left: number;
      ref: null;
      resize: () => void;
    }) => ReactNode;
  }) => (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        {children({
          width: MOCK_WIDTH,
          height: COMMIT_CHART_HEIGHT,
          top: 0,
          left: 0,
          ref: null,
          resize: () => {},
        })}
      </div>
    </div>
  ),
}));

const today: DailyCommitCount[] = [{ date: "2026-09-02", count: 14 }];

describe("CommitActivityChart", () => {
  it("renders the empty state when there is no data", () => {
    render(<CommitActivityChart data={[]} />);

    expect(
      screen.getByText("No commit activity in this period"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("commit-activity-chart"),
    ).not.toBeInTheDocument();
  });

  it("renders the chart inside a container with a fixed non-zero height", () => {
    render(<CommitActivityChart data={today} />);

    const container = screen.getByTestId("commit-activity-chart");
    expect(container).toHaveStyle({ height: `${COMMIT_CHART_HEIGHT}px` });
    expect(COMMIT_CHART_HEIGHT).toBeGreaterThan(0);

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("width", String(MOCK_WIDTH));
    expect(svg).toHaveAttribute("height", String(COMMIT_CHART_HEIGHT));
  });

  it("shows the date on the axis for a single day of activity", () => {
    render(<CommitActivityChart data={today} />);

    expect(screen.getByText("Sep 2")).toBeInTheDocument();
  });

  it("does not render the empty state when data is present", () => {
    render(<CommitActivityChart data={today} />);

    expect(
      screen.queryByText("No commit activity in this period"),
    ).not.toBeInTheDocument();
  });
});
