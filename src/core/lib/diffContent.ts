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
 * The fix is to strip exactly one trailing newline from each side so Monaco's
 * line count matches git's. This is only done when both sides agree on their
 * end-of-file newline state; when they differ (one side is missing the
 * trailing newline, i.e. git's "\ No newline at end of file"), both sides are
 * left untouched so the difference stays visible in the editor. An empty
 * document has no end-of-file newline state and never blocks stripping.
 */

export interface PreparedDiffContent {
  original: string;
  modified: string;
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
 * Normalize the original/modified texts of a diff for Monaco.
 *
 * @param oldContent Raw content of the original side (empty for new files).
 * @param newContent Raw content of the modified side (empty for deleted files).
 */
export function prepareDiffContent(
  oldContent: string,
  newContent: string,
): PreparedDiffContent {
  const oldIsEmpty = oldContent.length === 0;
  const newIsEmpty = newContent.length === 0;
  const eofNewlineAgrees =
    oldIsEmpty ||
    newIsEmpty ||
    hasTrailingNewline(oldContent) === hasTrailingNewline(newContent);

  if (!eofNewlineAgrees) {
    return { original: oldContent, modified: newContent };
  }

  return {
    original: stripTrailingNewline(oldContent),
    modified: stripTrailingNewline(newContent),
  };
}
