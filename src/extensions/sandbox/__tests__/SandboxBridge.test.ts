/**
 * SandboxBridge tests using mock Worker objects.
 *
 * @vitest/web-worker's Blob URL workers don't work in jsdom,
 * so we mock the Worker constructor to test the bridge protocol directly.
 * This validates: ready handshake, API call/response, method blocking,
 * termination, and double-start prevention.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SandboxBridge } from "../SandboxBridge";
import type { HostToWorkerMessage, WorkerToHostMessage } from "../types";

// ---------------------------------------------------------------------------
// MockWorker: simulates a Web Worker for testing the bridge protocol
// ---------------------------------------------------------------------------

type OnMessageHandler = ((event: MessageEvent) => void) | null;

class MockWorker {
  onmessage: OnMessageHandler = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  private messageHandler: ((msg: HostToWorkerMessage) => void) | null = null;

  constructor(_url: string | URL, _opts?: WorkerOptions) {
    // Register in the global mock so tests can configure behavior
    MockWorker.lastInstance = this;
  }

  static lastInstance: MockWorker | null = null;

  /** Simulate the Worker sending a message to the host */
  simulateSend(msg: WorkerToHostMessage): void {
    const event = new MessageEvent("message", { data: msg });
    this.onmessage?.(event);
  }

  /** Simulate a Worker error */
  simulateError(message: string): void {
    const event = new ErrorEvent("error", { message });
    this.onerror?.(event);
  }

  /** Set a handler for messages the bridge sends to the Worker */
  onReceive(handler: (msg: HostToWorkerMessage) => void): void {
    this.messageHandler = handler;
  }

  postMessage(msg: HostToWorkerMessage): void {
    // Deliver asynchronously to match real Worker behavior
    queueMicrotask(() => this.messageHandler?.(msg));
  }

  terminate(): void {
    this.onmessage = null;
    this.onerror = null;
    this.messageHandler = null;
  }
}

// ---------------------------------------------------------------------------
// Test setup: replace global Worker with MockWorker
// ---------------------------------------------------------------------------

const OriginalWorker = globalThis.Worker;

beforeEach(() => {
  MockWorker.lastInstance = null;
  (globalThis as any).Worker = MockWorker;
});

afterEach(() => {
  (globalThis as any).Worker = OriginalWorker;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SandboxBridge", () => {
  let bridge: SandboxBridge;

  beforeEach(() => {
    bridge = new SandboxBridge({ callTimeout: 2000 });
  });

  afterEach(() => {
    bridge.terminate();
  });

  it("creates worker and receives ready handshake", async () => {
    const startPromise = bridge.start("worker://test");
    const worker = MockWorker.lastInstance!;

    // Worker sends ready
    worker.simulateSend({ type: "ready" });

    await startPromise;
    expect(bridge.isRunning).toBe(true);
  });

  it("rejects if worker does not send ready within timeout", async () => {
    vi.useFakeTimers();

    const startPromise = bridge.start("worker://test");
    // Do NOT send ready — let the timeout fire
    vi.advanceTimersByTime(2100);

    await expect(startPromise).rejects.toThrow("ready timeout");
    expect(bridge.isRunning).toBe(false);

    vi.useRealTimers();
  });

  it("sends api-call and receives api-response", async () => {
    const startPromise = bridge.start("worker://test");
    const worker = MockWorker.lastInstance!;
    worker.simulateSend({ type: "ready" });
    await startPromise;

    // Set up the worker to echo api-calls back as responses
    worker.onReceive((msg) => {
      if (msg.type === "api-call") {
        worker.simulateSend({
          type: "api-response",
          callId: msg.callId,
          result: { echo: msg.method },
        });
      }
    });

    const result = await bridge.callApi("onDidGit", ["commit"]);
    expect(result).toEqual({ echo: "onDidGit" });
  });

  it("blocks requires-trust methods", async () => {
    const startPromise = bridge.start("worker://test");
    const worker = MockWorker.lastInstance!;
    worker.simulateSend({ type: "ready" });
    await startPromise;

    await expect(bridge.callApi("registerBlade", [])).rejects.toThrow(
      "not sandbox-safe",
    );
    await expect(bridge.callApi("contributeToolbar", [])).rejects.toThrow(
      "not sandbox-safe",
    );
    await expect(bridge.callApi("registerCommand", [])).rejects.toThrow(
      "not sandbox-safe",
    );
    await expect(bridge.callApi("contributeContextMenu", [])).rejects.toThrow(
      "not sandbox-safe",
    );
    await expect(bridge.callApi("contributeSidebarPanel", [])).rejects.toThrow(
      "not sandbox-safe",
    );
    await expect(bridge.callApi("contributeStatusBar", [])).rejects.toThrow(
      "not sandbox-safe",
    );
  });

  it("allows all sandbox-safe methods", async () => {
    const startPromise = bridge.start("worker://test");
    const worker = MockWorker.lastInstance!;
    worker.simulateSend({ type: "ready" });
    await startPromise;

    worker.onReceive((msg) => {
      if (msg.type === "api-call") {
        worker.simulateSend({
          type: "api-response",
          callId: msg.callId,
          result: { method: msg.method },
        });
      }
    });

    const r1 = await bridge.callApi("onDidGit", []);
    expect(r1).toEqual({ method: "onDidGit" });

    const r2 = await bridge.callApi("onWillGit", []);
    expect(r2).toEqual({ method: "onWillGit" });

    const r3 = await bridge.callApi("onDispose", []);
    expect(r3).toEqual({ method: "onDispose" });
  });

  it("terminate rejects pending calls", async () => {
    const startPromise = bridge.start("worker://test");
    const worker = MockWorker.lastInstance!;
    worker.simulateSend({ type: "ready" });
    await startPromise;

    // Worker never responds to this call
    const callPromise = bridge.callApi("onDispose", []);
    bridge.terminate();

    await expect(callPromise).rejects.toThrow("Sandbox terminated");
    expect(bridge.isRunning).toBe(false);
  });

  it("throws when calling api before start", async () => {
    await expect(bridge.callApi("onDidGit", [])).rejects.toThrow("not running");
  });

  it("throws when starting twice", async () => {
    const startPromise = bridge.start("worker://test");
    const worker = MockWorker.lastInstance!;
    worker.simulateSend({ type: "ready" });
    await startPromise;

    await expect(bridge.start("worker://test2")).rejects.toThrow(
      "already running",
    );
  });

  it("handles api-response errors from worker", async () => {
    const startPromise = bridge.start("worker://test");
    const worker = MockWorker.lastInstance!;
    worker.simulateSend({ type: "ready" });
    await startPromise;

    worker.onReceive((msg) => {
      if (msg.type === "api-call") {
        worker.simulateSend({
          type: "api-response",
          callId: msg.callId,
          error: "handler threw an error",
        });
      }
    });

    await expect(bridge.callApi("onDidGit", [])).rejects.toThrow(
      "handler threw an error",
    );
  });
});
