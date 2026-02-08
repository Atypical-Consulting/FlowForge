import { Trash2, X } from "lucide-react";

interface BranchBulkActionsProps {
  selectionMode: boolean;
  selectedCount: number;
  onEnterSelectionMode: () => void;
  onExitSelectionMode: () => void;
  onSelectAllMerged: () => void;
  onDeleteSelected: () => void;
}

export function BranchBulkActions({
  selectionMode,
  selectedCount,
  onEnterSelectionMode,
  onExitSelectionMode,
  onSelectAllMerged,
  onDeleteSelected,
}: BranchBulkActionsProps) {
  if (!selectionMode) {
    return (
      <div className="flex justify-end px-3 py-1">
        <button
          type="button"
          onClick={onEnterSelectionMode}
          className="text-xs text-ctp-overlay1 hover:text-ctp-text flex items-center gap-1 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Clean up
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-ctp-surface0/50 rounded-md mx-2 mb-2">
      <button
        type="button"
        onClick={onSelectAllMerged}
        className="text-xs text-ctp-blue hover:text-ctp-sapphire transition-colors"
      >
        Select merged
      </button>
      <span className="text-xs text-ctp-overlay0 flex-1">
        {selectedCount} selected
      </span>
      <button
        type="button"
        onClick={onDeleteSelected}
        disabled={selectedCount === 0}
        className="text-xs text-ctp-red hover:text-ctp-red/80 disabled:text-ctp-overlay0 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
      >
        <Trash2 className="w-3 h-3" />
        Delete
      </button>
      <button
        type="button"
        onClick={onExitSelectionMode}
        className="text-xs text-ctp-overlay1 hover:text-ctp-text p-0.5 rounded hover:bg-ctp-surface1 transition-colors"
        title="Cancel selection"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
