import { DiffEditor } from "@monaco-editor/react";
import { useQuery } from "@tanstack/react-query";
import { AlignJustify, Columns, Loader2 } from "lucide-react";
import { useState } from "react";
import { commands } from "../../bindings";
import { useStagingStore } from "../../stores/staging";
import { Button } from "../ui/button";

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
          theme="vs-dark"
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
          }}
        />
      </div>
    </div>
  );
}
