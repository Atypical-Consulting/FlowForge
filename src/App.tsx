import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import "./commands";
import "./components/blades/registrations";
import { CommandPalette } from "./components/command-palette";
import { Header } from "./components/Header";
import { RepositoryView } from "./components/RepositoryView";
import { WelcomeView } from "./components/WelcomeView";
import { ToastContainer } from "./components/ui/ToastContainer";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useNavigationStore } from "./stores/navigation";
import { useRepositoryStore } from "./stores/repository";
import { useSettingsStore } from "./stores/settings";
import { useThemeStore } from "./stores/theme";
import { useTopologyStore } from "./stores/topology";
import { useUndoStore } from "./stores/undo";

function App() {
  const queryClient = useQueryClient();
  const { status } = useRepositoryStore();
  const initTheme = useThemeStore((s) => s.initTheme);
  const initSettings = useSettingsStore((s) => s.initSettings);
  const initNavigation = useNavigationStore((s) => s.initNavigation);
  const loadUndoInfo = useUndoStore((s) => s.loadUndoInfo);

  // Register global keyboard shortcuts
  useKeyboardShortcuts();

  // Initialize theme, settings, and navigation on mount
  useEffect(() => {
    initTheme();
    initSettings();
    initNavigation();
  }, [initTheme, initSettings, initNavigation]);

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
    <div className="flex flex-col h-screen bg-ctp-base text-ctp-text font-sans">
      <Header />
      <main className="flex-1 min-h-0 overflow-hidden">
        {status ? <RepositoryView /> : <WelcomeView />}
      </main>
      <ToastContainer />
      <CommandPalette />
    </div>
  );
}

export default App;
