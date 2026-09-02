import { AlertTriangle, GitBranch, Loader2, Shield } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import type { EnrichedBranch } from "../../../core/lib/branchClassifier";

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
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-ctp-text">
            Delete {branches.length} branch{branches.length !== 1 ? "es" : ""}?
          </DialogTitle>
        </DialogHeader>

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

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isDeleting}
            data-autofocus
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Delete {branches.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
