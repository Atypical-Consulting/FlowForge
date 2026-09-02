import { useQuery } from "@tanstack/react-query";
import { useSelector } from "@xstate/react";
import type { SnapshotFrom } from "xstate";
import { getMergeActor } from "@/core/machines/merge/context";
import type { mergeMachine } from "@/core/machines/merge/mergeMachine";
import { useConflictStore } from "../store";

/** Query key of the conflicted-file list (a `string[]` of repo-relative paths). */
export const CONFLICT_FILES_QUERY_KEY = ["conflictFiles"] as const;

/** How often the conflict list is re-read while conflicts may exist. */
export const CONFLICT_POLL_INTERVAL_MS = 3000;

/**
 * Whether the conflict list should keep polling the backend. Polling is only
 * useful while something can change the list: conflicts are present (the
 * user may resolve them from a terminal), or a merge is being run/aborted.
 * With no conflicts and no merge in flight, git hook events (merge, pull,
 * abort, commit) and the file watcher trigger explicit refreshes instead.
 */
export function shouldPollConflictFiles(
  paths: readonly string[] | undefined,
  mergeInProgress: boolean,
): boolean {
  return mergeInProgress || (paths?.length ?? 0) > 0;
}

const selectIsMergeInProgress = (snap: SnapshotFrom<typeof mergeMachine>) =>
  snap.matches("merging") ||
  snap.matches("conflicted") ||
  snap.matches("aborting");

/**
 * Conflicted-file list, backed by the conflict store's `loadConflictFiles`
 * (which also fills the store so the blade and toolbar badge can read it).
 * The query function always resolves with an array, never undefined.
 */
export function useConflictFiles() {
  const loadConflictFiles = useConflictStore((s) => s.loadConflictFiles);
  const mergeInProgress = useSelector(getMergeActor(), selectIsMergeInProgress);

  return useQuery({
    queryKey: CONFLICT_FILES_QUERY_KEY,
    queryFn: loadConflictFiles,
    refetchInterval: (query) =>
      shouldPollConflictFiles(query.state.data, mergeInProgress)
        ? CONFLICT_POLL_INTERVAL_MS
        : false,
  });
}
