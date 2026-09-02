import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from "lucide-react";
import { FileTypeIcon } from "../../../components/icons/FileTypeIcon";

interface DiffPreviewHeaderProps {
  filePath: string;
  onExpand: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  /** The file has unresolved merge conflicts (the diff shows raw markers). */
  isConflicted?: boolean;
  /** Opens the conflict-resolution blade for this file. */
  onOpenConflictResolver?: () => void;
}

export function DiffPreviewHeader({
  filePath,
  onExpand,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  isConflicted = false,
  onOpenConflictResolver,
}: DiffPreviewHeaderProps) {
  const lastSlash = filePath.lastIndexOf("/");
  const dir = lastSlash >= 0 ? filePath.slice(0, lastSlash + 1) : "";
  const filename = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-ctp-surface0 bg-ctp-crust shrink-0">
      <FileTypeIcon path={filePath} className="w-4 h-4 shrink-0" />
      <span className="truncate flex-1 text-sm">
        {dir && <span className="text-ctp-overlay1">{dir}</span>}
        <span className="font-semibold text-ctp-text">{filename}</span>
      </span>
      {isConflicted && onOpenConflictResolver && (
        <button
          type="button"
          onClick={onOpenConflictResolver}
          className="flex items-center gap-1.5 px-2 py-0.5 text-xs rounded border border-ctp-red/40 bg-ctp-red/10 text-ctp-red hover:bg-ctp-red/20 transition-colors shrink-0"
          title="Resolve this file's merge conflict side by side"
          aria-label="Open conflict resolver"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Open conflict resolver
        </button>
      )}
      {onPrev && (
        <button
          type="button"
          disabled={!hasPrev}
          onClick={onPrev}
          className="p-1 rounded hover:bg-ctp-surface0 disabled:opacity-30 disabled:cursor-default text-ctp-overlay1 hover:text-ctp-text transition-colors"
          aria-label="Previous file"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      {onNext && (
        <button
          type="button"
          disabled={!hasNext}
          onClick={onNext}
          className="p-1 rounded hover:bg-ctp-surface0 disabled:opacity-30 disabled:cursor-default text-ctp-overlay1 hover:text-ctp-text transition-colors"
          aria-label="Next file"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onExpand}
        className="p-1 rounded hover:bg-ctp-surface0 text-ctp-overlay1 hover:text-ctp-text transition-colors"
        title="Expand to full view"
        aria-label="Expand diff to full view"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
}
