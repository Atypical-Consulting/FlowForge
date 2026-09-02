import { assign, fromCallback, sendTo, setup } from "xstate";
import { gitHookBus } from "@/core/services/gitHookBus";
import { useGitOpsStore } from "@/core/stores/domain/git-ops";
import { useConflictStore } from "@/extensions/conflict-resolution/store";
import { toast } from "@/framework/stores/toast";
import type { MergeResult, MergeStatus } from "../../../bindings";
import {
  abortMergeActor,
  executeMerge,
  probeMergeStatus,
  probeMergeStatusActor,
} from "./actors";
import type { MergeContext, MergeEvent, MergeVerifyOrigin } from "./types";

export const MERGE_IN_PROGRESS_MESSAGE =
  "A merge is already in progress — resolve or abort it first";

// Internal-only events used by the conflict watcher; not part of the public
// MergeEvent contract that external callers send.
type MergeInternalEvent =
  | MergeEvent
  | { type: "RESOLVED" }
  | { type: "CONFLICTS_CHANGED"; conflicts: string[] };

type WatcherEvent = { type: "CHECK" };

/** Hook-bus operations after which a merge may no longer be in progress. */
const MERGE_ENDING_OPERATIONS = ["commit", "checkout", "merge-abort"] as const;

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

// While conflicted, keep the machine in sync with the repository's real state.
// A merge can end in many ways the app does not drive itself (`git merge
// --abort` or `git commit` in a terminal, a checkout, the conflict resolver
// staging every file), so rather than trusting a single in-app event we
// re-probe the backend whenever something relevant happens and return to idle
// as soon as no merge is in progress any more.
const watchConflictResolution = fromCallback<WatcherEvent>(
  ({ sendBack, receive }) => {
    let disposed = false;
    let latestProbe = 0;

    const check = async () => {
      const probe = ++latestProbe;
      let status: MergeStatus;
      try {
        status = await probeMergeStatus();
      } catch (err) {
        console.warn("[merge-machine] Could not probe merge status:", err);
        return;
      }
      // Only the most recent probe may speak for the repository.
      if (disposed || probe !== latestProbe) return;
      if (status.inProgress) {
        sendBack({
          type: "CONFLICTS_CHANGED",
          conflicts: status.conflictedFiles,
        });
      } else {
        sendBack({ type: "RESOLVED" });
      }
    };

    const unsubscribeHooks = MERGE_ENDING_OPERATIONS.map((operation) =>
      gitHookBus.onDid(
        operation,
        () => {
          void check();
        },
        "merge-machine",
      ),
    );

    // The conflict resolver removes files from the store as they are marked
    // resolved: once the last one is gone there is nothing left to resolve.
    const unsubscribeStore = useConflictStore.subscribe((state, previous) => {
      if (previous.files.size > 0 && state.files.size === 0) {
        sendBack({ type: "RESOLVED" });
      }
    });

    // Forwarded by the machine when the `.git` file watcher fires.
    receive((event) => {
      if (event.type === "CHECK") void check();
    });

    return () => {
      disposed = true;
      for (const unsubscribe of unsubscribeHooks) unsubscribe();
      unsubscribeStore();
    };
  },
);

export const mergeMachine = setup({
  types: {
    context: {} as MergeContext,
    events: {} as MergeInternalEvent,
  },
  actors: {
    executeMerge,
    abortMerge: abortMergeActor,
    probeMergeStatus: probeMergeStatusActor,
    watchConflictResolution,
  },
  guards: {
    hasConflicts: (_, params: { result: MergeResult }) =>
      params.result.hasConflicts,
  },
  actions: {
    // Remember what was asked and where we came from; the request is only
    // honoured once the backend confirms no other merge is in progress.
    requestMerge: assign(
      (_, params: { from: MergeVerifyOrigin; sourceBranch: string }) => ({
        pendingSourceBranch: params.sourceBranch,
        verifyFrom: params.from,
      }),
    ),
    beginPendingMerge: assign(({ context }) => ({
      sourceBranch: context.pendingSourceBranch,
      pendingSourceBranch: null,
      error: null,
      conflicts: [],
      mergeResult: null,
    })),
    clearPendingMerge: assign({ pendingSourceBranch: null }),
    notifyMergeInProgress: () => {
      toast.error(MERGE_IN_PROGRESS_MESSAGE);
    },
    syncConflicts: assign(({ context }, params: { conflicts: string[] }) => {
      if (sameList(context.conflicts, params.conflicts)) return {};
      return {
        conflicts: params.conflicts,
        mergeResult: context.mergeResult
          ? { ...context.mergeResult, conflictedFiles: params.conflicts }
          : null,
      };
    }),
    clearState: assign({
      sourceBranch: null,
      conflicts: [],
      error: null,
      mergeResult: null,
      pendingSourceBranch: null,
    }),
    emitMergeDid: ({ context }) => {
      if (context.sourceBranch) {
        gitHookBus.emitDid("merge", { branchName: context.sourceBranch });
      }
    },
    // Fired after `git merge --abort` succeeded so listeners that track the
    // conflicted state (conflict-resolution badge/list) can clear it. Runs
    // before clearState so the branch name is still available.
    // A merge (started, conflicted or aborted) changes MERGE_HEAD, so the
    // header/commit form must see the new merge state without a manual
    // "Refresh All".
    refreshRepoStatus: () => {
      void useGitOpsStore.getState().refreshRepoStatus();
    },
    emitMergeAbortDid: ({ context }) => {
      gitHookBus.emitDid("merge-abort", {
        branchName: context.sourceBranch ?? undefined,
      });
    },
    recheckMergeStatus: sendTo("watchConflictResolution", { type: "CHECK" }),
  },
}).createMachine({
  id: "merge",
  initial: "idle",
  context: {
    sourceBranch: null,
    conflicts: [],
    error: null,
    mergeResult: null,
    pendingSourceBranch: null,
    verifyFrom: "idle",
  },
  states: {
    idle: {
      on: {
        START_MERGE: {
          target: "verifying",
          actions: {
            type: "requestMerge",
            params: ({ event }) => ({
              from: "idle",
              sourceBranch: event.sourceBranch,
            }),
          },
        },
      },
    },
    // Every START_MERGE goes through here: confirm with the backend that no
    // merge is already in progress before running a new one. If one is, the
    // request is refused loudly (toast) and the machine resumes where it was.
    verifying: {
      invoke: {
        id: "probeMergeStatus",
        src: "probeMergeStatus",
        onDone: [
          {
            guard: ({ context, event }) =>
              event.output.inProgress && context.verifyFrom === "conflicted",
            target: "conflicted",
            actions: [
              "notifyMergeInProgress",
              "clearPendingMerge",
              {
                type: "syncConflicts",
                params: ({ event }) => ({
                  conflicts: event.output.conflictedFiles,
                }),
              },
            ],
          },
          {
            guard: ({ context, event }) =>
              event.output.inProgress && context.verifyFrom === "error",
            target: "error",
            actions: ["notifyMergeInProgress", "clearPendingMerge"],
          },
          {
            guard: ({ event }) => event.output.inProgress,
            target: "idle",
            actions: ["notifyMergeInProgress", "clearPendingMerge"],
          },
          {
            target: "merging",
            actions: "beginPendingMerge",
          },
        ],
        // The probe itself failed (e.g. no repository open): let the merge
        // run and report its own error instead of blocking the user.
        onError: {
          target: "merging",
          actions: "beginPendingMerge",
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
              "refreshRepoStatus",
            ],
          },
          {
            target: "idle",
            // NOTE: do not clearState here — the UI reads context.mergeResult to
            // render the success view. Transient fields are reset when the next
            // merge starts (beginPendingMerge).
            actions: [
              assign(({ event }) => ({
                mergeResult: event.output,
                conflicts: [],
              })),
              "emitMergeDid",
              "refreshRepoStatus",
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
        // A new merge may be requested here: `verifying` decides whether the
        // previous one is really still in progress.
        START_MERGE: {
          target: "verifying",
          actions: {
            type: "requestMerge",
            params: ({ event }) => ({
              from: "conflicted",
              sourceBranch: event.sourceBranch,
            }),
          },
        },
        REPOSITORY_CHANGED: {
          actions: "recheckMergeStatus",
        },
        CONFLICTS_CHANGED: {
          actions: {
            type: "syncConflicts",
            params: ({ event }) => ({ conflicts: event.conflicts }),
          },
        },
        // The merge is no longer in progress (committed, aborted, resolved,
        // checked out...) → return to idle.
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
          actions: ["emitMergeAbortDid", "clearState", "refreshRepoStatus"],
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
        START_MERGE: {
          target: "verifying",
          actions: {
            type: "requestMerge",
            params: ({ event }) => ({
              from: "error",
              sourceBranch: event.sourceBranch,
            }),
          },
        },
        ABORT: {
          target: "idle",
          actions: "clearState",
        },
      },
    },
  },
});
