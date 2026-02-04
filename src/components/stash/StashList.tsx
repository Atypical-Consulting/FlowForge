import { Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { useStashStore } from "../../stores/stash";
import { StashDialog } from "./StashDialog";
import { StashItem } from "./StashItem";

export function StashList() {
  const {
    stashes,
    isLoading,
    error,
    loadStashes,
    applyStash,
    popStash,
    dropStash,
    clearError,
  } = useStashStore();
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    loadStashes();
  }, [loadStashes]);

  const handleDrop = async (index: number) => {
    if (window.confirm("Drop this stash? This cannot be undone.")) {
      await dropStash(index);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300">Stashes</h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => loadStashes()}
            disabled={isLoading}
            className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={() => setShowSaveDialog(true)}
            className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 text-red-300 text-sm">
          {error}
          <button
            type="button"
            onClick={clearError}
            className="ml-2 underline"
          >
            dismiss
          </button>
        </div>
      )}

      <div className="p-2 space-y-1">
        {stashes.length === 0 ? (
          <p className="text-gray-500 text-sm p-2">No stashes</p>
        ) : (
          stashes.map((stash) => (
            <StashItem
              key={stash.oid}
              stash={stash}
              onApply={() => applyStash(stash.index)}
              onPop={() => popStash(stash.index)}
              onDrop={() => handleDrop(stash.index)}
              disabled={isLoading}
            />
          ))
        )}
      </div>

      {showSaveDialog && (
        <StashDialog onClose={() => setShowSaveDialog(false)} />
      )}
    </div>
  );
}
