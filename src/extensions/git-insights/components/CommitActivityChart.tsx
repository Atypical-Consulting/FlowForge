import { ParentSize } from "@visx/responsive";
import {
  XYChart,
  AnimatedBarSeries,
  AnimatedGrid,
  Axis,
  Tooltip,
} from "@visx/xychart";
import { BarChart3 } from "lucide-react";
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

  return (
    <ParentSize>
      {({ width }) =>
        width > 0 ? (
          <XYChart
            height={220}
            width={width}
            theme={insightsChartTheme}
            xScale={{ type: "band", paddingInner: 0.3 }}
            yScale={{ type: "linear" }}
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
            <Axis
              orientation="left"
              numTicks={4}
              hideTicks
              hideAxisLine
            />
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
        ) : null
      }
    </ParentSize>
  );
}
