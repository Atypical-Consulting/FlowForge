import { Plus, Tag } from "lucide-react";
import { useEffect } from "react";
import { useGitOpsStore as useTagStore } from "../../stores/domain/git-ops";
import { EmptyState } from "../ui/EmptyState";
import { CreateTagDialog } from "./CreateTagDialog";
import { TagItem } from "./TagItem";

interface TagListProps {
  showCreateDialog: boolean;
  onCloseCreateDialog: () => void;
  onOpenCreateDialog?: () => void;
}

export function TagList({
  showCreateDialog,
  onCloseCreateDialog,
  onOpenCreateDialog,
}: TagListProps) {
  const { tagList: tags, tagIsLoading: isLoading, tagError: error, loadTags, deleteTag, clearTagError: clearError } =
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
        <div className="p-3 bg-ctp-red/20 text-ctp-red text-sm">
          {error}
          <button type="button" onClick={clearError} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      <div className="p-2 space-y-1">
        {tags.length === 0 ? (
          <EmptyState
            icon={<Tag className="w-full h-full" />}
            title="No tags yet"
            description="Tags mark important points in history like releases."
            action={
              onOpenCreateDialog
                ? {
                    label: "Create Tag",
                    onClick: onOpenCreateDialog,
                    icon: <Plus className="w-3.5 h-3.5" />,
                  }
                : undefined
            }
          />
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
