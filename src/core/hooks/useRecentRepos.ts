import { useCallback, useEffect, useState } from "react";
import { getStore } from "../lib/store";

export interface RecentRepo {
  path: string;
  name: string;
  lastOpened: number;
}

const MAX_RECENT_REPOS = 10;
const RECENT_REPOS_KEY = "recent-repositories";

export function useRecentRepos() {
  const [recentRepos, setRecentRepos] = useState<RecentRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load recent repos on mount
  useEffect(() => {
    loadRecentRepos();
  }, []);

  const loadRecentRepos = async () => {
    try {
      const store = await getStore();
      const repos = await store.get<RecentRepo[]>(RECENT_REPOS_KEY);
      setRecentRepos(repos || []);
    } catch (e) {
      console.error("Failed to load recent repos:", e);
      setRecentRepos([]);
    } finally {
      setIsLoading(false);
    }
  };

  const addRecentRepo = useCallback(async (path: string, name?: string) => {
    try {
      const store = await getStore();
      const existing = (await store.get<RecentRepo[]>(RECENT_REPOS_KEY)) || [];

      // Extract folder name from path if not provided
      const repoName =
        name || path.split(/[/\\]/).filter(Boolean).pop() || path;

      // Remove if already exists (will re-add at front)
      const filtered = existing.filter((r) => r.path !== path);

      // Add to front with updated timestamp
      const updated: RecentRepo[] = [
        { path, name: repoName, lastOpened: Date.now() },
        ...filtered,
      ].slice(0, MAX_RECENT_REPOS);

      await store.set(RECENT_REPOS_KEY, updated);
      setRecentRepos(updated);
    } catch (e) {
      console.error("Failed to add recent repo:", e);
    }
  }, []);

  const removeRecentRepo = useCallback(async (path: string) => {
    try {
      const store = await getStore();
      const existing = (await store.get<RecentRepo[]>(RECENT_REPOS_KEY)) || [];
      const updated = existing.filter((r) => r.path !== path);
      await store.set(RECENT_REPOS_KEY, updated);
      setRecentRepos(updated);
    } catch (e) {
      console.error("Failed to remove recent repo:", e);
    }
  }, []);

  return {
    recentRepos,
    isLoading,
    addRecentRepo,
    removeRecentRepo,
    refresh: loadRecentRepos,
  };
}
