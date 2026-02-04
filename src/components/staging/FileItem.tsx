import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import type { FileChange, FileStatus } from "../../bindings";
import { commands } from "../../bindings";
import { cn } from "../../lib/utils";
import { useStagingStore } from "../../stores/staging";
import { FileTypeIcon } from "../icons/FileTypeIcon";

interface FileItemProps {
  file: FileChange;
  section: "staged" | "unstaged" | "untracked";
  depth?: number;
  showFilenameOnly?: boolean;
}

function getStatusDot(status: FileStatus): { color: string; title: string } {
  if (status === "added") return { color: "bg-green-500", title: "Added" };
  if (status === "deleted") return { color: "bg-red-500", title: "Deleted" };
  if (status === "modified")
    return { color: "bg-yellow-500", title: "Modified" };
  if (status === "untracked")
    return { color: "bg-blue-500", title: "Untracked" };
  if (typeof status === "object" && "renamed" in status) {
    return { color: "bg-purple-500", title: "Renamed" };
  }
  return { color: "bg-gray-500", title: "Unknown" };
}

export function FileItem({
  file,
  section,
  depth = 0,
  showFilenameOnly = false,
}: FileItemProps) {
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

  const statusDot = getStatusDot(file.status);
  const displayName = showFilenameOnly
    ? file.path.split("/").pop() || file.path
    : file.path;
  const indentStyle =
    depth > 0 ? { paddingLeft: `${depth * 12 + 12}px` } : undefined;

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
        isSelected && "bg-blue-900/30 border-l-2 border-blue-500",
      )}
      style={indentStyle}
    >
      <div className="relative shrink-0">
        <FileTypeIcon path={file.path} className="w-4 h-4" />
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-gray-900",
            statusDot.color,
          )}
          title={statusDot.title}
        />
      </div>
      <span className="flex-1 truncate text-sm text-gray-200">
        {displayName}
      </span>
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
            : "hover:bg-green-900/50 text-green-400",
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
