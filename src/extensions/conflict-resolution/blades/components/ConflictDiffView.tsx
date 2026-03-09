import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import { useEffect, useMemo, useRef } from "react";
import {
  MONACO_COMMON_OPTIONS,
  MONACO_THEME,
} from "../../../../core/lib/monacoConfig";
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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex border-b border-ctp-surface0 text-xs font-mono">
        <div className="flex-1 px-3 py-1.5 text-ctp-blue font-semibold">
          {oursName} (Ours)
        </div>
        <div className="flex-1 px-3 py-1.5 text-ctp-mauve font-semibold border-l border-ctp-surface0">
          {theirsName} (Theirs)
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <DiffEditor
          original={oursContent}
          modified={theirsContent}
          language={language}
          theme={MONACO_THEME}
          options={options}
          onMount={handleMount}
        />
      </div>
    </div>
  );
}
