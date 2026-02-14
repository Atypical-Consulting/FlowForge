import { useEffect, useRef, useState } from "react";
import { commands, type RepoHealth } from "../../../bindings";
import type { RecentRepo } from "../../../core/hooks/useRecentRepos";

export type RepoHealthStatus = {
  status:
    | "clean"
    | "dirty"
    | "ahead"
    | "behind"
    | "diverged"
    | "unknown"
    | "loading";
  branchName: string;
  ahead: number;
  behind: number;
  isDirty: boolean;
};

const LOADING_STATUS: RepoHealthStatus = {
  status: "loading",
  branchName: "",
  ahead: 0,
  behind: 0,
  isDirty: false,
};

function toHealthStatus(health: RepoHealth): RepoHealthStatus {
  return {
    status: health.status as RepoHealthStatus["status"],
    branchName: health.branchName,
    ahead: health.ahead,
    behind: health.behind,
    isDirty: health.isDirty,
  };
}

/**
 * Asynchronously fetches health status for a list of recent repos.
 * Returns a Map keyed by repo path with current health status.
 * Initializes all repos as "loading" so cards render immediately.
 */
export function useRepoHealth(repos: RecentRepo[]) {
  const [healthMap, setHealthMap] = useState<Map<string, RepoHealthStatus>>(
    () => new Map(),
  );
  const abortRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Debounce: if repos reference changes within 500ms, cancel pending checks
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set abort flag for any in-flight requests from previous run
    abortRef.current = true;

    debounceRef.current = setTimeout(() => {
      // Reset abort flag for this run
      abortRef.current = false;
      const currentAbort = abortRef;

      // Initialize all repos with loading status immediately
      setHealthMap((prev) => {
        const next = new Map(prev);
        for (const repo of repos) {
          if (!next.has(repo.path)) {
            next.set(repo.path, LOADING_STATUS);
          }
        }
        return next;
      });

      // Fetch all in parallel
      Promise.allSettled(
        repos.map(async (repo) => {
          const result = await commands.getRepoHealthQuick(repo.path);
          if (currentAbort.current) return; // Abort if stale
          if (result.status === "ok") {
            setHealthMap((prev) => {
              const next = new Map(prev);
              next.set(repo.path, toHealthStatus(result.data));
              return next;
            });
          } else {
            setHealthMap((prev) => {
              const next = new Map(prev);
              next.set(repo.path, {
                status: "unknown",
                branchName: "",
                ahead: 0,
                behind: 0,
                isDirty: false,
              });
              return next;
            });
          }
        }),
      );
    }, 500);

    return () => {
      abortRef.current = true;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [repos]);

  return healthMap;
}
