import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor as waitForActor } from "xstate";
import { useMergeWorkflow } from "@/core/hooks/useMergeWorkflow";
import {
  getMergeActor,
  MERGE_IN_PROGRESS_MESSAGE,
} from "@/core/machines/merge";
import { toast } from "@/framework/stores/toast";
import type { MergeResult, MergeStatus } from "../../../../bindings";
import { commands } from "../../../../bindings";
import { MergeDialog } from "../MergeDialog";

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

function status(inProgress: boolean, conflictedFiles: string[] = []) {
  return ok({ inProgress, conflictedFiles } satisfies MergeStatus);
}

/**
 * Mirrors how BranchList wires the dialog: the result is only shown when it
 * belongs to the branch open in the dialog, and Merge asks the machine.
 */
function Harness({ branch }: { branch: string }) {
  const { startMerge, mergeResult, sourceBranch } = useMergeWorkflow();
  return (
    <MergeDialog
      sourceBranch={branch}
      result={sourceBranch === branch ? mergeResult : null}
      onConfirm={() => startMerge(branch)}
      onClose={() => {}}
    />
  );
}

const actor = getMergeActor();

/** Leave the singleton machine conflicted on `feature/a`, as after a merge
 *  whose conflicts were never resolved inside the app. */
async function leaveMachineConflicted(): Promise<void> {
  mocked.getMergeStatus.mockResolvedValue(status(false));
  mocked.mergeBranch.mockResolvedValue(
    ok(
      mergeResult({
        success: false,
        commitOid: null,
        hasConflicts: true,
        conflictedFiles: ["a.txt"],
      }),
    ),
  );
  await act(async () => {
    actor.send({ type: "START_MERGE", sourceBranch: "feature/a" });
    await waitForActor(actor, (s) => s.matches("conflicted"));
  });
}

describe("MergeDialog", () => {
  const toastError = vi.spyOn(toast, "error");

  beforeEach(() => {
    vi.clearAllMocks();
    mocked.getMergeStatus.mockResolvedValue(status(false));
    mocked.mergeBranch.mockResolvedValue(ok(mergeResult()));
    mocked.abortMerge.mockResolvedValue(ok(null));
  });

  afterEach(async () => {
    // Bring the singleton back to idle for the next test.
    if (!actor.getSnapshot().matches("idle")) {
      await act(async () => {
        actor.send({ type: "ABORT" });
        await waitForActor(actor, (s) => s.matches("idle"));
      });
    }
  });

  it("shows why Merge is refused when a previous merge is still in progress", async () => {
    await leaveMachineConflicted();
    mocked.getMergeStatus.mockResolvedValue(status(true, ["a.txt"]));
    mocked.mergeBranch.mockClear();

    render(<Harness branch="feature/b" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "A previous merge of feature/a reported conflicts",
    );

    await userEvent.click(screen.getByRole("button", { name: "Merge" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(MERGE_IN_PROGRESS_MESSAGE),
    );
    expect(mocked.mergeBranch).not.toHaveBeenCalled();
    // The dialog is still there, ready for another attempt.
    expect(screen.getByRole("button", { name: "Merge" })).toBeEnabled();
    expect(actor.getSnapshot().matches("conflicted")).toBe(true);
  });

  it("merges when the previous merge was resolved outside the app", async () => {
    await leaveMachineConflicted();
    mocked.getMergeStatus.mockResolvedValue(status(false));
    mocked.mergeBranch.mockResolvedValue(ok(mergeResult()));

    render(<Harness branch="feature/b" />);
    await userEvent.click(screen.getByRole("button", { name: "Merge" }));

    await waitFor(() =>
      expect(mocked.mergeBranch).toHaveBeenCalledWith("feature/b"),
    );
    expect(await screen.findByText("Merge Result")).toBeInTheDocument();
    expect(screen.getByText(/Merged successfully/)).toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows the failure inline and offers a retry when the merge fails", async () => {
    mocked.mergeBranch.mockResolvedValue({
      status: "error",
      error: { type: "Internal", message: "index is locked" },
    });

    // A branch the singleton has not merged yet, so no stale result is shown.
    render(<Harness branch="feature/c" />);
    await userEvent.click(screen.getByRole("button", { name: "Merge" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Merge failed: index is locked",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it("reports a refused start while a merge is already running", async () => {
    let finishMerge: (() => void) | undefined;
    mocked.mergeBranch.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishMerge = () => resolve(ok(mergeResult()));
        }),
    );

    await act(async () => {
      actor.send({ type: "START_MERGE", sourceBranch: "feature/a" });
      await waitForActor(actor, (s) => s.matches("merging"));
    });

    const { result } = renderHook(() => useMergeWorkflow());
    expect(result.current.startMerge("feature/b")).toBe(false);

    await act(async () => {
      finishMerge?.();
      await waitForActor(actor, (s) => s.matches("idle"));
    });
    expect(mocked.mergeBranch).toHaveBeenCalledTimes(1);
  });
});
