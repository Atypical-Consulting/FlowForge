import type { ConflictHunk } from "../types";

/**
 * Parse git conflict markers from file content into structured hunks.
 *
 * Scans for standard `<<<<<<<`, `=======`, `>>>>>>>` markers and extracts
 * the ours/theirs content for each conflict region.
 */
export function parseConflictMarkers(content: string): ConflictHunk[] {
  // Normalize CRLF to LF
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const hunks: ConflictHunk[] = [];

  let i = 0;
  let hunkIndex = 0;

  while (i < lines.length) {
    // Look for conflict start marker
    if (lines[i].startsWith("<<<<<<<")) {
      const startLine = i + 1; // 1-indexed
      const oursLines: string[] = [];
      const theirsLines: string[] = [];

      i++; // Skip the <<<<<<< line

      // Collect "ours" content until =======
      while (i < lines.length && !lines[i].startsWith("=======")) {
        oursLines.push(lines[i]);
        i++;
      }

      if (i >= lines.length) break; // Malformed: no separator found

      i++; // Skip the ======= line

      // Collect "theirs" content until >>>>>>>
      while (i < lines.length && !lines[i].startsWith(">>>>>>>")) {
        theirsLines.push(lines[i]);
        i++;
      }

      const endLine = i + 1; // 1-indexed, inclusive of >>>>>>> line

      hunks.push({
        id: `hunk-${hunkIndex}`,
        startLine,
        endLine,
        oursContent: oursLines.join("\n"),
        theirsContent: theirsLines.join("\n"),
        resolution: null,
      });

      hunkIndex++;
      i++; // Skip the >>>>>>> line
    } else {
      i++;
    }
  }

  return hunks;
}

/**
 * Build resolved file content by replacing conflict marker regions
 * with the chosen resolution for each hunk.
 *
 * @param originalContent - The file content with conflict markers
 * @param hunks - The parsed hunks with resolution choices
 * @returns The resolved file content
 */
export function buildResolvedContent(
  originalContent: string,
  hunks: ConflictHunk[],
): string {
  const normalized = originalContent.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const result: string[] = [];

  let i = 0;
  let hunkIndex = 0;

  while (i < lines.length) {
    if (lines[i].startsWith("<<<<<<<") && hunkIndex < hunks.length) {
      const hunk = hunks[hunkIndex];

      if (hunk.resolution === null) {
        // Unresolved: leave original markers in place
        while (i < lines.length && !lines[i].startsWith(">>>>>>>")) {
          result.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          result.push(lines[i]); // Include >>>>>>> line
          i++;
        }
      } else {
        // Resolved: skip the marker region and insert resolved content
        // Skip past the >>>>>>> line
        while (i < lines.length && !lines[i].startsWith(">>>>>>>")) {
          i++;
        }
        if (i < lines.length) i++; // Skip >>>>>>> line

        // Insert resolved content based on choice
        switch (hunk.resolution) {
          case "ours":
            if (hunk.oursContent) result.push(hunk.oursContent);
            break;
          case "theirs":
            if (hunk.theirsContent) result.push(hunk.theirsContent);
            break;
          case "both":
            if (hunk.oursContent) result.push(hunk.oursContent);
            if (hunk.theirsContent) result.push(hunk.theirsContent);
            break;
          case "custom":
            // Custom edits are handled via resultContent directly
            // Leave empty — the caller uses resultContent instead
            break;
        }
      }

      hunkIndex++;
    } else {
      result.push(lines[i]);
      i++;
    }
  }

  return result.join("\n");
}
