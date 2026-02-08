import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ScopeSuggestion } from "../../bindings";
import { cn } from "../../lib/utils";

const BAR_COLORS = [
  "bg-ctp-blue",
  "bg-ctp-mauve",
  "bg-ctp-green",
  "bg-ctp-peach",
  "bg-ctp-pink",
  "bg-ctp-teal",
  "bg-ctp-yellow",
  "bg-ctp-lavender",
  "bg-ctp-sapphire",
  "bg-ctp-red",
];

interface ScopeFrequencyChartProps {
  frequencies: ScopeSuggestion[];
  onScopeClick: (scope: string) => void;
  loading?: boolean;
}

export function ScopeFrequencyChart({
  frequencies,
  onScopeClick,
  loading,
}: ScopeFrequencyChartProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-24 bg-ctp-surface1 rounded animate-pulse" />
        <div className="space-y-1.5">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-6 bg-ctp-surface1 rounded animate-pulse"
              style={{ width: `${100 - i * 15}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (frequencies.length === 0) return null;

  const maxCount = frequencies[0]?.usageCount ?? 1;
  const displayLimit = showAll ? frequencies.length : 8;
  const displayed = frequencies.slice(0, displayLimit);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-sm font-medium text-ctp-overlay1 hover:text-ctp-subtext1 transition-colors w-full"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        Scope History
        <span className="text-xs text-ctp-overlay0 ml-1">
          ({frequencies.length})
        </span>
      </button>

      {expanded && (
        <div className="space-y-1.5">
          {displayed.map((item, index) => {
            const barWidth = Math.max(
              (item.usageCount / maxCount) * 100,
              8,
            );
            const color = BAR_COLORS[index % BAR_COLORS.length];

            return (
              <button
                key={item.scope}
                type="button"
                onClick={() => onScopeClick(item.scope)}
                className="flex items-center gap-2 w-full group text-left"
                title={`${item.scope}: ${item.usageCount} commits — click to use`}
              >
                <span className="text-xs text-ctp-subtext0 w-20 truncate group-hover:text-ctp-blue transition-colors">
                  {item.scope}
                </span>
                <div className="flex-1 h-5 bg-ctp-surface0 rounded overflow-hidden">
                  <div
                    className={cn(
                      color,
                      "h-full rounded transition-all group-hover:opacity-80",
                    )}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="text-xs text-ctp-overlay0 w-8 text-right font-mono">
                  {item.usageCount}
                </span>
              </button>
            );
          })}

          {frequencies.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-ctp-blue hover:text-ctp-sapphire mt-1"
            >
              {showAll ? "Show less" : `Show all (${frequencies.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
