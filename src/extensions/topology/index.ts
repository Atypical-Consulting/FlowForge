import { lazy } from "react";
import { History } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { getNavigationActor } from "@/framework/layout/navigation/context";
import { useGitOpsStore } from "../../core/stores/domain/git-ops";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // 1. Register blade with coreOverride (preserves "topology-graph" type without ext: prefix)
  const TopologyRootBlade = lazy(() =>
    import("./blades/TopologyRootBlade").then((m) => ({
      default: m.TopologyRootBlade,
    }))
  );

  api.registerBlade({
    type: "topology-graph",
    title: "Topology",
    component: TopologyRootBlade,
    singleton: true,
    lazy: true,
    wrapInPanel: false,
    showBack: false,
    coreOverride: true,
  });

  // 2. Register "Show History" command
  api.registerCommand({
    id: "show-topology",
    title: "Show History",
    description: "Switch to the topology (history) view",
    category: "Navigation",
    shortcut: "mod+2",
    icon: History,
    keywords: ["topology", "history", "graph", "commits"],
    action: () => {
      getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
    },
    enabled: () => !!useGitOpsStore.getState().repoStatus,
  });

  // 3. File watcher: auto-refresh topology when repository files change externally
  const unlisten = await listen<{ paths: string[] }>("repository-changed", () => {
    const state = useGitOpsStore.getState();
    if (state.nodes.length > 0) {
      state.loadGraph();
    }
  });
  api.onDispose(() => unlisten());

  // 4. Apply defaultTab setting: if user prefers topology as default, switch to it
  try {
    const { Store } = await import("@tauri-apps/plugin-store");
    const store = await Store.load("settings.json");
    const settings = await store.get<{ general?: { defaultTab?: string } }>("settings");
    const defaultTab = settings?.general?.defaultTab;
    if (defaultTab === "topology" || defaultTab === "history") {
      if (useGitOpsStore.getState().repoStatus) {
        getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
      }
    }
  } catch {
    // Settings not available yet -- no-op, user can navigate manually
  }
}

export function onDeactivate(): void {
  // api.cleanup() handles all unregistrations (blade, commands, disposables)
  // Topology data stays in GitOpsStore (TOPO-08) -- no store cleanup needed
}
