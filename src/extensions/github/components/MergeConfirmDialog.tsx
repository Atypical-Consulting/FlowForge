import { useState, useEffect } from "react";
import { AlertTriangle, GitMerge } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { MergeStrategySelector, type MergeMethod } from "./MergeStrategySelector";

interface MergeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prNumber: number;
  prTitle: string;
  headRef: string;
  baseRef: string;
  onMerge: (method: MergeMethod, commitTitle?: string, commitMessage?: string) => void;
  isPending: boolean;
}

export function MergeConfirmDialog({
  open,
  onOpenChange,
  prNumber,
  prTitle,
  headRef,
  baseRef,
  onMerge,
  isPending,
}: MergeConfirmDialogProps) {
  const [mergeMethod, setMergeMethod] = useState<MergeMethod>("merge");
  const [commitMessage, setCommitMessage] = useState("");

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setMergeMethod("merge");
      setCommitMessage("");
    }
  }, [open]);

  const showCommitMessage = mergeMethod !== "rebase";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-ctp-green" />
            <DialogTitle>Merge Pull Request</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* PR description */}
          <p className="text-sm text-ctp-text">
            Merge{" "}
            <span className="font-semibold">
              #{prNumber} {prTitle}
            </span>{" "}
            into{" "}
            <code className="font-mono bg-ctp-surface0 px-1.5 py-0.5 rounded text-ctp-subtext1 text-xs">
              {baseRef}
            </code>
            ?
          </p>

          {/* Branch indicator */}
          <div className="text-xs text-ctp-overlay0">
            <span className="font-mono bg-ctp-surface0 px-1.5 py-0.5 rounded text-ctp-subtext1">
              {headRef}
            </span>
            <span className="mx-1.5">&rarr;</span>
            <span className="font-mono bg-ctp-surface0 px-1.5 py-0.5 rounded text-ctp-subtext1">
              {baseRef}
            </span>
          </div>

          {/* Strategy selector */}
          <MergeStrategySelector
            value={mergeMethod}
            onChange={setMergeMethod}
            disabled={isPending}
          />

          {/* Commit message (not shown for rebase) */}
          {showCommitMessage && (
            <div>
              <label
                htmlFor="merge-commit-message"
                className="block text-xs font-medium text-ctp-subtext1 mb-1"
              >
                Commit message (optional)
              </label>
              <textarea
                id="merge-commit-message"
                rows={2}
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                disabled={isPending}
                placeholder={`Merge pull request #${prNumber}`}
                className="w-full bg-ctp-mantle border border-ctp-surface1 rounded px-3 py-2 text-sm text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none focus:border-ctp-blue resize-none"
              />
            </div>
          )}

          {/* Warning callout */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-ctp-yellow/10 border border-ctp-yellow/20">
            <AlertTriangle className="w-4 h-4 text-ctp-yellow shrink-0 mt-0.5" />
            <p className="text-xs text-ctp-yellow">
              This action cannot be undone. The branch will be merged into{" "}
              <span className="font-semibold">{baseRef}</span>.
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            autoFocus
          >
            Cancel
          </Button>
          <Button
            onClick={() =>
              onMerge(
                mergeMethod,
                commitMessage || undefined,
                commitMessage || undefined,
              )
            }
            disabled={isPending}
            loading={isPending}
            loadingText="Merging..."
            className="bg-ctp-green text-ctp-base hover:bg-ctp-green/90"
          >
            <GitMerge className="w-4 h-4 mr-1.5" />
            Merge Pull Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
