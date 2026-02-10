import { isSandboxSafe } from "./sandbox-api-surface";
import type { HostToWorkerMessage, WorkerToHostMessage } from "./types";

/**
 * Host-side bridge for communicating with a sandboxed extension Worker.
 *
 * This is a prototype demonstrating the communication pattern:
 * - Worker creation and lifecycle management
 * - Bidirectional postMessage RPC
 * - API method whitelisting (sandbox-safe only)
 * - Pending call tracking with timeout
 * - Clean termination with pending call rejection
 */
export class SandboxBridge {
  private worker: Worker | null = null;
  private pendingCalls = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private _isRunning = false;
  private readonly callTimeout: number;

  constructor(options?: { callTimeout?: number }) {
    this.callTimeout = options?.callTimeout ?? 5000;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Create and start the Worker from a URL.
   * Resolves when the Worker sends a "ready" message.
   */
  async start(workerUrl: string | URL): Promise<void> {
    if (this._isRunning) {
      throw new Error("SandboxBridge is already running");
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.terminate();
        reject(new Error("Worker failed to start: ready timeout"));
      }, this.callTimeout);

      this.worker = new Worker(workerUrl, { type: "module" });

      this.worker.onmessage = (event: MessageEvent<WorkerToHostMessage>) => {
        const msg = event.data;
        if (msg.type === "ready") {
          clearTimeout(timeout);
          this._isRunning = true;
          // Replace onmessage with the standard handler
          this.worker!.onmessage = this.handleMessage.bind(this);
          resolve();
        }
      };

      this.worker.onerror = (event) => {
        clearTimeout(timeout);
        console.error("[SandboxBridge] Worker error:", event.message);
        reject(new Error(`Worker error: ${event.message}`));
      };
    });
  }

  /**
   * Send an initialization message with extension code to execute.
   */
  async initialize(extensionId: string, code: string): Promise<void> {
    this.assertRunning();
    const msg: HostToWorkerMessage = { type: "init", extensionId, code };
    this.worker!.postMessage(msg);

    // Wait for "initialized" response
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Extension initialization timed out"));
      }, this.callTimeout);

      const worker = this.worker!;
      const originalHandler = worker.onmessage;
      worker.onmessage = (event: MessageEvent<WorkerToHostMessage>) => {
        const msg = event.data;
        if (msg.type === "initialized") {
          clearTimeout(timeout);
          worker.onmessage = originalHandler;
          resolve();
        } else if (msg.type === "error") {
          clearTimeout(timeout);
          worker.onmessage = originalHandler;
          reject(new Error(msg.message));
        } else {
          // Forward other messages to normal handler
          originalHandler?.call(worker, event);
        }
      };
    });
  }

  /**
   * Call a sandbox-safe API method on the Worker side.
   * Throws if the method is not sandbox-safe.
   */
  async callApi(method: string, args: unknown[] = []): Promise<unknown> {
    this.assertRunning();

    if (!isSandboxSafe(method)) {
      throw new Error(
        `Method "${method}" is not sandbox-safe and cannot be called ` +
        `through the sandbox bridge. It requires trust level "built-in" ` +
        `or "user-trusted".`
      );
    }

    const callId = crypto.randomUUID();

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(callId);
        reject(new Error(`API call "${method}" timed out after ${this.callTimeout}ms`));
      }, this.callTimeout);

      this.pendingCalls.set(callId, { resolve, reject, timer });

      const msg: HostToWorkerMessage = {
        type: "api-call",
        callId,
        method,
        args,
      };
      this.worker!.postMessage(msg);
    });
  }

  /**
   * Terminate the Worker and reject all pending calls.
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this._isRunning = false;

    // Reject all pending calls
    for (const [callId, pending] of this.pendingCalls) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Sandbox terminated"));
      this.pendingCalls.delete(callId);
    }
  }

  private handleMessage(event: MessageEvent<WorkerToHostMessage>): void {
    const msg = event.data;

    switch (msg.type) {
      case "api-response": {
        const pending = this.pendingCalls.get(msg.callId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingCalls.delete(msg.callId);
          if (msg.error) {
            pending.reject(new Error(msg.error));
          } else {
            pending.resolve(msg.result);
          }
        }
        break;
      }
      case "error":
        console.error("[SandboxBridge] Worker error:", msg.message);
        break;
      default:
        break;
    }
  }

  private assertRunning(): void {
    if (!this._isRunning || !this.worker) {
      throw new Error("SandboxBridge is not running. Call start() first.");
    }
  }
}
