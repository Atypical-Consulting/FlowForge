import { Check, GitMerge, Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect } from "react";
import {
  ResizablePanel,
  ResizablePanelLayout,
  ResizeHandle,
} from "@/framework/layout/ResizablePanelLayout";
import {
  useConflictFileContent,
  useConflictFiles,
} from "../hooks/useConflictQuery";
import { useConflictStore } from "../store";
import { ConflictDiffView } from "./components/ConflictDiffView";
import { ConflictFileList } from "./components/ConflictFileList";
import { ConflictHunkActions } from "./components/ConflictHunkActions";
import { ConflictResultEditor } from "./components/ConflictResultEditor";

const EXT_LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  rs: "rust",
  py: "python",
  rb: "ruby",
  go: "go",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  cs: "csharp",
  css: "css",
  scss: "scss",
  html: "html",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  toml: "toml",
  xml: "xml",
  sql: "sql",
  sh: "shell",
  bash: "shell",
};

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return EXT_LANGUAGE_MAP[ext] ?? "plaintext";
}

interface ConflictResolutionBladeProps {
  filePath?: string;
}

export function ConflictResolutionBlade({
  filePath,
}: ConflictResolutionBladeProps) {
  const {
    files,
    activeFilePath,
    openConflictFile,
    resolveHunk,
    undoHunkResolution,
    updateResultContent,
    resetFile,
    markFileResolved,
    isFileFullyResolved,
  } = useConflictStore();

  const { isLoading: isLoadingFiles } = useConflictFiles();
  const { isLoading: isLoadingContent } =
    useConflictFileContent(activeFilePath);

  // Auto-select file from props on mount
  useEffect(() => {
    if (filePath && files.has(filePath)) {
      openConflictFile(filePath);
    }
  }, [filePath, files, openConflictFile]);

  const handleSelectFile = useCallback(
    (path: string) => {
      openConflictFile(path);
    },
    [openConflictFile],
  );

  const handleMarkResolved = useCallback(
    (path: string) => {
      markFileResolved(path);
    },
    [markFileResolved],
  );

  const handleResolveHunk = useCallback(
    (hunkId: string, choice: "ours" | "theirs" | "both" | "custom") => {
      if (activeFilePath) {
        resolveHunk(activeFilePath, hunkId, choice);
      }
    },
    [activeFilePath, resolveHunk],
  );

  const handleUndo = useCallback(() => {
    if (activeFilePath) {
      undoHunkResolution(activeFilePath);
    }
  }, [activeFilePath, undoHunkResolution]);

  const handleResultChange = useCallback(
    (value: string) => {
      if (activeFilePath) {
        updateResultContent(activeFilePath, value);
      }
    },
    [activeFilePath, updateResultContent],
  );

  const handleReset = useCallback(() => {
    if (activeFilePath) {
      resetFile(activeFilePath);
    }
  }, [activeFilePath, resetFile]);

  const handleResolve = useCallback(() => {
    if (activeFilePath) {
      markFileResolved(activeFilePath);
    }
  }, [activeFilePath, markFileResolved]);

  const activeFile = activeFilePath ? files.get(activeFilePath) : undefined;
  const canResolve = activeFilePath
    ? isFileFullyResolved(activeFilePath)
    : false;
  const language = activeFilePath
    ? getLanguageFromPath(activeFilePath)
    : "plaintext";

  // Loading state
  if (isLoadingFiles && files.size === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
        <Loader2 className="w-5 h-5 animate-spin text-ctp-overlay1" />
      </div>
    );
  }

  // Empty state — no conflicts
  if (files.size === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-ctp-mantle text-ctp-subtext0">
        <GitMerge className="w-10 h-10 text-ctp-overlay0" />
        <p className="text-sm font-medium">No merge conflicts detected</p>
        <p className="text-xs text-ctp-overlay0">
          Conflicts will appear here during a merge operation
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <ResizablePanelLayout
        autoSaveId="conflict-resolution-layout"
        direction="horizontal"
      >
        {/* File list sidebar */}
        <ResizablePanel id="conflict-files" defaultSize={22} minSize={15}>
          <ConflictFileList
            files={files}
            activeFilePath={activeFilePath}
            onSelectFile={handleSelectFile}
            onMarkResolved={handleMarkResolved}
          />
        </ResizablePanel>

        <ResizeHandle />

        {/* Editor area */}
        <ResizablePanel id="conflict-editor" defaultSize={78} minSize={40}>
          {!activeFile ? (
            <div className="flex items-center justify-center h-full text-ctp-subtext0 text-sm">
              Select a conflicted file to begin resolving
            </div>
          ) : isLoadingContent ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 animate-spin text-ctp-overlay1" />
            </div>
          ) : (
            <ResizablePanelLayout
              autoSaveId="conflict-editor-split"
              direction="vertical"
            >
              {/* Diff view: ours vs theirs */}
              <ResizablePanel id="conflict-diff" defaultSize={45} minSize={20}>
                <ConflictDiffView
                  oursContent={activeFile.oursFullContent}
                  theirsContent={activeFile.theirsFullContent}
                  language={language}
                  oursName={activeFile.oursName}
                  theirsName={activeFile.theirsName}
                />
              </ResizablePanel>

              <ResizeHandle className="h-1 w-full cursor-row-resize" />

              {/* Result editor with hunk actions */}
              <ResizablePanel
                id="conflict-result"
                defaultSize={55}
                minSize={20}
              >
                <div className="flex flex-col h-full">
                  {/* Hunk actions bar */}
                  <ConflictHunkActions
                    hunks={activeFile.hunks}
                    filePath={activeFilePath!}
                    onResolveHunk={handleResolveHunk}
                    onUndo={handleUndo}
                    undoAvailable={activeFile.undoStack.length > 0}
                  />

                  {/* Result editor */}
                  <ConflictResultEditor
                    content={activeFile.resultContent}
                    language={language}
                    onChange={handleResultChange}
                  />

                  {/* Bottom toolbar */}
                  <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-ctp-surface0 bg-ctp-mantle">
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-ctp-surface1 text-ctp-subtext0 hover:bg-ctp-surface0 transition-colors"
                      aria-label="Reset file to original conflicted state"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset File
                    </button>
                    <button
                      onClick={handleResolve}
                      disabled={!canResolve}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium transition-colors bg-ctp-green text-ctp-base hover:bg-ctp-green/80 disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Mark file as resolved and stage it"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Mark as Resolved
                    </button>
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelLayout>
          )}
        </ResizablePanel>
      </ResizablePanelLayout>
    </div>
  );
}
