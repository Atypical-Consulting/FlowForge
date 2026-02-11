import type { GitError, GitflowError } from "../../bindings";

/**
 * Extract a human-readable error message from a GitError or GitflowError.
 */
export function getErrorMessage(error: GitError | GitflowError): string {
  // Handle GitflowError types
  if ("data" in error) {
    const data = error.data as Record<string, unknown>;
    if ("expected" in data && "actual" in data) {
      return `Expected ${data.expected}, got ${data.actual}`;
    }
    // For errors with string data (e.g., ReleaseInProgress, BranchNotFound)
    if (typeof error.data === "string") {
      return `${error.type}: ${error.data}`;
    }
  }

  if ("message" in error) {
    // Some errors have numeric messages (like StashNotFound index)
    return String(error.message);
  }

  // Errors without message field use their type as the message
  return error.type;
}
