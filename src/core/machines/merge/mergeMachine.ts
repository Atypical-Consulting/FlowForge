import { assign, fromCallback, setup } from "xstate";
import { gitHookBus } from "@/core/services/gitHookBus";
import type { MergeResult } from "../../../bindings";
import { abortMergeActor, executeMerge } from "./actors";
import type { MergeContext, MergeEvent } from "./types";

// Internal-only event used by the conflict watcher; not part of the public
// MergeEvent contract that external callers send.
type MergeInternalEvent = MergeEvent | { type: "RESOLVED" };

// While conflicted, watch the git hook bus: once the user stages and commits
// their manual resolution, return the machine to idle so subsequent merges work
// and the stale conflict/abort UI clears.
const watchConflictResolution = fromCallback(({ sendBack }) => {
  const unsubscribe = gitHookBus.onDid(
    "commit",
    () => sendBack({ type: "RESOLVED" }),
    "merge-machine",
  );
  return unsubscribe;
});

export const mergeMachine = setup({
  types: {
    context: {} as MergeContext,
    events: {} as MergeInternalEvent,
  },
  actors: {
    executeMerge,
    abortMerge: abortMergeActor,
    watchConflictResolution,
  },
  guards: {
    hasConflicts: (_, params: { result: MergeResult }) =>
      params.result.hasConflicts,
  },
  actions: {
    setSourceBranch: assign(({ event }) => {
      if (event.type !== "START_MERGE") return {};
      return { sourceBranch: event.sourceBranch, error: null };
    }),
    clearState: assign({
      sourceBranch: null,
      conflicts: [],
      error: null,
      mergeResult: null,
    }),
    emitMergeDid: ({ context }) => {
      if (context.sourceBranch) {
        gitHookBus.emitDid("merge", { branchName: context.sourceBranch });
      }
    },
    // Fired after `git merge --abort` succeeded so listeners that track the
    // conflicted state (conflict-resolution badge/list) can clear it. Runs
    // before clearState so the branch name is still available.
    emitMergeAbortDid: ({ context }) => {
      gitHookBus.emitDid("merge-abort", {
        branchName: context.sourceBranch ?? undefined,
      });
    },
  },
}).createMachine({
  id: "merge",
  initial: "idle",
  context: {
    sourceBranch: null,
    conflicts: [],
    error: null,
    mergeResult: null,
  },
  states: {
    idle: {
      on: {
        START_MERGE: {
          target: "merging",
          actions: "setSourceBranch",
        },
      },
    },
    merging: {
      invoke: {
        id: "executeMerge",
        src: "executeMerge",
        input: ({ context }) => ({ sourceBranch: context.sourceBranch! }),
        onDone: [
          {
            guard: {
              type: "hasConflicts",
              params: ({ event }) => ({ result: event.output }),
            },
            target: "conflicted",
            actions: [
              assign(({ event }) => {
                const result = event.output;
                return {
                  mergeResult: result,
                  conflicts: result.conflictedFiles ?? [],
                };
              }),
              "emitMergeDid",
            ],
          },
          {
            target: "idle",
            // NOTE: do not clearState here — the UI reads context.mergeResult to
            // render the success view. Transient fields are reset on the next
            // START_MERGE (setSourceBranch) or when the dialog is closed.
            actions: [
              assign(({ event }) => ({
                mergeResult: event.output,
                conflicts: [],
              })),
              "emitMergeDid",
            ],
          },
        ],
        onError: {
          target: "error",
          actions: assign(({ event }) => ({
            error:
              event.error instanceof Error
                ? event.error.message
                : "Unknown error",
          })),
        },
      },
    },
    conflicted: {
      invoke: {
        id: "watchConflictResolution",
        src: "watchConflictResolution",
      },
      on: {
        ABORT: "aborting",
        // User manually resolved conflicts and committed → return to idle.
        RESOLVED: {
          target: "idle",
          actions: "clearState",
        },
      },
    },
    aborting: {
      invoke: {
        src: "abortMerge",
        onDone: {
          target: "idle",
          actions: ["emitMergeAbortDid", "clearState"],
        },
        onError: {
          target: "error",
          actions: assign(({ event }) => ({
            error:
              event.error instanceof Error
                ? event.error.message
                : "Unknown error",
          })),
        },
      },
    },
    error: {
      on: {
        RETRY: "merging",
        ABORT: {
          target: "idle",
          actions: "clearState",
        },
      },
    },
  },
});
