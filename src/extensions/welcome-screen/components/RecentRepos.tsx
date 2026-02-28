import { Clock, Pin } from "lucide-react";
import { useCallback } from "react";
import { commands } from "../../../bindings";
import {
  type RecentRepo,
  useRecentRepos,
} from "../../../core/hooks/useRecentRepos";
import { useGitOpsStore as useRepositoryStore } from "../../../core/stores/domain/git-ops";
import { usePreferencesStore } from "../../../core/stores/domain/preferences";
import { useRepoHealth } from "../hooks/useRepoHealth";
import { RepoCard } from "./RepoCard";

interface RecentReposProps {
  onRepoOpened?: () => void;
}

export function RecentRepos({ onRepoOpened }: RecentReposProps) {
  const { recentRepos, isLoading, removeRecentRepo, addRecentRepo, togglePin } =
    useRecentRepos();
  const { openRepository } = useRepositoryStore();
  const terminal = usePreferencesStore(
    (s) => s.settingsData.integrations.terminal,
  );
  const healthMap = useRepoHealth(recentRepos);

  const handleOpenInTerminal = useCallback(
    async (path: string) => {
      const terminalApp = terminal || "terminal"; // default to system Terminal
      const result = await commands.openInTerminal(path, terminalApp);
      if (result.status === "error") {
        console.error("Failed to open terminal:", result.error);
      }
    },
    [terminal],
  );

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

  const pinnedCount = recentRepos.filter((r) => r.isPinned).length;
  const hasBothGroups = pinnedCount > 0 && pinnedCount < recentRepos.length;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-ctp-overlay1 flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Recent Repositories
        {pinnedCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-ctp-peach">
            <Pin className="w-3 h-3 rotate-45" />
            {pinnedCount}
          </span>
        )}
      </h2>
      <div className="space-y-1">
        {recentRepos.map((repo, index) => (
          <div key={repo.path}>
            {hasBothGroups && index === pinnedCount && (
              <hr className="border-ctp-surface0/50 my-1" />
            )}
            <RepoCard
              repo={repo}
              health={healthMap.get(repo.path)}
              onOpen={handleOpen}
              onRemove={removeRecentRepo}
              onTogglePin={togglePin}
              onOpenInTerminal={handleOpenInTerminal}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
