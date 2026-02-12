import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import { useEffect, useMemo, useRef } from "react";
import { MONACO_COMMON_OPTIONS, MONACO_THEME } from "../../../lib/monacoConfig";
import "../../../lib/monacoTheme";

interface DiffContentProps {
  original: string;
  modified: string;
  language: string;
  inline: boolean;
  collapseUnchanged?: boolean;
  contextLines?: number;
}

export function DiffContent({
  original,
  modified,
  language,
  inline,
  collapseUnchanged,
  contextLines,
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
    }),
    [inline],
  );

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
