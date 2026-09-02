import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import { useEffect, useMemo, useRef } from "react";
import { useMonacoTheme } from "../../../../core/hooks/useMonacoTheme";
import { prepareDiffContent } from "../../../../core/lib/diffContent";
import { MONACO_COMMON_OPTIONS } from "../../../../core/lib/monacoConfig";
import "../../../../core/lib/monacoTheme";

interface ConflictDiffViewProps {
  oursContent: string;
  theirsContent: string;
  language: string;
  oursName: string;
  theirsName: string;
}

export function ConflictDiffView({
  oursContent,
  theirsContent,
  language,
  oursName,
  theirsName,
}: ConflictDiffViewProps) {
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

  const monacoTheme = useMonacoTheme();
  const options = useMemo(
    () => ({
      ...MONACO_COMMON_OPTIONS,
      readOnly: true,
      originalEditable: false,
      renderSideBySide: true,
      diffAlgorithm: "advanced" as const,
      diffWordWrap: "on" as const,
      hideUnchangedRegions: {
        enabled: true,
        contextLineCount: 3,
        minimumLineCount: 3,
        revealLineCount: 20,
      },
    }),
    [],
  );

  // Normalize trailing newlines so Monaco doesn't render a phantom empty last line.
  const content = useMemo(
    () => prepareDiffContent(oursContent, theirsContent),
    [oursContent, theirsContent],
  );

  // The parent is a resizable Panel (a flex *item*, not a flex container), so
  // `flex-1` alone gives this wrapper no height and Monaco lays out into 0px.
  // `h-full` makes the panel's height definite for the editor below.
  return (
    <div
      className="flex flex-col h-full min-h-0"
      data-testid="conflict-diff-view"
    >
      <div className="flex border-b border-ctp-surface0 text-xs font-mono shrink-0">
        <div className="flex-1 px-3 py-1.5 text-ctp-blue font-semibold">
          {oursName} (Ours)
        </div>
        <div className="flex-1 px-3 py-1.5 text-ctp-mauve font-semibold border-l border-ctp-surface0">
          {theirsName} (Theirs)
        </div>
      </div>
      <div
        className="flex-1 min-h-0 h-full overflow-hidden"
        data-testid="conflict-diff-editor-container"
      >
        <DiffEditor
          original={content.original}
          modified={content.modified}
          language={language}
          theme={monacoTheme}
          options={options}
          onMount={handleMount}
        />
      </div>
    </div>
  );
}
