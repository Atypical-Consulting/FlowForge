import { Clock, Folder, X } from "lucide-react";
import { type RecentRepo, useRecentRepos } from "../hooks/useRecentRepos";
import { useRepositoryStore } from "../stores/repository";
import { Button } from "./ui/button";

interface RecentReposProps {
  onRepoOpened?: () => void;
}

export function RecentRepos({ onRepoOpened }: RecentReposProps) {
  const { recentRepos, isLoading, removeRecentRepo, addRecentRepo } =
    useRecentRepos();
  const { openRepository } = useRepositoryStore();

  if (isLoading) {
    return (
      <div className="text-ctp-overlay0 text-sm py-4">
        Loading recent repos...
      </div>
    );
  }

  if (recentRepos.length === 0) {
    return null;
  }

  const handleOpen = async (repo: RecentRepo) => {
    try {
      await openRepository(repo.path);
      await addRecentRepo(repo.path, repo.name);
      onRepoOpened?.();
    } catch (e) {
      console.error("Failed to open recent repo:", e);
    }
  };

  const formatTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const truncatePath = (path: string, maxLength = 50): string => {
    if (path.length <= maxLength) return path;
    const parts = path.split(/[/\\]/);
    if (parts.length <= 3) return path;
    return `${parts[0]}/.../${parts.slice(-2).join("/")}`;
  };

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-ctp-overlay1 flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Recent Repositories
      </h2>
      <div className="space-y-1">
        {recentRepos.map((repo) => (
          <div
            key={repo.path}
            className="group flex items-center gap-3 p-3 rounded-lg hover:bg-ctp-surface0/50 cursor-pointer transition-colors"
            onClick={() => handleOpen(repo)}
            onKeyDown={(e) => e.key === "Enter" && handleOpen(repo)}
            role="button"
            tabIndex={0}
          >
            <Folder className="w-5 h-5 text-ctp-blue shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ctp-text truncate">
                {repo.name}
              </div>
              <div className="text-xs text-ctp-overlay0 truncate">
                {truncatePath(repo.path)}
              </div>
            </div>
            <div className="text-xs text-ctp-overlay0 shrink-0">
              {formatTime(repo.lastOpened)}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 h-7 w-7 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                removeRecentRepo(repo.path);
              }}
              aria-label={`Remove ${repo.name} from recent`}
            >
              <X className="w-4 h-4 text-ctp-overlay0 hover:text-ctp-red" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
