import { describe, expect, it } from "vitest";
import type { GitflowStatus } from "../../bindings";
import { getProtectedBranches } from "./bulkBranchOps";

function makeStatus(
  overrides: Partial<GitflowStatus["context"]> = {},
): GitflowStatus {
  return {
    currentBranch: overrides.currentBranch ?? "feature/x",
    isGitflowReady: true,
    canStartFeature: false,
    canFinishFeature: false,
    canStartRelease: false,
    canFinishRelease: false,
    canStartHotfix: false,
    canFinishHotfix: false,
    canAbort: false,
    activeFlow: null,
    context: {
      state: { type: "Idle" },
      currentBranch: overrides.currentBranch ?? "feature/x",
      hasMain: true,
      hasDevelop: true,
      isInitialized: overrides.isInitialized ?? false,
      ...overrides,
    },
  };
}

describe("getProtectedBranches", () => {
  it("always protects main/master/develop", () => {
    const result = getProtectedBranches(null);
    expect(result.has("main")).toBe(true);
    expect(result.has("master")).toBe(true);
    expect(result.has("develop")).toBe(true);
  });

  it("does not add gitflow extras when status is null", () => {
    const result = getProtectedBranches(null);
    expect(result.has("development")).toBe(false);
    expect(result.has("dev")).toBe(false);
  });

  it("adds development/dev when Gitflow is initialized", () => {
    const result = getProtectedBranches(
      makeStatus({ isInitialized: true, currentBranch: "develop" }),
    );
    expect(result.has("development")).toBe(true);
    expect(result.has("dev")).toBe(true);
  });

  it("does not add development/dev when Gitflow is not initialized", () => {
    const result = getProtectedBranches(makeStatus({ isInitialized: false }));
    expect(result.has("development")).toBe(false);
    expect(result.has("dev")).toBe(false);
  });

  it("protects the current branch so it can never be bulk-deleted", () => {
    const result = getProtectedBranches(
      makeStatus({ currentBranch: "feature/my-work" }),
    );
    expect(result.has("feature/my-work")).toBe(true);
  });

  it("protects a custom current integration branch name", () => {
    // Repo configured (e.g. via git-flow CLI) with a non-standard
    // integration branch. When the user is on it, it must be protected.
    const result = getProtectedBranches(
      makeStatus({ isInitialized: true, currentBranch: "integration" }),
    );
    expect(result.has("integration")).toBe(true);
  });
});
