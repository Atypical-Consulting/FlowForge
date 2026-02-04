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
    <div className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-800">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Archive className="w-4 h-4 shrink-0 text-gray-400" />
        <div className="min-w-0">
          <span className="text-xs text-gray-500">
            stash@{"{" + stash.index + "}"}
          </span>
          <p className="truncate text-sm">{stash.message}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onApply}
          disabled={disabled}
          className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
          title="Apply (keep stash)"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onPop}
          disabled={disabled}
          className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-green-400"
          title="Pop (apply and remove)"
        >
          <Play className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onDrop}
          disabled={disabled}
          className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
          title="Drop (discard)"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
