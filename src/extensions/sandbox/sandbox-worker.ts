/**
 * Sandbox Worker entry point.
 *
 * This runs inside a Web Worker with no access to:
 * - DOM (no document, no window)
 * - Tauri IPC (no window.__TAURI_INTERNALS__)
 * - React runtime
 * - Zustand stores
 *
 * Communication with the host thread is exclusively via postMessage.
 */
import type { HostToWorkerMessage, WorkerToHostMessage } from "./types";

// Signal readiness to host
// Use Worker global scope — DedicatedWorkerGlobalScope type isn't available
// in the main tsconfig (DOM lib), so we cast through unknown.
const ctx = self as unknown as {
  postMessage: (msg: WorkerToHostMessage) => void;
  onmessage: ((event: MessageEvent<HostToWorkerMessage>) => void) | null;
  close: () => void;
};

function send(msg: WorkerToHostMessage): void {
  ctx.postMessage(msg);
}

// Send ready signal
send({ type: "ready" });

ctx.onmessage = (event: MessageEvent<HostToWorkerMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case "init": {
      try {
        // In a real implementation, this would evaluate the extension code.
        // For the prototype, we just acknowledge initialization.
        // The 'code' parameter would be evaluated in a restricted scope.
        send({ type: "initialized", extensionId: msg.extensionId });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
      break;
    }

    case "api-call": {
      try {
        // Prototype: echo the method and args back as a successful response.
        // In a real implementation, this would dispatch to the sandboxed
        // extension's registered handlers.
        send({
          type: "api-response",
          callId: msg.callId,
          result: {
            method: msg.method,
            args: msg.args,
            handled: true,
          },
        });
      } catch (err) {
        send({
          type: "api-response",
          callId: msg.callId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      break;
    }

    case "terminate": {
      // Clean up and close
      ctx.close();
      break;
    }
  }
};
