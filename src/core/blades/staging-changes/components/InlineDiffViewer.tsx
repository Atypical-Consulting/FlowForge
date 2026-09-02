import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { commands } from "../../../../bindings";
import { useMonacoTheme } from "../../../hooks/useMonacoTheme";
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
  const editorRef = useRef<Parameters<DiffOnMount>[0] | null>(null);
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

  const handleMount: DiffOnMount = (editor) => {
    editorRef.current = editor;
    const scrollTop = initialScrollTopRef.current;
    if (scrollTop && scrollTop > 0) {
      editor.getModifiedEditor().setScrollTop(scrollTop);
    }
    scrollDisposableRef.current?.dispose();
    scrollDisposableRef.current = editor
      .getModifiedEditor()
      .onDidScrollChange((e) => {
        onScrollPositionChange?.(e.scrollTop);
      });
  };

  const diff = result?.status === "ok" ? result.data : null;

  // The editor is reused in place when the selected file changes (no remount),
  // so handleMount only runs once. Re-apply the saved scroll position whenever
  // the file or its loaded diff content changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: debouncedFilePath is an intentional trigger so the saved scroll position is re-applied on every file switch (the editor is reused, not remounted).
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !diff) return;
    const scrollTop = initialScrollTopRef.current ?? 0;
    editor.getModifiedEditor().setScrollTop(scrollTop);
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
      {diff && (
        <DiffEditor
          original={diff.oldContent}
          modified={diff.newContent}
          language={diff.language}
          theme={monacoTheme}
          options={INLINE_DIFF_OPTIONS}
          onMount={handleMount}
        />
      )}
    </div>
  );
}
