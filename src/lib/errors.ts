import type { GitError } from "../bindings";

/**
 * Extract a human-readable error message from a GitError.
 */
export function getErrorMessage(error: GitError): string {
  if ("message" in error) {
    // Some errors have numeric messages (like StashNotFound index)
    return String(error.message);
  }
  // Errors without message field use their type as the message
  return error.type;
}
