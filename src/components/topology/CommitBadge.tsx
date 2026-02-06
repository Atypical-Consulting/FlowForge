import {
  Bug,
  FileText,
  GitCommit,
  Hammer,
  Package,
  Paintbrush,
  Rocket,
  Settings,
  Sparkles,
  TestTube,
  Undo,
  Zap,
} from "lucide-react";
import { memo } from "react";
import type { ElementType } from "react";
import type { GraphNode } from "../../bindings";
import { cn } from "../../lib/utils";
import {
  BRANCH_BADGE_STYLES,
  BRANCH_RING_COLORS,
  parseConventionalType,
} from "./layoutUtils";

const ICON_MAP: Record<string, ElementType> = {
  feat: Sparkles,
  fix: Bug,
  docs: FileText,
  style: Paintbrush,
  refactor: Hammer,
  perf: Zap,
  test: TestTube,
  chore: Settings,
  ci: Rocket,
  build: Package,
  revert: Undo,
};

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
    const Icon = (commitType && ICON_MAP[commitType]) || GitCommit;

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
        <Icon className="w-3 h-3 text-ctp-overlay1 shrink-0" />
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
