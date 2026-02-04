import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { TagInfo } from "../../bindings";
import { commands } from "../../bindings";
import { getErrorMessage } from "../../lib/errors";
import { cn } from "../../lib/utils";
import { CreateTagDialog } from "./CreateTagDialog";
import { TagItem } from "./TagItem";

export function TagList() {
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

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
      <div className="flex items-center justify-between p-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300">Tags</h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => loadTags()}
            disabled={isLoading}
            className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={() => setShowCreateDialog(true)}
            className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

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
        <CreateTagDialog
          onClose={() => setShowCreateDialog(false)}
          onCreated={loadTags}
        />
      )}
    </div>
  );
}
