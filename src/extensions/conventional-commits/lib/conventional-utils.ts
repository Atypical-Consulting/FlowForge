import type { CommitType } from "../../../bindings";

/**
 * Parts of a conventional commit message.
 */
export interface ConventionalMessageParts {
  commitType: CommitType | "";
  scope: string;
  description: string;
  body: string;
  isBreaking: boolean;
  breakingDescription: string;
}

/**
 * Build a conventional commit message from its constituent parts.
 *
 * Returns an empty string if `commitType` or `description` is falsy.
 */
export function buildCommitMessage(parts: ConventionalMessageParts): string {
  const { commitType, scope, description, body, isBreaking, breakingDescription } = parts;

  if (!commitType || !description) {
    return "";
  }

  // Build header: type(scope)!: description
  let header = commitType;
  if (scope) header += `(${scope})`;
  if (isBreaking) header += "!";
  header += `: ${description}`;

  // Build full message
  let message = header;
  if (body) {
    message += `\n\n${body}`;
  }
  if (isBreaking && breakingDescription) {
    message += `\n\nBREAKING CHANGE: ${breakingDescription}`;
  }

  return message;
}

/**
 * Regex for parsing the subject line of a conventional commit.
 */
const CC_SUBJECT_REGEX =
  /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(([^)]+)\))?(!)?\s*:\s*(.+)/;

/**
 * Parse a full commit message string into ConventionalMessageParts.
 *
 * Returns `null` if the message does not match conventional commit format.
 */
export function parseConventionalMessage(
  message: string,
): ConventionalMessageParts | null {
  if (!message) return null;

  const lines = message.split("\n");
  const subjectLine = lines[0];

  const match = subjectLine.match(CC_SUBJECT_REGEX);
  if (!match) return null;

  const commitType = match[1] as CommitType;
  const scope = match[3] || "";
  const bangBreaking = match[4] === "!";
  const description = match[5].trim();

  // Extract body: everything after the first blank line, excluding BREAKING CHANGE footer
  let body = "";
  let breakingDescription = "";
  let isBreaking = bangBreaking;

  // Find the body start (after first blank line)
  let bodyStartIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "") {
      bodyStartIndex = i + 1;
      break;
    }
  }

  if (bodyStartIndex > 0 && bodyStartIndex < lines.length) {
    const remainingLines = lines.slice(bodyStartIndex);
    const bodyLines: string[] = [];

    for (const line of remainingLines) {
      if (line.startsWith("BREAKING CHANGE: ")) {
        isBreaking = true;
        breakingDescription = line.slice("BREAKING CHANGE: ".length).trim();
      } else if (line.startsWith("BREAKING-CHANGE: ")) {
        isBreaking = true;
        breakingDescription = line.slice("BREAKING-CHANGE: ".length).trim();
      } else {
        bodyLines.push(line);
      }
    }

    body = bodyLines.join("\n").trim();
  }

  return {
    commitType,
    scope,
    description,
    body,
    isBreaking,
    breakingDescription,
  };
}
