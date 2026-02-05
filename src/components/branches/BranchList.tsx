import { useEffect, useState } from "react";
import { useBranchStore } from "../../stores/branches";
import { toast } from "../../stores/toast";
import { BranchItem } from "./BranchItem";
import { CreateBranchDialog } from "./CreateBranchDialog";
import { MergeDialog } from "./MergeDialog";

interface BranchListProps {
  showCreateDialog: boolean;
  onCloseCreateDialog: () => void;
}

export function BranchList({
  showCreateDialog,
  onCloseCreateDialog,
}: BranchListProps) {
  const {
    branches,
    isLoading,
    error,
    loadBranches,
    checkoutBranch,
    deleteBranch,
    mergeBranch,
    lastMergeResult,
    clearError,
    clearMergeResult,
  } = useBranchStore();
  const [mergingBranch, setMergingBranch] = useState<string | null>(null);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const handleDelete = async (name: string, isMerged: boolean | null) => {
    if (!isMerged) {
      const confirmed = window.confirm(
        `Branch "${name}" has unmerged commits. Force delete?`,
      );
      if (!confirmed) return;
      await deleteBranch(name, true);
    } else {
      await deleteBranch(name, false);
    }
  };

  const handleMerge = (branchName: string) => {
    setMergingBranch(branchName);
  };

  const confirmMerge = async () => {
    if (mergingBranch) {
      const result = await mergeBranch(mergingBranch);
      if (result) {
        if (result.hasConflicts) {
          toast.warning(`Merge has conflicts - resolve manually`);
        } else {
          toast.success(`Merged ${mergingBranch} successfully`);
        }
      }
    }
  };

  const closeMergeDialog = () => {
    setMergingBranch(null);
    clearMergeResult();
    clearError();
  };

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="p-3 bg-ctp-red/20 border-b border-ctp-red/30 text-ctp-red text-sm">
          {error}
          <button type="button" onClick={clearError} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {branches.map((branch) => (
          <BranchItem
            key={branch.name}
            branch={branch}
            onCheckout={() => checkoutBranch(branch.name)}
            onDelete={() => handleDelete(branch.name, branch.isMerged)}
            onMerge={() => handleMerge(branch.name)}
            disabled={isLoading}
          />
        ))}
      </div>

      {showCreateDialog && <CreateBranchDialog onClose={onCloseCreateDialog} />}

      {mergingBranch && (
        <MergeDialog
          sourceBranch={mergingBranch}
          result={lastMergeResult}
          onConfirm={confirmMerge}
          onClose={closeMergeDialog}
        />
      )}
    </div>
  );
}
