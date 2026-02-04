import { useEffect } from "react";
import { useTagStore } from "../../stores/tags";
import { CreateTagDialog } from "./CreateTagDialog";
import { TagItem } from "./TagItem";

interface TagListProps {
  showCreateDialog: boolean;
  onCloseCreateDialog: () => void;
}

export function TagList({
  showCreateDialog,
  onCloseCreateDialog,
}: TagListProps) {
  const { tags, isLoading, error, loadTags, deleteTag, clearError } =
    useTagStore();

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Delete tag "${name}"?`)) return;
    await deleteTag(name);
  };

  return (
    <div className="flex flex-col">
      {error && (
        <div className="p-3 bg-red-900/30 text-red-300 text-sm">
          {error}
          <button type="button" onClick={clearError} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      <div className="p-2 space-y-1">
        {tags.length === 0 ? (
          <p className="text-gray-500 text-sm p-2">No tags</p>
        ) : (
          tags.map((tag) => (
            <TagItem
              key={tag.name}
              tag={tag}
              onDelete={() => handleDelete(tag.name)}
              disabled={isLoading}
            />
          ))
        )}
      </div>

      {showCreateDialog && (
        <CreateTagDialog onClose={onCloseCreateDialog} onCreated={loadTags} />
      )}
    </div>
  );
}
