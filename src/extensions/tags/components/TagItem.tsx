import { Loader2, Tag, Trash2 } from "lucide-react";
import { useState } from "react";
import { useContextMenuRegistry } from "@/framework/extension-system/contextMenuRegistry";
import type { TagInfo } from "../../../bindings";

interface TagItemProps {
  tag: TagInfo;
  /** Open the tagged commit. */
  onSelect: () => void;
  onDelete: () => Promise<void> | void;
  disabled?: boolean;
}

export function TagItem({ tag, onSelect, onDelete, disabled }: TagItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="group flex items-center justify-between rounded-md hover:bg-ctp-surface0"
      onContextMenu={(e) => {
        e.preventDefault();
        useContextMenuRegistry
          .getState()
          .showMenu({ x: e.clientX, y: e.clientY }, "tag-list", {
            location: "tag-list",
            tagName: tag.name,
            // Same callback the hover button uses (delete keeps its confirm).
            actions: { delete: handleDelete },
          });
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        title={`Open commit ${tag.targetOid.slice(0, 7)}`}
        className="flex items-center gap-1.5 min-w-0 flex-1 px-2 py-1 rounded-md text-left cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ctp-blue"
      >
        <Tag className="w-3.5 h-3.5 shrink-0 text-ctp-yellow" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{tag.name}</span>
          {tag.message && (
            <span className="block text-xs text-ctp-overlay0 truncate">
              {tag.message}
            </span>
          )}
        </span>
        {tag.isAnnotated && (
          <span className="text-xs text-ctp-overlay0 px-1 py-0.5 bg-ctp-surface0 rounded">
            annotated
          </span>
        )}
      </button>
      <div className="pr-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={handleDelete}
          disabled={disabled || isDeleting}
          className="p-1 hover:bg-ctp-surface1 rounded text-ctp-overlay1 hover:text-ctp-red"
          title="Delete tag"
          aria-label={`Delete tag ${tag.name}`}
        >
          {isDeleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
