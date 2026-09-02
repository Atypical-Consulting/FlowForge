import { FolderOpen, FolderTree, GitFork, RefreshCw, X } from "lucide-react";
import { lazy } from "react";
import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { openBlade } from "@/framework/layout/bladeOpener";
import { BladeBreadcrumb } from "../../core/blades/_shared/BladeBreadcrumb";
import { refreshRepositoryState } from "../../core/lib/repositoryRefresh";
import {
  isRepositoryOpen,
  useGitOpsStore as useRepositoryStore,
} from "../../core/stores/domain/git-ops";

/** Shared repo-open condition (same source as the welcome-screen switch). */
const whenRepoOpen = isRepositoryOpen;

/** Shared repo-closed condition. */
const whenRepoNotOpen = (): boolean => !isRepositoryOpen();

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Lazy component import
  const RepoBrowserBlade = lazy(() =>
    import("./blades/RepoBrowserBlade").then((m) => ({
      default: m.RepoBrowserBlade,
    })),
  );

  // ── Blade registration ──────────────────────────────────────────────
  api.registerBlade({
    type: "repo-browser",
    title: (props: { path?: string }) => {
      if (!props.path) return "Repository Browser";
      return props.path.split("/").pop() || "Repository Browser";
    },
    component: RepoBrowserBlade,
    lazy: true,
    singleton: true,
    coreOverride: true,
    renderTitleContent: (props: { path?: string }) => (
      <BladeBreadcrumb path={props.path || ""} />
    ),
  });

  // ── Commands ────────────────────────────────────────────────────────
  api.registerCommand({
    id: "open-repository",
    title: "Open Repository",
    description: "Open a local Git repository",
    category: "Repository",
    shortcut: "mod+o",
    icon: FolderOpen,
    action: () => {
      document.dispatchEvent(new CustomEvent("open-repository-dialog"));
    },
  });

  api.registerCommand({
    id: "close-repository",
    title: "Close Repository",
    description: "Close the current repository",
    category: "Repository",
    icon: X,
    action: () => {
      useRepositoryStore.getState().closeRepository();
    },
    enabled: () => !!useRepositoryStore.getState().repoStatus,
  });

  api.registerCommand({
    id: "clone-repository",
    title: "Clone Repository",
    description: "Clone a remote Git repository",
    category: "Repository",
    shortcut: "mod+shift+o",
    icon: GitFork,
    action: () => {
      document.dispatchEvent(new CustomEvent("clone-repository-dialog"));
    },
  });

  api.registerCommand({
    id: "refresh-all",
    title: "Refresh All",
    description:
      "Refresh status, branches, stashes, tags, history and gitflow state",
    category: "Repository",
    icon: RefreshCw,
    action: () => {
      // Shared post-mutation refresh: repo status (header branch), both
      // branch lists, gitflow, undo, tags, stashes, graph + query invalidation.
      refreshRepositoryState().catch((e) => {
        console.error("Refresh All failed:", e);
      });
    },
    enabled: () => !!useRepositoryStore.getState().repoStatus,
  });

  // ── Toolbar actions ─────────────────────────────────────────────────
  api.contributeToolbar({
    id: "open-repo",
    label: "Open Repository",
    icon: FolderOpen,
    group: "app",
    priority: 100,
    commandId: "ext:repository:open-repository",
    execute: () => {
      document.dispatchEvent(new CustomEvent("open-repository-dialog"));
    },
  });

  api.contributeToolbar({
    id: "close-repo",
    label: "Close Repository",
    icon: X,
    group: "navigation",
    priority: 60,
    commandId: "ext:repository:close-repository",
    when: whenRepoOpen,
    execute: () => {
      useRepositoryStore.getState().closeRepository();
    },
  });

  api.contributeToolbar({
    id: "clone-repo",
    label: "Clone Repository",
    icon: GitFork,
    group: "navigation",
    priority: 40,
    commandId: "ext:repository:clone-repository",
    when: whenRepoNotOpen,
    execute: () => {
      document.dispatchEvent(new CustomEvent("clone-repository-dialog"));
    },
  });

  api.contributeToolbar({
    id: "reveal-in-finder",
    label: "Reveal in File Manager",
    icon: FolderOpen,
    group: "navigation",
    priority: 50,
    when: whenRepoOpen,
    execute: async () => {
      try {
        const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
        const repoPath = useRepositoryStore.getState().repoStatus?.repoPath;
        if (repoPath) {
          await revealItemInDir(repoPath);
        }
      } catch (e) {
        const { toast } = await import("@/framework/stores/toast");
        toast.error(
          `Failed to reveal: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
  });

  api.contributeToolbar({
    id: "refresh-all",
    label: "Refresh All",
    commandId: "ext:repository:refresh-all",
    icon: RefreshCw,
    group: "git-actions",
    priority: 70,
    when: whenRepoOpen,
    isLoading: () => {
      const repoStore = useRepositoryStore.getState();
      return (
        repoStore.branchIsLoading ||
        repoStore.stashIsLoading ||
        repoStore.tagIsLoading
      );
    },
    execute: async () => {
      const store = useRepositoryStore.getState();
      await Promise.all([
        store.reloadBranchLists(),
        store.loadStashes(),
        store.loadTags(),
      ]);
    },
  });

  api.contributeToolbar({
    id: "repo-browser",
    label: "Browse Repository",
    icon: FolderTree,
    group: "views",
    priority: 40,
    when: whenRepoOpen,
    execute: () => {
      openBlade("repo-browser", {} as Record<string, never>);
    },
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all registrations
}
