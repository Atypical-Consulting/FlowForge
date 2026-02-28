import { listen } from "@tauri-apps/api/event";
import { BarChart3 } from "lucide-react";
import { lazy } from "react";
import type { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { openBlade } from "@/framework/layout/bladeOpener";
import { useGitOpsStore } from "../../core/stores/domain/git-ops";
import { useInsightsStore } from "./insightsStore";

export async function onActivate(api: ExtensionAPI): Promise<void> {
  // 1. Register lazy-loaded dashboard blade
  const InsightsDashboardBlade = lazy(() =>
    import("./blades/InsightsDashboardBlade").then((m) => ({
      default: m.InsightsDashboardBlade,
    })),
  );

  api.registerBlade({
    type: "insights-dashboard",
    title: "Insights",
    component: InsightsDashboardBlade,
    singleton: true,
    lazy: true,
    wrapInPanel: true,
    showBack: true,
  });

  // 2. Register "Show Insights" command
  api.registerCommand({
    id: "show-insights",
    title: "Show Insights Dashboard",
    description: "View repository analytics and activity charts",
    category: "Navigation",
    icon: BarChart3,
    keywords: [
      "insights",
      "analytics",
      "activity",
      "contributors",
      "stats",
      "dashboard",
    ],
    action: () => openBlade("ext:git-insights:insights-dashboard", {}),
    enabled: () => !!useGitOpsStore.getState().repoStatus,
  });

  // 3. Contribute toolbar button
  api.contributeToolbar({
    id: "insights",
    label: "Insights",
    icon: BarChart3,
    group: "views",
    priority: 40,
    when: () => !!useGitOpsStore.getState().repoStatus,
    execute: () => openBlade("ext:git-insights:insights-dashboard", {}),
  });

  // 4. Auto-refresh on repository changes
  const unlisten = await listen<{ paths: string[] }>(
    "repository-changed",
    () => {
      if (useInsightsStore.getState().insights) {
        useInsightsStore.getState().loadInsights();
        useInsightsStore.getState().loadBranchHealth();
      }
    },
  );
  api.onDispose(() => unlisten());
}

export function onDeactivate(): void {
  useInsightsStore.getState().reset();
}
