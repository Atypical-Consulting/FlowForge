/**
 * Relative timestamp display for GitHub dates.
 *
 * Computes and displays a human-readable relative time string
 * from an ISO 8601 date. Does NOT use setInterval for updates --
 * the timestamp is re-rendered when the parent re-renders
 * (e.g., from a TanStack Query refetch), avoiding unnecessary timers.
 */

import { cn } from "@/framework/lib/utils";

interface TimeAgoProps {
  /** ISO 8601 date string from the GitHub API */
  date: string;
  /** Additional CSS classes */
  className?: string;
}

function computeRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${weeks}w ago`;
  if (days < 365) return `${months}mo ago`;
  return `${years}y ago`;
}

export function TimeAgo({ date, className }: TimeAgoProps) {
  const relativeText = computeRelativeTime(date);

  return (
    <time
      dateTime={date}
      title={new Date(date).toLocaleString()}
      className={cn("text-xs text-ctp-overlay0", className)}
    >
      {relativeText}
    </time>
  );
}
