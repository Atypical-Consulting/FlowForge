import { AlertTriangle } from "lucide-react";
import { lazy } from "react";
import { queryClient } from "@/core/lib/queryClient";
import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { useToolbarRegistry } from "@/framework/extension-system/toolbarRegistry";
import { openBlade } from "@/framework/layout/bladeOpener";
import { useGitOpsStore } from "../../core/stores/domain/git-ops";
import { CONFLICT_FILES_QUERY_KEY } from "./hooks/useConflictQuery";
import { useConflictStore } from "./store";

let unsubConflictWatch: (() => void) | null = null;
let unsubRepoWatch: (() => void) | null = null;

/** Forget every conflict when the repository is closed. */
function clearConflictFiles(): void {
  useConflictStore.setState({
    files: new Map(),
    activeFilePath: null,
    loadingPath: null,
  });
  queryClient.setQueryData(CONFLICT_FILES_QUERY_KEY, []);
}

/**
 * Re-read the conflicted-file list and mirror it into the TanStack query so
 * the blade's `useConflictFiles` (and its polling decision) stays in sync
 * even when the refresh was triggered outside the query, e.g. by a git hook.
 */
export async function refreshConflictFiles(): Promise<string[]> {
  const paths = await useConflictStore.getState().loadConflictFiles();
  queryClient.setQueryData(CONFLICT_FILES_QUERY_KEY, paths);
  return paths;
}

export async function onActivate(api: ExtensionAPI): Promise<void> {
  const ConflictResolutionBlade = lazy(() =>
    import("./blades/ConflictResolutionBlade").then((m) => ({
      default: m.ConflictResolutionBlade,
    })),
  );

  api.registerBlade({
    type: "conflict-resolution",
    title: (props: { filePath?: string }) =>
      `Resolve: ${props?.filePath || "Conflicts"}`,
    component: ConflictResolutionBlade,
    lazy: true,
    singleton: false,
    coreOverride: true,
  });

  api.contributeToolbar({
    id: "conflict-badge",
    label: "Merge Conflicts",
    icon: AlertTriangle,
    group: "git-actions",
    priority: 40,
    when: () => {
      const count = useConflictStore.getState().conflictCount();
      return count > 0;
    },
    execute: () => {
      openBlade("conflict-resolution", {});
    },
  });

  api.registerCommand({
    id: "open-conflict-resolution",
    title: "Resolve Merge Conflicts",
    description: "Open the conflict resolution view",
    category: "Git",
    icon: AlertTriangle,
    keywords: ["conflict", "merge", "resolve", "ours", "theirs"],
    action: () => {
      void refreshConflictFiles();
      openBlade("conflict-resolution", {});
    },
    enabled: () => !!useGitOpsStore.getState().repoStatus,
  });

  // The toolbar only re-evaluates `when()` on repo status or registry
  // changes, so tell it explicitly whenever the conflict list changes
  // (conflicts appear after a merge, disappear after resolve/abort).
  unsubConflictWatch?.();
  unsubConflictWatch = useConflictStore.subscribe((state, prevState) => {
    if (state.files !== prevState.files) {
      useToolbarRegistry.getState().refreshVisibility();
    }
  });

  // Refresh the conflict list after operations that can create or clear
  // conflicts, whether or not the blade (and its query) is mounted.
  const refresh = () => {
    void refreshConflictFiles();
  };

  // A repository can already be mid-merge when it is opened (app launch or
  // reload with `UU` entries in `git status`), and `refreshRepositoryState`
  // (file watcher on .git, gitflow ops, "Refresh All") replaces `repoStatus`
  // with a fresh object. Neither goes through a git hook, so follow the repo
  // store: load the list whenever `repoStatus` changes, clear it on close.
  unsubRepoWatch?.();
  unsubRepoWatch = useGitOpsStore.subscribe((state, prevState) => {
    if (state.repoStatus === prevState.repoStatus) return;
    if (state.repoStatus) {
      refresh();
    } else {
      clearConflictFiles();
    }
  });
  if (useGitOpsStore.getState().repoStatus) {
    refresh();
  }
  api.onDidGit("merge", refresh);
  api.onDidGit("merge-abort", refresh);
  api.onDidGit("pull", refresh);
  api.onDidGit("commit", refresh);
}

export function onDeactivate(): void {
  unsubConflictWatch?.();
  unsubConflictWatch = null;
  unsubRepoWatch?.();
  unsubRepoWatch = null;
  // api.cleanup() handles all registrations
}
