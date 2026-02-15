import { OperationBus, type GitOperation, type GitHookContext } from "@/framework/extension-system/operationBus";

describe("GitHookBus (OperationBus)", () => {
  let bus: OperationBus<GitOperation, GitHookContext>;

  beforeEach(() => {
    bus = new OperationBus<GitOperation, GitHookContext>("GitHookBus");
  });

  it("emitDid fires registered onDid handler with correct context", async () => {
    const handler = vi.fn();
    bus.onDid("commit", handler, "core");

    await bus.emitDid("commit", { commitMessage: "test" });
    expect(handler).toHaveBeenCalledWith({
      operation: "commit",
      commitMessage: "test",
    });
  });

  it("unsubscribe function removes handler", async () => {
    const handler = vi.fn();
    const unsub = bus.onDid("push", handler, "core");

    unsub();
    await bus.emitDid("push");
    expect(handler).not.toHaveBeenCalled();
  });

  it("emitDid isolates handler errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const goodHandler = vi.fn();
    const badHandler = vi.fn(() => {
      throw new Error("boom");
    });

    bus.onDid("fetch", badHandler, "bad-ext");
    bus.onDid("fetch", goodHandler, "good-ext");

    await bus.emitDid("fetch");
    expect(goodHandler).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("emitWill runs handlers sequentially by priority", async () => {
    const order: string[] = [];
    bus.onWill(
      "merge",
      () => {
        order.push("low");
      },
      "low-ext",
      10,
    );
    bus.onWill(
      "merge",
      () => {
        order.push("high");
      },
      "high-ext",
      100,
    );

    await bus.emitWill("merge");
    expect(order).toEqual(["high", "low"]);
  });

  it("emitWill returns cancel result when handler cancels", async () => {
    bus.onWill(
      "push",
      () => ({ cancel: true, reason: "not ready" }),
      "guard",
      100,
    );

    const result = await bus.emitWill("push");
    expect(result.cancel).toBe(true);
    expect(result.reason).toBe("not ready");
  });

  it("emitWill fails open on handler error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    bus.onWill(
      "checkout",
      () => {
        throw new Error("oops");
      },
      "buggy",
    );

    const result = await bus.emitWill("checkout");
    expect(result.cancel).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("removeBySource removes handlers for specific source", async () => {
    const handler = vi.fn();
    bus.onDid("stash", handler, "ext:remove-me");
    bus.removeBySource("ext:remove-me");

    await bus.emitDid("stash");
    expect(handler).not.toHaveBeenCalled();
  });

  it("re-entrancy guard suppresses nested emitDid calls", async () => {
    const innerHandler = vi.fn();
    bus.onDid("commit", innerHandler, "inner");

    // Register a handler that tries to emit again
    bus.onDid(
      "push",
      async () => {
        await bus.emitDid("commit", { commitMessage: "nested" });
      },
      "outer",
    );

    await bus.emitDid("push");
    // The nested emitDid("commit") should have been suppressed
    expect(innerHandler).not.toHaveBeenCalled();
  });
});
