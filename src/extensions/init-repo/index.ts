import { lazy } from "react";
import { FolderGit2 } from "lucide-react";
import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { openBlade } from "../../core/lib/bladeOpener";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  const InitRepoBlade = lazy(() =>
    import("./blades/InitRepoBlade").then((m) => ({
      default: m.InitRepoBlade,
    }))
  );

  api.registerBlade({
    type: "init-repo",
    title: "Initialize Repository",
    component: InitRepoBlade,
    singleton: true,
    lazy: true,
    coreOverride: true,
  });

  api.registerCommand({
    id: "init-repository",
    title: "Initialize Repository",
    description:
      "Set up a new Git repository with .gitignore templates, README, and initial commit",
    category: "Repository",
    icon: FolderGit2,
    keywords: ["init", "initialize", "new", "repository", "git", "create"],
    action: async () => {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { commands } = await import("../../bindings");

      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select folder to initialize",
      });

      if (selected && typeof selected === "string") {
        const isRepo = await commands.isGitRepository(selected);
        if (isRepo.status === "ok" && !isRepo.data) {
          openBlade("init-repo", { directoryPath: selected });
        }
      }
    },
  });

  api.onDispose(() => {
    import("./store").then((m) => m.useInitRepoStore.getState().reset());
  });
}

export function onDeactivate(): void {
  // No custom cleanup needed -- api.cleanup() handles all unregistrations
}
