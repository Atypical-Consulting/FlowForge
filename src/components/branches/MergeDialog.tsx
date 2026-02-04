import { AlertTriangle, Check, GitMerge, X } from "lucide-react";
import type { MergeResult } from "../../bindings";
import { useBranchStore } from "../../stores/branches";

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
  const { isLoading, abortMerge } = useBranchStore();

  const handleAbort = async () => {
    await abortMerge();
    onClose();
  };

  // Show confirmation before merge
  if (!result) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-96">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <GitMerge className="w-5 h-5" />
              Merge Branch
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-gray-800 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-gray-300 mb-4">
            Merge <strong>{sourceBranch}</strong> into current branch?
          </p>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
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
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-96">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Merge Result</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {result.success && !result.hasConflicts && (
          <div className="flex items-center gap-2 text-green-400 mb-4">
            <Check className="w-5 h-5" />
            <span>
              {result.fastForwarded ? "Fast-forwarded" : "Merged"} successfully
              {result.analysis === "upToDate" && " (already up to date)"}
            </span>
          </div>
        )}

        {result.hasConflicts && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-yellow-400">
              <AlertTriangle className="w-5 h-5" />
              <span>Merge conflicts detected</span>
            </div>
            <div className="text-sm text-gray-400">
              <p className="mb-2">Conflicted files:</p>
              <ul className="list-disc list-inside space-y-1">
                {result.conflictedFiles.map((file) => (
                  <li key={file} className="text-red-400">
                    {file}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-sm text-gray-500">
              Resolve conflicts manually, then stage and commit.
            </p>
            <button
              type="button"
              onClick={handleAbort}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 rounded"
            >
              Abort Merge
            </button>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
