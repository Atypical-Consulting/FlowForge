import { Check, GitBranch, GitMerge, Trash2 } from "lucide-react";
import type { BranchInfo } from "../../bindings";
import { cn } from "../../lib/utils";

interface BranchItemProps {
  branch: BranchInfo;
  onCheckout: () => void;
  onDelete: () => void;
  onMerge: () => void;
  disabled?: boolean;
}

export function BranchItem({
  branch,
  onCheckout,
  onDelete,
  onMerge,
  disabled,
}: BranchItemProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-2 rounded-md",
        branch.isHead
          ? "bg-blue-900/30 border border-blue-700"
          : "hover:bg-gray-800",
        disabled && "opacity-50"
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <GitBranch className="w-4 h-4 shrink-0 text-gray-400" />
        <span className="truncate font-medium">{branch.name}</span>
        {branch.isHead && <Check className="w-4 h-4 shrink-0 text-green-400" />}
        {branch.isMerged && !branch.isHead && (
          <span className="text-xs text-gray-500 px-1.5 py-0.5 bg-gray-800 rounded">
            merged
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {!branch.isHead && (
          <>
            <button
              type="button"
              onClick={onCheckout}
              disabled={disabled}
              className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              title="Switch to branch"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onMerge}
              disabled={disabled}
              className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              title="Merge into current branch"
            >
              <GitMerge className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={disabled}
              className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
              title="Delete branch"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
