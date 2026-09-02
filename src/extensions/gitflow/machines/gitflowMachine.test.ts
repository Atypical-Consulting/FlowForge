import { createActor, waitFor } from "xstate";
import {
  gitflowErr,
  gitflowOk,
} from "../../../core/test-utils/mocks/tauri-commands";

const mockCommands = vi.hoisted(() => ({
  startFeature: vi.fn(),
  finishFeature: vi.fn(),
  finishRelease: vi.fn(),
  abortGitflow: vi.fn(),
}));
const mockRefresh = vi.hoisted(() => ({ refreshRepositoryState: vi.fn() }));
const mockToast = vi.hoisted(() => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../../bindings", () => ({ commands: mockCommands }));
vi.mock("../../../core/lib/repositoryRefresh", () => mockRefresh);
vi.mock("@/framework/stores/toast", () => mockToast);

import { gitflowMachine } from "./gitflowMachine";

const DIRTY_TREE_MESSAGE =
  "You have uncommitted changes. Commit or stash them before running this Gitflow operation.";

function startActor() {
  const actor = createActor(gitflowMachine);
  actor.start();
  return actor;
}

const settled = (actor: ReturnType<typeof startActor>) =>
  waitFor(
    actor,
    (snap) =>
      snap.matches("idle") || snap.matches("error") || snap.matches("stale"),
  );

describe("gitflowMachine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefresh.refreshRepositoryState.mockResolvedValue(undefined);
  });

  it("enters error with the mapped dirty-tree message and toasts it when finishFeature is refused", async () => {
    mockCommands.finishFeature.mockResolvedValue(
      gitflowErr({ type: "DirtyWorkingTree" }),
    );
    const actor = startActor();

    actor.send({ type: "FINISH", operation: "feature", name: "ui-test" });
    expect(actor.getSnapshot().matches("executing")).toBe(true);

    const snap = await settled(actor);
    expect(snap.matches("error")).toBe(true);
    expect(snap.context.error).toBe(DIRTY_TREE_MESSAGE);
    expect(mockToast.toast.error).toHaveBeenCalledWith(DIRTY_TREE_MESSAGE);
    expect(mockToast.toast.success).not.toHaveBeenCalled();
    expect(mockRefresh.refreshRepositoryState).not.toHaveBeenCalled();
  });

  it("toasts a success message, refreshes and returns to idle when finishFeature succeeds", async () => {
    mockCommands.finishFeature.mockResolvedValue(gitflowOk(null));
    const actor = startActor();

    actor.send({ type: "FINISH", operation: "feature", name: "ui-test" });
    const snap = await settled(actor);

    expect(snap.matches("idle")).toBe(true);
    expect(snap.context.error).toBeNull();
    expect(mockToast.toast.success).toHaveBeenCalledWith(
      "Finished feature ui-test into develop",
    );
    expect(mockRefresh.refreshRepositoryState).toHaveBeenCalledTimes(1);
  });

  it("mentions the created tag when finishing a release", async () => {
    mockCommands.finishRelease.mockResolvedValue(gitflowOk("v1.2.0"));
    const actor = startActor();

    actor.send({ type: "FINISH", operation: "release", name: "1.2.0" });
    await settled(actor);

    expect(mockCommands.finishRelease).toHaveBeenCalledWith(null);
    expect(mockToast.toast.success).toHaveBeenCalledWith(
      "Finished release 1.2.0 into main and develop, tagged v1.2.0",
    );
  });

  it("toasts start and abort outcomes", async () => {
    mockCommands.startFeature.mockResolvedValue(gitflowOk("feature/payments"));
    mockCommands.abortGitflow.mockResolvedValue(
      gitflowErr({
        type: "CheckoutWouldOverwriteChanges",
        data: "develop",
      }),
    );
    const actor = startActor();

    actor.send({ type: "START", operation: "feature", name: "payments" });
    await settled(actor);
    expect(mockToast.toast.success).toHaveBeenCalledWith(
      "Started feature payments — now on feature/payments",
    );

    actor.send({
      type: "ABORT_GITFLOW",
      operation: "feature",
      name: "payments",
    });
    const snap = await settled(actor);
    expect(snap.matches("error")).toBe(true);
    expect(snap.context.error).toBe(
      "You have uncommitted changes that would be overwritten by switching to 'develop'. Commit or stash them first.",
    );
    expect(mockToast.toast.error).toHaveBeenCalledWith(snap.context.error);
  });

  it("allows retrying an operation from the error state and dismissing it", async () => {
    mockCommands.finishFeature.mockResolvedValueOnce(
      gitflowErr({ type: "DirtyWorkingTree" }),
    );
    const actor = startActor();

    actor.send({ type: "FINISH", operation: "feature", name: "ui-test" });
    expect((await settled(actor)).matches("error")).toBe(true);

    // Retry after the user committed their changes
    mockCommands.finishFeature.mockResolvedValueOnce(gitflowOk(null));
    actor.send({ type: "FINISH", operation: "feature", name: "ui-test" });
    expect(actor.getSnapshot().matches("executing")).toBe(true);
    expect(actor.getSnapshot().context.error).toBeNull();
    expect((await settled(actor)).matches("idle")).toBe(true);

    // Dismiss clears a failure
    mockCommands.finishFeature.mockResolvedValueOnce(
      gitflowErr({ type: "DirtyWorkingTree" }),
    );
    actor.send({ type: "FINISH", operation: "feature", name: "ui-test" });
    await settled(actor);
    actor.send({ type: "DISMISS_ERROR" });
    expect(actor.getSnapshot().matches("idle")).toBe(true);
    expect(actor.getSnapshot().context.error).toBeNull();
  });

  it("ignores new operations while one is in flight", async () => {
    let resolveFinish: (value: unknown) => void = () => {};
    mockCommands.finishFeature.mockReturnValue(
      new Promise((resolve) => {
        resolveFinish = resolve;
      }),
    );
    const actor = startActor();

    actor.send({ type: "FINISH", operation: "feature", name: "ui-test" });
    actor.send({ type: "START", operation: "feature", name: "other" });
    expect(actor.getSnapshot().matches("executing")).toBe(true);
    expect(actor.getSnapshot().context.phase).toBe("finish");

    resolveFinish(gitflowOk(null));
    await settled(actor);
    expect(mockCommands.startFeature).not.toHaveBeenCalled();
  });
});
