import { parseConventionalMessage } from "../../extensions/conventional-commits/lib/conventional-utils";

export function parseConventionalType(message: string): string | null {
  const parsed = parseConventionalMessage(message);
  return parsed ? parsed.commitType : null;
}
