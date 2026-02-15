import { AlertTriangle, GitBranch, Loader2, Shield, X } from "lucide-react";
import type { EnrichedBranch } from "../../../core/lib/branchClassifier";
import { cn } from "../../../core/lib/utils";

interface BulkDeleteDialogProps {
  branches: EnrichedBranch[];
  protectedBranches: string[];
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BulkDeleteDialog({
  branches,
  protectedBranches,
  isDeleting,
  onConfirm,
  onCancel,
}: BulkDeleteDialogProps) {
  const hasUnmerged = branches.some((b) => b.isMerged === false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-6 w-[28rem] max-h-[80vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ctp-text">
            Delete {branches.length} branch{branches.length !== 1 ? "es" : ""}?
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 hover:bg-ctp-surface1 rounded text-ctp-overlay1 hover:text-ctp-text"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
          {branches.map((branch) => (
            <div
              key={branch.name}
              className="flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-ctp-surface0"
            >
              <GitBranch className="w-3.5 h-3.5 shrink-0 text-ctp-overlay1" />
              <span className="truncate flex-1">{branch.name}</span>
              {branch.isMerged ? (
                <span className="text-xs text-ctp-green">(merged)</span>
              ) : branch.isMerged === false ? (
                <span className="text-xs text-ctp-yellow flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  unmerged
                </span>
              ) : null}
            </div>
          ))}
        </div>

        {protectedBranches.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-ctp-blue/10 border border-ctp-blue/20 rounded text-xs text-ctp-blue">
            <Shield className="w-4 h-4 shrink-0" />
            <span>
              Protected: {protectedBranches.join(", ")} (not affected)
            </span>
          </div>
        )}

        {hasUnmerged && (
          <p className="text-xs text-ctp-yellow mb-3">
            Warning: Some branches have unmerged commits that will be lost.
          </p>
        )}

        <p className="text-xs text-ctp-overlay0 mb-4">
          This action cannot be undone.
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-3 py-1.5 text-sm text-ctp-subtext0 hover:text-ctp-text hover:bg-ctp-surface0 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded transition-colors flex items-center gap-1.5",
              isDeleting
                ? "bg-ctp-red/50 text-ctp-base cursor-not-allowed"
                : "bg-ctp-red text-ctp-base hover:bg-ctp-red/90",
            )}
          >
            {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Delete {branches.length}
          </button>
        </div>
      </div>
    </div>
  );
}
