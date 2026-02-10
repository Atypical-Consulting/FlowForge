import { Archive } from "lucide-react";
import { useEffect, useState } from "react";
import { useGitOpsStore as useStashStore } from "../../stores/domain/git-ops";
import { EmptyState } from "../ui/EmptyState";
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
    stashList: stashes,
    stashIsLoading: isLoading,
    stashError: error,
    loadStashes,
    applyStash,
    popStash,
    dropStash,
    clearStashError: clearError,
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
          <EmptyState
            icon={<Archive className="w-full h-full" />}
            title="Nothing stashed!"
            description="Stash changes when you need a clean working tree without committing."
          />
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
