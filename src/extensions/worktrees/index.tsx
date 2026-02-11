import { FolderGit2, Plus, RefreshCw } from "lucide-react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { useGitOpsStore } from "../../core/stores/domain/git-ops";
import { WorktreeSidebarPanel } from "./components";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Contribute sidebar panel (replaces hardcoded RepositoryView section)
  api.contributeSidebarPanel({
    id: "worktree-panel",
    title: "Worktrees",
    icon: FolderGit2,
    component: WorktreeSidebarPanel,
    priority: 69,
    defaultOpen: false,
    renderAction: () => {
      // "+" button that dispatches CustomEvent to open create dialog
      const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("worktree:open-create-dialog"));
      };
      return (
        <button
          type="button"
          onClick={handleClick}
          className="p-1 hover:bg-ctp-surface1 rounded text-ctp-subtext0 hover:text-ctp-text"
          title="Create new worktree"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      );
    },
    badge: () => {
      const count = useGitOpsStore.getState().worktreeList.length;
      return count > 1 ? count : null;
    },
  });

  // Register "Create Worktree" command in palette
  api.registerCommand({
    id: "create-worktree",
    title: "Create Worktree",
    description: "Create a new git worktree",
    category: "Worktrees",
    icon: FolderGit2,
    keywords: ["worktree", "create", "new", "folder"],
    action: () => {
      document.dispatchEvent(new CustomEvent("worktree:open-create-dialog"));
    },
    enabled: () => !!useGitOpsStore.getState().repoStatus,
  });

  // Register "Refresh Worktrees" command in palette
  api.registerCommand({
    id: "refresh-worktrees",
    title: "Refresh Worktrees",
    description: "Reload the worktree list",
    category: "Worktrees",
    icon: RefreshCw,
    keywords: ["worktree", "refresh", "reload", "list"],
    action: () => {
      useGitOpsStore.getState().loadWorktrees();
    },
    enabled: () => !!useGitOpsStore.getState().repoStatus,
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all registrations
}
