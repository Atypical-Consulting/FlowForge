import { DiffEditor } from "@monaco-editor/react";
import { useQuery } from "@tanstack/react-query";
import {
  AlignJustify,
  ChevronLeft,
  ChevronRight,
  Code,
  Columns,
  Eye,
  Loader2,
} from "lucide-react";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { commands } from "../../bindings";
import { MONACO_COMMON_OPTIONS, MONACO_THEME } from "../../lib/monacoConfig";
import "../../lib/monacoTheme";
import { useBladeNavigation } from "../../hooks/useBladeNavigation";
import { useStagingStore } from "../../stores/staging";
import { Button } from "../ui/button";
import { BladeLoadingFallback } from "../../blades/_shared/BladeLoadingFallback";

const MarkdownRenderer = lazy(() =>
  import("../markdown/MarkdownRenderer").then((m) => ({
    default: m.MarkdownRenderer,
  })),
);

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
  const { replaceBlade } = useBladeNavigation();

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
      replaceBlade({
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
    [allFiles, selectFile, replaceBlade],
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

  // Markdown preview toggle — only for .md/.mdx files
  const isMarkdown =
    source.filePath.toLowerCase().endsWith(".md") ||
    source.filePath.toLowerCase().endsWith(".mdx");
  const [showPreview, setShowPreview] = useState(false);

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
      {/* Toolbar: diff view toggles + staging navigation */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-ctp-surface0 bg-ctp-crust shrink-0">
        {/* Markdown preview toggle (only for .md/.mdx files) */}
        {isMarkdown && (
          <div className="flex bg-ctp-surface0 rounded p-0.5">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                !showPreview
                  ? "bg-ctp-surface1 text-ctp-text"
                  : "text-ctp-overlay0 hover:text-ctp-subtext1"
              }`}
              title="Show diff"
            >
              <Code className="w-3.5 h-3.5" />
              Diff
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                showPreview
                  ? "bg-ctp-surface1 text-ctp-text"
                  : "text-ctp-overlay0 hover:text-ctp-subtext1"
              }`}
              title="Show rendered preview"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
          </div>
        )}

        {/* Divider between Diff/Preview toggle and Side-by-side button */}
        {isMarkdown && !showPreview && (
          <div className="w-px h-4 bg-ctp-surface1" />
        )}

        {/* Inline/side-by-side toggle (hidden in preview mode) */}
        {!showPreview && (
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
        )}

        <div className="flex-1" />
        {source.mode === "staging" && (
          <StagingDiffNavigation currentFilePath={source.filePath} />
        )}
      </div>
      {/* Content: diff editor or markdown preview */}
      {showPreview && isMarkdown ? (
        <div className="flex-1 min-h-0 overflow-y-auto bg-ctp-base">
          <div className="p-6 mx-auto w-full">
            <Suspense fallback={<BladeLoadingFallback />}>
              <MarkdownRenderer
                content={diff.newContent}
                currentFilePath={source.filePath}
              />
            </Suspense>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 h-full overflow-hidden">
          <DiffEditor
            original={diff.oldContent}
            modified={diff.newContent}
            language={diff.language}
            theme={MONACO_THEME}
            options={{
              ...MONACO_COMMON_OPTIONS,
              renderSideBySide: !inline,
              originalEditable: false,
            }}
          />
        </div>
      )}
    </div>
  );
}
