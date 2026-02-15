import { lazy } from "react";
import { GitBranch } from "lucide-react";
import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { getNavigationActor } from "@/framework/layout/navigation/context";
import { useGitOpsStore as useRepositoryStore } from "../../core/stores/domain/git-ops";
import { usePreferencesStore } from "../../core/stores/domain/preferences";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Lazy component import -- loaded on first blade render, not during activation
  const BranchManagerBlade = lazy(() =>
    import("../../core/blades/branch-manager/BranchManagerBlade").then((m) => ({
      default: m.BranchManagerBlade,
    }))
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
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all registrations
}
