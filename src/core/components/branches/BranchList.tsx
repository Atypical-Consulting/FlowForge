import { useEffect, useMemo, useState } from "react";
import { Pin, Shield } from "lucide-react";
import { useBulkSelect } from "../../hooks/useBulkSelect";
import { useBranchScopes } from "../../hooks/useBranchScopes";
import { useMergeWorkflow } from "../../hooks/useMergeWorkflow";
import { bulkDeleteBranches, getProtectedBranches } from "../../lib/bulkBranchOps";
import { gitHookBus } from "../../lib/gitHookBus";
import { usePreferencesStore as useBranchMetadataStore } from "../../stores/domain/preferences";
import { useGitOpsStore as useBranchStore } from "../../stores/domain/git-ops";
import { useGitOpsStore as useGitflowStore } from "../../stores/domain/git-ops";
import { toast } from "../../stores/toast";
import { BranchBulkActions } from "./BranchBulkActions";
import { BranchItem } from "./BranchItem";
import { BranchScopeSelector } from "./BranchScopeSelector";
import { BulkDeleteDialog } from "./BulkDeleteDialog";
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
    activeScopeId,
    setScope,
    scopes,
    repoPath,
    isLoading,
    error,
    loadBranches,
    loadAllBranches,
  } = useBranchScopes();

  const { checkoutBranch, deleteBranch, clearBranchError: clearError } = useBranchStore();
  const { mergeResult: lastMergeResult, startMerge, abort: abortMerge, isMerging: mergeIsLoading } = useMergeWorkflow();
  const [mergingBranch, setMergingBranch] = useState<string | null>(null);

  // Bulk delete state
  const bulkSelect = useBulkSelect(branches.map((b) => b.name));
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Protected branches
  const gitflowStatus = useGitflowStore((s) => s.gitflowStatus);
  const protectedBranches = useMemo(
    () => getProtectedBranches(gitflowStatus),
    [gitflowStatus],
  );

  useEffect(() => {
    loadBranches();
    loadAllBranches(true);
    useBranchMetadataStore.getState().initMetadata();
  }, [loadBranches, loadAllBranches]);

  // Refresh branch list after push/fetch/pull operations
  useEffect(() => {
    const refresh = () => {
      loadBranches();
      loadAllBranches(true);
    };
    const unsubPush = gitHookBus.onDid("push", refresh, "branch-list");
    const unsubFetch = gitHookBus.onDid("fetch", refresh, "branch-list");
    const unsubPull = gitHookBus.onDid("pull", refresh, "branch-list");
    return () => {
      unsubPush();
      unsubFetch();
      unsubPull();
    };
  }, [loadBranches, loadAllBranches]);

  const handleCheckout = async (branchName: string) => {
    const success = await checkoutBranch(branchName);
    if (success) {
      await loadAllBranches(true);
      if (repoPath) {
        await useBranchMetadataStore.getState().recordBranchVisit(repoPath, branchName);
      }
    }
  };

  const handleTogglePin = async (branchName: string) => {
    if (!repoPath) return;
    const store = useBranchMetadataStore.getState();
    if (store.isBranchPinned(repoPath, branchName)) {
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
    await loadAllBranches(true);
  };

  const handleMerge = (branchName: string) => {
    setMergingBranch(branchName);
  };

  const confirmMerge = () => {
    if (mergingBranch) {
      startMerge(mergingBranch);
    }
  };

  const closeMergeDialog = () => {
    setMergingBranch(null);
    clearError();
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await bulkDeleteBranches({
        branchNames: Array.from(bulkSelect.selected),
        force: false,
      });
      if (result.totalDeleted > 0) {
        toast.success(
          `Deleted ${result.totalDeleted} branch${result.totalDeleted !== 1 ? "es" : ""}`,
        );
      }
      if (result.totalFailed > 0) {
        toast.warning(
          `Failed to delete ${result.totalFailed} branch${result.totalFailed !== 1 ? "es" : ""}`,
        );
      }
      await loadBranches();
      await loadAllBranches(true);
    } catch (e) {
      toast.error(
        `Bulk delete failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      bulkSelect.exitSelectionMode();
    }
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

      <BranchBulkActions
        selectionMode={bulkSelect.selectionMode}
        selectedCount={bulkSelect.selectedCount}
        onEnterSelectionMode={bulkSelect.enterSelectionMode}
        onExitSelectionMode={bulkSelect.exitSelectionMode}
        onSelectAllMerged={() => {
          const merged = branches
            .filter(
              (b) =>
                b.isMerged && !b.isHead && !protectedBranches.has(b.name),
            )
            .map((b) => b.name);
          bulkSelect.selectAllMerged(merged);
        }}
        onDeleteSelected={() => setShowDeleteDialog(true)}
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

        {branches.map((branch) => (
          <div key={branch.name} className="flex items-center gap-1">
            {bulkSelect.selectionMode && (
              protectedBranches.has(branch.name) ? (
                <span title="Protected branch" className="shrink-0 ml-1">
                  <Shield className="w-3.5 h-3.5 text-ctp-blue" />
                </span>
              ) : (
                <input
                  type="checkbox"
                  checked={bulkSelect.isSelected(branch.name)}
                  onChange={(e) => {
                    const shiftKey = e.nativeEvent instanceof MouseEvent
                      ? (e.nativeEvent as MouseEvent).shiftKey
                      : false;
                    bulkSelect.toggleSelect(branch.name, shiftKey);
                  }}
                  className="accent-ctp-blue shrink-0 ml-1"
                  aria-label={`Select ${branch.name}`}
                />
              )
            )}
            <div className="flex-1 min-w-0">
              <BranchItem
                branch={branch}
                onCheckout={() => handleCheckout(branch.name)}
                onDelete={() => handleDelete(branch.name, branch.isMerged)}
                onMerge={() => handleMerge(branch.name)}
                onTogglePin={() => handleTogglePin(branch.name)}
                disabled={isLoading}
              />
            </div>
          </div>
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

      {showDeleteDialog && (
        <BulkDeleteDialog
          branches={branches.filter((b) => bulkSelect.selected.has(b.name))}
          protectedBranches={Array.from(protectedBranches)}
          isDeleting={isDeleting}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
    </div>
  );
}
