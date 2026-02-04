import { open } from "@tauri-apps/plugin-dialog";
import {
  Circle,
  FileText,
  FolderOpen,
  GitBranch,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { useRecentRepos } from "../hooks/useRecentRepos";
import { useBranchStore } from "../stores/branches";
import { useChangelogStore } from "../stores/changelogStore";
import { useRepositoryStore } from "../stores/repository";
import { useStashStore } from "../stores/stash";
import { useTagStore } from "../stores/tags";
import { SyncButtons } from "./sync/SyncButtons";
import { Button } from "./ui/button";

export function Header() {
  const { status, isLoading, openRepository, closeRepository } =
    useRepositoryStore();
  const { loadBranches, isLoading: branchesLoading } = useBranchStore();
  const { loadStashes, isLoading: stashesLoading } = useStashStore();
  const { loadTags, isLoading: tagsLoading } = useTagStore();
  const openChangelog = useChangelogStore((s) => s.openDialog);
  const { addRecentRepo } = useRecentRepos();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([loadBranches(), loadStashes(), loadTags()]);
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

  return (
    <header className="flex items-center justify-between h-14 px-4 border-b border-ctp-surface0 bg-ctp-mantle/80 backdrop-blur-md select-none sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-ctp-text">FlowForge</h1>
        {status && (
          <>
            <span className="text-ctp-overlay0">/</span>
            <span className="text-sm text-ctp-subtext1">{status.repoName}</span>
          </>
        )}

        {status && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-ctp-surface0">
            <GitBranch className="w-4 h-4 text-ctp-subtext0" />
            <span className="text-sm text-ctp-text font-medium font-mono">
              {status.branchName}
            </span>
            {status.isDirty && (
              <Circle
                className="w-2 h-2 fill-ctp-yellow text-ctp-yellow"
                aria-label="Uncommitted changes"
              />
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
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
            onClick={openChangelog}
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
      </div>
    </header>
  );
}
