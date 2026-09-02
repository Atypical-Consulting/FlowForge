import { AlertTriangle, Check, GitMerge } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import type { MergeResult } from "../../../bindings";
import { useMergeWorkflow } from "../../../core/hooks/useMergeWorkflow";

interface MergeDialogProps {
  sourceBranch: string;
  result: MergeResult | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function MergeDialog({
  sourceBranch,
  result,
  onConfirm,
  onClose,
}: MergeDialogProps) {
  const {
    isMerging: isLoading,
    isAborting,
    isConflicted,
    state,
    error,
    sourceBranch: activeSourceBranch,
    abort,
  } = useMergeWorkflow();

  const handleAbort = () => {
    abort();
    onClose();
  };

  // Show confirmation before merge
  if (!result) {
    // The last merge of *this* branch failed: show why instead of leaving the
    // dialog silently open.
    const failedMessage =
      state === "error" && activeSourceBranch === sourceBranch ? error : null;
    // The singleton machine still tracks conflicts from a previous merge of a
    // different branch. The Merge button stays enabled: the machine checks the
    // repository first and refuses (with a toast) only if that merge is really
    // still in progress.
    const pendingConflictBranch =
      isConflicted && activeSourceBranch && activeSourceBranch !== sourceBranch
        ? activeSourceBranch
        : null;

    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="w-5 h-5" />
              Merge Branch
            </DialogTitle>
          </DialogHeader>

          <DialogDescription className="text-ctp-subtext1 mb-4">
            Merge <strong>{sourceBranch}</strong> into current branch?
          </DialogDescription>

          {failedMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 mb-4 p-3 rounded bg-ctp-red/20 border border-ctp-red/30 text-ctp-red text-sm"
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Merge failed: {failedMessage}</span>
            </div>
          )}

          {pendingConflictBranch && (
            <div
              role="status"
              className="flex items-start gap-2 mb-4 p-3 rounded bg-ctp-yellow/20 border border-ctp-yellow/30 text-ctp-yellow text-sm"
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                A previous merge of <strong>{pendingConflictBranch}</strong>{" "}
                reported conflicts. If it is still in progress, resolve or abort
                it first.
              </span>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={isLoading || isAborting}
              data-autofocus
            >
              {isLoading ? "Merging..." : failedMessage ? "Retry" : "Merge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Show result after merge
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge Result</DialogTitle>
        </DialogHeader>

        {result.success && !result.hasConflicts && (
          <div className="flex items-center gap-2 text-ctp-green mb-4">
            <Check className="w-5 h-5" />
            <span>
              {result.fastForwarded ? "Fast-forwarded" : "Merged"} successfully
              {result.analysis === "upToDate" && " (already up to date)"}
            </span>
          </div>
        )}

        {result.hasConflicts && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-ctp-yellow">
              <AlertTriangle className="w-5 h-5" />
              <span>Merge conflicts detected</span>
            </div>
            <div className="text-sm text-ctp-overlay1">
              <p className="mb-2">Conflicted files:</p>
              <ul className="list-disc list-inside space-y-1">
                {result.conflictedFiles.map((file) => (
                  <li key={file} className="text-ctp-red">
                    {file}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-sm text-ctp-overlay0">
              Resolve conflicts manually, then stage and commit.
            </p>
            <Button
              type="button"
              variant="destructive"
              onClick={handleAbort}
              disabled={isAborting}
            >
              {isAborting ? "Aborting..." : "Abort Merge"}
            </Button>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            data-autofocus
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
