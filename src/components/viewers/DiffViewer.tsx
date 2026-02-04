import { DiffEditor, loader } from "@monaco-editor/react";
import { useQuery } from "@tanstack/react-query";
import { AlignJustify, Columns, Loader2 } from "lucide-react";
import { useState } from "react";
import { commands } from "../../bindings";
import { Button } from "../ui/button";
import type { ViewerProps } from "./ViewerRegistry";

// Custom theme matching Catppuccin Mocha color scheme
// Using CSS variable hex values for Monaco (Monaco doesn't support CSS variables directly)
const FLOWFORGE_THEME = {
  base: "vs-dark" as const,
  inherit: true,
  rules: [
    { token: "comment", foreground: "6c7086", fontStyle: "italic" }, // ctp-overlay0
    { token: "keyword", foreground: "cba6f7" }, // ctp-mauve
    { token: "string", foreground: "a6e3a1" }, // ctp-green
    { token: "number", foreground: "fab387" }, // ctp-peach
    { token: "type", foreground: "94e2d5" }, // ctp-teal
    { token: "function", foreground: "89b4fa" }, // ctp-blue
    { token: "variable", foreground: "cdd6f4" }, // ctp-text
    { token: "operator", foreground: "9399b2" }, // ctp-overlay2
  ],
  colors: {
    "editor.background": "#11111b", // ctp-crust
    "editor.foreground": "#cdd6f4", // ctp-text
    "editor.lineHighlightBackground": "#31324466", // ctp-surface0 with transparency
    "editor.selectionBackground": "#89b4fa40", // ctp-blue with transparency
    "editor.inactiveSelectionBackground": "#89b4fa20", // ctp-blue with less transparency
    "editorLineNumber.foreground": "#6c7086", // ctp-overlay0
    "editorLineNumber.activeForeground": "#9399b2", // ctp-overlay2
    "editorCursor.foreground": "#89b4fa", // ctp-blue
    "editorWhitespace.foreground": "#45475a", // ctp-surface1
    "editorIndentGuide.background": "#45475a", // ctp-surface1
    "editorIndentGuide.activeBackground": "#585b70", // ctp-surface2
    "editor.wordHighlightBackground": "#89b4fa20", // ctp-blue with transparency
    "diffEditor.insertedTextBackground": "#a6e3a120", // ctp-green with transparency
    "diffEditor.removedTextBackground": "#f38ba820", // ctp-red with transparency
    "diffEditor.insertedLineBackground": "#a6e3a115", // ctp-green with less transparency
    "diffEditor.removedLineBackground": "#f38ba815", // ctp-red with less transparency
    "diffEditorGutter.insertedLineBackground": "#a6e3a130", // ctp-green gutter
    "diffEditorGutter.removedLineBackground": "#f38ba830", // ctp-red gutter
    "scrollbarSlider.background": "#58587050", // ctp-surface2 with transparency
    "scrollbarSlider.hoverBackground": "#6c708670", // ctp-overlay0 with transparency
    "scrollbarSlider.activeBackground": "#9399b280", // ctp-overlay2 with transparency
  },
};

// Configure Monaco loader to use local files and suppress source map warnings
loader.config({
  paths: {
    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs",
  },
});

// Initialize Monaco with custom theme
loader.init().then((monaco) => {
  monaco.editor.defineTheme("flowforge-dark", FLOWFORGE_THEME);
});

export function DiffViewer({ file, section }: ViewerProps) {
  const [inline, setInline] = useState(true);
  const contextLines = 3;

  // Staged files show diff between HEAD and index
  // Unstaged files show diff between index and workdir
  const staged = section === "staged";

  const {
    data: result,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["fileDiff", file.path, staged, contextLines],
    queryFn: () => commands.getFileDiff(file.path, staged, contextLines),
    enabled: true,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
        <Loader2 className="w-5 h-5 animate-spin text-ctp-overlay1" />
      </div>
    );
  }

  if (error || !result || result.status === "error") {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
        <p className="text-ctp-red text-sm">Failed to load diff</p>
      </div>
    );
  }

  const diff = result.data;

  if (diff.isBinary) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
        <p className="text-ctp-overlay1 text-sm">
          Binary file - diff not available
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ctp-surface0 bg-ctp-crust">
        <span className="text-sm text-ctp-subtext1 truncate flex-1">
          {file.path}
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
