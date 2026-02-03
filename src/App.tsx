import { useEffect } from "react";
import { Header } from "./components/Header";
import { WelcomeView } from "./components/WelcomeView";
import { RepositoryView } from "./components/RepositoryView";
import { useRepositoryStore } from "./stores/repository";

function App() {
  const { status } = useRepositoryStore();

  // Set up keyboard shortcut for Cmd/Ctrl+O
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "o") {
        e.preventDefault();
        // Trigger the open dialog via a custom event
        document.dispatchEvent(new CustomEvent("open-repository-dialog"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <Header />
      <main className="flex-1 overflow-hidden">
        {status ? <RepositoryView /> : <WelcomeView />}
      </main>
    </div>
  );
}

export default App;
