import { HEAT_COLORS } from "../lib/heatMapUtils";

interface HeatMapLegendProps {
  minDate: Date;
  maxDate: Date;
}

/**
 * Format a date for the legend labels.
 *
 * - "Today" if the date matches today
 * - "Yesterday" if it matches yesterday
 * - "MMM DD" if within the current year
 * - "MMM DD, YYYY" otherwise
 */
function formatDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateDay.getTime() === today.getTime()) {
    return "Today";
  }

  if (dateDay.getTime() === yesterday.getTime()) {
    return "Yesterday";
  }

  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getDate();

  if (date.getFullYear() === now.getFullYear()) {
    return `${month} ${day}`;
  }

  return `${month} ${day}, ${date.getFullYear()}`;
}

/**
 * Gradient legend bar showing the heat map color scale.
 *
 * Displays: date range labels above, colored gradient bar,
 * and "Recent" / "Older" labels below.
 */
export function HeatMapLegend({ minDate, maxDate }: HeatMapLegendProps) {
  return (
    <div className="px-3 py-2 bg-ctp-surface0/50 rounded-lg">
      {/* Date range labels */}
      <div className="flex justify-between mb-1">
        <span className="text-[10px] text-ctp-overlay0">
          {formatDate(maxDate)}
        </span>
        <span className="text-[10px] text-ctp-overlay0">
          {formatDate(minDate)}
        </span>
      </div>

      {/* Gradient bar */}
      <div
        className="w-[200px] h-2 rounded-full"
        style={{
          background: `linear-gradient(to right, ${HEAT_COLORS.recent}, ${HEAT_COLORS.mid}, ${HEAT_COLORS.old})`,
        }}
      />

      {/* Recent / Older labels */}
      <div className="flex justify-between mt-1">
        <span className="text-xs text-ctp-overlay0">Recent</span>
        <span className="text-xs text-ctp-overlay0">Older</span>
      </div>
    </div>
  );
}
