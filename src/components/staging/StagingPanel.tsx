import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCheck, FolderTree, List, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { FileChange } from "../../bindings";
import { commands } from "../../bindings";
import { formatShortcut } from "../../hooks/useKeyboardShortcuts";
import { cn } from "../../lib/utils";
import { useStagingStore } from "../../stores/staging";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";
import { Button } from "../ui/button";
import { FileList } from "./FileList";
import { FileTreeSearch } from "./FileTreeSearch";
import { FileTreeView } from "./FileTreeView";

interface StagingPanelProps {
  onFileSelect?: (
    file: FileChange,
    section: "staged" | "unstaged" | "untracked",
  ) => void;
}

export function StagingPanel({ onFileSelect }: StagingPanelProps = {}) {
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
      <div className="p-3 space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
        <Skeleton className="h-4 w-20" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-5/6" />
        </div>
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
      <EmptyState
        icon={<FileCheck className="w-full h-full" />}
        title="All clear!"
        description="No changes to commit. Edit some files and they'll show up here."
      />
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
                  onFileSelect={onFileSelect}
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
                    title={`Stage All (${formatShortcut("mod+shift+A")})`}
                  >
                    Stage All
                  </button>
                </div>
                <FileTreeView
                  files={status.unstaged}
                  section="unstaged"
                  filter={searchFilter}
                  onFileSelect={onFileSelect}
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
                    title={`Stage All (${formatShortcut("mod+shift+A")})`}
                  >
                    Stage All
                  </button>
                </div>
                <FileTreeView
                  files={status.untracked}
                  section="untracked"
                  filter={searchFilter}
                  onFileSelect={onFileSelect}
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
              onFileSelect={onFileSelect}
            />
            <FileList
              title="Changes"
              files={status.unstaged}
              section="unstaged"
              onStageAll={() => stageAllMutation.mutate()}
              onFileSelect={onFileSelect}
            />
            <FileList
              title="Untracked Files"
              files={status.untracked}
              section="untracked"
              onStageAll={() => stageAllMutation.mutate()}
              onFileSelect={onFileSelect}
            />
          </>
        )}
      </div>
    </div>
  );
}
