import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useMemo, useRef } from "react";
import type { editor } from "monaco-editor";
import { MONACO_COMMON_OPTIONS, MONACO_THEME } from "../../../../core/lib/monacoConfig";
import "../../../../core/lib/monacoTheme";

interface ConflictResultEditorProps {
  content: string;
  language: string;
  onChange: (value: string) => void;
}

export function ConflictResultEditor({
  content,
  language,
  onChange,
}: ConflictResultEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    return () => {
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, []);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const options = useMemo(
    () => ({
      ...MONACO_COMMON_OPTIONS,
      readOnly: false,
      wordWrap: "on" as const,
      minimap: { enabled: true },
    }),
    [],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-3 py-1.5 border-b border-ctp-surface0 text-xs font-mono text-ctp-green font-semibold">
        Result (Editable)
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <Editor
          value={content}
          language={language}
          theme={MONACO_THEME}
          options={options}
          onMount={handleMount}
          onChange={(value) => onChange(value ?? "")}
        />
      </div>
    </div>
  );
}
