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

  it("stringifies numeric messages", () => {
    const error = {
      type: "StashNotFound",
      message: 3,
    } as unknown as GitError;

    expect(getErrorMessage(error)).toBe("3");
  });

  it("falls back to the type when no data or message is present", () => {
    const error = { type: "Unknown" } as unknown as GitError;

    expect(getErrorMessage(error)).toBe("Unknown");
  });
});
