/**
 * Rate limit progress bar with color coding.
 *
 * Green (>50%), yellow (10-50%), red (<10%).
 */

import { cn } from "../../../lib/utils";

interface RateLimitBarProps {
  label: string;
  remaining: number;
  limit: number;
  reset: number;
}

export function RateLimitBar({ label, remaining, limit, reset }: RateLimitBarProps) {
  const pct = limit > 0 ? remaining / limit : 0;
  const widthPct = Math.max(0, Math.min(100, pct * 100));

  let barColor: string;
  if (pct > 0.5) barColor = "bg-ctp-green";
  else if (pct > 0.1) barColor = "bg-ctp-yellow";
  else barColor = "bg-ctp-red";

  // Calculate reset time
  const resetDate = new Date(reset * 1000);
  const now = new Date();
  const diffMs = resetDate.getTime() - now.getTime();
  const resetMinutes = Math.max(0, Math.ceil(diffMs / 60000));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ctp-subtext1">{label}</span>
        <span className="text-sm font-mono text-ctp-subtext0">
          {remaining.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="w-full h-2 bg-ctp-surface0 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", barColor)}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <p className="text-xs text-ctp-overlay0">
        Resets in {resetMinutes}min
      </p>
    </div>
  );
}
