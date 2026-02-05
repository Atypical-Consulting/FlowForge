import { Archive, Download, Play, Trash2 } from "lucide-react";
import type { StashEntry } from "../../bindings";

interface StashItemProps {
  stash: StashEntry;
  onApply: () => void;
  onPop: () => void;
  onDrop: () => void;
  disabled?: boolean;
}

export function StashItem({
  stash,
  onApply,
  onPop,
  onDrop,
  disabled,
}: StashItemProps) {
  return (
    <div className="group flex items-center justify-between px-2 py-1 rounded-md hover:bg-ctp-surface0">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <Archive className="w-3.5 h-3.5 shrink-0 text-ctp-overlay1" />
        <div className="min-w-0">
          <span className="text-xs text-ctp-overlay0">
            stash@{"{" + stash.index + "}"}
          </span>
          <p className="truncate text-sm">{stash.message}</p>
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onApply}
          disabled={disabled}
          className="p-1 hover:bg-ctp-surface1 rounded text-ctp-overlay1 hover:text-ctp-text"
          title="Apply (keep stash)"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onPop}
          disabled={disabled}
          className="p-1 hover:bg-ctp-surface1 rounded text-ctp-overlay1 hover:text-ctp-green"
          title="Pop (apply and remove)"
        >
          <Play className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDrop}
          disabled={disabled}
          className="p-1 hover:bg-ctp-surface1 rounded text-ctp-overlay1 hover:text-ctp-red"
          title="Drop (discard)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
