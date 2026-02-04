import { Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { useBranchStore } from "../../stores/branches";
import { BranchItem } from "./BranchItem";
import { CreateBranchDialog } from "./CreateBranchDialog";
import { MergeDialog } from "./MergeDialog";

export function BranchList() {
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
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [mergingBranch, setMergingBranch] = useState<string | null>(null);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const handleDelete = async (name: string, isMerged: boolean | null) => {
    if (!isMerged) {
      const confirmed = window.confirm(
        `Branch "${name}" has unmerged commits. Force delete?`
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
      await mergeBranch(mergingBranch);
    }
  };

  const closeMergeDialog = () => {
    setMergingBranch(null);
    clearMergeResult();
    clearError();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300">Branches</h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => loadBranches()}
            disabled={isLoading}
            className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={() => setShowCreateDialog(true)}
            className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border-b border-red-800 text-red-300 text-sm">
          {error}
          <button
            type="button"
            onClick={clearError}
            className="ml-2 underline"
          >
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

      {showCreateDialog && (
        <CreateBranchDialog onClose={() => setShowCreateDialog(false)} />
      )}

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
