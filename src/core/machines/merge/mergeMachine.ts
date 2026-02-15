import { setup, assign } from "xstate";
import type { MergeResult } from "../../../bindings";
import { gitHookBus } from "@/core/services/gitHookBus";
import type { MergeContext, MergeEvent } from "./types";
import { executeMerge, abortMergeActor } from "./actors";

export const mergeMachine = setup({
  types: {
    context: {} as MergeContext,
    events: {} as MergeEvent,
  },
  actors: {
    executeMerge,
    abortMerge: abortMergeActor,
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
            actions: [
              assign(({ event }) => ({
                mergeResult: event.output,
                conflicts: [],
              })),
              "emitMergeDid",
              "clearState",
            ],
          },
        ],
        onError: {
          target: "error",
          actions: assign(({ event }) => ({
            error: event.error instanceof Error
              ? event.error.message
              : "Unknown error",
          })),
        },
      },
    },
    conflicted: {
      on: {
        ABORT: "aborting",
      },
    },
    aborting: {
      invoke: {
        src: "abortMerge",
        onDone: {
          target: "idle",
          actions: "clearState",
        },
        onError: {
          target: "error",
          actions: assign(({ event }) => ({
            error: event.error instanceof Error
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
