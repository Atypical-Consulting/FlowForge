import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { FileChange, FileStatus } from "../../../bindings";
import { commands } from "../../../bindings";
import { cn } from "../../../lib/utils";
import { useUIStore as useStagingStore } from "../../../stores/domain/ui-state";
import { FileTypeIcon } from "../../../components/icons/FileTypeIcon";

interface FileItemProps {
  file: FileChange;
  section: "staged" | "unstaged" | "untracked";
  depth?: number;
  showFilenameOnly?: boolean;
}

function getStatusDot(status: FileStatus): { color: string; title: string } {
  if (status === "added") return { color: "bg-ctp-green", title: "Added" };
  if (status === "deleted") return { color: "bg-ctp-red", title: "Deleted" };
  if (status === "modified")
    return { color: "bg-ctp-yellow", title: "Modified" };
  if (status === "untracked")
    return { color: "bg-ctp-blue", title: "Untracked" };
  if (typeof status === "object" && "renamed" in status) {
    return { color: "bg-ctp-mauve", title: "Renamed" };
  }
  return { color: "bg-ctp-overlay0", title: "Unknown" };
}

export function FileItem({
  file,
  section,
  depth = 0,
  showFilenameOnly = false,
}: FileItemProps) {
  const queryClient = useQueryClient();
  const { stagingSelectedFile, selectFile } = useStagingStore();
  const isSelected = stagingSelectedFile?.path === file.path;
  const itemRef = useRef<HTMLDivElement>(null);

  // Scroll into view when programmatically selected (keyboard navigation)
  useEffect(() => {
    if (isSelected) {
      itemRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isSelected]);

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

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (section === "staged") {
      unstageMutation.mutate();
    } else {
      stageMutation.mutate();
    }
  };

  const handleSelect = () => {
    selectFile(file, section);
  };

  return (
    <div
      ref={itemRef}
      onClick={handleSelect}
      onKeyDown={(e) => e.key === "Enter" && handleSelect()}
      className={cn(
        "flex items-center cursor-pointer group",
        "hover:bg-ctp-surface0/50 transition-colors",
        showFilenameOnly ? "gap-1 px-2 py-1" : "gap-2 px-3 py-1.5",
        isSelected && "bg-ctp-blue/20 border-l-2 border-ctp-blue",
      )}
    >
      <div className="relative shrink-0">
        <FileTypeIcon path={file.path} className="w-4 h-4" />
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-ctp-mantle",
            statusDot.color,
          )}
          title={statusDot.title}
        />
      </div>
      <span className="flex-1 truncate text-sm text-ctp-text">
        {displayName}
      </span>
      {file.additions !== null && file.deletions !== null && (
        <span className="text-xs text-ctp-overlay0">
          <span className="text-ctp-green">+{file.additions}</span>{" "}
          <span className="text-ctp-red">-{file.deletions}</span>
        </span>
      )}
      <button
        type="button"
        onClick={handleAction}
        className={cn(
          "opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity",
          section === "staged"
            ? "hover:bg-ctp-red/20 text-ctp-red"
            : "hover:bg-ctp-green/20 text-ctp-green",
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
