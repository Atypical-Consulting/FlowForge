import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { FileTypeIcon } from "../../../components/icons/FileTypeIcon";

interface DiffPreviewHeaderProps {
  filePath: string;
  onExpand: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function DiffPreviewHeader({
  filePath,
  onExpand,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: DiffPreviewHeaderProps) {
  const lastSlash = filePath.lastIndexOf("/");
  const dir = lastSlash >= 0 ? filePath.slice(0, lastSlash + 1) : "";
  const filename =
    lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-ctp-surface0 bg-ctp-crust shrink-0">
      <FileTypeIcon path={filePath} className="w-4 h-4 shrink-0" />
      <span className="truncate flex-1 text-sm">
        {dir && <span className="text-ctp-overlay1">{dir}</span>}
        <span className="font-semibold text-ctp-text">{filename}</span>
      </span>
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
