import { Tag, Trash2 } from "lucide-react";
import type { TagInfo } from "../../bindings";

interface TagItemProps {
  tag: TagInfo;
  onDelete: () => void;
  disabled?: boolean;
}

export function TagItem({ tag, onDelete, disabled }: TagItemProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-800">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Tag className="w-4 h-4 shrink-0 text-yellow-400" />
        <div className="min-w-0">
          <p className="truncate font-medium">{tag.name}</p>
          {tag.message && (
            <p className="text-xs text-gray-500 truncate">{tag.message}</p>
          )}
        </div>
        {tag.isAnnotated && (
          <span className="text-xs text-gray-500 px-1.5 py-0.5 bg-gray-800 rounded">
            annotated
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
        title="Delete tag"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
