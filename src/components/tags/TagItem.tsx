import { Tag, Trash2 } from "lucide-react";
import type { TagInfo } from "../../bindings";

interface TagItemProps {
  tag: TagInfo;
  onDelete: () => void;
  disabled?: boolean;
}

export function TagItem({ tag, onDelete, disabled }: TagItemProps) {
  return (
    <div className="group flex items-center justify-between px-2 py-1 rounded-md hover:bg-ctp-surface0">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <Tag className="w-3.5 h-3.5 shrink-0 text-ctp-yellow" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{tag.name}</p>
          {tag.message && (
            <p className="text-xs text-ctp-overlay0 truncate">{tag.message}</p>
          )}
        </div>
        {tag.isAnnotated && (
          <span className="text-xs text-ctp-overlay0 px-1 py-0.5 bg-ctp-surface0 rounded">
            annotated
          </span>
        )}
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="p-1 hover:bg-ctp-surface1 rounded text-ctp-overlay1 hover:text-ctp-red"
          title="Delete tag"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
