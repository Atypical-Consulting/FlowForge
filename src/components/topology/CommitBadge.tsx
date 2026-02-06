import { GitCommit } from "lucide-react";
import { memo } from "react";
import type { GraphNode } from "../../bindings";
import {
  COMMIT_TYPE_THEME,
  type ConventionalCommitType,
} from "../../lib/commit-type-theme";
import { cn } from "../../lib/utils";
import {
  BRANCH_BADGE_STYLES,
  BRANCH_RING_COLORS,
  parseConventionalType,
} from "./layoutUtils";

interface CommitBadgeProps {
  node: GraphNode;
  isSelected: boolean;
  onClick: () => void;
}

export const CommitBadge = memo(
  ({ node, isSelected, onClick }: CommitBadgeProps) => {
    const badgeStyle =
      BRANCH_BADGE_STYLES[node.branchType] || BRANCH_BADGE_STYLES.other;
    const ringColor =
      BRANCH_RING_COLORS[node.branchType] || BRANCH_RING_COLORS.other;

    const commitType = parseConventionalType(node.message);
    const theme = commitType
      ? COMMIT_TYPE_THEME[commitType as ConventionalCommitType]
      : null;
    const Icon = theme?.icon ?? GitCommit;
    const iconColor = theme ? theme.color : "text-ctp-overlay1";

    return (
      <div
        onClick={onClick}
        className={cn(
          "px-2 py-1 rounded-md border cursor-pointer transition-all",
          "h-full flex items-center gap-1.5 text-xs",
          badgeStyle,
          isSelected &&
            `ring-2 ${ringColor} ring-offset-1 ring-offset-ctp-base shadow-lg`,
        )}
      >
        <Icon className={cn("w-3 h-3 shrink-0", iconColor)} />
        <span className="text-ctp-text truncate flex-1 leading-tight">
          {node.message}
        </span>
        <span className="text-[10px] font-mono text-ctp-overlay0 shrink-0">
          {node.shortOid}
        </span>
      </div>
    );
  },
);

CommitBadge.displayName = "CommitBadge";
