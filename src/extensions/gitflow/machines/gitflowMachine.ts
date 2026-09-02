import { assign, setup } from "xstate";
import { toast } from "@/framework/stores/toast";
import { abortGitflowOp, executeGitflowOp, refreshAll } from "./actors";
import { describeGitflowSuccess } from "./messages";
import type { GitflowContext, GitflowEvent } from "./types";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

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
        name: event.name ?? null,
        tagMessage: event.tagMessage ?? null,
        result: null,
        error: null,
        refreshErrors: [],
      };
    }),
    setAbort: assign(({ event }) => {
      if (event.type !== "ABORT_GITFLOW") return {};
      return {
        operation: event.operation ?? null,
        phase: null,
        name: event.name ?? null,
        tagMessage: null,
        result: null,
        error: null,
        refreshErrors: [],
      };
    }),
    // The machine is a module-level singleton shared by the panel and the
    // dialogs, so it is the one place that reliably sees every outcome —
    // toasts are emitted here rather than from whichever component happened
    // to send the event (the dialog may already be unmounted by then).
    notifySuccess: ({ context }) => {
      toast.success(describeGitflowSuccess(context));
    },
    notifyError: ({ context }) => {
      if (context.error) toast.error(context.error);
    },
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
  // Operations may be (re)started from idle, and from error/stale so the
  // user can retry after fixing the cause (e.g. committing a dirty tree).
  on: {
    START: { target: ".executing", actions: "setStart" },
    FINISH: { target: ".executing", actions: "setFinish" },
    ABORT_GITFLOW: { target: ".aborting", actions: "setAbort" },
  },
  states: {
    idle: {},
    executing: {
      // A running operation must not be interrupted by a new one.
      on: { START: {}, FINISH: {}, ABORT_GITFLOW: {} },
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
          actions: [
            assign(({ event }) => ({ result: event.output })),
            "notifySuccess",
          ],
        },
        onError: {
          target: "error",
          actions: [
            assign(({ event }) => ({ error: errorMessage(event.error) })),
            "notifyError",
          ],
        },
      },
    },
    aborting: {
      on: { START: {}, FINISH: {}, ABORT_GITFLOW: {} },
      invoke: {
        src: "abortGitflowOp",
        onDone: {
          target: "refreshing",
          actions: "notifySuccess",
        },
        onError: {
          target: "error",
          actions: [
            assign(({ event }) => ({ error: errorMessage(event.error) })),
            "notifyError",
          ],
        },
      },
    },
    refreshing: {
      on: { START: {}, FINISH: {}, ABORT_GITFLOW: {} },
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
