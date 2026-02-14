import type { RepoHealthStatus } from "../hooks/useRepoHealth";

interface HealthDotProps {
  status: RepoHealthStatus;
}

const STATUS_CONFIG: Record<
  RepoHealthStatus["status"],
  { color: string; ringColor: string; label: string }
> = {
  clean: {
    color: "bg-ctp-green",
    ringColor: "ring-ctp-green/50",
    label: "Clean -- working tree is clean",
  },
  dirty: {
    color: "bg-ctp-yellow",
    ringColor: "ring-ctp-yellow/50",
    label: "Dirty -- uncommitted changes",
  },
  ahead: {
    color: "bg-ctp-blue",
    ringColor: "ring-ctp-blue/50",
    label: "Ahead",
  },
  behind: {
    color: "bg-ctp-peach",
    ringColor: "ring-ctp-peach/50",
    label: "Behind",
  },
  diverged: {
    color: "bg-ctp-red",
    ringColor: "ring-ctp-red/50",
    label: "Diverged",
  },
  unknown: {
    color: "bg-ctp-overlay0",
    ringColor: "ring-ctp-overlay0/50",
    label: "Unknown -- could not determine status",
  },
  loading: {
    color: "bg-ctp-overlay0 motion-safe:animate-pulse",
    ringColor: "ring-ctp-overlay0/50",
    label: "Checking...",
  },
};

function getTooltipText(status: RepoHealthStatus): string {
  const config = STATUS_CONFIG[status.status];
  switch (status.status) {
    case "ahead":
      return `Ahead -- ${status.ahead} commit${status.ahead !== 1 ? "s" : ""} ahead of remote`;
    case "behind":
      return `Behind -- ${status.behind} commit${status.behind !== 1 ? "s" : ""} behind remote`;
    case "diverged":
      return `Diverged -- ${status.ahead} ahead, ${status.behind} behind remote`;
    default:
      return config.label;
  }
}

export function HealthDot({ status }: HealthDotProps) {
  const config = STATUS_CONFIG[status.status];
  const tooltipText = getTooltipText(status);

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="relative group">
        <div
          className={`w-2 h-2 rounded-full shrink-0 transition-shadow ${config.color} group-hover:ring-2 group-hover:ring-offset-1 group-hover:ring-offset-ctp-base ${config.ringColor}`}
          aria-label={tooltipText}
        />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-ctp-mantle/95 text-xs text-ctp-subtext1 rounded shadow-md border border-ctp-surface0/30 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
          {tooltipText}
        </div>
      </div>
      {status.branchName && status.status !== "loading" && (
        <span className="text-[10px] text-ctp-overlay0 font-mono truncate max-w-[80px]">
          {status.branchName}
        </span>
      )}
    </div>
  );
}
