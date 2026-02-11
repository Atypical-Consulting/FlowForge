import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { useGitOpsStore as useBranchStore } from "../../../stores/domain/git-ops";
import { useGitOpsStore as useWorktreeStore } from "../../../stores/domain/git-ops";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";

interface DeleteWorktreeDialogProps {
  worktreeName: string | null;
  onOpenChange: (open: boolean) => void;
}

export function DeleteWorktreeDialog({
  worktreeName,
  onOpenChange,
}: DeleteWorktreeDialogProps) {
  const { worktreeList: worktrees, deleteWorktree, worktreeIsLoading: isLoading, worktreeError: error, clearWorktreeError: clearError } =
    useWorktreeStore();
  const { branchList: branches } = useBranchStore();

  const [deleteBranch, setDeleteBranch] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);

  const worktree = useMemo(
    () => worktrees.find((wt) => wt.name === worktreeName),
    [worktrees, worktreeName]
  );

  // Check if branch is merged (can be safely deleted)
  const branchInfo = useMemo(() => {
    if (!worktree?.branch) return null;
    return branches.find((b) => b.name === worktree.branch);
  }, [branches, worktree]);

  const canDeleteBranch = branchInfo?.isMerged === true;
  const isDirty =
    worktree?.status === "dirty" || worktree?.status === "conflicts";

  const handleDelete = async () => {
    if (!worktreeName) return;

    const success = await deleteWorktree(worktreeName, forceDelete, deleteBranch);

    if (success) {
      onOpenChange(false);
      setDeleteBranch(false);
      setForceDelete(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    clearError();
    setDeleteBranch(false);
    setForceDelete(false);
  };

  return (
    <Dialog open={!!worktreeName} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Worktree</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning for dirty worktree */}
          {isDirty && (
            <div className="flex items-start gap-3 p-3 bg-ctp-yellow/10 border border-ctp-yellow/30 rounded">
              <AlertTriangle className="w-5 h-5 text-ctp-yellow shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-ctp-yellow">
                  This worktree has uncommitted changes
                </p>
                <p className="text-ctp-subtext0 mt-1">
                  {worktree?.status === "conflicts"
                    ? "There are unresolved merge conflicts."
                    : "You may lose work if you proceed."}
                </p>
              </div>
            </div>
          )}

          <p className="text-sm text-ctp-text">
            Are you sure you want to delete the worktree{" "}
            <span className="font-medium">"{worktreeName}"</span>?
          </p>

          {worktree?.path && (
            <p className="text-xs text-ctp-subtext0 font-mono bg-ctp-surface0 p-2 rounded">
              {worktree.path}
            </p>
          )}

          {/* Force delete option for dirty worktrees */}
          {isDirty && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={forceDelete}
                onChange={(e) => setForceDelete(e.target.checked)}
                className="rounded"
              />
              <span className="text-ctp-red">
                Force delete (discard uncommitted changes)
              </span>
            </label>
          )}

          {/* Delete branch option */}
          {worktree?.branch && !worktree.isMain && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={deleteBranch}
                onChange={(e) => setDeleteBranch(e.target.checked)}
                className="rounded"
                disabled={!canDeleteBranch}
              />
              <span className={!canDeleteBranch ? "text-ctp-overlay0" : ""}>
                Also delete branch "{worktree.branch}"
                {!canDeleteBranch && " (not fully merged)"}
              </span>
            </label>
          )}

          {/* Error Display */}
          {error && <p className="text-ctp-red text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading || (isDirty && !forceDelete)}
          >
            {isLoading ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
