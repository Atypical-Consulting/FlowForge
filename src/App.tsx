import { useEffect } from "react";
import { Header } from "./components/Header";
import { RepositoryView } from "./components/RepositoryView";
import { WelcomeView } from "./components/WelcomeView";
import { ChangelogDialog } from "./components/changelog";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useRepositoryStore } from "./stores/repository";
import { useThemeStore } from "./stores/theme";

function App() {
  const { status } = useRepositoryStore();
  const initTheme = useThemeStore((s) => s.initTheme);

  // Register global keyboard shortcuts
  useKeyboardShortcuts();

  // Initialize theme on mount
  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return (
    <div className="flex flex-col h-screen bg-ctp-base text-ctp-text font-sans">
      <Header />
      <main className="flex-1 min-h-0 overflow-hidden">
        {status ? <RepositoryView /> : <WelcomeView />}
      </main>
      <ChangelogDialog />
    </div>
  );
}

export default App;
