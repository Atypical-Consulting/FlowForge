import { useState } from "react";
import { commands } from "./bindings";

function App() {
  const [greeting, setGreeting] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGreet = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await commands.greet("Developer");
      setGreeting(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      console.error("IPC error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-8">FlowForge</h1>

      <button
        onClick={handleGreet}
        disabled={loading}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
      >
        {loading ? "Loading..." : "Test IPC"}
      </button>

      {greeting && <p className="mt-6 text-lg text-green-400">{greeting}</p>}

      {error && <p className="mt-6 text-lg text-red-400">Error: {error}</p>}

      <p className="mt-8 text-sm text-gray-500">
        Click the button to verify Rust backend communication
      </p>
    </div>
  );
}

export default App;
