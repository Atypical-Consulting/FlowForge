import { AlertTriangle, Check, GitMerge, X } from "lucide-react";
import type { MergeResult } from "../../bindings";
import { useGitOpsStore as useBranchStore } from "../../stores/domain/git-ops";

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
  const { branchIsLoading: isLoading, abortMerge } = useBranchStore();

  const handleAbort = async () => {
    await abortMerge();
    onClose();
  };

  // Show confirmation before merge
  if (!result) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-6 w-96">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <GitMerge className="w-5 h-5" />
              Merge Branch
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-ctp-surface0 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-ctp-subtext1 mb-4">
            Merge <strong>{sourceBranch}</strong> into current branch?
          </p>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-ctp-overlay1 hover:text-ctp-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="px-4 py-2 text-sm bg-ctp-blue hover:bg-ctp-blue/80 rounded disabled:opacity-50"
            >
              {isLoading ? "Merging..." : "Merge"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show result after merge
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-6 w-96">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Merge Result</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-ctp-surface0 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
            <button
              type="button"
              onClick={handleAbort}
              className="px-4 py-2 text-sm bg-ctp-red hover:bg-ctp-red/80 rounded"
            >
              Abort Merge
            </button>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm bg-ctp-surface1 hover:bg-ctp-surface2 rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
