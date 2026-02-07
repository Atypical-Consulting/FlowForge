import { DiffEditor } from "@monaco-editor/react";
import { useQuery } from "@tanstack/react-query";
import {
  AlignJustify,
  ChevronLeft,
  ChevronRight,
  Columns,
  Loader2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { commands } from "../../bindings";
import "../../lib/monacoTheme";
import { useBladeStore } from "../../stores/blades";
import { useStagingStore } from "../../stores/staging";
import { Button } from "../ui/button";

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
}

function StagingDiffNavigation({
  currentFilePath,
}: { currentFilePath: string }) {
  const { selectFile } = useStagingStore();
  const store = useBladeStore();

  const { data: statusResult } = useQuery({
    queryKey: ["stagingStatus"],
    queryFn: () => commands.getStagingStatus(),
  });

  const allFiles = useMemo(() => {
    if (!statusResult || statusResult.status !== "ok") return [];
    const s = statusResult.data;
    return [
      ...s.staged.map((f) => ({ file: f, section: "staged" as const })),
      ...s.unstaged.map((f) => ({ file: f, section: "unstaged" as const })),
      ...s.untracked.map((f) => ({
        file: f,
        section: "untracked" as const,
      })),
    ];
  }, [statusResult]);

  const currentIndex = allFiles.findIndex(
    (f) => f.file.path === currentFilePath,
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allFiles.length - 1;

  const navigateTo = useCallback(
    (index: number) => {
      const entry = allFiles[index];
      if (!entry) return;
      selectFile(entry.file, entry.section);
      store.replaceBlade({
        type: "diff",
        title: entry.file.path.split("/").pop() || entry.file.path,
        props: {
          source: {
            mode: "staging",
            filePath: entry.file.path,
            staged: entry.section === "staged",
          },
        },
      });
    },
    [allFiles, selectFile, store],
  );

  useHotkeys(
    "alt+up",
    () => hasPrev && navigateTo(currentIndex - 1),
    { enabled: hasPrev, enableOnFormTags: false, preventDefault: true },
    [currentIndex, hasPrev, navigateTo],
  );

  useHotkeys(
    "alt+down",
    () => hasNext && navigateTo(currentIndex + 1),
    { enabled: hasNext, enableOnFormTags: false, preventDefault: true },
    [currentIndex, hasNext, navigateTo],
  );

  if (allFiles.length <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={!hasPrev}
        onClick={() => navigateTo(currentIndex - 1)}
        className="p-1 rounded hover:bg-ctp-surface0 disabled:opacity-30 disabled:cursor-default text-ctp-overlay1 hover:text-ctp-text transition-colors"
        aria-label="Previous file"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-xs text-ctp-overlay0 tabular-nums">
        {currentIndex + 1} / {allFiles.length}
      </span>
      <button
        type="button"
        disabled={!hasNext}
        onClick={() => navigateTo(currentIndex + 1)}
        className="p-1 rounded hover:bg-ctp-surface0 disabled:opacity-30 disabled:cursor-default text-ctp-overlay1 hover:text-ctp-text transition-colors"
        aria-label="Next file"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
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
      {/* Inline/side-by-side toggle + staging navigation */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-ctp-surface0 bg-ctp-crust shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setInline((v) => !v)}
          title={inline ? "Switch to side-by-side" : "Switch to inline"}
          className="h-7 px-2"
        >
          {inline ? (
            <Columns className="w-4 h-4" />
          ) : (
            <AlignJustify className="w-4 h-4" />
          )}
          <span className="text-xs ml-1.5">
            {inline ? "Side-by-side" : "Inline"}
          </span>
        </Button>
        <div className="flex-1" />
        {source.mode === "staging" && (
          <StagingDiffNavigation currentFilePath={source.filePath} />
        )}
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
