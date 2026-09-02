/**
 * Prepare raw file contents for Monaco's DiffEditor.
 *
 * Monaco models count lines by newline separators, so a file whose content is
 * `"tmp\n"` becomes two lines (`"tmp"` and an empty trailing line) while git
 * counts it as a single line. Combined with the fact that an empty string is a
 * one-line (empty) document for Monaco, this produced two phantom rows for a
 * new file: a removed empty line on the original side and an added empty line
 * at the end of the modified side. Modified files ending with a newline showed
 * an extra empty context row after the last real line.
 *
 * Two things are done here:
 *
 * 1. Exactly one trailing newline is stripped from each side so Monaco's line
 *    count matches git's. This is only done when both sides agree on their
 *    end-of-file newline state; when they differ (one side is missing the
 *    trailing newline, i.e. git's "\ No newline at end of file"), both sides
 *    are left untouched so the difference stays visible in the editor. An
 *    empty document has no end-of-file newline state and never blocks
 *    stripping.
 *
 * 2. The diff is classified as `added`, `deleted` or `modified`. A Monaco
 *    model can never have zero lines, so an empty original is a single empty
 *    line and `DefaultLinesDiffComputer` reports it as "delete line 1 + insert
 *    everything": a phantom removed row. No diff option avoids this, so
 *    consumers must render added/deleted files as a single-sided view (see
 *    `WholeFileDiffEditor`) instead of a two-sided DiffEditor. The kind is
 *    derived from the raw inputs: a zero-byte side is an absent file, while a
 *    side containing `"\n"` is a real one-line document.
 */

/** Whether a file exists on both sides of the diff or only on one. */
export type DiffContentKind = "added" | "deleted" | "modified";

export interface PreparedDiffContent {
  original: string;
  modified: string;
  kind: DiffContentKind;
}

const TRAILING_NEWLINE = /\r?\n$/;

/** True when `text` ends with a line terminator (`\n` or `\r\n`). */
export function hasTrailingNewline(text: string): boolean {
  return TRAILING_NEWLINE.test(text);
}

/** Remove exactly one trailing line terminator, if present. */
export function stripTrailingNewline(text: string): string {
  return text.replace(TRAILING_NEWLINE, "");
}

/**
 * Classify a diff from its raw contents: an empty (zero-byte) side means the
 * file does not exist on that side. Two empty sides are treated as
 * `modified` (there is nothing single-sided to show).
 */
export function classifyDiffContent(
  oldContent: string,
  newContent: string,
): DiffContentKind {
  const oldIsEmpty = oldContent.length === 0;
  const newIsEmpty = newContent.length === 0;
  if (oldIsEmpty && !newIsEmpty) return "added";
  if (newIsEmpty && !oldIsEmpty) return "deleted";
  return "modified";
}

/**
 * Normalize the original/modified texts of a diff for Monaco.
 *
 * @param oldContent Raw content of the original side (empty for new files).
 * @param newContent Raw content of the modified side (empty for deleted files).
 */
export function prepareDiffContent(
  oldContent: string,
  newContent: string,
): PreparedDiffContent {
  const kind = classifyDiffContent(oldContent, newContent);
  const oldIsEmpty = oldContent.length === 0;
  const newIsEmpty = newContent.length === 0;
  const eofNewlineAgrees =
    oldIsEmpty ||
    newIsEmpty ||
    hasTrailingNewline(oldContent) === hasTrailingNewline(newContent);

  if (!eofNewlineAgrees) {
    return { original: oldContent, modified: newContent, kind };
  }

  return {
    original: stripTrailingNewline(oldContent),
    modified: stripTrailingNewline(newContent),
    kind,
  };
}
