import { Check, GitBranch, GitMerge, Loader2, Pin, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { AheadBehind } from "../../../bindings";
import { commands } from "../../../bindings";
import type { EnrichedBranch } from "../../lib/branchClassifier";
import { useContextMenuRegistry } from "../../lib/contextMenuRegistry";
import { gitHookBus } from "../../lib/gitHookBus";
import { cn } from "../../lib/utils";
import { BranchTypeBadge } from "./BranchTypeBadge";

function AheadBehindBadge({ branchName, isRemote }: { branchName: string; isRemote: boolean }) {
  const [counts, setCounts] = useState<AheadBehind | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (isRemote) return;
    let cancelled = false;
    commands.getBranchAheadBehind(branchName).then((result) => {
      if (!cancelled && result.status === "ok") {
        setCounts(result.data);
      }
    });
    return () => { cancelled = true; };
  }, [branchName, isRemote, tick]);

  // Re-fetch ahead/behind after push/fetch/pull
  useEffect(() => {
    if (isRemote) return;
    const bump = () => setTick((t) => t + 1);
    const unsubs = [
      gitHookBus.onDid("push", bump, "ahead-behind-badge"),
      gitHookBus.onDid("fetch", bump, "ahead-behind-badge"),
      gitHookBus.onDid("pull", bump, "ahead-behind-badge"),
    ];
    return () => unsubs.forEach((u) => u());
  }, [isRemote]);

  if (!counts || (counts.ahead === 0 && counts.behind === 0)) return null;

  return (
    <span className="flex items-center gap-1 text-xs font-mono shrink-0">
      {counts.ahead > 0 && (
        <span className="text-ctp-green" title={`${counts.ahead} commit(s) ahead of upstream`}>
          ↑{counts.ahead}
        </span>
      )}
      {counts.behind > 0 && (
        <span className="text-ctp-blue" title={`${counts.behind} commit(s) behind upstream`}>
          ↓{counts.behind}
        </span>
      )}
    </span>
  );
}

interface BranchItemProps {
  branch: EnrichedBranch;
  onCheckout: () => Promise<unknown> | void;
  onDelete: () => Promise<unknown> | void;
  onMerge: () => Promise<unknown> | void;
  onTogglePin?: () => void;
  disabled?: boolean;
}

export function BranchItem({
  branch,
  onCheckout,
  onDelete,
  onMerge,
  onTogglePin,
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
        "group/item flex items-center justify-between px-2 py-1 rounded-md",
        branch.isHead
          ? "bg-ctp-blue/20 border border-ctp-blue/50"
          : "hover:bg-ctp-surface0",
        disabled && "opacity-50",
      )}
      onContextMenu={(e) => {
        e.preventDefault();
        useContextMenuRegistry.getState().showMenu(
          { x: e.clientX, y: e.clientY },
          "branch-list",
          { location: "branch-list", branchName: branch.name },
        );
      }}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {onTogglePin && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            className={cn(
              "p-0.5 rounded shrink-0 transition-opacity",
              branch.isPinned
                ? "text-ctp-blue hover:text-ctp-sapphire opacity-100"
                : "text-ctp-overlay0 hover:text-ctp-subtext0 opacity-0 group-hover/item:opacity-100"
            )}
            title={branch.isPinned ? "Unpin branch" : "Pin branch"}
            aria-label={branch.isPinned ? "Unpin branch" : "Pin branch"}
          >
            <Pin className={cn("w-3 h-3", branch.isPinned && "fill-current")} />
          </button>
        )}
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
        <BranchTypeBadge branchType={branch.branchType} />
        <AheadBehindBadge branchName={branch.name} isRemote={branch.isRemote} />
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
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
