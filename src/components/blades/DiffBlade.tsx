import { DiffEditor } from "@monaco-editor/react";
import { useQuery } from "@tanstack/react-query";
import { AlignJustify, Columns, Loader2 } from "lucide-react";
import { useState } from "react";
import { commands } from "../../bindings";
import "../../lib/monacoTheme";
import { Button } from "../ui/button";

/**
 * Blade input: diff source configuration.
 *
 * - "commit" mode: fetches diff for a file at a specific commit OID
 * - "staging" mode: fetches diff for a working-tree file (staged or unstaged)
 */
type DiffSource =
  | { mode: "commit"; oid: string; filePath: string }
  | { mode: "staging"; filePath: string; staged: boolean };

interface DiffBladeProps {
  source: DiffSource;
}

export function DiffBlade({ source }: DiffBladeProps) {
  const [inline, setInline] = useState(true);
  const contextLines = 3;

  const queryKey =
    source.mode === "commit"
      ? ["commitFileDiff", source.oid, source.filePath, contextLines]
      : ["fileDiff", source.filePath, source.staged, contextLines];

  const queryFn =
    source.mode === "commit"
      ? () =>
          commands.getCommitFileDiff(source.oid, source.filePath, contextLines)
      : () =>
          commands.getFileDiff(source.filePath, source.staged, contextLines);

  const {
    data: result,
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn,
    staleTime: source.mode === "commit" ? 60000 : undefined,
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
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ctp-surface0 bg-ctp-crust shrink-0">
        <span className="text-sm truncate flex-1">
          {(() => {
            const lastSlash = source.filePath.lastIndexOf("/");
            if (lastSlash === -1) {
              return (
                <span className="font-semibold text-ctp-text">
                  {source.filePath}
                </span>
              );
            }
            return (
              <>
                <span className="text-ctp-overlay1">
                  {source.filePath.slice(0, lastSlash + 1)}
                </span>
                <span className="font-semibold text-ctp-text">
                  {source.filePath.slice(lastSlash + 1)}
                </span>
              </>
            );
          })()}
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
      <div className="flex-1 min-h-0">
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
