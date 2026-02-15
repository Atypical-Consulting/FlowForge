import type { Command } from "./commandRegistry";

export interface ScoredCommand {
  command: Command;
  score: number;
  matchedRanges: [number, number][];
}

export function searchCommands(
  query: string,
  commands: Command[],
): ScoredCommand[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return commands.map((command) => ({ command, score: 0, matchedRanges: [] }));
  }

  const q = trimmed.toLowerCase();
  const results: ScoredCommand[] = [];

  for (const command of commands) {
    const title = command.title.toLowerCase();
    const description = command.description?.toLowerCase() ?? "";

    // Exact title match
    if (title === q) {
      results.push({
        command,
        score: 100,
        matchedRanges: [[0, command.title.length]],
      });
      continue;
    }

    // Title starts-with
    if (title.startsWith(q)) {
      results.push({
        command,
        score: 80,
        matchedRanges: [[0, trimmed.length]],
      });
      continue;
    }

    // Title contains (substring)
    const substringIndex = title.indexOf(q);
    if (substringIndex >= 0) {
      results.push({
        command,
        score: 60,
        matchedRanges: [[substringIndex, substringIndex + trimmed.length]],
      });
      continue;
    }

    // Description contains
    if (description.includes(q)) {
      results.push({ command, score: 40, matchedRanges: [] });
      continue;
    }

    // Keywords match
    if (
      command.keywords?.some((kw) => kw.toLowerCase().includes(q))
    ) {
      results.push({ command, score: 35, matchedRanges: [] });
      continue;
    }

    // Fuzzy subsequence in title
    const ranges = fuzzyMatch(q, command.title);
    if (ranges) {
      results.push({ command, score: 20, matchedRanges: ranges });
      continue;
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

export function fuzzyMatch(
  query: string,
  text: string,
): [number, number][] | null {
  const lowerText = text.toLowerCase();
  const ranges: [number, number][] = [];
  let qi = 0;
  let rangeStart = -1;

  for (let ti = 0; ti < lowerText.length && qi < query.length; ti++) {
    if (lowerText[ti] === query[qi]) {
      if (rangeStart === -1) {
        rangeStart = ti;
      }
      qi++;
    } else if (rangeStart !== -1) {
      ranges.push([rangeStart, ti]);
      rangeStart = -1;
    }
  }

  if (qi < query.length) return null;

  // Close any open range
  if (rangeStart !== -1) {
    ranges.push([rangeStart, rangeStart + (qi - ranges.reduce((sum, r) => sum + (r[1] - r[0]), 0))]);
  }

  return ranges;
}

export function highlightMatches(
  text: string,
  ranges: [number, number][],
): { text: string; highlighted: boolean }[] {
  if (ranges.length === 0) {
    return [{ text, highlighted: false }];
  }

  const segments: { text: string; highlighted: boolean }[] = [];
  let cursor = 0;

  for (const [start, end] of ranges) {
    if (cursor < start) {
      segments.push({ text: text.slice(cursor, start), highlighted: false });
    }
    segments.push({ text: text.slice(start, end), highlighted: true });
    cursor = end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlighted: false });
  }

  return segments;
}
