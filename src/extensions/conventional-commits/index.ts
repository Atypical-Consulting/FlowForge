import { lazy } from "react";
import type { ExtensionAPI } from "../ExtensionAPI";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // Lazy component imports -- loaded on first blade render, not during activation
  const ConventionalCommitBlade = lazy(() =>
    import("../../blades/conventional-commit/ConventionalCommitBlade").then((m) => ({
      default: m.ConventionalCommitBlade,
    }))
  );
  const ChangelogBlade = lazy(() =>
    import("../../blades/changelog/ChangelogBlade").then((m) => ({
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
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all blade unregistrations
}
