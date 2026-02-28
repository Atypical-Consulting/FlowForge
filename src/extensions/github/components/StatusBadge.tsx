/**
 * Status badge for GitHub pull requests and issues.
 *
 * Renders a pill-shaped badge with icon and text indicating
 * the state of a PR (open, closed, merged, draft) or issue
 * (open, closed). Uses Catppuccin colors with 15% opacity
 * backgrounds for a subtle, consistent look.
 */

import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  CircleDot,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
} from "lucide-react";

interface StatusBadgeProps {
  state: string;
  merged?: boolean;
  draft?: boolean;
  type?: "pr" | "issue";
}

interface BadgeConfig {
  icon: LucideIcon;
  label: string;
  bg: string;
  text: string;
}

function resolvePrConfig(
  state: string,
  merged?: boolean,
  draft?: boolean,
): BadgeConfig {
  if (merged) {
    return {
      icon: GitMerge,
      label: "Merged",
      bg: "bg-ctp-mauve/15",
      text: "text-ctp-mauve",
    };
  }
  if (draft) {
    return {
      icon: GitPullRequestDraft,
      label: "Draft",
      bg: "bg-ctp-overlay0/15",
      text: "text-ctp-overlay0",
    };
  }
  if (state === "open") {
    return {
      icon: GitPullRequest,
      label: "Open",
      bg: "bg-ctp-green/15",
      text: "text-ctp-green",
    };
  }
  // closed (not merged)
  return {
    icon: GitPullRequestClosed,
    label: "Closed",
    bg: "bg-ctp-red/15",
    text: "text-ctp-red",
  };
}

function resolveIssueConfig(state: string): BadgeConfig {
  if (state === "open") {
    return {
      icon: CircleDot,
      label: "Open",
      bg: "bg-ctp-green/15",
      text: "text-ctp-green",
    };
  }
  // closed
  return {
    icon: CheckCircle2,
    label: "Closed",
    bg: "bg-ctp-mauve/15",
    text: "text-ctp-mauve",
  };
}

export function StatusBadge({
  state,
  merged,
  draft,
  type = "pr",
}: StatusBadgeProps) {
  const config =
    type === "issue"
      ? resolveIssueConfig(state)
      : resolvePrConfig(state, merged, draft);

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.text}`}
      aria-label={config.label}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
