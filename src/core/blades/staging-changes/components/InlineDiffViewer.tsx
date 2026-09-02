import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { editor } from "monaco-editor";
import { useEffect, useMemo, useRef, useState } from "react";
import { commands } from "../../../../bindings";
import { WholeFileDiffEditor } from "../../../components/diff/WholeFileDiffEditor";
import { useMonacoTheme } from "../../../hooks/useMonacoTheme";
import { prepareDiffContent } from "../../../lib/diffContent";
import "../../../lib/monacoTheme";

interface InlineDiffViewerProps {
  filePath: string;
  staged: boolean;
  onScrollPositionChange?: (scrollTop: number) => void;
  initialScrollTop?: number;
}

export const INLINE_DIFF_OPTIONS = {
  readOnly: true,
  originalEditable: false,
  renderSideBySide: false,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  minimap: { enabled: false },
  fontSize: 12,
  lineNumbers: "on" as const,
  folding: false,
  wordWrap: "on" as const,
  renderLineHighlight: "none" as const,
  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
  overviewRulerBorder: false,
  renderOverviewRuler: false,
  glyphMargin: false,
  // The line-decorations area sits between the line numbers and the code and
  // is where Monaco draws the +/- change indicators (`renderIndicators`).
  // Width 0 hides the indicators and glues the numbers to the content.
  lineDecorationsWidth: 16,
  lineNumbersMinChars: 3,
  diffAlgorithm: "advanced" as const,
  renderIndicators: true,
  renderMarginRevertIcon: false,
  hideUnchangedRegions: {
    enabled: true,
    contextLineCount: 3,
    minimumLineCount: 3,
    revealLineCount: 20,
  },
};

export function InlineDiffViewer({
  filePath,
  staged,
  onScrollPositionChange,
  initialScrollTop,
}: InlineDiffViewerProps) {
  // Debounce file path changes to prevent rapid-fire queries during keyboard nav
  const [debouncedFilePath, setDebouncedFilePath] = useState(filePath);
  const [debouncedStaged, setDebouncedStaged] = useState(staged);
  // The editor whose scroll position is tracked: the modified pane of the
  // DiffEditor, or the single WholeFileDiffEditor for added/deleted files.
  const editorRef = useRef<editor.ICodeEditor | null>(null);
  const monacoTheme = useMonacoTheme();

  // Keep the latest saved scroll position in a ref so the restore effect can
  // read it without re-firing every time a scroll-driven save updates the prop.
  const initialScrollTopRef = useRef(initialScrollTop);
  initialScrollTopRef.current = initialScrollTop;

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedFilePath(filePath);
      setDebouncedStaged(staged);
    }, 150);
    return () => clearTimeout(timeout);
  }, [filePath, staged]);

  const {
    data: result,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["fileDiff", debouncedFilePath, debouncedStaged, 3],
    queryFn: () => commands.getFileDiff(debouncedFilePath, debouncedStaged, 3),
    staleTime: 5000,
    enabled: !!debouncedFilePath,
  });

  // Dispose Monaco scroll listener on unmount
  const scrollDisposableRef = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => {
    return () => {
      scrollDisposableRef.current?.dispose();
      scrollDisposableRef.current = null;
      editorRef.current = null;
    };
  }, []);

  const attachEditor = (codeEditor: editor.ICodeEditor) => {
    editorRef.current = codeEditor;
    const scrollTop = initialScrollTopRef.current;
    if (scrollTop && scrollTop > 0) {
      codeEditor.setScrollTop(scrollTop);
    }
    scrollDisposableRef.current?.dispose();
    scrollDisposableRef.current = codeEditor.onDidScrollChange((e) => {
      onScrollPositionChange?.(e.scrollTop);
    });
  };

  const handleMount: DiffOnMount = (diffEditor) => {
    attachEditor(diffEditor.getModifiedEditor());
  };

  const diff = result?.status === "ok" ? result.data : null;

  // Normalize trailing newlines so Monaco's line count matches git's and new
  // files don't render phantom empty removed/added lines.
  const content = useMemo(
    () => (diff ? prepareDiffContent(diff.oldContent, diff.newContent) : null),
    [diff],
  );

  // The editor is reused in place when the selected file changes (no remount),
  // so handleMount only runs once. Re-apply the saved scroll position whenever
  // the file or its loaded diff content changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: debouncedFilePath is an intentional trigger so the saved scroll position is re-applied on every file switch (the editor is reused, not remounted).
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !diff) return;
    const scrollTop = initialScrollTopRef.current ?? 0;
    editor.setScrollTop(scrollTop);
  }, [debouncedFilePath, diff]);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
        <p className="text-ctp-red text-sm">Failed to load diff</p>
      </div>
    );
  }

  if (diff?.isBinary) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
        <p className="text-ctp-overlay1 text-sm">Binary file</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-ctp-mantle z-10">
          <Loader2 className="w-5 h-5 animate-spin text-ctp-overlay1" />
        </div>
      )}
      {diff && content && content.kind !== "modified" && (
        <WholeFileDiffEditor
          content={
            content.kind === "added" ? content.modified : content.original
          }
          kind={content.kind}
          language={diff.language}
          options={INLINE_DIFF_OPTIONS}
          onMount={attachEditor}
        />
      )}
      {diff && content && content.kind === "modified" && (
        <DiffEditor
          original={content.original}
          modified={content.modified}
          language={diff.language}
          theme={monacoTheme}
          options={INLINE_DIFF_OPTIONS}
          onMount={handleMount}
        />
      )}
    </div>
  );
}
