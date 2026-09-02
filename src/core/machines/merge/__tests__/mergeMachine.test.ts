import { beforeEach, describe, expect, it, vi } from "vitest";
import { createActor, waitFor } from "xstate";
import type { MergeResult } from "../../../../bindings";
import { ok } from "../../../test-utils/mocks/tauri-commands";

const mockCommands = vi.hoisted(() => ({
  mergeBranch: vi.fn(),
  abortMerge: vi.fn(),
}));

vi.mock("../../../../bindings", () => ({ commands: mockCommands }));

import { gitHookBus } from "../../../services/gitHookBus";
import { mergeMachine } from "../mergeMachine";

const conflictedResult: MergeResult = {
  success: false,
  analysis: "normal",
  commitOid: null,
  fastForwarded: false,
  hasConflicts: true,
  conflictedFiles: ["README.md"],
};

describe("mergeMachine git hook events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommands.mergeBranch.mockResolvedValue(ok(conflictedResult));
    mockCommands.abortMerge.mockResolvedValue(ok(null));
  });

  it("emits merge-abort after a successful abort so listeners can clear conflict state", async () => {
    const onMerge = vi.fn();
    const onAbort = vi.fn();
    const unsubMerge = gitHookBus.onDid("merge", onMerge, "test");
    const unsubAbort = gitHookBus.onDid("merge-abort", onAbort, "test");

    const actor = createActor(mergeMachine).start();
    actor.send({ type: "START_MERGE", sourceBranch: "conflict-a" });
    await waitFor(actor, (snap) => snap.matches("conflicted"));
    expect(onMerge).toHaveBeenCalledTimes(1);
    expect(onAbort).not.toHaveBeenCalled();

    actor.send({ type: "ABORT" });
    await waitFor(actor, (snap) => snap.matches("idle"));

    expect(mockCommands.abortMerge).toHaveBeenCalledTimes(1);
    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(onAbort.mock.calls[0][0]).toMatchObject({
      operation: "merge-abort",
      branchName: "conflict-a",
    });
    expect(actor.getSnapshot().context.conflicts).toEqual([]);

    actor.stop();
    unsubMerge();
    unsubAbort();
  });
});
