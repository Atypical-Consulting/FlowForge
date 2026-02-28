import type { DiffHunk, DiffHunkDetail } from "../../../../bindings";

/**
 * Find which hunk a given line number belongs to (in the modified/new editor).
 * Uses newStart and newLines from hunk data.
 * Returns the hunk index, or -1 if no hunk contains the line.
 */
export function findHunkForLine(
  hunks: DiffHunkDetail[] | DiffHunk[],
  lineNumber: number,
): number {
  return hunks.findIndex(
    (h) => lineNumber >= h.newStart && lineNumber < h.newStart + h.newLines,
  );
}

/**
 * Convert a Set of individual line numbers into consolidated contiguous ranges.
 * Adjacent lines are merged into a single range.
 */
export function linesToRanges(
  lines: Set<number>,
): Array<{ start: number; end: number }> {
  const sorted = Array.from(lines).sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const ranges: Array<{ start: number; end: number }> = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push({ start, end });
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push({ start, end });
  return ranges;
}

/**
 * Check if a line is a changed line (addition or deletion) vs context.
 */
export function isChangedLine(origin: string): boolean {
  return origin === "addition" || origin === "deletion";
}
