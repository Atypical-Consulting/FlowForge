import {
  Check,
  Copy,
  GitBranch,
  GitMerge,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { lazy } from "react";
import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { getNavigationActor } from "@/framework/layout/navigation/context";
import { toast } from "@/framework/stores/toast";
import { useGitOpsStore as useRepositoryStore } from "../../core/stores/domain/git-ops";
import { usePreferencesStore } from "../../core/stores/domain/preferences";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Lazy component import -- loaded on first blade render, not during activation
  const BranchManagerBlade = lazy(() =>
    import("./blades/BranchManagerBlade").then((m) => ({
      default: m.BranchManagerBlade,
    })),
  );

  // Register blade type with coreOverride to preserve existing blade type name
  api.registerBlade({
    type: "branch-manager",
    title: "Branch Manager",
    component: BranchManagerBlade,
    lazy: true,
    singleton: true,
    coreOverride: true,
  });

  // Register command: create-branch
  api.registerCommand({
    id: "create-branch",
    title: "Create Branch",
    description: "Create a new Git branch",
    category: "Branches",
    icon: GitBranch,
    action: () => {
      document.dispatchEvent(new CustomEvent("create-branch-dialog"));
    },
    enabled: () => !!useRepositoryStore.getState().repoStatus,
  });

  // Register command: show-branches
  api.registerCommand({
    id: "show-branches",
    title: "Show Branches",
    description: "Toggle the branches dropdown",
    category: "Navigation",
    shortcut: "mod+b",
    icon: GitBranch,
    action: () => {
      usePreferencesStore.getState().toggleNavBranchDropdown();
    },
    enabled: () => !!useRepositoryStore.getState().repoStatus,
  });

  // Register command: open-branch-manager
  api.registerCommand({
    id: "open-branch-manager",
    title: "Open Branch Manager",
    description: "Open the branch management blade",
    category: "Navigation",
    shortcut: "mod+shift+b",
    icon: GitBranch,
    action: () => {
      getNavigationActor().send({
        type: "PUSH_BLADE",
        bladeType: "branch-manager" as const,
        title: "Branch Manager",
        props: {},
      });
    },
    enabled: () => !!useRepositoryStore.getState().repoStatus,
  });

  // Register toolbar action: create-branch
  api.contributeToolbar({
    id: "create-branch",
    label: "Create Branch",
    icon: GitBranch,
    group: "git-actions",
    priority: 35,
    when: () => !!useRepositoryStore.getState().repoStatus,
    execute: () => {
      document.dispatchEvent(new CustomEvent("create-branch-dialog"));
    },
  });

  // Context menu items for branch rows (branch-list). The row passes the
  // same callbacks its hover buttons use through `ctx.actions`, so these
  // items reuse BranchList's checkout / merge-dialog / delete-confirm paths.
  api.contributeContextMenu({
    id: "checkout",
    label: "Switch to branch",
    icon: Check,
    location: "branch-list",
    group: "1-branch",
    priority: 100,
    when: (ctx) => !ctx.isHead && !!ctx.actions?.checkout,
    execute: (ctx) => ctx.actions?.checkout?.(),
  });

  api.contributeContextMenu({
    id: "merge",
    label: "Merge into current branch",
    icon: GitMerge,
    location: "branch-list",
    group: "1-branch",
    priority: 90,
    when: (ctx) => !ctx.isHead && !!ctx.actions?.merge,
    execute: (ctx) => ctx.actions?.merge?.(),
  });

  api.contributeContextMenu({
    id: "pin",
    label: "Pin branch",
    icon: Pin,
    location: "branch-list",
    group: "2-organize",
    priority: 100,
    when: (ctx) => !ctx.isPinned && !!ctx.actions?.togglePin,
    execute: (ctx) => ctx.actions?.togglePin?.(),
  });

  api.contributeContextMenu({
    id: "unpin",
    label: "Unpin branch",
    icon: PinOff,
    location: "branch-list",
    group: "2-organize",
    priority: 100,
    when: (ctx) => !!ctx.isPinned && !!ctx.actions?.togglePin,
    execute: (ctx) => ctx.actions?.togglePin?.(),
  });

  api.contributeContextMenu({
    id: "copy-name",
    label: "Copy branch name",
    icon: Copy,
    location: "branch-list",
    group: "3-clipboard",
    priority: 100,
    when: (ctx) => !!ctx.branchName,
    execute: async (ctx) => {
      if (!ctx.branchName) return;
      await navigator.clipboard.writeText(ctx.branchName);
      toast.success("Branch name copied to clipboard");
    },
  });

  api.contributeContextMenu({
    id: "delete",
    label: "Delete branch",
    icon: Trash2,
    location: "branch-list",
    group: "4-danger",
    priority: 100,
    when: (ctx) => !ctx.isHead && !!ctx.actions?.delete,
    execute: (ctx) => ctx.actions?.delete?.(),
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all registrations
}
