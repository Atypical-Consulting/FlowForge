import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderTree, List, Loader2 } from "lucide-react";
import { commands } from "../../bindings";
import { cn } from "../../lib/utils";
import { useStagingStore } from "../../stores/staging";
import { Button } from "../ui/button";
import { FileList } from "./FileList";
import { FileTreeView } from "./FileTreeView";

export function StagingPanel() {
  const queryClient = useQueryClient();
  const { viewMode, setViewMode } = useStagingStore();

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-400 text-sm">Failed to load file status</div>
    );
  }

  if (!result || result.status === "error") {
    return (
      <div className="p-4 text-red-400 text-sm">
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
      <div className="p-4 text-gray-500 text-sm text-center">
        No changes to commit
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* View mode toggle */}
      <div className="flex items-center justify-end px-3 py-1.5 border-b border-gray-800">
        <div className="flex items-center gap-1 bg-gray-800 rounded p-0.5">
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
                <div className="flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-300">
                  <span>
                    Staged Changes{" "}
                    <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded ml-1">
                      {status.staged.length}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => unstageAllMutation.mutate()}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Unstage All
                  </button>
                </div>
                <FileTreeView files={status.staged} section="staged" />
              </div>
            )}
            {status.unstaged.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-300">
                  <span>
                    Changes{" "}
                    <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded ml-1">
                      {status.unstaged.length}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => stageAllMutation.mutate()}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Stage All
                  </button>
                </div>
                <FileTreeView files={status.unstaged} section="unstaged" />
              </div>
            )}
            {status.untracked.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-300">
                  <span>
                    Untracked Files{" "}
                    <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded ml-1">
                      {status.untracked.length}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => stageAllMutation.mutate()}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Stage All
                  </button>
                </div>
                <FileTreeView files={status.untracked} section="untracked" />
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
