import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { memo } from "react";
import type { BranchType } from "../../bindings";
import { cn } from "../../lib/utils";
import type { CommitNodeData } from "./layoutUtils";

// Catppuccin Mocha branch colors
const BRANCH_STYLES: Record<BranchType, string> = {
  main: "border-ctp-peach bg-ctp-peach/10 hover:bg-ctp-peach/20",
  develop: "border-ctp-green bg-ctp-green/10 hover:bg-ctp-green/20",
  feature: "border-ctp-blue bg-ctp-blue/10 hover:bg-ctp-blue/20",
  release: "border-ctp-mauve bg-ctp-mauve/10 hover:bg-ctp-mauve/20",
  hotfix: "border-ctp-red bg-ctp-red/10 hover:bg-ctp-red/20",
  other: "border-ctp-overlay0 bg-ctp-surface0/50 hover:bg-ctp-surface1/50",
};

const BRANCH_RING_COLORS: Record<BranchType, string> = {
  main: "ring-ctp-peach",
  develop: "ring-ctp-green",
  feature: "ring-ctp-blue",
  release: "ring-ctp-mauve",
  hotfix: "ring-ctp-red",
  other: "ring-ctp-overlay0",
};

type CommitNodeProps = NodeProps<Node<CommitNodeData>>;

export const CommitNode = memo(({ data }: CommitNodeProps) => {
  const branchStyle = BRANCH_STYLES[data.branchType] || BRANCH_STYLES.other;
  const ringColor =
    BRANCH_RING_COLORS[data.branchType] || BRANCH_RING_COLORS.other;

  return (
    <div
      className={cn(
        "px-3 py-2 rounded-lg border-2 cursor-pointer transition-all",
        "hover:shadow-lg min-w-[200px]",
        branchStyle,
        data.isSelected &&
          `ring-2 ${ringColor} ring-offset-2 ring-offset-ctp-base shadow-lg`,
      )}
      onClick={() => data.onSelect?.(data.oid)}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-ctp-overlay0"
      />

      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-mono text-ctp-subtext0">
          {data.shortOid}
        </span>
        {data.branchNames.length > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-ctp-surface0 text-ctp-subtext1 truncate max-w-[100px]">
            {data.branchNames[0]}
          </span>
        )}
      </div>

      <div
        className="text-sm text-ctp-text truncate max-w-[180px]"
        title={data.message}
      >
        {data.message}
      </div>

      <div className="text-xs text-ctp-subtext0 mt-1">{data.author}</div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-ctp-overlay0"
      />
    </div>
  );
});

CommitNode.displayName = "CommitNode";
