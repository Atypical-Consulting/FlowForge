import { open } from "@tauri-apps/plugin-dialog";
import { useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  FolderOpen,
  FolderTree,
  GitBranch,
  GitFork,
  RefreshCw,
  Search,
  Settings,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRecentRepos } from "../hooks/useRecentRepos";
import { useBranchStore } from "../stores/branches";
import { getNavigationActor } from "../machines/navigation/context";
import { useNavigationStore } from "../stores/navigation";
import { useCommandPaletteStore } from "../stores/commandPalette";
import { useRepositoryStore } from "../stores/repository";
import { useBladeNavigation } from "../hooks/useBladeNavigation";
import { useStashStore } from "../stores/stash";
import { useTagStore } from "../stores/tags";
import { toast } from "../stores/toast";
import { useUndoStore } from "../stores/undo";
import { ProcessNavigation } from "../blades/_shared";
import { BranchSwitcher } from "./navigation/BranchSwitcher";
import { RepoSwitcher } from "./navigation/RepoSwitcher";
import { SyncButtons } from "./sync/SyncButtons";
import { ShortcutTooltip } from "./ui/ShortcutTooltip";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ui/ThemeToggle";

interface StashConfirmTarget {
  branchName: string;
  isRemote: boolean;
}

export function Header() {
  const queryClient = useQueryClient();
  const { repoStatus: status, repoIsLoading: isLoading, openRepository, closeRepository, refreshRepoStatus: refreshStatus } =
    useRepositoryStore();
  const {
    loadBranches,
    checkoutBranch,
    checkoutRemoteBranch,
    branchIsLoading: branchesLoading,
  } = useBranchStore();
  const { loadStashes, saveStash, stashIsLoading: stashesLoading } = useStashStore();
  const { loadTags, tagIsLoading: tagsLoading } = useTagStore();
  const { undoInfo, undoIsUndoing: isUndoing, loadUndoInfo, performUndo } = useUndoStore();
  const { openBlade } = useBladeNavigation();
  const { addRecentRepo } = useRecentRepos();
  const navigationStore = useNavigationStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stashConfirmTarget, setStashConfirmTarget] =
    useState<StashConfirmTarget | null>(null);

  // Load undo info when repo opens
  useEffect(() => {
    if (status) {
      loadUndoInfo();
    }
  }, [status, loadUndoInfo]);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([
      loadBranches(),
      loadStashes(),
      loadTags(),
      loadUndoInfo(),
    ]);
    setIsRefreshing(false);
  };

  const isAnyLoading =
    isRefreshing || branchesLoading || stashesLoading || tagsLoading;

  const handleOpenRepo = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Open Git Repository",
      });

      if (selected && typeof selected === "string") {
        await openRepository(selected);
        await addRecentRepo(selected);
      }
    } catch (e) {
      console.error("Failed to open repository:", e);
    }
  };

  const handleClose = async () => {
    await closeRepository();
  };

  const handleUndo = async () => {
    if (!undoInfo?.canUndo) return;

    const confirmed = window.confirm(
      `Are you sure you want to undo?\n\n${undoInfo.description}`,
    );

    if (confirmed) {
      const success = await performUndo();
      if (success) {
        queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
        queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
        queryClient.invalidateQueries({ queryKey: ["repositoryStatus"] });
      }
    }
  };

  // Repo switching: open new repo atomically, restore last branch, show toast
  const handleRepoSwitch = useCallback(
    async (path: string) => {
      try {
        // Save current branch as last active for current repo
        if (status) {
          await navigationStore.setNavLastActiveBranch(
            status.repoPath,
            status.branchName,
          );
        }

        // Open new repository atomically (do NOT close first!)
        await openRepository(path);
        getNavigationActor().send({ type: "RESET_STACK" });
        await addRecentRepo(path);

        // Check if there's a last active branch for this repo
        const lastBranch = navigationStore.getNavLastActiveBranch(path);
        if (lastBranch) {
          try {
            await checkoutBranch(lastBranch);
          } catch {
            // Branch may have been deleted — stay on current
          }
        }

        // Refresh all data for new repo
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
    [
      status,
      navigationStore,
      openRepository,
      addRecentRepo,
      checkoutBranch,
      loadBranches,
      loadStashes,
      loadTags,
      loadUndoInfo,
    ],
  );

  // Perform the actual branch switch (local or remote)
  const performBranchSwitch = useCallback(
    async (branchName: string, isRemote: boolean) => {
      try {
        let success: boolean;
        if (isRemote) {
          success = await checkoutRemoteBranch(branchName);
        } else {
          success = await checkoutBranch(branchName);
        }

        if (success) {
          const localName = isRemote
            ? branchName.replace(/^[^/]+\//, "")
            : branchName;
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
    [
      checkoutBranch,
      checkoutRemoteBranch,
      status,
      navigationStore,
      refreshStatus,
    ],
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

    const stashed = await saveStash(
      `Auto-stash before switching to ${branchName}`,
      true,
    );

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
          {status && (
            <>
              <div className="w-px h-6 bg-ctp-surface1" />
              <RepoSwitcher onSelectRepo={handleRepoSwitch} />
              <BranchSwitcher onSelectBranch={handleBranchSwitch} />
            </>
          )}
          {status && <ProcessNavigation className="ml-4" />}
        </div>

        <div className="flex items-center gap-2">
          <ShortcutTooltip shortcut="mod+," label="Settings">
            <Button variant="ghost" size="sm" onClick={() => openBlade("settings", {} as Record<string, never>)}>
              <Settings className="w-4 h-4" />
            </Button>
          </ShortcutTooltip>
          <ThemeToggle />
          <ShortcutTooltip shortcut="mod+shift+P" label="Command Palette">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => useCommandPaletteStore.getState().togglePalette()}
            >
              <Search className="w-4 h-4" />
            </Button>
          </ShortcutTooltip>
          {status && undoInfo?.canUndo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={isUndoing}
              title={undoInfo.description || "Undo last operation"}
            >
              <Undo2 className={`w-4 h-4 ${isUndoing ? "animate-spin" : ""}`} />
            </Button>
          )}
          {status && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshAll}
              disabled={isAnyLoading}
              title="Refresh branches, stashes, and tags"
            >
              <RefreshCw
                className={`w-4 h-4 ${isAnyLoading ? "animate-spin" : ""}`}
              />
            </Button>
          )}
          {status && <SyncButtons />}
          {status && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openBlade("gitflow-cheatsheet", {} as Record<string, never>)}
              title="Gitflow Guide"
              aria-label="Open Gitflow guide"
            >
              <GitBranch className="w-4 h-4" />
            </Button>
          )}
          {status && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openBlade("repo-browser", {})}
              title="Browse repository files"
              aria-label="Browse repository files"
            >
              <FolderTree className="w-4 h-4" />
            </Button>
          )}
          {status && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openBlade("changelog", {} as Record<string, never>)}
              title="Generate Changelog"
            >
              <FileText className="w-4 h-4" />
            </Button>
          )}
          {status && (
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Close
            </Button>
          )}
          {status ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  const { revealItemInDir } = await import(
                    "@tauri-apps/plugin-opener"
                  );
                  await revealItemInDir(status.repoPath);
                } catch (e) {
                  toast.error(
                    `Failed to reveal: ${e instanceof Error ? e.message : String(e)}`,
                  );
                }
              }}
              className="text-ctp-subtext1 hover:text-ctp-text"
              title="Reveal in Finder"
              aria-label="Reveal repository in file manager"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Reveal
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                document.dispatchEvent(
                  new CustomEvent("clone-repository-dialog"),
                );
              }}
              disabled={isLoading}
              className="text-ctp-subtext1 hover:text-ctp-text"
              title="Clone Repository"
            >
              <GitFork className="w-4 h-4 mr-2" />
              Clone
            </Button>
          )}
          <ShortcutTooltip shortcut="mod+o" label="Open Repository">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenRepo}
              disabled={isLoading}
              className="text-ctp-subtext1 hover:text-ctp-text"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Open
            </Button>
          </ShortcutTooltip>
        </div>
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
