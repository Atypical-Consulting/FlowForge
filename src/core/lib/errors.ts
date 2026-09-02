import type { GitError, GitflowError } from "../../bindings";

/**
 * Extract a human-readable error message from a GitError or GitflowError.
 */
export function getErrorMessage(error: GitError | GitflowError): string {
  // Gitflow safety errors: give the user an actionable sentence rather than
  // the raw variant name.
  if (error.type === "CheckoutWouldOverwriteChanges") {
    return `You have uncommitted changes that would be overwritten by switching to '${error.data}'. Commit or stash them first.`;
  }
  if (error.type === "DirtyWorkingTree") {
    return "You have uncommitted changes. Commit or stash them before running this Gitflow operation.";
  }
  // Branch checkout refused because it would clobber local edits to the
  // listed files. Nothing was modified.
  if (error.type === "CheckoutWouldOverwrite") {
    return `You have local changes to ${error.message} that would be overwritten by checkout; commit or stash them first.`;
  }

  // Handle GitflowError types
  if ("data" in error) {
    // For errors with string data (e.g., ReleaseInProgress, BranchNotFound).
    // Check this before using the `in` operator below, which throws a
    // TypeError when applied to a string primitive.
    if (typeof error.data === "string") {
      return `${error.type}: ${error.data}`;
    }
    if (
      error.data &&
      typeof error.data === "object" &&
      "expected" in error.data &&
      "actual" in error.data
    ) {
      const data = error.data as Record<string, unknown>;
      return `Expected ${data.expected}, got ${data.actual}`;
    }
  }

  if ("message" in error) {
    // Some errors have numeric messages (like StashNotFound index)
    return String(error.message);
  }

  // Errors without message field use their type as the message
  return error.type;
}
