import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { memo } from "react";
import type { BranchType } from "../../bindings";
import { cn } from "../../lib/utils";
import type { CommitNodeData } from "./layoutUtils";

const BRANCH_STYLES: Record<BranchType, string> = {
  main: "border-orange-500 bg-orange-500/10",
  develop: "border-green-500 bg-green-500/10",
  feature: "border-blue-500 bg-blue-500/10",
  release: "border-purple-500 bg-purple-500/10",
  hotfix: "border-red-500 bg-red-500/10",
  other: "border-gray-500 bg-gray-500/10",
};

type CommitNodeProps = NodeProps<Node<CommitNodeData>>;

export const CommitNode = memo(({ data }: CommitNodeProps) => {
  const branchStyle = BRANCH_STYLES[data.branchType] || BRANCH_STYLES.other;

  return (
    <div
      className={cn(
        "px-3 py-2 rounded-lg border-2 cursor-pointer transition-all",
        "hover:shadow-lg min-w-[200px]",
        branchStyle,
        data.isSelected &&
          "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg",
      )}
      onClick={() => data.onSelect?.(data.oid)}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground"
      />

      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-mono text-muted-foreground">
          {data.shortOid}
        </span>
        {data.branchNames.length > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-muted truncate max-w-[100px]">
            {data.branchNames[0]}
          </span>
        )}
      </div>

      <div className="text-sm truncate max-w-[180px]" title={data.message}>
        {data.message}
      </div>

      <div className="text-xs text-muted-foreground mt-1">{data.author}</div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground"
      />
    </div>
  );
});

CommitNode.displayName = "CommitNode";
