import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import "./commands";
import "./commands/toolbar-actions";
import "./commands/context-menu-items";
import "./blades/_discovery";
import { CommandPalette } from "./components/command-palette";
import { Header } from "./components/Header";
import { RepositoryView } from "./components/RepositoryView";
import { WelcomeView } from "./components/WelcomeView";
import { ContextMenuPortal } from "./components/ui/ContextMenu";
import { StatusBar } from "./components/ui/StatusBar";
import { ToastContainer } from "./components/ui/ToastContainer";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { getNavigationActor, NavigationProvider } from "./machines/navigation/context";
import { usePreferencesStore as useBranchMetadataStore } from "./stores/domain/preferences";
import { usePreferencesStore as useNavigationStore } from "./stores/domain/preferences";
import { useGitOpsStore as useRepositoryStore } from "./stores/domain/git-ops";
import { usePreferencesStore as useReviewChecklistStore } from "./stores/domain/preferences";
import { usePreferencesStore as useSettingsStore } from "./stores/domain/preferences";
import { usePreferencesStore as useThemeStore } from "./stores/domain/preferences";
import { useGitOpsStore as useTopologyStore } from "./stores/domain/git-ops";
import { useGitOpsStore as useUndoStore } from "./stores/domain/git-ops";
import { useExtensionHost } from "./extensions";
import { onActivate as contentViewersActivate, onDeactivate as contentViewersDeactivate } from "./extensions/content-viewers";
import { onActivate as ccActivate, onDeactivate as ccDeactivate } from "./extensions/conventional-commits";
import { onActivate as gitflowActivate, onDeactivate as gitflowDeactivate } from "./extensions/gitflow";
import { onActivate as worktreesActivate, onDeactivate as worktreesDeactivate } from "./extensions/worktrees";
import { onActivate as githubActivate, onDeactivate as githubDeactivate } from "./extensions/github";
import { onActivate as initRepoActivate, onDeactivate as initRepoDeactivate } from "./extensions/init-repo";

function App() {
  const queryClient = useQueryClient();
  const status = useRepositoryStore((s) => s.repoStatus);
  const initTheme = useThemeStore((s) => s.initTheme);
  const initSettings = useSettingsStore((s) => s.initSettings);
  const initNavigation = useNavigationStore((s) => s.initNavigation);
  const initMetadata = useBranchMetadataStore((s) => s.initMetadata);
  const initChecklist = useReviewChecklistStore((s) => s.initChecklist);
  const loadUndoInfo = useUndoStore((s) => s.loadUndoInfo);
  const discoverExtensions = useExtensionHost((s) => s.discoverExtensions);
  const activateAll = useExtensionHost((s) => s.activateAll);
  const deactivateAll = useExtensionHost((s) => s.deactivateAll);
  const registerBuiltIn = useExtensionHost((s) => s.registerBuiltIn);

  // Register global keyboard shortcuts
  useKeyboardShortcuts();

  // Initialize theme, settings, navigation, and branch metadata on mount
  useEffect(() => {
    initTheme();
    initSettings().then(() => {
      const { settingsData: settings } = useSettingsStore.getState();
      const defaultTab = settings.general.defaultTab;
      if (defaultTab === "topology" || defaultTab === "history") {
        getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
      }
    });
    initNavigation();
    initMetadata();
    initChecklist();

    // Register built-in extensions
    registerBuiltIn({
      id: "content-viewers",
      name: "Content Viewers",
      version: "1.0.0",
      activate: contentViewersActivate,
      deactivate: contentViewersDeactivate,
    });

    registerBuiltIn({
      id: "conventional-commits",
      name: "Conventional Commits",
      version: "1.0.0",
      activate: ccActivate,
      deactivate: ccDeactivate,
    });

    registerBuiltIn({
      id: "gitflow",
      name: "Gitflow",
      version: "1.0.0",
      activate: gitflowActivate,
      deactivate: gitflowDeactivate,
    });

    registerBuiltIn({
      id: "worktrees",
      name: "Worktrees",
      version: "1.0.0",
      activate: worktreesActivate,
      deactivate: worktreesDeactivate,
    });

    registerBuiltIn({
      id: "init-repo",
      name: "Init Repository",
      version: "1.0.0",
      activate: initRepoActivate,
      deactivate: initRepoDeactivate,
    });

    registerBuiltIn({
      id: "github",
      name: "GitHub Integration",
      version: "1.0.0",
      activate: githubActivate,
      deactivate: githubDeactivate,
    });
  }, [initTheme, initSettings, initNavigation, initMetadata, initChecklist, registerBuiltIn]);

  // Discover and activate extensions when a repository is opened
  useEffect(() => {
    if (status) {
      // Repository opened -- discover and activate extensions
      discoverExtensions(status.repoPath).then(() => {
        activateAll();
      });
    } else {
      // Repository closed -- deactivate all extensions
      deactivateAll();
    }

    return () => {
      // Cleanup on unmount or before re-running (handles repo switch)
      deactivateAll();
    };
  }, [status, discoverExtensions, activateAll, deactivateAll]);

  // Listen for file watcher events
  useEffect(() => {
    if (!status) return;

    const unlisten = listen<{ paths: string[] }>(
      "repository-changed",
      (event) => {
        console.log("Repository changed:", event.payload.paths);

        // Invalidate relevant queries to trigger refresh
        queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
        queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
        queryClient.invalidateQueries({ queryKey: ["repositoryStatus"] });

        // Also refresh undo info
        loadUndoInfo();

        // Auto-refresh topology if it has been loaded
        const topologyState = useTopologyStore.getState();
        if (topologyState.nodes.length > 0) {
          topologyState.loadGraph();
        }
      },
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [status, queryClient, loadUndoInfo]);

  return (
    <NavigationProvider>
      <div className="flex flex-col h-screen bg-ctp-base text-ctp-text font-sans">
        <Header />
        <main className="flex-1 min-h-0 overflow-hidden">
          {status ? <RepositoryView /> : <WelcomeView />}
        </main>
        {status && <StatusBar />}
        <ToastContainer />
        <CommandPalette />
        <ContextMenuPortal />
      </div>
    </NavigationProvider>
  );
}

export default App;
