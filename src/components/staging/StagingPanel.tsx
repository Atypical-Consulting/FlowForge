import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderTree, List, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { commands } from "../../bindings";
import { cn } from "../../lib/utils";
import { useStagingStore } from "../../stores/staging";
import { Button } from "../ui/button";
import { FileList } from "./FileList";
import { FileTreeSearch } from "./FileTreeSearch";
import { FileTreeView } from "./FileTreeView";

export function StagingPanel() {
  const queryClient = useQueryClient();
  const { viewMode, setViewMode, selectedFile, selectFile } = useStagingStore();
  const [searchFilter, setSearchFilter] = useState("");

  const {
    data: result,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["stagingStatus"],
    queryFn: () => commands.getStagingStatus(),
    refetchInterval: 2000,
  });

  const stageAllMutation = useMutation({
    mutationFn: () => commands.stageAll(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["stagingStatus"] }),
  });

  const unstageAllMutation = useMutation({
    mutationFn: () => commands.unstageAll(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["stagingStatus"] }),
  });

  // Auto-select first file when data loads and no selection exists
  useEffect(() => {
    if (!selectedFile && result?.status === "ok") {
      const status = result.data;
      if (status.staged.length > 0) {
        selectFile(status.staged[0], "staged");
      } else if (status.unstaged.length > 0) {
        selectFile(status.unstaged[0], "unstaged");
      } else if (status.untracked.length > 0) {
        selectFile(status.untracked[0], "untracked");
      }
    }
  }, [result, selectedFile, selectFile]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-ctp-subtext0" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-ctp-red text-sm">Failed to load file status</div>
    );
  }

  if (!result || result.status === "error") {
    return (
      <div className="p-4 text-ctp-red text-sm">
        {result?.status === "error" ? String(result.error) : "No data"}
      </div>
    );
  }

  const status = result.data;
  const hasChanges =
    status.staged.length > 0 ||
    status.unstaged.length > 0 ||
    status.untracked.length > 0;

  if (!hasChanges) {
    return (
      <div className="p-4 text-ctp-overlay0 text-sm text-center">
        No changes to commit
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Search and view mode toggle */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-ctp-surface0">
        <FileTreeSearch
          value={searchFilter}
          onChange={setSearchFilter}
          placeholder="Filter files..."
        />
        <div className="flex items-center gap-1 bg-ctp-surface0 rounded p-0.5">
          <Button
            variant={viewMode === "tree" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("tree")}
            title="Tree view"
            className={cn("h-6 w-6 p-0")}
          >
            <FolderTree className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant={viewMode === "flat" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("flat")}
            title="Flat list"
            className={cn("h-6 w-6 p-0")}
          >
            <List className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* File lists */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === "tree" ? (
          <>
            {status.staged.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between px-3 py-2 text-sm font-medium text-ctp-subtext1">
                  <span>
                    Staged Changes{" "}
                    <span className="text-xs text-ctp-overlay0 bg-ctp-surface0 px-1.5 py-0.5 rounded ml-1">
                      {status.staged.length}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => unstageAllMutation.mutate()}
                    className="text-xs text-ctp-subtext0 hover:text-ctp-text"
                  >
                    Unstage All
                  </button>
                </div>
                <FileTreeView
                  files={status.staged}
                  section="staged"
                  filter={searchFilter}
                />
              </div>
            )}
            {status.unstaged.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between px-3 py-2 text-sm font-medium text-ctp-subtext1">
                  <span>
                    Changes{" "}
                    <span className="text-xs text-ctp-overlay0 bg-ctp-surface0 px-1.5 py-0.5 rounded ml-1">
                      {status.unstaged.length}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => stageAllMutation.mutate()}
                    className="text-xs text-ctp-subtext0 hover:text-ctp-text"
                  >
                    Stage All
                  </button>
                </div>
                <FileTreeView
                  files={status.unstaged}
                  section="unstaged"
                  filter={searchFilter}
                />
              </div>
            )}
            {status.untracked.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between px-3 py-2 text-sm font-medium text-ctp-subtext1">
                  <span>
                    Untracked Files{" "}
                    <span className="text-xs text-ctp-overlay0 bg-ctp-surface0 px-1.5 py-0.5 rounded ml-1">
                      {status.untracked.length}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => stageAllMutation.mutate()}
                    className="text-xs text-ctp-subtext0 hover:text-ctp-text"
                  >
                    Stage All
                  </button>
                </div>
                <FileTreeView
                  files={status.untracked}
                  section="untracked"
                  filter={searchFilter}
                />
              </div>
            )}
          </>
        ) : (
          <>
            <FileList
              title="Staged Changes"
              files={status.staged}
              section="staged"
              onUnstageAll={() => unstageAllMutation.mutate()}
            />
            <FileList
              title="Changes"
              files={status.unstaged}
              section="unstaged"
              onStageAll={() => stageAllMutation.mutate()}
            />
            <FileList
              title="Untracked Files"
              files={status.untracked}
              section="untracked"
              onStageAll={() => stageAllMutation.mutate()}
            />
          </>
        )}
      </div>
    </div>
  );
}
