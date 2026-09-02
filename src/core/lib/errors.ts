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
    // Several GitError variants carry only the offending identifier (branch,
    // tag, remote, path, index...) in `message`; wrap it in a sentence so the
    // UI never shows a bare name such as "main" as the whole error.
    switch (error.type) {
      case "InvalidBranchName":
        return `'${error.message}' is not a valid branch name`;
      case "BranchAlreadyExists":
        return `A branch named '${error.message}' already exists`;
      case "BranchNotFound":
        return `Branch '${error.message}' not found`;
      case "BranchNotMerged":
        return `Branch '${error.message}' is not fully merged`;
      case "TagAlreadyExists":
        return `A tag named '${error.message}' already exists`;
      case "TagNotFound":
        return `Tag '${error.message}' not found`;
      case "RemoteNotFound":
        return `Remote '${error.message}' not found`;
      case "StashNotFound":
        return `Stash at index ${error.message} not found`;
      case "HunkIndexOutOfRange":
        return `Hunk index ${error.message} is out of range`;
      case "FileNotConflicted":
        return `'${error.message}' has no merge conflicts`;
      case "NotARepository":
        return `'${error.message}' is not a Git repository`;
      case "PathNotFound":
        return `Path '${error.message}' does not exist`;
      case "PathExists":
        return `Path '${error.message}' already exists`;
      case "InvalidUrl":
        return `'${error.message}' is not a valid URL`;
      case "InvalidPath":
        return `'${error.message}' is not a valid path`;
      default:
        // The remaining variants already carry a full sentence (or a number).
        return String(error.message);
    }
  }

  // Variants without a payload: spell out what went wrong instead of echoing
  // the enum name.
  switch (error.type) {
    case "EmptyRepository":
      return "The repository has no commits yet";
    case "NoStagedChanges":
      return "There are no staged changes to commit";
    case "CannotDeleteCurrentBranch":
      return "The currently checked-out branch cannot be deleted";
    case "DirtyWorkingDirectory":
      return "You have uncommitted changes; commit or stash them first";
    case "NothingToStash":
      return "There are no local changes to stash";
    case "NoMergeInProgress":
      return "There is no merge in progress";
    case "BinaryPartialStaging":
      return "Binary files cannot be partially staged";
    default:
      return error.type;
  }
}
