import { assign, setup } from "xstate";
import { abortGitflowOp, executeGitflowOp, refreshAll } from "./actors";
import type { GitflowContext, GitflowEvent } from "./types";

export const gitflowMachine = setup({
  types: {
    context: {} as GitflowContext,
    events: {} as GitflowEvent,
  },
  actors: {
    executeGitflowOp,
    abortGitflowOp,
    refreshAll,
  },
  actions: {
    setStart: assign(({ event }) => {
      if (event.type !== "START") return {};
      return {
        operation: event.operation,
        phase: "start" as const,
        name: event.name,
        tagMessage: null,
        result: null,
        error: null,
        refreshErrors: [],
      };
    }),
    setFinish: assign(({ event }) => {
      if (event.type !== "FINISH") return {};
      return {
        operation: event.operation,
        phase: "finish" as const,
        name: null,
        tagMessage: event.tagMessage ?? null,
        result: null,
        error: null,
        refreshErrors: [],
      };
    }),
    setAbort: assign({
      operation: null,
      phase: null,
      name: null,
      tagMessage: null,
      result: null,
      error: null,
      refreshErrors: [],
    }),
    setError: assign({
      error: "Unknown error",
    }),
    setRefreshError: assign({
      refreshErrors: ["Refresh failed"],
    }),
    clearState: assign({
      operation: null,
      phase: null,
      name: null,
      tagMessage: null,
      result: null,
      error: null,
      refreshErrors: [],
    }),
  },
}).createMachine({
  id: "gitflow",
  initial: "idle",
  context: {
    operation: null,
    phase: null,
    name: null,
    tagMessage: null,
    result: null,
    error: null,
    refreshErrors: [],
  },
  states: {
    idle: {
      on: {
        START: { target: "executing", actions: "setStart" },
        FINISH: { target: "executing", actions: "setFinish" },
        ABORT_GITFLOW: { target: "aborting", actions: "setAbort" },
      },
    },
    executing: {
      invoke: {
        src: "executeGitflowOp",
        input: ({ context }) => ({
          operation: context.operation!,
          phase: context.phase!,
          name: context.name,
          tagMessage: context.tagMessage,
        }),
        onDone: {
          target: "refreshing",
          actions: assign(({ event }) => ({
            result: event.output,
          })),
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
    aborting: {
      invoke: {
        src: "abortGitflowOp",
        onDone: "refreshing",
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
    refreshing: {
      invoke: {
        src: "refreshAll",
        onDone: {
          target: "idle",
          actions: "clearState",
        },
        onError: {
          target: "stale",
          actions: assign(({ event }) => ({
            refreshErrors: [
              event.error instanceof Error
                ? event.error.message
                : "Refresh failed",
            ],
          })),
        },
      },
    },
    stale: {
      // Operation succeeded but refresh failed — data may be outdated
      on: {
        RETRY_REFRESH: "refreshing",
        DISMISS_ERROR: {
          target: "idle",
          actions: "clearState",
        },
      },
    },
    error: {
      on: {
        DISMISS_ERROR: {
          target: "idle",
          actions: "clearState",
        },
      },
    },
  },
});
