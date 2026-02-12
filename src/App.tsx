import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import { useSelector } from "@xstate/react";
import { Suspense, useCallback, useEffect } from "react";
import "./core/commands";
import "./core/commands/toolbar-actions";
import "./core/commands/context-menu-items";
import "./core/blades/_discovery";
import { CommandPalette } from "./core/components/command-palette";
import { Header } from "./core/components/Header";
import { RepositoryView } from "./core/components/RepositoryView";
import { ContextMenuPortal } from "./core/components/ui/ContextMenu";
import { StatusBar } from "./core/components/ui/StatusBar";
import { ToastContainer } from "./core/components/ui/ToastContainer";
import { useKeyboardShortcuts } from "./core/hooks/useKeyboardShortcuts";
import { BladeRenderer } from "./core/blades/_shared/BladeRenderer";
import { getNavigationActor, NavigationProvider, useNavigationActorRef } from "./core/machines/navigation/context";
import { selectBladeStack } from "./core/machines/navigation/selectors";
import { usePreferencesStore as useBranchMetadataStore } from "./core/stores/domain/preferences";
import { usePreferencesStore as useNavigationStore } from "./core/stores/domain/preferences";
import { useGitOpsStore } from "./core/stores/domain/git-ops";
import { useGitOpsStore as useRepositoryStore } from "./core/stores/domain/git-ops";
import { usePreferencesStore as useReviewChecklistStore } from "./core/stores/domain/preferences";
import { usePreferencesStore as useSettingsStore } from "./core/stores/domain/preferences";
import { usePreferencesStore as useThemeStore } from "./core/stores/domain/preferences";
import { useGitOpsStore as useUndoStore } from "./core/stores/domain/git-ops";
import { useBladeRegistry } from "./core/lib/bladeRegistry";
import { modKeyLabel } from "./core/lib/platform";
import { useExtensionHost } from "./extensions";
import { onActivate as viewerCodeActivate, onDeactivate as viewerCodeDeactivate } from "./extensions/viewer-code";
import { onActivate as viewerMarkdownActivate, onDeactivate as viewerMarkdownDeactivate } from "./extensions/viewer-markdown";
import { onActivate as viewer3dActivate, onDeactivate as viewer3dDeactivate } from "./extensions/viewer-3d";
import { onActivate as ccActivate, onDeactivate as ccDeactivate } from "./extensions/conventional-commits";
import { onActivate as gitflowActivate, onDeactivate as gitflowDeactivate } from "./extensions/gitflow";
import { onActivate as worktreesActivate, onDeactivate as worktreesDeactivate } from "./extensions/worktrees";
import { onActivate as githubActivate, onDeactivate as githubDeactivate } from "./extensions/github";
import { onActivate as initRepoActivate, onDeactivate as initRepoDeactivate } from "./extensions/init-repo";
import { onActivate as viewerImageActivate, onDeactivate as viewerImageDeactivate } from "./extensions/viewer-image";
import { onActivate as viewerNupkgActivate, onDeactivate as viewerNupkgDeactivate } from "./extensions/viewer-nupkg";
import { onActivate as viewerPlaintextActivate, onDeactivate as viewerPlaintextDeactivate } from "./extensions/viewer-plaintext";
import { onActivate as welcomeActivate, onDeactivate as welcomeDeactivate } from "./extensions/welcome-screen";
import { onActivate as topologyActivate, onDeactivate as topologyDeactivate } from "./extensions/topology";
import { onActivate as conflictActivate, onDeactivate as conflictDeactivate } from "./extensions/conflict-resolution";

function WelcomeFallback() {
  const { openRepository } = useGitOpsStore();
  const actorRef = useNavigationActorRef();
  const bladeStack = useSelector(actorRef, selectBladeStack);
  const pushedBlade = bladeStack.length > 1 ? bladeStack[bladeStack.length - 1] : null;

  const openDialog = useCallback(async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { commands } = await import("./bindings");
    const selected = await open({ directory: true, multiple: false, title: "Open Git Repository" });
    if (selected && typeof selected === "string") {
      const isRepo = await commands.isGitRepository(selected);
      if (isRepo.status === "ok" && isRepo.data) {
        await openRepository(selected);
      }
    }
  }, [openRepository]);

  useEffect(() => {
    const handler = () => openDialog();
    document.addEventListener("open-repository-dialog", handler);
    return () => document.removeEventListener("open-repository-dialog", handler);
  }, [openDialog]);

  // Render blades pushed via command palette / toolbar (e.g. Extension Manager, Settings)
  if (pushedBlade) {
    return (
      <div className="h-[calc(100vh-3.5rem)] bg-ctp-base">
        <BladeRenderer
          blade={pushedBlade}
          goBack={() => actorRef.send({ type: "POP_BLADE" })}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] gap-4 bg-ctp-base">
      <p className="text-ctp-subtext0">
        Press{" "}
        <kbd className="px-1.5 py-0.5 bg-ctp-surface0 rounded text-ctp-subtext1 font-mono text-xs">
          {modKeyLabel}+O
        </kbd>{" "}
        to open a repository
      </p>
    </div>
  );
}

function WelcomeScreen() {
  const registration = useBladeRegistry((s) => s.blades.get("welcome-screen"));

  if (!registration) {
    return <WelcomeFallback />;
  }

  const WelcomeComponent = registration.component;
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] bg-ctp-base">
          <p className="text-ctp-subtext0">Loading...</p>
        </div>
      }
    >
      <WelcomeComponent />
    </Suspense>
  );
}

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
      if (
        (defaultTab === "topology" || defaultTab === "history") &&
        useBladeRegistry.getState().blades.has("topology-graph")
      ) {
        getNavigationActor().send({ type: "SWITCH_PROCESS", process: "topology" });
      }
    });
    initNavigation();
    initMetadata();
    initChecklist();

    // Register built-in extensions
    registerBuiltIn({
      id: "viewer-code",
      name: "Code Viewer",
      version: "1.0.0",
      activate: viewerCodeActivate,
      deactivate: viewerCodeDeactivate,
    });

    registerBuiltIn({
      id: "viewer-markdown",
      name: "Markdown Viewer",
      version: "1.0.0",
      activate: viewerMarkdownActivate,
      deactivate: viewerMarkdownDeactivate,
    });

    registerBuiltIn({
      id: "viewer-3d",
      name: "3D Model Viewer",
      version: "1.0.0",
      activate: viewer3dActivate,
      deactivate: viewer3dDeactivate,
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
      id: "topology",
      name: "Topology Graph",
      version: "1.0.0",
      activate: topologyActivate,
      deactivate: topologyDeactivate,
    });

    registerBuiltIn({
      id: "github",
      name: "GitHub Integration",
      version: "1.0.0",
      activate: githubActivate,
      deactivate: githubDeactivate,
    });

    registerBuiltIn({
      id: "viewer-image",
      name: "Image Viewer",
      version: "1.0.0",
      activate: viewerImageActivate,
      deactivate: viewerImageDeactivate,
    });

    registerBuiltIn({
      id: "viewer-nupkg",
      name: "NuGet Package Viewer",
      version: "1.0.0",
      activate: viewerNupkgActivate,
      deactivate: viewerNupkgDeactivate,
    });

    registerBuiltIn({
      id: "viewer-plaintext",
      name: "Plain Text Viewer",
      version: "1.0.0",
      activate: viewerPlaintextActivate,
      deactivate: viewerPlaintextDeactivate,
    });

    registerBuiltIn({
      id: "welcome-screen",
      name: "Welcome Screen",
      version: "1.0.0",
      activate: welcomeActivate,
      deactivate: welcomeDeactivate,
    });

    registerBuiltIn({
      id: "conflict-resolution",
      name: "Conflict Resolution",
      version: "1.0.0",
      activate: conflictActivate,
      deactivate: conflictDeactivate,
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
          {status ? <RepositoryView /> : <WelcomeScreen />}
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
