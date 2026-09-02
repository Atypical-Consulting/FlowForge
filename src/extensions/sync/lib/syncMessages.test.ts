import { describe, expect, it } from "vitest";
import type { SyncResult } from "../../../bindings";
import {
  describeSyncResult,
  formatFetchSuccess,
  formatPullSuccess,
  formatPushSuccess,
  formatSyncError,
  formatSyncException,
  formatSyncFailure,
} from "./syncMessages";

function result(overrides: Partial<SyncResult> = {}): SyncResult {
  return {
    success: true,
    message: "",
    commitsTransferred: 0,
    remote: "origin",
    branch: "feature/payments",
    updatedRefs: 0,
    upToDate: false,
    upstreamSet: false,
    ...overrides,
  };
}

describe("formatPushSuccess", () => {
  it("names the branch and remote from the result, not UI state", () => {
    expect(formatPushSuccess(result({ commitsTransferred: 3 }))).toBe(
      "Pushed feature/payments to origin (3 commits)",
    );
  });

  it("uses singular for one commit", () => {
    expect(formatPushSuccess(result({ commitsTransferred: 1 }))).toBe(
      "Pushed feature/payments to origin (1 commit)",
    );
  });

  it("omits the count when the backend could not determine it", () => {
    expect(formatPushSuccess(result())).toBe(
      "Pushed feature/payments to origin",
    );
  });

  it("mentions the upstream on a first push", () => {
    expect(
      formatPushSuccess(result({ commitsTransferred: 2, upstreamSet: true })),
    ).toBe(
      "Pushed feature/payments to origin (2 commits) — upstream set to origin/feature/payments",
    );
  });

  it("reports when nothing was sent", () => {
    expect(formatPushSuccess(result({ upToDate: true }))).toBe(
      "Nothing to push — feature/payments is up to date with origin/feature/payments",
    );
  });

  it("falls back to the remote when no branch is reported", () => {
    expect(formatPushSuccess(result({ branch: null }))).toBe(
      "Pushed to origin",
    );
  });
});

describe("formatPullSuccess", () => {
  it("counts pulled commits into the branch", () => {
    expect(
      formatPullSuccess(result({ branch: "main", commitsTransferred: 4 })),
    ).toBe("Pulled 4 commits into main");
  });

  it("uses singular for one commit", () => {
    expect(
      formatPullSuccess(result({ branch: "main", commitsTransferred: 1 })),
    ).toBe("Pulled 1 commit into main");
  });

  it("reports already up to date with the tracking branch", () => {
    expect(formatPullSuccess(result({ branch: "main", upToDate: true }))).toBe(
      "Already up to date — main matches origin/main",
    );
  });

  it("flags a staged non-fast-forward merge", () => {
    expect(
      formatPullSuccess(
        result({
          branch: "main",
          commitsTransferred: 2,
          message: "Merged successfully. Please review and commit the merge.",
        }),
      ),
    ).toBe("Pulled 2 commits into main — merge staged, review and commit it");
  });
});

describe("formatFetchSuccess", () => {
  it("reports new commits and updated branches", () => {
    expect(
      formatFetchSuccess(
        result({ branch: null, commitsTransferred: 5, updatedRefs: 2 }),
      ),
    ).toBe("Fetched origin: 5 new commits, 2 updated branches");
  });

  it("uses singular forms", () => {
    expect(
      formatFetchSuccess(
        result({ branch: null, commitsTransferred: 1, updatedRefs: 1 }),
      ),
    ).toBe("Fetched origin: 1 new commit, 1 updated branch");
  });

  it("reports already up to date", () => {
    expect(formatFetchSuccess(result({ branch: null, upToDate: true }))).toBe(
      "Fetched origin — already up to date",
    );
  });

  it("uses the remote the backend actually fetched", () => {
    expect(
      formatFetchSuccess(result({ remote: "upstream", upToDate: true })),
    ).toBe("Fetched upstream — already up to date");
  });
});

describe("formatSyncError", () => {
  it("explains push rejections and what to do", () => {
    expect(
      formatSyncError(
        "push",
        {
          type: "PushRejected",
          message: "origin/main has 2 commits not present on main",
        },
        "origin",
      ),
    ).toBe(
      "Push rejected: origin/main has 2 commits not present on main — pull first, then push again",
    );
  });

  it("points at credentials on auth failures", () => {
    expect(
      formatSyncError(
        "push",
        { type: "AuthenticationFailed", message: "no auth sock" },
        "origin",
      ),
    ).toBe(
      "Push failed: authentication to origin failed (no auth sock) — check your credentials or SSH key",
    );
  });

  it("names the remote on network errors", () => {
    expect(
      formatSyncError(
        "fetch",
        { type: "NetworkError", message: "could not resolve host" },
        "origin",
      ),
    ).toBe("Fetch failed: could not reach origin — could not resolve host");
  });

  it("reports a missing remote", () => {
    expect(
      formatSyncError(
        "pull",
        { type: "RemoteNotFound", message: "upstream" },
        "upstream",
      ),
    ).toBe('Pull failed: remote "upstream" is not configured');
  });

  it("explains a pull with no tracking branch", () => {
    expect(
      formatSyncError(
        "pull",
        {
          type: "OperationFailed",
          message: "No tracking branch found for origin/feature/payments",
        },
        "origin",
      ),
    ).toBe(
      "Pull failed: origin/feature/payments does not exist on the remote — push the branch first",
    );
  });

  it("falls back to the generic message for other errors", () => {
    expect(formatSyncError("push", { type: "EmptyRepository" }, "origin")).toBe(
      "Push failed: The repository has no commits yet",
    );
  });
});

describe("formatSyncFailure / formatSyncException", () => {
  it("surfaces the backend failure message", () => {
    expect(
      formatSyncFailure(
        "pull",
        result({ success: false, message: "Merge conflicts detected." }),
      ),
    ).toBe("Pull failed: Merge conflicts detected.");
  });

  it("uses the Error message for thrown errors", () => {
    expect(formatSyncException("push", new Error("ipc down"))).toBe(
      "Push failed: ipc down",
    );
    expect(formatSyncException("fetch", "boom")).toBe("Fetch failed: boom");
  });
});

describe("describeSyncResult", () => {
  it("maps ok results to a success outcome", () => {
    expect(
      describeSyncResult(
        "push",
        { status: "ok", data: result({ commitsTransferred: 1 }) },
        "origin",
      ),
    ).toEqual({
      ok: true,
      message: "Pushed feature/payments to origin (1 commit)",
    });
  });

  it("maps success:false results to a failure outcome", () => {
    expect(
      describeSyncResult(
        "pull",
        { status: "ok", data: result({ success: false, message: "nope" }) },
        "origin",
      ),
    ).toEqual({ ok: false, message: "Pull failed: nope" });
  });

  it("maps typed errors to an actionable failure outcome", () => {
    expect(
      describeSyncResult(
        "push",
        { status: "error", error: { type: "PushRejected", message: "x" } },
        "origin",
      ),
    ).toEqual({
      ok: false,
      message: "Push rejected: x — pull first, then push again",
    });
  });
});
