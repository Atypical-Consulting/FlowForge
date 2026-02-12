import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import { useEffect, useMemo, useRef } from "react";
import type { DiffHunkDetail } from "../../../../bindings";
import { MONACO_COMMON_OPTIONS, MONACO_THEME } from "../../../lib/monacoConfig";
import "../../../lib/monacoTheme";
import { StagingDiffEditor } from "./StagingDiffEditor";

interface StagingSource {
  filePath: string;
  staged: boolean;
  hunks: DiffHunkDetail[];
  isOperationPending: boolean;
  onToggleHunk: (hunkIndex: number) => void;
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

  useEffect(() => {
    return () => {
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, []);

  const handleMount: DiffOnMount = (editor) => {
    editorRef.current = editor;
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
      />
    </div>
  );
}
