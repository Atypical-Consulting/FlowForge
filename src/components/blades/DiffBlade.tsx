import { DiffEditor } from "@monaco-editor/react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { commands } from "../../bindings";
import "../../lib/monacoTheme";

/**
 * Blade input: diff source configuration.
 *
 * - "commit" mode: fetches diff for a file at a specific commit OID
 * - "staging" mode: fetches diff for a working-tree file (staged or unstaged)
 */
export type DiffSource =
  | { mode: "commit"; oid: string; filePath: string }
  | { mode: "staging"; filePath: string; staged: boolean };

interface DiffBladeProps {
  source: DiffSource;
  inline?: boolean;
}

export function DiffBlade({ source, inline = true }: DiffBladeProps) {
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
