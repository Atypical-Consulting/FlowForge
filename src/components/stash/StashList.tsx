import { useEffect, useState } from "react";
import { useStashStore } from "../../stores/stash";
import { StashDialog } from "./StashDialog";
import { StashItem } from "./StashItem";

interface StashListProps {
  showSaveDialog: boolean;
  onCloseSaveDialog: () => void;
}

export function StashList({
  showSaveDialog,
  onCloseSaveDialog,
}: StashListProps) {
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
      {error && (
        <div className="p-3 bg-ctp-red/20 text-ctp-red text-sm">
          {error}
          <button type="button" onClick={clearError} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      <div className="p-2 space-y-1">
        {stashes.length === 0 ? (
          <p className="text-ctp-overlay0 text-sm p-2">No stashes</p>
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

      {showSaveDialog && <StashDialog onClose={onCloseSaveDialog} />}
    </div>
  );
}
