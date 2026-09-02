import { ParentSize } from "@visx/responsive";
import {
  AnimatedBarSeries,
  AnimatedGrid,
  Axis,
  Tooltip,
  XYChart,
} from "@visx/xychart";
import { BarChart3 } from "lucide-react";
import {
  COMMIT_CHART_HEIGHT,
  COMMIT_CHART_MARGIN,
  COMMIT_CHART_PADDING_INNER,
  computeBandPaddingOuter,
} from "../lib/chartLayout";
import { insightsChartTheme } from "../lib/chartTheme";
import type { DailyCommitCount } from "../types";

interface Props {
  data: DailyCommitCount[];
}

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-").map(Number);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[month - 1]} ${day}`;
}

function formatDateFull(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[month - 1]} ${day}, ${year}`;
}

export function CommitActivityChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-ctp-subtext0">
        <BarChart3 className="mb-2 h-6 w-6 opacity-40" />
        <span className="text-xs">No commit activity in this period</span>
      </div>
    );
  }

  // ParentSize (visx 4) renders the chart inside an absolutely-positioned,
  // overflow-hidden box, so the chart must live in a container with an explicit
  // height or it collapses to 0px and is clipped away. See lib/chartLayout.ts.
  return (
    <div
      className="w-full"
      style={{ height: COMMIT_CHART_HEIGHT }}
      data-testid="commit-activity-chart"
    >
      <ParentSize>
        {({ width }) => {
          if (width <= 0) return null;
          const innerWidth =
            width - COMMIT_CHART_MARGIN.left - COMMIT_CHART_MARGIN.right;
          const paddingOuter = computeBandPaddingOuter(innerWidth, data.length);
          return (
            <XYChart
              height={COMMIT_CHART_HEIGHT}
              width={width}
              margin={COMMIT_CHART_MARGIN}
              theme={insightsChartTheme}
              xScale={{
                type: "band",
                paddingInner: COMMIT_CHART_PADDING_INNER,
                paddingOuter,
              }}
              yScale={{ type: "linear", nice: true }}
            >
              <AnimatedGrid columns={false} numTicks={4} />
              <AnimatedBarSeries
                dataKey="Daily Commits"
                data={data}
                xAccessor={(d) => d.date}
                yAccessor={(d) => d.count}
                colorAccessor={() => "#89b4fa"}
                radius={3}
                radiusAll
              />
              <Axis
                orientation="bottom"
                numTicks={Math.min(data.length, 7)}
                tickFormat={formatDate}
                hideTicks
              />
              <Axis orientation="left" numTicks={4} hideTicks hideAxisLine />
              <Tooltip
                snapTooltipToDatumX
                snapTooltipToDatumY
                showVerticalCrosshair
                verticalCrosshairStyle={{
                  stroke: "#89b4fa",
                  strokeOpacity: 0.3,
                }}
                renderTooltip={({ tooltipData }) => {
                  const datum = tooltipData?.nearestDatum?.datum as
                    | DailyCommitCount
                    | undefined;
                  if (!datum) return null;
                  return (
                    <div className="rounded-lg bg-ctp-surface0 px-3 py-2 text-xs shadow-lg border border-ctp-surface1/50">
                      <div className="font-medium text-ctp-text">
                        {formatDateFull(datum.date)}
                      </div>
                      <div className="text-ctp-blue mt-0.5">
                        {datum.count} commit{datum.count !== 1 ? "s" : ""}
                      </div>
                    </div>
                  );
                }}
              />
            </XYChart>
          );
        }}
      </ParentSize>
    </div>
  );
}
