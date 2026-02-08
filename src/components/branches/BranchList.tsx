import { useEffect, useState } from "react";
import { Pin, Clock } from "lucide-react";
import { useBranchScopes } from "../../hooks/useBranchScopes";
import { useBranchMetadataStore } from "../../stores/branchMetadata";
import { useBranchStore } from "../../stores/branches";
import { toast } from "../../stores/toast";
import { BranchItem } from "./BranchItem";
import { BranchScopeSelector } from "./BranchScopeSelector";
import { CollapsibleSection } from "./CollapsibleSection";
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
    pinnedBranches,
    recentBranches,
    activeScopeId,
    setScope,
    scopes,
    repoPath,
    isLoading,
    error,
    loadBranches,
    loadAllBranches,
  } = useBranchScopes();

  const { checkoutBranch, deleteBranch, mergeBranch, lastMergeResult, clearError, clearMergeResult } = useBranchStore();
  const [mergingBranch, setMergingBranch] = useState<string | null>(null);

  useEffect(() => {
    loadBranches();
    loadAllBranches(true);
    useBranchMetadataStore.getState().initMetadata();
  }, [loadBranches, loadAllBranches]);

  const handleCheckout = async (branchName: string) => {
    const success = await checkoutBranch(branchName);
    if (success && repoPath) {
      await useBranchMetadataStore.getState().recordBranchVisit(repoPath, branchName);
    }
  };

  const handleTogglePin = async (branchName: string) => {
    if (!repoPath) return;
    const store = useBranchMetadataStore.getState();
    if (store.isPinned(repoPath, branchName)) {
      await store.unpinBranch(repoPath, branchName);
    } else {
      await store.pinBranch(repoPath, branchName);
    }
  };

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

      <BranchScopeSelector
        scopes={scopes}
        activeScopeId={activeScopeId}
        onChange={setScope}
      />

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {pinnedBranches.length > 0 && (
          <CollapsibleSection
            title="Quick Access"
            icon={<Pin className="w-3 h-3" />}
            count={pinnedBranches.length}
          >
            <div className="space-y-0.5">
              {pinnedBranches.map((branch) => (
                <BranchItem
                  key={`pin-${branch.name}`}
                  branch={branch}
                  onCheckout={() => handleCheckout(branch.name)}
                  onDelete={() => handleDelete(branch.name, branch.isMerged)}
                  onMerge={() => handleMerge(branch.name)}
                  onTogglePin={() => handleTogglePin(branch.name)}
                  disabled={isLoading}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {recentBranches.length > 0 && (
          <CollapsibleSection
            title="Recent"
            icon={<Clock className="w-3 h-3" />}
            count={recentBranches.length}
          >
            <div className="space-y-0.5">
              {recentBranches.map((branch) => (
                <BranchItem
                  key={`recent-${branch.name}`}
                  branch={branch}
                  onCheckout={() => handleCheckout(branch.name)}
                  onDelete={() => handleDelete(branch.name, branch.isMerged)}
                  onMerge={() => handleMerge(branch.name)}
                  onTogglePin={() => handleTogglePin(branch.name)}
                  disabled={isLoading}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {branches.map((branch) => (
          <BranchItem
            key={branch.name}
            branch={branch}
            onCheckout={() => handleCheckout(branch.name)}
            onDelete={() => handleDelete(branch.name, branch.isMerged)}
            onMerge={() => handleMerge(branch.name)}
            onTogglePin={() => handleTogglePin(branch.name)}
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
