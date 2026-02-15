import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import { useEffect, useMemo, useRef } from "react";
import type { DiffHunkDetail } from "../../../../bindings";
import { MONACO_COMMON_OPTIONS, MONACO_THEME } from "@/core/lib/monacoConfig";
import "@/core/lib/monacoTheme";
import { StagingDiffEditor } from "./StagingDiffEditor";

interface LineSelection {
  selectedLines: Set<number>;
  toggleLine: (lineNumber: number) => void;
  selectRange: (toLine: number) => void;
  clearSelection: () => void;
  stageSelectedLines: () => void;
  isLineStagingPending: boolean;
  hasSelection: boolean;
}

interface StagingSource {
  filePath: string;
  staged: boolean;
  hunks: DiffHunkDetail[];
  isOperationPending: boolean;
  onToggleHunk: (hunkIndex: number) => void;
  lineSelection?: LineSelection;
}

interface DiffContentProps {
  original: string;
  modified: string;
  language: string;
  inline: boolean;
  collapseUnchanged?: boolean;
  contextLines?: number;
  stagingSource?: StagingSource;
}

export function DiffContent({
  original,
  modified,
  language,
  inline,
  collapseUnchanged,
  contextLines,
  stagingSource,
}: DiffContentProps) {
  const editorRef = useRef<Parameters<DiffOnMount>[0] | null>(null);
  const modelsRef = useRef<ReturnType<Parameters<DiffOnMount>[0]["getModel"]>>(null);

  // Dispose models on unmount. keepCurrentOriginalModel/keepCurrentModifiedModel
  // tell @monaco-editor/react to skip model disposal in its own cleanup so the
  // editor is disposed first (correct order). This parent useEffect cleanup then
  // runs after the child's, safely disposing the now-detached models.
  useEffect(() => {
    return () => {
      modelsRef.current?.original?.dispose();
      modelsRef.current?.modified?.dispose();
      modelsRef.current = null;
      editorRef.current = null;
    };
  }, []);

  const handleMount: DiffOnMount = (editor) => {
    editorRef.current = editor;
    modelsRef.current = editor.getModel();
  };

  const options = useMemo(
    () => ({
      ...MONACO_COMMON_OPTIONS,
      renderSideBySide: !inline,
      originalEditable: false,
      glyphMargin: true,
      diffAlgorithm: "advanced" as const,
      diffWordWrap: "on" as const,
      renderIndicators: true,
      renderMarginRevertIcon: false,
      useInlineViewWhenSpaceIsLimited: true,
      renderSideBySideInlineBreakpoint: 600,
      hideUnchangedRegions: {
        enabled: collapseUnchanged ?? true,
        contextLineCount: contextLines ?? 3,
        minimumLineCount: 3,
        revealLineCount: 20,
      },
    }),
    [inline, collapseUnchanged, contextLines],
  );

  if (stagingSource) {
    return (
      <StagingDiffEditor
        original={original}
        modified={modified}
        language={language}
        inline={inline}
        collapseUnchanged={collapseUnchanged}
        contextLines={contextLines}
        hunks={stagingSource.hunks}
        staged={stagingSource.staged}
        isOperationPending={stagingSource.isOperationPending}
        onToggleHunk={stagingSource.onToggleHunk}
        lineSelection={stagingSource.lineSelection}
      />
    );
  }

  return (
    <div className="flex-1 min-h-0 h-full overflow-hidden">
      <DiffEditor
        original={original}
        modified={modified}
        language={language}
        theme={MONACO_THEME}
        options={options}
        onMount={handleMount}
        keepCurrentOriginalModel
        keepCurrentModifiedModel
      />
    </div>
  );
}
