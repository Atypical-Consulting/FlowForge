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
          ? "bg-ctp-blue/20 border border-ctp-blue/50"
          : "hover:bg-ctp-surface0",
        disabled && "opacity-50",
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <GitBranch className="w-4 h-4 shrink-0 text-ctp-overlay1" />
        <span className="truncate font-medium">{branch.name}</span>
        {branch.isHead && <Check className="w-4 h-4 shrink-0 text-ctp-green" />}
        {branch.isMerged && !branch.isHead && (
          <span className="text-xs text-ctp-overlay0 px-1.5 py-0.5 bg-ctp-surface0 rounded">
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
              className="p-1.5 hover:bg-ctp-surface1 rounded text-ctp-overlay1 hover:text-ctp-text"
              title="Switch to branch"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onMerge}
              disabled={disabled}
              className="p-1.5 hover:bg-ctp-surface1 rounded text-ctp-overlay1 hover:text-ctp-text"
              title="Merge into current branch"
            >
              <GitMerge className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={disabled}
              className="p-1.5 hover:bg-ctp-surface1 rounded text-ctp-overlay1 hover:text-ctp-red"
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
