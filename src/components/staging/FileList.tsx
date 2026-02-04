import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { FileChange } from "../../bindings";
import { FileItem } from "./FileItem";

interface FileListProps {
  title: string;
  files: FileChange[];
  section: "staged" | "unstaged" | "untracked";
  defaultExpanded?: boolean;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
}

export function FileList({
  title,
  files,
  section,
  defaultExpanded = true,
  onStageAll,
  onUnstageAll,
}: FileListProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (files.length === 0) return null;

  return (
    <div className="mb-2">
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-ctp-surface0/30 w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-ctp-overlay1" />
        ) : (
          <ChevronRight className="w-4 h-4 text-ctp-overlay1" />
        )}
        <span className="text-sm font-medium text-ctp-subtext1">{title}</span>
        <span className="text-xs text-ctp-overlay0 bg-ctp-surface0 px-1.5 py-0.5 rounded">
          {files.length}
        </span>

        {section === "staged" && onUnstageAll && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUnstageAll();
            }}
            className="ml-auto text-xs text-ctp-overlay1 hover:text-ctp-text"
          >
            Unstage All
          </button>
        )}
        {section !== "staged" && onStageAll && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStageAll();
            }}
            className="ml-auto text-xs text-ctp-overlay1 hover:text-ctp-text"
          >
            Stage All
          </button>
        )}
      </button>

      {expanded && (
        <div className="border-l border-ctp-surface0 ml-3">
          {files.map((file) => (
            <FileItem key={file.path} file={file} section={section} />
          ))}
        </div>
      )}
    </div>
  );
}
