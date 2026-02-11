import { useCallback, useState } from "react";
import { useRecentRepos } from "../hooks/useRecentRepos";
import { useGitOpsStore as useBranchStore } from "../stores/domain/git-ops";
import { getNavigationActor } from "../machines/navigation/context";
import { usePreferencesStore as useNavigationStore } from "../stores/domain/preferences";
import { useGitOpsStore as useRepositoryStore } from "../stores/domain/git-ops";
import { useGitOpsStore as useStashStore } from "../stores/domain/git-ops";
import { useGitOpsStore as useTagStore } from "../stores/domain/git-ops";
import { toast } from "../stores/toast";
import { useGitOpsStore as useUndoStore } from "../stores/domain/git-ops";
import { ProcessNavigation } from "../blades/_shared";
import { MenuBar } from "./menu-bar";
import { BranchSwitcher } from "./navigation/BranchSwitcher";
import { RepoSwitcher } from "./navigation/RepoSwitcher";
import { Toolbar } from "./toolbar/Toolbar";
import { Button } from "./ui/button";

interface StashConfirmTarget {
  branchName: string;
  isRemote: boolean;
}

export function Header() {
  const { repoStatus: status, openRepository, refreshRepoStatus: refreshStatus } =
    useRepositoryStore();
  const { loadBranches, checkoutBranch, checkoutRemoteBranch } = useBranchStore();
  const { loadStashes, saveStash } = useStashStore();
  const { loadTags } = useTagStore();
  const { loadUndoInfo } = useUndoStore();
  const { addRecentRepo } = useRecentRepos();
  const navigationStore = useNavigationStore();
  const [stashConfirmTarget, setStashConfirmTarget] =
    useState<StashConfirmTarget | null>(null);

  // Repo switching: open new repo atomically, restore last branch, show toast
  const handleRepoSwitch = useCallback(
    async (path: string) => {
      try {
        if (status) {
          await navigationStore.setNavLastActiveBranch(
            status.repoPath,
            status.branchName,
          );
        }

        await openRepository(path);
        getNavigationActor().send({ type: "RESET_STACK" });
        await addRecentRepo(path);

        const lastBranch = navigationStore.getNavLastActiveBranch(path);
        if (lastBranch) {
          try {
            await checkoutBranch(lastBranch);
          } catch {
            // Branch may have been deleted -- stay on current
          }
        }

        await Promise.all([
          loadBranches(),
          loadStashes(),
          loadTags(),
          loadUndoInfo(),
        ]);

        const repoName = path.split(/[/\\]/).filter(Boolean).pop() || path;
        toast.success(`Switched to ${repoName}`);
      } catch (e) {
        toast.error(
          `Failed to switch repository: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [status, navigationStore, openRepository, addRecentRepo, checkoutBranch, loadBranches, loadStashes, loadTags, loadUndoInfo],
  );

  // Perform the actual branch switch (local or remote)
  const performBranchSwitch = useCallback(
    async (branchName: string, isRemote: boolean) => {
      try {
        const success = isRemote
          ? await checkoutRemoteBranch(branchName)
          : await checkoutBranch(branchName);

        if (success) {
          const localName = isRemote ? branchName.replace(/^[^/]+\//, "") : branchName;
          if (status) {
            await navigationStore.addNavRecentBranch(status.repoPath, localName);
          }
          await refreshStatus();
          toast.info(`Switched to ${localName}`);
        }
      } catch (e) {
        toast.error(
          `Failed to switch branch: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [checkoutBranch, checkoutRemoteBranch, status, navigationStore, refreshStatus],
  );

  // Branch switching: check dirty state first
  const handleBranchSwitch = useCallback(
    async (branchName: string, isRemote: boolean) => {
      if (status?.isDirty) {
        setStashConfirmTarget({ branchName, isRemote });
        return;
      }
      await performBranchSwitch(branchName, isRemote);
    },
    [status, performBranchSwitch],
  );

  // Stash-and-switch handler
  const handleStashAndSwitch = useCallback(async () => {
    if (!stashConfirmTarget) return;
    const { branchName, isRemote } = stashConfirmTarget;
    setStashConfirmTarget(null);

    const stashed = await saveStash(`Auto-stash before switching to ${branchName}`, true);
    if (stashed) {
      await performBranchSwitch(branchName, isRemote);
    } else {
      toast.error("Failed to stash changes");
    }
  }, [stashConfirmTarget, saveStash, performBranchSwitch]);

  return (
    <>
      <header className="flex items-center justify-between h-14 px-4 border-b border-ctp-surface0 bg-ctp-mantle/80 backdrop-blur-md select-none sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-ctp-text">FlowForge</h1>
          <div className="w-px h-6 bg-ctp-surface1" />
          <MenuBar />
          {status && (
            <>
              <div className="w-px h-6 bg-ctp-surface1" />
              <RepoSwitcher onSelectRepo={handleRepoSwitch} />
              <BranchSwitcher onSelectBranch={handleBranchSwitch} />
            </>
          )}
          {status && <ProcessNavigation className="ml-4" />}
        </div>

        <Toolbar />
      </header>

      {/* Stash-and-switch confirmation dialog */}
      {stashConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-ctp-base rounded-lg p-6 max-w-md shadow-xl border border-ctp-surface0">
            <h3 className="text-lg font-semibold text-ctp-text">
              Uncommitted Changes
            </h3>
            <p className="text-sm text-ctp-subtext0 mt-2">
              You have uncommitted changes. Would you like to stash them before
              switching to{" "}
              <span className="font-mono font-medium text-ctp-text">
                {stashConfirmTarget.branchName}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="ghost"
                onClick={() => setStashConfirmTarget(null)}
              >
                Cancel
              </Button>
              <Button onClick={handleStashAndSwitch}>Stash and Switch</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
