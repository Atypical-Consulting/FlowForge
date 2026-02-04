import { DiffEditor, loader } from "@monaco-editor/react";
import { useQuery } from "@tanstack/react-query";
import { AlignJustify, Columns, Loader2 } from "lucide-react";
import { useState } from "react";
import { commands } from "../../bindings";
import { useStagingStore } from "../../stores/staging";
import { Button } from "../ui/button";

// Custom theme matching the app's dark color scheme
// Tailwind gray-950: #030712, gray-900: #111827, gray-800: #1f2937
const FLOWFORGE_THEME = {
  base: "vs-dark" as const,
  inherit: true,
  rules: [
    { token: "comment", foreground: "6b7280", fontStyle: "italic" },
    { token: "keyword", foreground: "c084fc" },
    { token: "string", foreground: "86efac" },
    { token: "number", foreground: "fbbf24" },
    { token: "type", foreground: "67e8f9" },
    { token: "function", foreground: "93c5fd" },
    { token: "variable", foreground: "e5e7eb" },
    { token: "operator", foreground: "9ca3af" },
  ],
  colors: {
    "editor.background": "#030712", // gray-950
    "editor.foreground": "#e5e7eb", // gray-200
    "editor.lineHighlightBackground": "#1f293766", // gray-800 with transparency
    "editor.selectionBackground": "#3b82f640", // blue-500 with transparency
    "editor.inactiveSelectionBackground": "#3b82f620",
    "editorLineNumber.foreground": "#6b7280", // gray-500
    "editorLineNumber.activeForeground": "#9ca3af", // gray-400
    "editorCursor.foreground": "#3b82f6", // blue-500
    "editorWhitespace.foreground": "#374151", // gray-700
    "editorIndentGuide.background": "#374151", // gray-700
    "editorIndentGuide.activeBackground": "#4b5563", // gray-600
    "editor.wordHighlightBackground": "#3b82f620",
    "diffEditor.insertedTextBackground": "#22c55e20", // green-500 with transparency
    "diffEditor.removedTextBackground": "#ef444420", // red-500 with transparency
    "diffEditor.insertedLineBackground": "#16a34a15", // green-600 with transparency
    "diffEditor.removedLineBackground": "#dc262615", // red-600 with transparency
    "diffEditorGutter.insertedLineBackground": "#22c55e30",
    "diffEditorGutter.removedLineBackground": "#ef444430",
    "scrollbarSlider.background": "#4b556350",
    "scrollbarSlider.hoverBackground": "#6b728070",
    "scrollbarSlider.activeBackground": "#9ca3af80",
  },
};

// Initialize Monaco with custom theme
loader.init().then((monaco) => {
  monaco.editor.defineTheme("flowforge-dark", FLOWFORGE_THEME);
});

export function DiffViewer() {
  const { selectedFile, selectedSection } = useStagingStore();
  const [inline, setInline] = useState(true);
  const contextLines = 3;

  // Staged files show diff between HEAD and index
  // Unstaged files show diff between index and workdir
  const staged = selectedSection === "staged";

  const {
    data: result,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["fileDiff", selectedFile?.path, staged, contextLines],
    queryFn: () =>
      selectedFile
        ? commands.getFileDiff(selectedFile.path, staged, contextLines)
        : null,
    enabled: !!selectedFile,
  });

  if (!selectedFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <p className="text-gray-500 text-sm">Select a file to view diff</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !result || result.status === "error") {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <p className="text-red-400 text-sm">Failed to load diff</p>
      </div>
    );
  }

  const diff = result.data;

  if (diff.isBinary) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <p className="text-gray-400 text-sm">
          Binary file - diff not available
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 bg-gray-950">
        <span className="text-sm text-gray-300 truncate flex-1">
          {selectedFile.path}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setInline(!inline)}
          title={inline ? "Switch to side-by-side" : "Switch to inline"}
        >
          {inline ? (
            <Columns className="w-4 h-4" />
          ) : (
            <AlignJustify className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Monaco DiffEditor */}
      <div className="flex-1">
        <DiffEditor
          original={diff.oldContent}
          modified={diff.newContent}
          language={diff.language}
          theme="flowforge-dark"
          options={{
            readOnly: true,
            renderSideBySide: !inline,
            originalEditable: false,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            folding: true,
            wordWrap: "off",
            renderLineHighlight: "all",
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
          }}
        />
      </div>
    </div>
  );
}
