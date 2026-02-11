import { useEffect } from "react";
import { useGitOpsStore as useWorktreeStore } from "../../../stores/domain/git-ops";
import { WorktreeItem } from "./WorktreeItem";

interface WorktreePanelProps {
  onOpenDeleteDialog: (worktreeName: string) => void;
}

export function WorktreePanel({ onOpenDeleteDialog }: WorktreePanelProps) {
  const {
    worktreeList: worktrees,
    worktreeIsLoading: isLoading,
    worktreeError: error,
    worktreeSelected: selectedWorktree,
    loadWorktrees,
    selectWorktree,
    openInExplorer,
    switchToWorktree,
    clearWorktreeError: clearError,
  } = useWorktreeStore();

  // Load worktrees on mount
  useEffect(() => {
    loadWorktrees();
  }, [loadWorktrees]);

  if (isLoading && worktrees.length === 0) {
    return (
      <div className="p-3 text-ctp-subtext0 text-sm">Loading worktrees...</div>
    );
  }

  if (error) {
    return (
      <div className="p-3">
        <div className="text-ctp-red text-sm mb-2">{error}</div>
        <button
          type="button"
          onClick={clearError}
          className="text-xs text-ctp-subtext0 hover:text-ctp-text"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (worktrees.length === 0) {
    return (
      <div className="p-3 text-ctp-subtext0 text-sm">No worktrees found</div>
    );
  }

  return (
    <div className="divide-y divide-ctp-surface0">
      {worktrees.map((worktree) => (
        <WorktreeItem
          key={worktree.name}
          worktree={worktree}
          isSelected={selectedWorktree === worktree.name}
          onSelect={() => selectWorktree(worktree.name)}
          onOpenInExplorer={() => openInExplorer(worktree.path)}
          onSwitchTo={() => switchToWorktree(worktree.path)}
          onDelete={() => onOpenDeleteDialog(worktree.name)}
        />
      ))}
    </div>
  );
}
