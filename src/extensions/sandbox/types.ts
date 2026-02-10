/**
 * Message types for host <-> worker sandbox communication.
 *
 * All messages are JSON-serializable and go through structured clone
 * via postMessage. No functions, DOM nodes, or React elements allowed.
 */

/** Messages sent FROM host TO worker */
export type HostToWorkerMessage =
  | { type: "init"; extensionId: string; code: string }
  | { type: "api-call"; callId: string; method: string; args: unknown[] }
  | { type: "terminate" };

/** Messages sent FROM worker TO host */
export type WorkerToHostMessage =
  | { type: "ready" }
  | { type: "initialized"; extensionId: string }
  | { type: "api-request"; callId: string; method: string; args: unknown[] }
  | { type: "api-response"; callId: string; result?: unknown; error?: string }
  | { type: "error"; message: string };
