import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { GraphNode } from "../../../bindings";

interface CommitTooltipProps {
  node: GraphNode;
  style?: React.CSSProperties;
}

/**
 * Format a timestamp as a relative date string.
 *
 * - "X min ago" for less than 60 minutes
 * - "X hours ago" for less than 24 hours
 * - "X days ago" for less than 30 days
 * - Full date (MMM DD, YYYY) otherwise
 */
function formatRelativeDate(timestampMs: number): string {
  const now = Date.now();
  const diffMs = now - timestampMs;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) {
    return "just now";
  }

  if (diffMin < 60) {
    return `${diffMin} min ago`;
  }

  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  }

  if (diffDays < 30) {
    return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
  }

  const date = new Date(timestampMs);
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${month} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Hover tooltip showing commit metadata (short hash, author, date, subject).
 *
 * Respects prefers-reduced-motion: uses plain div when reduced motion is
 * preferred, animated motion.div otherwise (matching ShortcutTooltip pattern).
 */
export function CommitTooltip({ node, style }: CommitTooltipProps) {
  const shouldReduceMotion = useReducedMotion();

  const truncatedMessage =
    node.message.length > 60 ? `${node.message.slice(0, 60)}...` : node.message;

  const content = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="font-mono text-ctp-blue text-xs">{node.shortOid}</span>
        <span className="text-ctp-subtext1 text-xs">{node.author}</span>
      </div>
      <div className="text-[11px] text-ctp-overlay0">
        {formatRelativeDate(node.timestampMs)}
      </div>
      <div className="text-xs text-ctp-text leading-snug">
        {truncatedMessage}
      </div>
    </div>
  );

  const className =
    "bg-ctp-mantle/95 backdrop-blur-sm border border-ctp-surface0/30 rounded-lg shadow-lg px-3 py-2 min-w-[200px] max-w-[300px] pointer-events-none";

  return (
    <AnimatePresence>
      {shouldReduceMotion ? (
        <div key="commit-tooltip" className={className} style={style}>
          {content}
        </div>
      ) : (
        <motion.div
          key="commit-tooltip"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={className}
          style={style}
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
