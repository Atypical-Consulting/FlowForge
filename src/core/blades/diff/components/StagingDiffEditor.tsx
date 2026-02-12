import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { DiffHunkDetail } from "../../../../bindings";
import {
  MONACO_COMMON_OPTIONS,
  MONACO_THEME,
} from "../../../lib/monacoConfig";
import "../../../lib/monacoTheme";
import { findHunkForLine, isChangedLine } from "../lib/diffUtils";

interface LineSelection {
  selectedLines: Set<number>;
  toggleLine: (lineNumber: number) => void;
  selectRange: (toLine: number) => void;
  clearSelection: () => void;
  stageSelectedLines: () => void;
  isLineStagingPending: boolean;
  hasSelection: boolean;
}

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
  lineSelection?: LineSelection;
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
  lineSelection,
}: StagingDiffEditorProps) {
  const editorRef = useRef<Parameters<DiffOnMount>[0] | null>(null);
  const viewZoneIdsRef = useRef<string[]>([]);
  const hunkDecorationRef = useRef<ReturnType<
    Parameters<DiffOnMount>[0]["getModifiedEditor"]
  >["createDecorationsCollection"] extends (...args: any) => infer R
    ? R
    : null>(null);
  const lineDecorationRef = useRef<ReturnType<
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
  const lineSelectionRef = useRef(lineSelection);
  lineSelectionRef.current = lineSelection;
  const hunksRef = useRef(hunks);
  hunksRef.current = hunks;

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

  // Count selected lines in a specific hunk
  const selectedLinesInHunk = useCallback(
    (hunkIndex: number): number => {
      if (!lineSelection || lineSelection.selectedLines.size === 0) return 0;
      const hunk = hunks[hunkIndex];
      if (!hunk) return 0;
      let count = 0;
      for (const line of lineSelection.selectedLines) {
        if (line >= hunk.newStart && line < hunk.newStart + hunk.newLines) {
          count++;
        }
      }
      return count;
    },
    [lineSelection, hunks],
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

        // Stage/Unstage button with dynamic label
        const button = document.createElement("button");
        const isStaged = stagedRef.current;
        const selCount = selectedLinesInHunk(hunk.index);

        if (selCount > 0) {
          button.textContent = isStaged
            ? `Unstage ${selCount} Line${selCount > 1 ? "s" : ""}`
            : `Stage ${selCount} Line${selCount > 1 ? "s" : ""}`;
          button.setAttribute(
            "aria-label",
            `${isStaged ? "Unstage" : "Stage"} ${selCount} selected lines in hunk ${hunk.index + 1}`,
          );
        } else {
          button.textContent = isStaged ? "Unstage Hunk" : "Stage Hunk";
          button.setAttribute(
            "aria-label",
            `${isStaged ? "Unstage" : "Stage"} hunk containing lines ${hunk.newStart} through ${hunk.newStart + hunk.newLines - 1}`,
          );
        }

        button.style.padding = "2px 8px";
        button.style.borderRadius = "4px";
        button.style.border = "none";
        button.style.cursor = "pointer";
        button.style.fontSize = "11px";
        button.style.fontWeight = "500";
        button.style.whiteSpace = "nowrap";
        button.style.transition = "background 0.15s";
        button.style.background = "transparent";

        if (selCount > 0) {
          // Blue for line selection actions
          button.style.color = "var(--catppuccin-color-blue)";
          button.addEventListener("mouseenter", () => {
            button.style.background = "rgb(137 180 250 / 0.2)";
          });
          button.addEventListener("mouseleave", () => {
            button.style.background = "transparent";
          });
        } else if (isStaged) {
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
          if (isOperationPendingRef.current) return;
          const ls = lineSelectionRef.current;
          if (ls && ls.hasSelection && selectedLinesInHunk(hunkIndex) > 0) {
            ls.stageSelectedLines();
            if (announcementRef.current) {
              const count = selectedLinesInHunk(hunkIndex);
              announcementRef.current.textContent = `${isStaged ? "Unstaged" : "Staged"} ${count} lines from hunk ${hunkIndex + 1}`;
            }
          } else {
            onToggleHunkRef.current(hunkIndex);
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

    // Update glyph margin decorations for hunk first lines
    const hunkGlyphClassName = staged
      ? "hunk-unstage-glyph"
      : "hunk-stage-glyph";

    const hunkDecorations = hunks.map((hunk) => ({
      range: {
        startLineNumber: hunk.newStart,
        startColumn: 1,
        endLineNumber: hunk.newStart,
        endColumn: 1,
      },
      options: {
        isWholeLine: true,
        glyphMarginClassName: hunkGlyphClassName,
        glyphMarginHoverMessage: {
          value: staged
            ? `Unstage hunk (lines ${hunk.newStart}-${hunk.newStart + hunk.newLines - 1})`
            : `Stage hunk (lines ${hunk.newStart}-${hunk.newStart + hunk.newLines - 1})`,
        },
      },
    }));

    if (hunkDecorationRef.current) {
      hunkDecorationRef.current.set(hunkDecorations);
    } else {
      hunkDecorationRef.current =
        modifiedEditor.createDecorationsCollection(hunkDecorations);
    }
  }, [hunks, staged, selectedLinesInHunk]);

  // Update line selection decorations separately for performance
  const updateLineDecorations = useCallback(() => {
    const diffEditor = editorRef.current;
    if (!diffEditor || !lineSelection) return;

    const modifiedEditor = diffEditor.getModifiedEditor();
    const decorations: Array<{
      range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
      options: { isWholeLine: boolean; className?: string; glyphMarginClassName?: string; glyphMarginHoverMessage?: { value: string } };
    }> = [];

    // Add glyph margin checkbox decorations for all changed lines
    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (!isChangedLine(line.origin)) continue;
        const lineNo = line.newLineno ?? line.oldLineno;
        if (lineNo === null) continue;

        const isSelected = lineSelection.selectedLines.has(lineNo);
        decorations.push({
          range: {
            startLineNumber: lineNo,
            startColumn: 1,
            endLineNumber: lineNo,
            endColumn: 1,
          },
          options: {
            isWholeLine: true,
            className: isSelected ? "line-selected-for-staging" : undefined,
            glyphMarginClassName: isSelected
              ? "line-stage-checkbox-checked"
              : "line-stage-checkbox",
            glyphMarginHoverMessage: {
              value: isSelected
                ? "Click to deselect line"
                : "Click to select line for staging (Shift+click for range)",
            },
          },
        });
      }
    }

    if (lineDecorationRef.current) {
      lineDecorationRef.current.set(decorations);
    } else {
      lineDecorationRef.current =
        modifiedEditor.createDecorationsCollection(decorations);
    }
  }, [hunks, lineSelection]);

  // Update ViewZones/decorations when hunks, staged status, or line selection changes
  useEffect(() => {
    updateViewZonesAndDecorations();
  }, [updateViewZonesAndDecorations]);

  // Update line decorations when selection changes
  useEffect(() => {
    updateLineDecorations();
  }, [updateLineDecorations]);

  // Update button disabled states when operation pending changes
  useEffect(() => {
    isOperationPendingRef.current = isOperationPending;
  }, [isOperationPending]);

  // Handle glyph margin clicks (both hunk and line)
  useEffect(() => {
    const diffEditor = editorRef.current;
    if (!diffEditor) return;

    const modifiedEditor = diffEditor.getModifiedEditor();
    const disposable = modifiedEditor.onMouseDown((e) => {
      // Monaco mouse target type 3 = GUTTER_GLYPH_MARGIN
      if (e.target.type !== 3) return;

      const lineNumber = e.target.position?.lineNumber;
      if (!lineNumber || isOperationPendingRef.current) return;

      const ls = lineSelectionRef.current;
      const currentHunks = hunksRef.current;

      // Check if this line is a changed line (has a line-stage-checkbox)
      const isLineSelectable = currentHunks.some((hunk) =>
        hunk.lines.some(
          (line) =>
            isChangedLine(line.origin) &&
            (line.newLineno === lineNumber || line.oldLineno === lineNumber),
        ),
      );

      if (isLineSelectable && ls) {
        if (e.event.shiftKey) {
          ls.selectRange(lineNumber);
        } else {
          ls.toggleLine(lineNumber);
        }
        return;
      }

      // Fall back to hunk toggle for hunk header lines
      const hunkIndex = findHunkForLine(currentHunks, lineNumber);
      if (hunkIndex >= 0) {
        onToggleHunkRef.current(hunkIndex);
        if (announcementRef.current) {
          announcementRef.current.textContent = `${stagedRef.current ? "Unstaged" : "Staged"} hunk ${hunkIndex + 1}`;
        }
      }
    });

    return () => disposable.dispose();
  }, [hunks]);

  // Register keyboard actions on the modified editor
  useEffect(() => {
    const diffEditor = editorRef.current;
    if (!diffEditor) return;

    const modifiedEditor = diffEditor.getModifiedEditor();
    const disposables: Array<{ dispose(): void }> = [];

    // ] key: next hunk
    disposables.push(
      modifiedEditor.addAction({
        id: "staging.nextHunk",
        label: "Go to Next Hunk",
        keybindings: [
          // Monaco KeyCode for ']' = 94 (US_CLOSE_SQUARE_BRACKET)
          94,
        ],
        run: () => {
          const currentHunks = hunksRef.current;
          if (currentHunks.length === 0) return;
          const cursorLine = modifiedEditor.getPosition()?.lineNumber ?? 0;
          const nextHunk = currentHunks.find((h) => h.newStart > cursorLine);
          const target = nextHunk ?? currentHunks[0];
          modifiedEditor.revealLineInCenter(target.newStart);
          modifiedEditor.setPosition({
            lineNumber: target.newStart,
            column: 1,
          });
        },
      }),
    );

    // [ key: previous hunk
    disposables.push(
      modifiedEditor.addAction({
        id: "staging.prevHunk",
        label: "Go to Previous Hunk",
        keybindings: [
          // Monaco KeyCode for '[' = 92 (US_OPEN_SQUARE_BRACKET)
          92,
        ],
        run: () => {
          const currentHunks = hunksRef.current;
          if (currentHunks.length === 0) return;
          const cursorLine = modifiedEditor.getPosition()?.lineNumber ?? 0;
          const prevHunks = currentHunks.filter(
            (h) => h.newStart < cursorLine,
          );
          const target =
            prevHunks.length > 0
              ? prevHunks[prevHunks.length - 1]
              : currentHunks[currentHunks.length - 1];
          modifiedEditor.revealLineInCenter(target.newStart);
          modifiedEditor.setPosition({
            lineNumber: target.newStart,
            column: 1,
          });
        },
      }),
    );

    // Ctrl+Shift+S / Cmd+Shift+S: stage selected lines or hunk at cursor
    disposables.push(
      modifiedEditor.addAction({
        id: "staging.stageSelection",
        label: "Stage Selected Lines",
        keybindings: [
          // KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyS = 2048 | 1024 | 49
          2048 | 1024 | 49,
        ],
        run: () => {
          const ls = lineSelectionRef.current;
          if (ls && ls.hasSelection) {
            ls.stageSelectedLines();
          } else {
            // Stage hunk at cursor
            const cursorLine =
              modifiedEditor.getPosition()?.lineNumber ?? 0;
            const hunkIndex = findHunkForLine(hunksRef.current, cursorLine);
            if (hunkIndex >= 0) {
              onToggleHunkRef.current(hunkIndex);
            }
          }
        },
      }),
    );

    // Ctrl+Shift+U / Cmd+Shift+U: unstage selected lines or hunk at cursor
    disposables.push(
      modifiedEditor.addAction({
        id: "staging.unstageSelection",
        label: "Unstage Selected Lines",
        keybindings: [
          // KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyU = 2048 | 1024 | 55
          2048 | 1024 | 55,
        ],
        run: () => {
          const ls = lineSelectionRef.current;
          if (ls && ls.hasSelection) {
            ls.stageSelectedLines();
          } else {
            const cursorLine =
              modifiedEditor.getPosition()?.lineNumber ?? 0;
            const hunkIndex = findHunkForLine(hunksRef.current, cursorLine);
            if (hunkIndex >= 0) {
              onToggleHunkRef.current(hunkIndex);
            }
          }
        },
      }),
    );

    // Escape: clear line selection
    disposables.push(
      modifiedEditor.addAction({
        id: "staging.clearSelection",
        label: "Clear Line Selection",
        keybindings: [
          // KeyCode.Escape = 9
          9,
        ],
        precondition: undefined,
        run: () => {
          const ls = lineSelectionRef.current;
          if (ls && ls.hasSelection) {
            ls.clearSelection();
          }
        },
      }),
    );

    return () => {
      for (const d of disposables) d.dispose();
    };
  }, []);

  const handleMount: DiffOnMount = (editor) => {
    editorRef.current = editor;
    updateViewZonesAndDecorations();
    updateLineDecorations();
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
      hunkDecorationRef.current = null;
      lineDecorationRef.current = null;
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
