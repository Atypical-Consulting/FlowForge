import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, FileEdit, FileMinus, FilePlus, FileQuestion, X } from "lucide-react";
import type { FileChange, FileStatus } from "../../bindings";
import { commands } from "../../bindings";
import { cn } from "../../lib/utils";
import { useStagingStore } from "../../stores/staging";

interface FileItemProps {
  file: FileChange;
  section: "staged" | "unstaged" | "untracked";
}

export function FileItem({ file, section }: FileItemProps) {
  const queryClient = useQueryClient();
  const { selectedFile, selectFile } = useStagingStore();
  const isSelected = selectedFile?.path === file.path;

  const stageMutation = useMutation({
    mutationFn: () => commands.stageFile(file.path),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["stagingStatus"] }),
  });

  const unstageMutation = useMutation({
    mutationFn: () => commands.unstageFile(file.path),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["stagingStatus"] }),
  });

  const StatusIcon = getStatusIcon(file.status);

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (section === "staged") {
      unstageMutation.mutate();
    } else {
      stageMutation.mutate();
    }
  };

  return (
    <div
      onClick={() => selectFile(file, section)}
      onKeyDown={(e) => e.key === "Enter" && selectFile(file, section)}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 cursor-pointer group",
        "hover:bg-gray-800/50 transition-colors",
        isSelected && "bg-blue-900/30 border-l-2 border-blue-500"
      )}
    >
      <StatusIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <span className="flex-1 truncate text-sm text-gray-200">{file.path}</span>
      {file.additions !== null && file.deletions !== null && (
        <span className="text-xs text-gray-500">
          <span className="text-green-500">+{file.additions}</span>{" "}
          <span className="text-red-500">-{file.deletions}</span>
        </span>
      )}
      <button
        type="button"
        onClick={handleAction}
        className={cn(
          "opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity",
          section === "staged"
            ? "hover:bg-red-900/50 text-red-400"
            : "hover:bg-green-900/50 text-green-400"
        )}
        title={section === "staged" ? "Unstage" : "Stage"}
      >
        {section === "staged" ? (
          <X className="w-3 h-3" />
        ) : (
          <Check className="w-3 h-3" />
        )}
      </button>
    </div>
  );
}

function getStatusIcon(status: FileStatus) {
  if (status === "added") return FilePlus;
  if (status === "deleted") return FileMinus;
  if (status === "modified") return FileEdit;
  if (status === "untracked") return FileQuestion;
  if (typeof status === "object" && "renamed" in status) return FileEdit;
  return FileEdit;
}
