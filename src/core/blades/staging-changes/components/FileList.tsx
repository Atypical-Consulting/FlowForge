import { ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";
import type { FileChange } from "../../../../bindings";
import { FileItem } from "./FileItem";

interface FileListProps {
  title: string;
  files: FileChange[];
  section: "staged" | "unstaged" | "untracked";
  defaultExpanded?: boolean;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
  onBulkStage?: (paths: string[]) => void;
  onBulkUnstage?: (paths: string[]) => void;
  partiallyStagedPaths?: Set<string>;
}

export function FileList({
  title,
  files,
  section,
  defaultExpanded = true,
  onStageAll,
  onUnstageAll,
  onBulkStage,
  onBulkUnstage,
  partiallyStagedPaths,
}: FileListProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  const handleCheckChange = useCallback((path: string, checked: boolean) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedPaths.size === files.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(files.map((f) => f.path)));
    }
  }, [selectedPaths.size, files]);

  const handleBulkAction = useCallback(() => {
    const paths = Array.from(selectedPaths);
    if (paths.length === 0) return;
    if (section === "staged") {
      onBulkUnstage?.(paths);
    } else {
      onBulkStage?.(paths);
    }
    setSelectedPaths(new Set());
  }, [selectedPaths, section, onBulkStage, onBulkUnstage]);

  if (files.length === 0) return null;

  const allSelected = selectedPaths.size === files.length;
  const someSelected = selectedPaths.size > 0;

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
          {/* Select all + bulk action bar */}
          <div className="flex items-center gap-2 px-3 py-1 border-b border-ctp-surface0/50">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected && !allSelected;
              }}
              onChange={handleSelectAll}
              className="shrink-0 w-3.5 h-3.5 accent-ctp-blue rounded cursor-pointer"
              aria-label={allSelected ? "Deselect all" : "Select all"}
            />
            <span className="text-xs text-ctp-overlay0">
              {allSelected ? "Deselect all" : "Select all"}
            </span>
            {someSelected && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleBulkAction();
                }}
                className={`ml-auto text-xs font-medium px-2 py-0.5 rounded transition-colors ${
                  section === "staged"
                    ? "bg-ctp-red/15 text-ctp-red hover:bg-ctp-red/25"
                    : "bg-ctp-green/15 text-ctp-green hover:bg-ctp-green/25"
                }`}
              >
                {section === "staged"
                  ? `Unstage Selected (${selectedPaths.size})`
                  : `Stage Selected (${selectedPaths.size})`}
              </button>
            )}
          </div>
          {files.map((file) => (
            <FileItem
              key={file.path}
              file={file}
              section={section}
              checked={selectedPaths.has(file.path)}
              onCheckChange={handleCheckChange}
              isPartiallyStaged={partiallyStagedPaths?.has(file.path)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
