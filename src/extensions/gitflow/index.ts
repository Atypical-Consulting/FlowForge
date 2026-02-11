import { lazy } from "react";
import { GitBranch, GitMerge } from "lucide-react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { openBlade } from "../../core/lib/bladeOpener";
import { useGitOpsStore as useRepositoryStore } from "../../core/stores/domain/git-ops";
import { GitflowPanel } from "./components";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Lazy component import -- loaded on first blade render, not during activation
  const GitflowCheatsheetBlade = lazy(() =>
    import("./blades/GitflowCheatsheetBlade").then((m) => ({
      default: m.GitflowCheatsheetBlade,
    }))
  );

  // Register blade type with coreOverride to preserve existing blade type name
  api.registerBlade({
    type: "gitflow-cheatsheet",
    title: "Gitflow Guide",
    component: GitflowCheatsheetBlade,
    lazy: true,
    singleton: true,
    coreOverride: true,
  });

  // Contribute sidebar panel (replaces hardcoded RepositoryView section)
  api.contributeSidebarPanel({
    id: "gitflow-panel",
    title: "Gitflow",
    icon: GitMerge,
    component: GitflowPanel,
    priority: 65,
    defaultOpen: false,
  });

  // Contribute toolbar action (replaces core tb:gitflow-guide)
  api.contributeToolbar({
    id: "gitflow-guide",
    label: "Gitflow Guide",
    icon: GitBranch,
    group: "views",
    priority: 50,
    when: () => !!useRepositoryStore.getState().repoStatus,
    execute: () => {
      openBlade("gitflow-cheatsheet", {} as Record<string, never>);
    },
  });

  // Register command palette entry (replaces core open-gitflow-cheatsheet)
  api.registerCommand({
    id: "open-gitflow-cheatsheet",
    title: "Gitflow Cheatsheet",
    description: "Open the Gitflow workflow guide",
    category: "Navigation",
    icon: GitBranch,
    keywords: ["gitflow", "workflow", "guide", "branching", "reference", "cheatsheet"],
    action: () => {
      openBlade("gitflow-cheatsheet", {} as Record<string, never>);
    },
    enabled: () => !!useRepositoryStore.getState().repoStatus,
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all registrations
}
