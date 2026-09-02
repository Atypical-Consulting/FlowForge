import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Actor, createActor, waitFor } from "xstate";
import { gitHookBus } from "@/core/services/gitHookBus";
import { useConflictStore } from "@/extensions/conflict-resolution/store";
import type { ConflictFile } from "@/extensions/conflict-resolution/types";
import { useToastStore } from "@/framework/stores/toast";
import type { MergeResult, MergeStatus } from "../../../../bindings";
import { commands } from "../../../../bindings";
import { MERGE_IN_PROGRESS_MESSAGE, mergeMachine } from "../mergeMachine";

vi.mock("../../../../bindings", () => ({
  commands: {
    mergeBranch: vi.fn(),
    abortMerge: vi.fn(),
    getMergeStatus: vi.fn(),
    listConflictFiles: vi.fn(),
  },
}));

const mocked = vi.mocked(commands);

function ok<T>(data: T) {
  return { status: "ok" as const, data };
}

function gitError(message: string) {
  return { status: "error" as const, error: { type: "Internal", message } };
}

function mergeResult(overrides: Partial<MergeResult> = {}): MergeResult {
  return {
    success: true,
    analysis: "normal",
    commitOid: "abc123",
    fastForwarded: false,
    hasConflicts: false,
    conflictedFiles: [],
    ...overrides,
  };
}

function conflictedResult(files = ["a.txt"]): MergeResult {
  return mergeResult({
    success: false,
    commitOid: null,
    hasConflicts: true,
    conflictedFiles: files,
  });
}

function status(inProgress: boolean, conflictedFiles: string[] = []) {
  return ok({ inProgress, conflictedFiles } satisfies MergeStatus);
}

function conflictFile(path: string): ConflictFile {
  return {
    path,
    status: "unresolved",
    hunks: [],
    oursFullContent: "",
    theirsFullContent: "",
    baseFullContent: "",
    resultContent: "",
    undoStack: [],
    oursName: "HEAD",
    theirsName: "MERGE_HEAD",
  };
}

function errorToasts() {
  return useToastStore
    .getState()
    .toasts.filter((t) => t.type === "error")
    .map((t) => t.message);
}

type MergeActor = Actor<typeof mergeMachine>;

/** Run a merge of `feature/a` that ends with conflicts. */
async function bringToConflicted(actor: MergeActor): Promise<void> {
  mocked.getMergeStatus.mockResolvedValue(status(false));
  mocked.mergeBranch.mockResolvedValue(ok(conflictedResult()));
  actor.send({ type: "START_MERGE", sourceBranch: "feature/a" });
  await waitFor(actor, (s) => s.matches("conflicted"));
  // From now on the repository really is mid-merge unless a test says
  // otherwise.
  mocked.getMergeStatus.mockResolvedValue(status(true, ["a.txt"]));
}

describe("mergeMachine", () => {
  let actor: MergeActor;

  beforeEach(() => {
    vi.clearAllMocks();
    mocked.getMergeStatus.mockResolvedValue(status(false));
    mocked.mergeBranch.mockResolvedValue(ok(mergeResult()));
    mocked.abortMerge.mockResolvedValue(ok(null));
    actor = createActor(mergeMachine);
    actor.start();
  });

  afterEach(() => {
    actor.stop();
  });

  describe("starting a merge", () => {
    it("verifies the repository, merges and returns to idle with the result", async () => {
      actor.send({ type: "START_MERGE", sourceBranch: "feature/a" });
      expect(actor.getSnapshot().matches("verifying")).toBe(true);

      await waitFor(actor, (s) => s.matches("idle"));

      expect(mocked.getMergeStatus).toHaveBeenCalledTimes(1);
      expect(mocked.mergeBranch).toHaveBeenCalledWith("feature/a");
      expect(actor.getSnapshot().context.sourceBranch).toBe("feature/a");
      expect(actor.getSnapshot().context.mergeResult?.success).toBe(true);
    });

    it("enters conflicted when the merge reports conflicts", async () => {
      await bringToConflicted(actor);

      const { context } = actor.getSnapshot();
      expect(context.conflicts).toEqual(["a.txt"]);
      expect(context.mergeResult?.hasConflicts).toBe(true);
    });

    it("refuses to merge from idle while another merge is in progress", async () => {
      mocked.getMergeStatus.mockResolvedValue(status(true, ["x.txt"]));

      actor.send({ type: "START_MERGE", sourceBranch: "feature/a" });
      await waitFor(actor, (s) => s.matches("idle"));

      expect(mocked.mergeBranch).not.toHaveBeenCalled();
      expect(errorToasts()).toEqual([MERGE_IN_PROGRESS_MESSAGE]);
    });

    it("still merges when the status probe itself fails", async () => {
      mocked.getMergeStatus.mockResolvedValue(gitError("no repo"));

      actor.send({ type: "START_MERGE", sourceBranch: "feature/a" });
      await waitFor(actor, (s) => s.matches("idle"));

      expect(mocked.mergeBranch).toHaveBeenCalledWith("feature/a");
    });

    it("records the merge error", async () => {
      mocked.mergeBranch.mockResolvedValue(gitError("boom"));

      actor.send({ type: "START_MERGE", sourceBranch: "feature/a" });
      await waitFor(actor, (s) => s.matches("error"));

      expect(actor.getSnapshot().context.error).toBe("boom");
    });
  });

  describe("resyncing while conflicted", () => {
    it.each(["merge-abort", "checkout", "commit"] as const)(
      "returns to idle after a %s hook when no merge is in progress any more",
      async (operation) => {
        await bringToConflicted(actor);
        mocked.getMergeStatus.mockResolvedValue(status(false));

        await gitHookBus.emitDid(operation);
        await waitFor(actor, (s) => s.matches("idle"));

        const { context } = actor.getSnapshot();
        expect(context.sourceBranch).toBeNull();
        expect(context.conflicts).toEqual([]);
        expect(context.mergeResult).toBeNull();
      },
    );

    it("stays conflicted and refreshes the conflict list when the merge is still in progress", async () => {
      await bringToConflicted(actor);
      mocked.getMergeStatus.mockResolvedValue(status(true, ["b.txt"]));

      await gitHookBus.emitDid("checkout");
      await waitFor(actor, (s) => s.context.conflicts.includes("b.txt"));

      const { context, value } = actor.getSnapshot();
      expect(value).toBe("conflicted");
      expect(context.conflicts).toEqual(["b.txt"]);
      expect(context.mergeResult?.conflictedFiles).toEqual(["b.txt"]);
    });

    it("returns to idle when the conflict store's file list becomes empty", async () => {
      await bringToConflicted(actor);

      useConflictStore.setState({
        files: new Map([["a.txt", conflictFile("a.txt")]]),
      });
      expect(actor.getSnapshot().value).toBe("conflicted");

      useConflictStore.setState({ files: new Map() });
      await waitFor(actor, (s) => s.matches("idle"));
    });

    it("re-probes the repository on REPOSITORY_CHANGED", async () => {
      await bringToConflicted(actor);
      mocked.getMergeStatus.mockClear();
      mocked.getMergeStatus.mockResolvedValue(status(false));

      actor.send({ type: "REPOSITORY_CHANGED" });
      await waitFor(actor, (s) => s.matches("idle"));

      expect(mocked.getMergeStatus).toHaveBeenCalledTimes(1);
    });

    it("ignores REPOSITORY_CHANGED outside of conflicted", () => {
      actor.send({ type: "REPOSITORY_CHANGED" });

      expect(actor.getSnapshot().value).toBe("idle");
      expect(mocked.getMergeStatus).not.toHaveBeenCalled();
    });

    it("stops listening to the hook bus once resolved", async () => {
      await bringToConflicted(actor);
      mocked.getMergeStatus.mockResolvedValue(status(false));
      await gitHookBus.emitDid("commit");
      await waitFor(actor, (s) => s.matches("idle"));
      mocked.getMergeStatus.mockClear();

      await gitHookBus.emitDid("commit");

      expect(mocked.getMergeStatus).not.toHaveBeenCalled();
    });
  });

  describe("START_MERGE from conflicted", () => {
    it("starts a new merge when the previous one is no longer in progress", async () => {
      await bringToConflicted(actor);
      mocked.getMergeStatus.mockResolvedValue(status(false));
      mocked.mergeBranch.mockResolvedValue(ok(mergeResult()));

      actor.send({ type: "START_MERGE", sourceBranch: "feature/b" });
      await waitFor(actor, (s) => s.matches("idle"));

      expect(mocked.mergeBranch).toHaveBeenLastCalledWith("feature/b");
      const { context } = actor.getSnapshot();
      expect(context.sourceBranch).toBe("feature/b");
      expect(context.conflicts).toEqual([]);
      expect(context.mergeResult?.success).toBe(true);
      expect(errorToasts()).toEqual([]);
    });

    it("stays conflicted and toasts when the previous merge is still in progress", async () => {
      await bringToConflicted(actor);
      mocked.mergeBranch.mockClear();

      actor.send({ type: "START_MERGE", sourceBranch: "feature/b" });
      expect(actor.getSnapshot().matches("verifying")).toBe(true);
      await waitFor(actor, (s) => s.matches("conflicted"));

      expect(mocked.mergeBranch).not.toHaveBeenCalled();
      expect(errorToasts()).toEqual([MERGE_IN_PROGRESS_MESSAGE]);
      const { context } = actor.getSnapshot();
      expect(context.sourceBranch).toBe("feature/a");
      expect(context.pendingSourceBranch).toBeNull();
      expect(context.mergeResult?.hasConflicts).toBe(true);
    });
  });

  describe("START_MERGE from error", () => {
    async function bringToError(): Promise<void> {
      mocked.mergeBranch.mockResolvedValue(gitError("boom"));
      actor.send({ type: "START_MERGE", sourceBranch: "feature/a" });
      await waitFor(actor, (s) => s.matches("error"));
    }

    it("starts a new merge when no merge is in progress", async () => {
      await bringToError();
      mocked.mergeBranch.mockResolvedValue(ok(mergeResult()));

      actor.send({ type: "START_MERGE", sourceBranch: "feature/b" });
      await waitFor(actor, (s) => s.matches("idle"));

      expect(mocked.mergeBranch).toHaveBeenLastCalledWith("feature/b");
      expect(actor.getSnapshot().context.error).toBeNull();
    });

    it("returns to error and toasts when a merge is in progress", async () => {
      await bringToError();
      mocked.getMergeStatus.mockResolvedValue(status(true));
      mocked.mergeBranch.mockClear();

      actor.send({ type: "START_MERGE", sourceBranch: "feature/b" });
      await waitFor(actor, (s) => s.matches("error"));

      expect(mocked.mergeBranch).not.toHaveBeenCalled();
      expect(errorToasts()).toEqual([MERGE_IN_PROGRESS_MESSAGE]);
      expect(actor.getSnapshot().context.error).toBe("boom");
    });

    it("keeps RETRY and ABORT behaviour", async () => {
      await bringToError();
      mocked.mergeBranch.mockResolvedValue(ok(mergeResult()));

      actor.send({ type: "RETRY" });
      expect(actor.getSnapshot().value).toBe("merging");
      await waitFor(actor, (s) => s.matches("idle"));

      await bringToError();
      actor.send({ type: "ABORT" });
      expect(actor.getSnapshot().value).toBe("idle");
      expect(actor.getSnapshot().context.error).toBeNull();
    });
  });

  describe("aborting", () => {
    it("aborts the merge, emits merge-abort and returns to idle", async () => {
      await bringToConflicted(actor);
      const onAbort = vi.fn();
      const unsubscribe = gitHookBus.onDid("merge-abort", onAbort, "test");

      actor.send({ type: "ABORT" });
      expect(actor.getSnapshot().value).toBe("aborting");
      await waitFor(actor, (s) => s.matches("idle"));

      expect(mocked.abortMerge).toHaveBeenCalledTimes(1);
      expect(onAbort).toHaveBeenCalledTimes(1);
      expect(actor.getSnapshot().context.sourceBranch).toBeNull();
      unsubscribe();
    });

    it("moves to error when the abort fails", async () => {
      await bringToConflicted(actor);
      mocked.abortMerge.mockResolvedValue(gitError("cannot abort"));

      actor.send({ type: "ABORT" });
      await waitFor(actor, (s) => s.matches("error"));

      expect(actor.getSnapshot().context.error).toBe("cannot abort");
    });
  });
});
