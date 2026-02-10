import { lazy } from "react";
import { FileText } from "lucide-react";
import type { ExtensionAPI } from "../ExtensionAPI";
import { openBlade } from "../../lib/bladeOpener";
import { useGitOpsStore as useRepositoryStore } from "../../stores/domain/git-ops";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Lazy component imports -- loaded on first blade render, not during activation
  const ConventionalCommitBlade = lazy(() =>
    import("./blades/conventional-commit/ConventionalCommitBlade").then((m) => ({
      default: m.ConventionalCommitBlade,
    }))
  );
  const ChangelogBlade = lazy(() =>
    import("./blades/changelog/ChangelogBlade").then((m) => ({
      default: m.ChangelogBlade,
    }))
  );

  // Register blade types with coreOverride to preserve existing blade type names
  api.registerBlade({
    type: "conventional-commit",
    title: "Conventional Commit",
    component: ConventionalCommitBlade,
    lazy: true,
    singleton: true,
    coreOverride: true,
  });

  api.registerBlade({
    type: "changelog",
    title: "Generate Changelog",
    component: ChangelogBlade,
    lazy: true,
    singleton: true,
    coreOverride: true,
  });

  // Contribute toolbar action for changelog
  api.contributeToolbar({
    id: "changelog",
    label: "Changelog",
    icon: FileText,
    group: "views",
    priority: 30,
    when: () => !!useRepositoryStore.getState().repoStatus,
    execute: () => {
      openBlade("changelog", {} as Record<string, never>);
    },
  });

  // Register command palette entries
  api.registerCommand({
    id: "generate-changelog",
    title: "Generate Changelog",
    description: "Generate a changelog from conventional commits",
    category: "Repository",
    icon: FileText,
    action: () => {
      openBlade("changelog", {} as Record<string, never>);
    },
    enabled: () => !!useRepositoryStore.getState().repoStatus,
  });

  api.registerCommand({
    id: "open-conventional-commit",
    title: "Open Conventional Commit Composer",
    category: "Repository",
    action: () => {
      openBlade("conventional-commit", {} as Record<string, never>);
    },
    enabled: () => !!useRepositoryStore.getState().repoStatus,
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all blade unregistrations
}
