import { describe, expect, it, vi } from "vitest";
import { OperationBus } from "./operationBus";

type TestOp = "a" | "b";
interface TestCtx {
  operation: TestOp;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("OperationBus", () => {
  it("invokes registered onDid handlers with the full context", async () => {
    const bus = new OperationBus<TestOp, TestCtx>("TestBus");
    const handler = vi.fn();
    bus.onDid("a", handler, "src");

    await bus.emitDid("a");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ operation: "a" });
  });

  it("does not suppress concurrent emits for DIFFERENT operations", async () => {
    const bus = new OperationBus<TestOp, TestCtx>("TestBus");
    const aHandler = vi.fn(() => flush());
    const bHandler = vi.fn(() => flush());
    bus.onDid("a", aHandler, "srcA");
    bus.onDid("b", bHandler, "srcB");

    // Start emit for "a" (its async handler is still in flight) then emit "b"
    // before "a" settles. The per-operation guard must NOT drop "b".
    const aPromise = bus.emitDid("a");
    const bPromise = bus.emitDid("b");

    await Promise.all([aPromise, bPromise]);

    expect(aHandler).toHaveBeenCalledTimes(1);
    expect(bHandler).toHaveBeenCalledTimes(1);
  });

  it("suppresses nested re-entry of the SAME operation", async () => {
    const bus = new OperationBus<TestOp, TestCtx>("TestBus");
    const handler = vi.fn(async () => {
      // Re-trigger the same operation from within its own handler.
      await bus.emitDid("a");
    });
    bus.onDid("a", handler, "src");

    await bus.emitDid("a");

    // Only the outer emit runs; the nested same-op emit is suppressed.
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("releases the in-flight guard after handlers settle, allowing later same-op emits", async () => {
    const bus = new OperationBus<TestOp, TestCtx>("TestBus");
    const handler = vi.fn(() => flush());
    bus.onDid("a", handler, "src");

    await bus.emitDid("a");
    await bus.emitDid("a");

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("cancels via onWill when a handler vetoes", async () => {
    const bus = new OperationBus<TestOp, TestCtx>("TestBus");
    bus.onWill("a", () => ({ cancel: true, reason: "no" }), "src");

    const result = await bus.emitWill("a");

    expect(result.cancel).toBe(true);
    expect(result.reason).toBe("no");
  });
});
