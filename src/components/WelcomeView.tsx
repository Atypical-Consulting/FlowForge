import { open } from "@tauri-apps/plugin-dialog";
import { AlertCircle, FolderOpen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { commands } from "../bindings";
import { useRecentRepos } from "../hooks/useRecentRepos";
import { useRepositoryStore } from "../stores/repository";
import { RecentRepos } from "./RecentRepos";
import { Button } from "./ui/button";

export function WelcomeView() {
  const { openRepository, isLoading, error, clearError } = useRepositoryStore();
  const { addRecentRepo } = useRecentRepos();
  const [isDragOver, setIsDragOver] = useState(false);

  const openDialog = useCallback(async () => {
    try {
      clearError();
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
  }, [openRepository, addRecentRepo, clearError]);

  // Listen for keyboard shortcut event
  useEffect(() => {
    const handler = () => openDialog();
    document.addEventListener("open-repository-dialog", handler);
    return () =>
      document.removeEventListener("open-repository-dialog", handler);
  }, [openDialog]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      clearError();

      const items = e.dataTransfer.items;
      if (!items || items.length === 0) return;

      // Try to get the path from the dropped item
      const item = items[0];
      if (item.kind !== "file") return;

      const file = item.getAsFile();
      if (!file) return;

      // In Tauri, dropped files have a path property
      const path = (file as File & { path?: string }).path;
      if (!path) {
        console.error("Could not get path from dropped item");
        return;
      }

      try {
        // Verify it's a git repository
        const isRepo = await commands.isGitRepository(path);
        if (isRepo.status === "error" || !isRepo.data) {
          throw new Error(`"${path}" is not a Git repository`);
        }

        await openRepository(path);
        await addRecentRepo(path);
      } catch (e) {
        console.error("Failed to open dropped repository:", e);
      }
    },
    [openRepository, addRecentRepo, clearError],
  );

  return (
    <div
      className={`flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] bg-gray-950 p-8 transition-colors ${
        isDragOver ? "bg-blue-950/20" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="fixed inset-0 bg-blue-500/10 pointer-events-none flex items-center justify-center z-50">
          <div className="text-xl font-medium text-blue-400 bg-gray-900/90 px-8 py-4 rounded-xl border border-blue-500/30">
            Drop folder to open repository
          </div>
        </div>
      )}

      <div className="max-w-md w-full space-y-8">
        {/* Main action */}
        <div className="text-center space-y-4">
          <div className="inline-flex p-4 rounded-full bg-gray-800/50">
            <FolderOpen className="w-12 h-12 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Open a Repository</h2>
          <p className="text-gray-400">
            Select a folder or drag and drop a Git repository to get started.
          </p>
          <Button
            size="lg"
            onClick={openDialog}
            disabled={isLoading}
            className="mt-4"
          >
            {isLoading ? "Opening..." : "Open Repository"}
          </Button>
          <p className="text-xs text-gray-500">
            or press{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 font-mono">
              {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+O
            </kbd>
          </p>
        </div>

        {/* Error display */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-800/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-red-300">
                Failed to open repository
              </div>
              <div className="text-sm text-red-400/80 mt-1">{error}</div>
            </div>
          </div>
        )}

        {/* Recent repos */}
        <RecentRepos />
      </div>
    </div>
  );
}
