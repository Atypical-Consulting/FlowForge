import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
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
import { cn } from "../../lib/utils";
import {
  BRANCH_BADGE_STYLES,
  BRANCH_RING_COLORS,
  type CommitNodeData,
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

type CommitBadgeProps = NodeProps<Node<CommitNodeData>>;

export const CommitBadge = memo(({ data }: CommitBadgeProps) => {
  const badgeStyle =
    BRANCH_BADGE_STYLES[data.branchType] || BRANCH_BADGE_STYLES.other;
  const ringColor =
    BRANCH_RING_COLORS[data.branchType] || BRANCH_RING_COLORS.other;

  const commitType = parseConventionalType(data.message);
  const Icon = (commitType && ICON_MAP[commitType]) || GitCommit;

  return (
    <div
      className={cn(
        "px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all",
        "min-w-[200px] h-[40px] flex items-center gap-2",
        badgeStyle,
        data.isSelected &&
          `ring-2 ${ringColor} ring-offset-1 ring-offset-ctp-base shadow-lg`,
      )}
      onClick={() => data.onSelect?.(data.oid)}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-transparent !border-0 !w-0 !h-0"
      />

      <Icon className="w-3.5 h-3.5 text-ctp-overlay1 shrink-0" />
      <span className="text-xs text-ctp-text truncate flex-1">
        {data.message}
      </span>
      <span className="text-[11px] font-mono text-ctp-overlay0 shrink-0">
        {data.shortOid}
      </span>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-transparent !border-0 !w-0 !h-0"
      />
    </div>
  );
});

CommitBadge.displayName = "CommitBadge";
