import type { QueryClient } from "@tanstack/react-query";
import { useGitOpsStore } from "../stores/domain/git-ops";
import { queryClient as sharedQueryClient } from "./queryClient";

/**
 * TanStack Query keys whose data depends on HEAD, refs or the working tree.
 * Every mutation that can move HEAD (checkout, gitflow start/finish, merge,
 * undo, ...) must invalidate these.
 */
export const REPOSITORY_QUERY_KEYS: readonly (readonly string[])[] = [
  ["repositoryStatus"],
  ["stagingStatus"],
  ["commitHistory"],
  // Conflicted-file list of the conflict-resolution blade: changes with the
  // index (merge, abort, `git add` of a resolved file from a terminal).
  ["conflictFiles"],
];

/** Invalidate every repository-dependent TanStack query. */
export function invalidateRepositoryQueries(
  queryClient: QueryClient = sharedQueryClient,
): void {
  for (const queryKey of REPOSITORY_QUERY_KEYS) {
    queryClient.invalidateQueries({ queryKey: [...queryKey] });
  }
}

/**
 * Refresh all frontend state that can change when HEAD or refs move.
 *
 * The header branch indicator, both branch lists (local `branchList` and the
 * local + remote `branchAllList` rendered by the sidebar), gitflow panel,
 * tags, stashes, undo info and the worktree list (whose main entry shows the
 * checked-out branch) are backed by the git-ops Zustand store rather than
 * TanStack queries, so invalidating query keys alone leaves them stale.
 * This helper is the single post-mutation refresh shared by gitflow
 * operations, gitflow init, the "Refresh All" command and the file watcher
 * (for external `git checkout` / branch changes).
 *
 * Rejects with an aggregated error when any refresh failed, so callers such
 * as the gitflow machine can surface a "stale data" state. The commit graph is
 * only reloaded when it has already been loaded (topology blade opened).
 */
export async function refreshRepositoryState(
  queryClient: QueryClient = sharedQueryClient,
): Promise<void> {
  invalidateRepositoryQueries(queryClient);

  const store = useGitOpsStore.getState();
  const tasks: Promise<void>[] = [
    store.refreshRepoStatus(),
    store.reloadBranchLists(),
    store.refreshGitflow(),
    store.loadUndoInfo(),
    store.loadTags(),
    store.loadStashes(),
    // `git worktree list` is cheap and loadWorktrees never rejects (it records
    // its error in the store), so the sidebar row/badge follow HEAD for free.
    store.loadWorktrees(),
  ];
  if (store.nodes.length > 0) {
    tasks.push(store.loadGraph());
  }

  const results = await Promise.allSettled(tasks);
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) =>
      r.reason instanceof Error
        ? r.reason.message
        : String(r.reason ?? "Refresh failed"),
    );

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
}

/**
 * Whether a file-watcher payload contains a path inside the `.git` directory.
 * The backend only forwards `.git/HEAD`, `.git/packed-refs` and `.git/refs/**`,
 * so a hit means HEAD or a ref moved (branch switch, create, delete, fetch).
 */
export function containsGitDirPath(paths: readonly string[]): boolean {
  return paths.some((p) => p.split(/[\\/]/).includes(".git"));
}
