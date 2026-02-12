import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { DiffHunkDetail } from "../../../../bindings";
import {
  MONACO_COMMON_OPTIONS,
  MONACO_THEME,
} from "../../../lib/monacoConfig";
import "../../../lib/monacoTheme";
import { findHunkForLine } from "../lib/diffUtils";

interface StagingDiffEditorProps {
  original: string;
  modified: string;
  language: string;
  inline: boolean;
  collapseUnchanged?: boolean;
  contextLines?: number;
  hunks: DiffHunkDetail[];
  staged: boolean;
  isOperationPending: boolean;
  onToggleHunk: (hunkIndex: number) => void;
}

export function StagingDiffEditor({
  original,
  modified,
  language,
  inline,
  collapseUnchanged,
  contextLines,
  hunks,
  staged,
  isOperationPending,
  onToggleHunk,
}: StagingDiffEditorProps) {
  const editorRef = useRef<Parameters<DiffOnMount>[0] | null>(null);
  const viewZoneIdsRef = useRef<string[]>([]);
  const decorationCollectionRef = useRef<ReturnType<
    Parameters<DiffOnMount>[0]["getModifiedEditor"]
  >["createDecorationsCollection"] extends (...args: any) => infer R
    ? R
    : null>(null);
  const announcementRef = useRef<HTMLDivElement>(null);

  // Store callbacks in refs so ViewZone DOM nodes always have current values
  const onToggleHunkRef = useRef(onToggleHunk);
  onToggleHunkRef.current = onToggleHunk;
  const isOperationPendingRef = useRef(isOperationPending);
  isOperationPendingRef.current = isOperationPending;
  const stagedRef = useRef(staged);
  stagedRef.current = staged;

  const options = useMemo(
    () => ({
      ...MONACO_COMMON_OPTIONS,
      renderSideBySide: !inline,
      originalEditable: false,
      glyphMargin: true,
      diffAlgorithm: "advanced" as const,
      diffWordWrap: "on" as const,
      renderIndicators: true,
      renderMarginRevertIcon: false,
      useInlineViewWhenSpaceIsLimited: true,
      renderSideBySideInlineBreakpoint: 600,
      hideUnchangedRegions: {
        enabled: collapseUnchanged ?? true,
        contextLineCount: contextLines ?? 3,
        minimumLineCount: 3,
        revealLineCount: 20,
      },
    }),
    [inline, collapseUnchanged, contextLines],
  );

  // Build ViewZone DOM nodes and glyph margin decorations
  const updateViewZonesAndDecorations = useCallback(() => {
    const diffEditor = editorRef.current;
    if (!diffEditor) return;

    const modifiedEditor = diffEditor.getModifiedEditor();

    // Clear existing ViewZones
    modifiedEditor.changeViewZones((accessor) => {
      for (const id of viewZoneIdsRef.current) {
        accessor.removeZone(id);
      }
      viewZoneIdsRef.current = [];

      // Create ViewZone for each hunk
      for (const hunk of hunks) {
        const domNode = document.createElement("div");
        domNode.style.display = "flex";
        domNode.style.alignItems = "center";
        domNode.style.justifyContent = "space-between";
        domNode.style.padding = "0 12px";
        domNode.style.height = "28px";
        domNode.style.background = "var(--catppuccin-color-surface0)";
        domNode.style.borderBottom =
          "1px solid var(--catppuccin-color-surface1)";
        domNode.style.fontSize = "11px";
        domNode.style.fontFamily = "var(--font-mono)";

        // Hunk header text
        const headerSpan = document.createElement("span");
        headerSpan.textContent = hunk.header;
        headerSpan.style.color = "var(--catppuccin-color-overlay1)";
        headerSpan.style.overflow = "hidden";
        headerSpan.style.textOverflow = "ellipsis";
        headerSpan.style.whiteSpace = "nowrap";
        headerSpan.style.marginRight = "8px";
        domNode.appendChild(headerSpan);

        // Stage/Unstage button
        const button = document.createElement("button");
        const isStaged = stagedRef.current;
        button.textContent = isStaged ? "Unstage Hunk" : "Stage Hunk";
        button.setAttribute(
          "aria-label",
          `${isStaged ? "Unstage" : "Stage"} hunk containing lines ${hunk.newStart} through ${hunk.newStart + hunk.newLines - 1}`,
        );
        button.style.padding = "2px 8px";
        button.style.borderRadius = "4px";
        button.style.border = "none";
        button.style.cursor = "pointer";
        button.style.fontSize = "11px";
        button.style.fontWeight = "500";
        button.style.whiteSpace = "nowrap";
        button.style.transition = "background 0.15s";
        button.style.background = "transparent";

        if (isStaged) {
          button.style.color = "var(--catppuccin-color-peach)";
          button.addEventListener("mouseenter", () => {
            button.style.background = "rgb(250 179 135 / 0.2)";
          });
          button.addEventListener("mouseleave", () => {
            button.style.background = "transparent";
          });
        } else {
          button.style.color = "var(--catppuccin-color-green)";
          button.addEventListener("mouseenter", () => {
            button.style.background = "rgb(166 227 161 / 0.2)";
          });
          button.addEventListener("mouseleave", () => {
            button.style.background = "transparent";
          });
        }

        const hunkIndex = hunk.index;
        button.addEventListener("click", () => {
          if (!isOperationPendingRef.current) {
            onToggleHunkRef.current(hunkIndex);
            // Announce to screen reader
            if (announcementRef.current) {
              announcementRef.current.textContent = `${isStaged ? "Unstaged" : "Staged"} hunk ${hunkIndex + 1}`;
            }
          }
        });

        domNode.appendChild(button);

        const zoneId = accessor.addZone({
          afterLineNumber: Math.max(0, hunk.newStart - 1),
          heightInPx: 28,
          domNode,
        });
        viewZoneIdsRef.current.push(zoneId);
      }
    });

    // Update glyph margin decorations
    const glyphClassName = staged
      ? "hunk-unstage-glyph"
      : "hunk-stage-glyph";

    const newDecorations = hunks.map((hunk) => ({
      range: {
        startLineNumber: hunk.newStart,
        startColumn: 1,
        endLineNumber: hunk.newStart,
        endColumn: 1,
      },
      options: {
        isWholeLine: true,
        glyphMarginClassName: glyphClassName,
        glyphMarginHoverMessage: {
          value: staged
            ? `Unstage hunk (lines ${hunk.newStart}-${hunk.newStart + hunk.newLines - 1})`
            : `Stage hunk (lines ${hunk.newStart}-${hunk.newStart + hunk.newLines - 1})`,
        },
      },
    }));

    if (decorationCollectionRef.current) {
      decorationCollectionRef.current.set(newDecorations);
    } else {
      decorationCollectionRef.current =
        modifiedEditor.createDecorationsCollection(newDecorations);
    }
  }, [hunks, staged]);

  // Update ViewZones/decorations when hunks or staged status changes
  useEffect(() => {
    updateViewZonesAndDecorations();
  }, [updateViewZonesAndDecorations]);

  // Update button disabled states when operation pending changes
  useEffect(() => {
    isOperationPendingRef.current = isOperationPending;
  }, [isOperationPending]);

  // Handle glyph margin clicks
  useEffect(() => {
    const diffEditor = editorRef.current;
    if (!diffEditor) return;

    const modifiedEditor = diffEditor.getModifiedEditor();
    const disposable = modifiedEditor.onMouseDown((e) => {
      // Monaco mouse target type 3 = GUTTER_GLYPH_MARGIN
      if (e.target.type === 3) {
        const lineNumber = e.target.position?.lineNumber;
        if (lineNumber && !isOperationPendingRef.current) {
          const hunkIndex = findHunkForLine(hunks, lineNumber);
          if (hunkIndex >= 0) {
            onToggleHunkRef.current(hunkIndex);
            if (announcementRef.current) {
              announcementRef.current.textContent = `${stagedRef.current ? "Unstaged" : "Staged"} hunk ${hunkIndex + 1}`;
            }
          }
        }
      }
    });

    return () => disposable.dispose();
  }, [hunks]);

  const handleMount: DiffOnMount = (editor) => {
    editorRef.current = editor;
    updateViewZonesAndDecorations();

    // Set up glyph margin click handler
    const modifiedEditor = editor.getModifiedEditor();
    const disposable = modifiedEditor.onMouseDown((e) => {
      if (e.target.type === 3) {
        const lineNumber = e.target.position?.lineNumber;
        if (lineNumber && !isOperationPendingRef.current) {
          const hunkIndex = findHunkForLine(hunks, lineNumber);
          if (hunkIndex >= 0) {
            onToggleHunkRef.current(hunkIndex);
          }
        }
      }
    });

    // Store disposable for cleanup
    const originalDispose = editor.dispose.bind(editor);
    editor.dispose = () => {
      disposable.dispose();
      originalDispose();
    };
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (editorRef.current) {
        const modifiedEditor = editorRef.current.getModifiedEditor();
        modifiedEditor.changeViewZones((accessor) => {
          for (const id of viewZoneIdsRef.current) {
            accessor.removeZone(id);
          }
        });
        viewZoneIdsRef.current = [];
      }
      decorationCollectionRef.current = null;
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, []);

  return (
    <div className="flex-1 min-h-0 h-full overflow-hidden relative">
      <DiffEditor
        original={original}
        modified={modified}
        language={language}
        theme={MONACO_THEME}
        options={options}
        onMount={handleMount}
      />
      {/* Screen reader announcement for staging operations */}
      <div
        ref={announcementRef}
        aria-live="polite"
        className="sr-only"
        role="status"
      />
    </div>
  );
}
