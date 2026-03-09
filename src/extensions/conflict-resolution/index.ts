import { AlertTriangle } from "lucide-react";
import { lazy } from "react";
import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { openBlade } from "@/framework/layout/bladeOpener";
import { useGitOpsStore } from "../../core/stores/domain/git-ops";
import { useConflictStore } from "./store";

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
      useConflictStore.getState().loadConflictFiles();
      openBlade("conflict-resolution", {});
    },
    enabled: () => !!useGitOpsStore.getState().repoStatus,
  });

  // Auto-refresh conflict list after merge operations
  api.onDidGit("merge", () => {
    useConflictStore.getState().loadConflictFiles();
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all registrations
}
