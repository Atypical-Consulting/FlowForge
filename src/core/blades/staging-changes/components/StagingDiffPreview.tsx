import type { FileChange } from "../../../../bindings";
import { getPreviewForFile } from "../../../lib/previewRegistry";
import { useUIStore as useStagingStore } from "../../../stores/domain/ui-state";
import { DiffPreviewHeader } from "./DiffPreviewHeader";
import { InlineDiffViewer } from "./InlineDiffViewer";
import { NonTextPlaceholder } from "./NonTextPlaceholder";
// Side-effect import: registers default preview types
import "./previewRegistrations";

interface StagingDiffPreviewProps {
  file: FileChange | null;
  section: "staged" | "unstaged" | "untracked" | null;
  onExpand: () => void;
  onNavigateFile?: (direction: "next" | "prev") => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function StagingDiffPreview({
  file,
  section,
  onExpand,
  onNavigateFile,
  hasPrev,
  hasNext,
}: StagingDiffPreviewProps) {
  const { stagingScrollPositions: scrollPositions, saveStagingScrollPosition: saveScrollPosition } = useStagingStore();

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
        <p className="text-ctp-overlay0 text-sm">Select a file to preview diff</p>
      </div>
    );
  }

  const preview = getPreviewForFile(file.path);

  return (
    <div className="flex flex-col h-full">
      <DiffPreviewHeader
        filePath={file.path}
        onExpand={onExpand}
        onPrev={onNavigateFile ? () => onNavigateFile("prev") : undefined}
        onNext={onNavigateFile ? () => onNavigateFile("next") : undefined}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />
      {preview?.mode === "placeholder" && preview.placeholder ? (
        <NonTextPlaceholder
          icon={preview.placeholder.icon}
          message={preview.placeholder.message}
          onExpand={onExpand}
        />
      ) : (
        <InlineDiffViewer
          filePath={file.path}
          staged={section === "staged"}
          initialScrollTop={scrollPositions[file.path] ?? 0}
          onScrollPositionChange={(top) => saveScrollPosition(file.path, top)}
        />
      )}
    </div>
  );
}
