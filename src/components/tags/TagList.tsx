import { useCallback, useEffect, useState } from "react";
import type { TagInfo } from "../../bindings";
import { commands } from "../../bindings";
import { getErrorMessage } from "../../lib/errors";
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
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTags = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await commands.listTags();
    if (result.status === "ok") {
      setTags(result.data);
    } else {
      setError(getErrorMessage(result.error));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Delete tag "${name}"?`)) return;
    const result = await commands.deleteTag(name);
    if (result.status === "ok") {
      await loadTags();
    }
  };

  return (
    <div className="flex flex-col">
      {error && (
        <div className="p-3 bg-red-900/30 text-red-300 text-sm">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
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
