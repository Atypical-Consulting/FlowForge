import type { editor } from "monaco-editor";

/** Which single-sided change a whole-file view represents. */
export type WholeFileDiffKind = "added" | "deleted";

/**
 * Decoration options mirroring the ones Monaco's own DiffEditor registers
 * (`diffLineAddDecorationBackgroundWithIndicator` and its delete twin), so a
 * plain editor renders exactly like a fully added/removed change: the line
 * background, the tinted line-number gutter and the +/- sign in the
 * line-decorations column all come from the shared diff theme colors.
 */
const WHOLE_FILE_DECORATION_OPTIONS: Record<
  WholeFileDiffKind,
  editor.IModelDecorationOptions
> = {
  added: {
    isWholeLine: true,
    className: "line-insert",
    marginClassName: "gutter-insert",
    linesDecorationsClassName: "insert-sign codicon codicon-diff-insert",
  },
  deleted: {
    isWholeLine: true,
    className: "line-delete",
    marginClassName: "gutter-delete",
    linesDecorationsClassName: "delete-sign codicon codicon-diff-remove",
  },
};

/**
 * Build the decorations that mark every line of a document as added or
 * removed. A single whole-line decoration spanning lines 1..lineCount is
 * enough: Monaco applies whole-line, margin and lines-decorations classes to
 * each line covered by the range.
 */
export function buildWholeFileDecorations(
  lineCount: number,
  kind: WholeFileDiffKind,
): editor.IModelDeltaDecoration[] {
  if (lineCount <= 0) return [];
  return [
    {
      range: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: lineCount,
        endColumn: 1,
      },
      options: WHOLE_FILE_DECORATION_OPTIONS[kind],
    },
  ];
}
