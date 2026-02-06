import { DiffEditor } from "@monaco-editor/react";
import { useQuery } from "@tanstack/react-query";
import { AlignJustify, Columns, Loader2 } from "lucide-react";
import { useState } from "react";
import { commands } from "../../bindings";
import "../../lib/monacoTheme";
import { Button } from "../ui/button";
import type { ViewerProps } from "./ViewerRegistry";

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
