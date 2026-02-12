import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { FileChange, FileStatus } from "../../../../bindings";
import { commands } from "../../../../bindings";
import { cn } from "../../../lib/utils";
import { useUIStore as useStagingStore } from "../../../stores/domain/ui-state";
import { FileTypeIcon } from "../../../components/icons/FileTypeIcon";

interface FileItemProps {
  file: FileChange;
  section: "staged" | "unstaged" | "untracked";
  depth?: number;
  showFilenameOnly?: boolean;
  checked?: boolean;
  onCheckChange?: (path: string, checked: boolean) => void;
  isPartiallyStaged?: boolean;
}

function getStatusDot(status: FileStatus): { color: string; title: string } {
  if (status === "added") return { color: "bg-ctp-green", title: "Added" };
  if (status === "deleted") return { color: "bg-ctp-red", title: "Deleted" };
  if (status === "modified")
    return { color: "bg-ctp-yellow", title: "Modified" };
  if (status === "untracked")
    return { color: "bg-ctp-blue", title: "Untracked" };
  if (status === "conflicted")
    return { color: "bg-ctp-red", title: "Conflicted" };
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
  checked,
  onCheckChange,
  isPartiallyStaged = false,
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
      {onCheckChange !== undefined && (
        <input
          type="checkbox"
          checked={checked ?? false}
          onChange={(e) => {
            e.stopPropagation();
            onCheckChange(file.path, e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 w-3.5 h-3.5 accent-ctp-blue rounded cursor-pointer"
          aria-label={`Select ${file.path}`}
        />
      )}
      <div className="relative shrink-0">
        <FileTypeIcon path={file.path} className="w-4 h-4" />
        {file.status === "conflicted" ? (
          <span title="Conflicted">
            <AlertTriangle
              className="absolute -bottom-0.5 -right-1 w-3 h-3 text-ctp-red"
            />
          </span>
        ) : (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-ctp-mantle",
              statusDot.color,
            )}
            title={statusDot.title}
          />
        )}
        {isPartiallyStaged && (
          <span
            className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5"
            title="Partially staged"
            aria-label="File is partially staged"
          >
            <svg viewBox="0 0 10 10" className="w-full h-full">
              <circle
                cx="5"
                cy="5"
                r="4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-ctp-yellow"
              />
              <path
                d="M5 1 A4 4 0 0 1 5 9"
                fill="currentColor"
                className="text-ctp-yellow"
              />
            </svg>
          </span>
        )}
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
