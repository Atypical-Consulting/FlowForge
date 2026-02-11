/**
 * Parse a git stash message into structured parts.
 *
 * Git stash messages follow patterns like:
 *   "On main: custom user message"
 *   "WIP on main: abc1234 commit message"
 */
export interface ParsedStashMessage {
  branch: string | null;
  description: string;
}

export function parseStashMessage(message: string): ParsedStashMessage {
  const match = message.match(/^(?:WIP )?[Oo]n\s+(.+?):\s*(.*)$/);

  if (!match) {
    return { branch: null, description: message || "Stashed changes" };
  }

  const branch = match[1];
  let description = match[2].trim();

  // Default WIP messages look like "abc1234 commit msg" — extract after hash
  const wipMatch = description.match(/^[0-9a-f]{7,40}\s+(.+)$/);
  if (wipMatch) {
    description = wipMatch[1];
  }

  if (!description) {
    description = "Stashed changes";
  }

  return { branch, description };
}
