import { open } from "@tauri-apps/plugin-dialog";
import { Circle, FolderOpen, GitBranch } from "lucide-react";
import { useRecentRepos } from "../hooks/useRecentRepos";
import { useRepositoryStore } from "../stores/repository";
import { SyncButtons } from "./sync/SyncButtons";
import { Button } from "./ui/button";

export function Header() {
  const { status, isLoading, openRepository, closeRepository } =
    useRepositoryStore();
  const { addRecentRepo } = useRecentRepos();

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
    <header className="flex items-center justify-between h-14 px-4 border-b border-gray-800 bg-gray-900 select-none">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-white">FlowForge</h1>

        {status && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-gray-800">
            <GitBranch className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-white font-medium">
              {status.branchName}
            </span>
            {status.isDirty && (
              <Circle
                className="w-2 h-2 fill-yellow-500 text-yellow-500"
                aria-label="Uncommitted changes"
              />
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {status && <SyncButtons />}
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
          className="text-gray-300 hover:text-white"
        >
          <FolderOpen className="w-4 h-4 mr-2" />
          Open
        </Button>
      </div>
    </header>
  );
}
