import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import { useEffect, useMemo, useRef } from "react";
import { WholeFileDiffEditor } from "@/core/components/diff/WholeFileDiffEditor";
import { useMonacoTheme } from "@/core/hooks/useMonacoTheme";
import { prepareDiffContent } from "@/core/lib/diffContent";
import { MONACO_COMMON_OPTIONS } from "@/core/lib/monacoConfig";
import type { DiffHunkDetail } from "../../../../bindings";
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
  const modelsRef =
    useRef<ReturnType<Parameters<DiffOnMount>[0]["getModel"]>>(null);

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

  const monacoTheme = useMonacoTheme();
  // Normalize trailing newlines so Monaco's line count matches git's and new
  // files don't render phantom empty removed/added lines.
  const content = useMemo(
    () => prepareDiffContent(original, modified),
    [original, modified],
  );

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

  // Options for the single-sided view of an added/deleted file.
  const wholeFileOptions = useMemo(
    () => ({
      ...MONACO_COMMON_OPTIONS,
      glyphMargin: true,
      wordWrap: "on" as const,
    }),
    [],
  );

  if (stagingSource) {
    return (
      <StagingDiffEditor
        // Remount when switching between the two-sided and single-sided
        // editors so hunk/line decorations are rebuilt for the new editor.
        key={content.kind}
        original={content.original}
        modified={content.modified}
        kind={content.kind}
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

  if (content.kind !== "modified") {
    return (
      <div className="flex-1 min-h-0 h-full overflow-hidden">
        <WholeFileDiffEditor
          content={
            content.kind === "added" ? content.modified : content.original
          }
          kind={content.kind}
          language={language}
          options={wholeFileOptions}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 h-full overflow-hidden">
      <DiffEditor
        original={content.original}
        modified={content.modified}
        language={language}
        theme={monacoTheme}
        options={options}
        onMount={handleMount}
        keepCurrentOriginalModel
        keepCurrentModifiedModel
      />
    </div>
  );
}
