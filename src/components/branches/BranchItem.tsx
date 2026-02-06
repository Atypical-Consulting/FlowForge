import { Check, GitBranch, GitMerge, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import type { BranchInfo } from "../../bindings";
import { cn } from "../../lib/utils";

interface BranchItemProps {
  branch: BranchInfo;
  onCheckout: () => Promise<unknown> | void;
  onDelete: () => Promise<unknown> | void;
  onMerge: () => Promise<unknown> | void;
  disabled?: boolean;
}

export function BranchItem({
  branch,
  onCheckout,
  onDelete,
  onMerge,
  disabled,
}: BranchItemProps) {
  const [loadingAction, setLoadingAction] = useState<
    "checkout" | "merge" | "delete" | null
  >(null);
  const isAnyLoading = loadingAction !== null;

  const handleAction = async (
    action: "checkout" | "merge" | "delete",
    fn: () => Promise<unknown> | void,
  ) => {
    setLoadingAction(action);
    try {
      await fn();
    } finally {
      setLoadingAction(null);
    }
  };
  return (
    <div
      className={cn(
        "group flex items-center justify-between px-2 py-1 rounded-md",
        branch.isHead
          ? "bg-ctp-blue/20 border border-ctp-blue/50"
          : "hover:bg-ctp-surface0",
        disabled && "opacity-50",
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <GitBranch className="w-3.5 h-3.5 shrink-0 text-ctp-overlay1" />
        <span className="truncate text-sm font-medium">{branch.name}</span>
        {branch.isHead && (
          <Check className="w-3.5 h-3.5 shrink-0 text-ctp-green" />
        )}
        {branch.isMerged && !branch.isHead && (
          <span className="text-xs text-ctp-overlay0 px-1 py-0.5 bg-ctp-surface0 rounded">
            merged
          </span>
        )}
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {!branch.isHead && (
          <>
            <button
              type="button"
              onClick={() => handleAction("checkout", onCheckout)}
              disabled={disabled || isAnyLoading}
              className="p-1 hover:bg-ctp-surface1 rounded text-ctp-overlay1 hover:text-ctp-text"
              title="Switch to branch"
            >
              {loadingAction === "checkout" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleAction("merge", onMerge)}
              disabled={disabled || isAnyLoading}
              className="p-1 hover:bg-ctp-surface1 rounded text-ctp-overlay1 hover:text-ctp-text"
              title="Merge into current branch"
            >
              {loadingAction === "merge" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <GitMerge className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleAction("delete", onDelete)}
              disabled={disabled || isAnyLoading}
              className="p-1 hover:bg-ctp-surface1 rounded text-ctp-overlay1 hover:text-ctp-red"
              title="Delete branch"
            >
              {loadingAction === "delete" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
