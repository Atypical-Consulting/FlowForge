import type { GitError, GitflowError } from "@/bindings";
import { getErrorMessage } from "@/core/lib/errors";

describe("getErrorMessage", () => {
  it("formats GitflowError variants with string data without throwing", () => {
    const error = {
      type: "ReleaseInProgress",
      data: "release/0.9",
    } as unknown as GitflowError;

    expect(getErrorMessage(error)).toBe("ReleaseInProgress: release/0.9");
  });

  it("formats other string-data GitflowError variants", () => {
    const error = {
      type: "BranchNotFound",
      data: "feature/foo",
    } as unknown as GitflowError;

    expect(getErrorMessage(error)).toBe("BranchNotFound: feature/foo");
  });

  it("formats object data with expected/actual fields", () => {
    const error = {
      type: "InvalidContext",
      data: { expected: "main", actual: "develop" },
    } as unknown as GitflowError;

    expect(getErrorMessage(error)).toBe("Expected main, got develop");
  });

  it("turns a refused checkout into an actionable sentence listing the files", () => {
    const error: GitError = {
      type: "CheckoutWouldOverwrite",
      message: "README.md, src/index.ts",
    };

    expect(getErrorMessage(error)).toBe(
      "You have local changes to README.md, src/index.ts that would be overwritten by checkout; commit or stash them first.",
    );
  });

  it("uses the message field for GitError variants", () => {
    const error = {
      type: "GitOperationFailed",
      message: "failed to push",
    } as unknown as GitError;

    expect(getErrorMessage(error)).toBe("failed to push");
  });

  it("stringifies numeric messages of unknown variants", () => {
    const error = {
      type: "SomeNumericError",
      message: 3,
    } as unknown as GitError;

    expect(getErrorMessage(error)).toBe("3");
  });

  it("falls back to the type when no data or message is present", () => {
    const error = { type: "Unknown" } as unknown as GitError;

    expect(getErrorMessage(error)).toBe("Unknown");
  });

  describe("GitError variants whose message is a bare identifier", () => {
    it.each<[GitError, string]>([
      [
        { type: "InvalidBranchName", message: "bad name..with spaces" },
        "'bad name..with spaces' is not a valid branch name",
      ],
      [
        { type: "BranchAlreadyExists", message: "main" },
        "A branch named 'main' already exists",
      ],
      [
        { type: "BranchNotFound", message: "feature/x" },
        "Branch 'feature/x' not found",
      ],
      [
        { type: "BranchNotMerged", message: "feature/x" },
        "Branch 'feature/x' is not fully merged",
      ],
      [
        { type: "TagAlreadyExists", message: "v1.0.0" },
        "A tag named 'v1.0.0' already exists",
      ],
      [{ type: "TagNotFound", message: "v1.0.0" }, "Tag 'v1.0.0' not found"],
      [
        { type: "RemoteNotFound", message: "upstream" },
        "Remote 'upstream' not found",
      ],
      [{ type: "StashNotFound", message: 3 }, "Stash at index 3 not found"],
      [
        { type: "HunkIndexOutOfRange", message: 7 },
        "Hunk index 7 is out of range",
      ],
      [
        { type: "FileNotConflicted", message: "src/a.ts" },
        "'src/a.ts' has no merge conflicts",
      ],
      [
        { type: "NotARepository", message: "/tmp/x" },
        "'/tmp/x' is not a Git repository",
      ],
      [
        { type: "PathNotFound", message: "/tmp/x" },
        "Path '/tmp/x' does not exist",
      ],
      [
        { type: "PathExists", message: "/tmp/x" },
        "Path '/tmp/x' already exists",
      ],
      [{ type: "InvalidUrl", message: "nope" }, "'nope' is not a valid URL"],
      [{ type: "InvalidPath", message: "nope" }, "'nope' is not a valid path"],
    ])("formats %o as a sentence", (error, expected) => {
      expect(getErrorMessage(error)).toBe(expected);
    });

    it("keeps full-sentence messages untouched", () => {
      const error: GitError = {
        type: "OperationFailed",
        message: "Git operation failed: reference already exists",
      };
      expect(getErrorMessage(error)).toBe(
        "Git operation failed: reference already exists",
      );
    });
  });

  describe("GitError variants without a payload", () => {
    it.each<[GitError, string]>([
      [{ type: "EmptyRepository" }, "The repository has no commits yet"],
      [{ type: "NoStagedChanges" }, "There are no staged changes to commit"],
      [
        { type: "CannotDeleteCurrentBranch" },
        "The currently checked-out branch cannot be deleted",
      ],
      [
        { type: "DirtyWorkingDirectory" },
        "You have uncommitted changes; commit or stash them first",
      ],
      [{ type: "NothingToStash" }, "There are no local changes to stash"],
      [{ type: "NoMergeInProgress" }, "There is no merge in progress"],
      [
        { type: "BinaryPartialStaging" },
        "Binary files cannot be partially staged",
      ],
    ])("formats %o as a sentence", (error, expected) => {
      expect(getErrorMessage(error)).toBe(expected);
    });
  });
});
